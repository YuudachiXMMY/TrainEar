"use strict";
/* 账号体系：
   - 注册：用户名 + 邮箱 + 密码 → 给邮箱发 6 位验证码 → 验证后账号生效并建立会话
   - 登录：用户名(或邮箱) + 密码；或 邮箱验证码
   - 会话：httpOnly cookie，30 天滑动过期
   邮件：配置了 SMTP_* 环境变量就真发；没配置则验证码打印在服务器终端（本地开发模式）。 */
const crypto = require("crypto");
const express = require("express");
const { db } = require("./db");

const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;

/* ---------- 邮件 ---------- */
let mailer = null;
function mailMode(){ return process.env.SMTP_HOST ? "smtp" : "console"; }
function getMailer(){
  if(!mailer){
    const nodemailer = require("nodemailer");
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "1",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }
  return mailer;
}
async function sendCode(email, code, purpose){
  const subject = purpose === "verify" ? "练耳训练器注册验证码" : "练耳训练器登录验证码";
  if(mailMode() === "smtp"){
    await getMailer().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email, subject,
      text: `你的验证码是 ${code}，10 分钟内有效。`
    });
  }else{
    console.log(`\n[MAIL:console] ${subject} → ${email}  验证码: ${code}  (10 分钟有效)\n`);
  }
}

/* ---------- 密码与令牌 ---------- */
function hashPassword(password, salt){
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function sha256(s){ return crypto.createHash("sha256").update(s).digest("hex"); }
function newToken(){ return crypto.randomBytes(32).toString("hex"); }
function genCode(){ return String(crypto.randomInt(0, 1000000)).padStart(6, "0"); }

/* ---------- 会话 ---------- */
// SECURE_COOKIES=1 时给会话 cookie 加 Secure（HTTPS 反代部署用）
function cookieFlags(){
  return "Path=/; HttpOnly; SameSite=Lax" + (process.env.SECURE_COOKIES === "1" ? "; Secure" : "");
}
function createSession(res, userId){
  const token = newToken();
  const expires = Date.now() + SESSION_DAYS * 86400e3;
  db.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES(?,?,?)").run(token, userId, expires);
  res.setHeader("Set-Cookie",
    `sid=${token}; ${cookieFlags()}; Max-Age=${SESSION_DAYS * 86400}`);
  return token;
}
function clearSession(req, res){
  const sid = readSid(req);
  if(sid) db.prepare("DELETE FROM sessions WHERE token=?").run(sid);
  res.setHeader("Set-Cookie", `sid=; ${cookieFlags()}; Max-Age=0`);
}
function readSid(req){
  const c = req.headers.cookie || "";
  const m = c.match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  return m ? m[1] : null;
}
function sessionMiddleware(req, res, next){
  req.user = null;
  const sid = readSid(req);
  if(sid){
    const row = db.prepare(
      `SELECT s.token, s.expires_at, u.id, u.username, u.email, u.verified
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=?`).get(sid);
    if(row && row.expires_at > Date.now()){
      req.user = { id: row.id, username: row.username, email: row.email, verified: !!row.verified };
      // 滑动续期（每天最多写一次）
      if(row.expires_at - Date.now() < (SESSION_DAYS - 1) * 86400e3){
        db.prepare("UPDATE sessions SET expires_at=? WHERE token=?")
          .run(Date.now() + SESSION_DAYS * 86400e3, sid);
      }
    }else if(row){
      db.prepare("DELETE FROM sessions WHERE token=?").run(sid);
    }
  }
  next();
}
function requireAuth(req, res, next){
  if(!req.user) return res.status(401).json({ error: "未登录" });
  next();
}

/* ---------- 简易限速（内存桶，防脚本乱撞） ---------- */
const buckets = new Map();
function rateLimit(key, max, windowMs){
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if(now > b.reset){ b.n = 0; b.reset = now + windowMs; }
  b.n++; buckets.set(key, b);
  return b.n <= max;
}

/* ---------- 验证码 ---------- */
async function issueCode(email, purpose){
  db.prepare("DELETE FROM codes WHERE email=? AND purpose=?").run(email, purpose);
  const code = genCode();
  db.prepare("INSERT INTO codes(email, code_hash, purpose, expires_at) VALUES(?,?,?,?)")
    .run(email, sha256(code), purpose, Date.now() + CODE_TTL_MS);
  await sendCode(email, code, purpose);
}
function checkCode(email, purpose, code){
  const row = db.prepare("SELECT * FROM codes WHERE email=? AND purpose=?").get(email, purpose);
  if(!row) return "验证码不存在，请重新获取";
  if(row.expires_at < Date.now()){ db.prepare("DELETE FROM codes WHERE id=?").run(row.id); return "验证码已过期"; }
  if(row.attempts >= 5){ db.prepare("DELETE FROM codes WHERE id=?").run(row.id); return "尝试次数过多，请重新获取"; }
  if(row.code_hash !== sha256(String(code || ""))){
    db.prepare("UPDATE codes SET attempts=attempts+1 WHERE id=?").run(row.id);
    return "验证码不正确";
  }
  db.prepare("DELETE FROM codes WHERE id=?").run(row.id);
  return null;
}

/* ---------- 路由 ---------- */
const router = express.Router();

const nameOk = s => typeof s === "string" && /^[\w一-龥-]{2,24}$/.test(s);
const emailOk = s => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;
const passOk = s => typeof s === "string" && s.length >= 6 && s.length <= 72;

router.post("/register", async (req, res) => {
  if(!rateLimit("reg:" + req.ip, 10, 3600e3)) return res.status(429).json({ error: "注册太频繁，稍后再试" });
  const { username, email, password } = req.body || {};
  if(!nameOk(username)) return res.status(400).json({ error: "用户名需 2 到 24 个字符（中英文、数字、下划线）" });
  if(!emailOk(email)) return res.status(400).json({ error: "邮箱格式不对" });
  if(!passOk(password)) return res.status(400).json({ error: "密码至少 6 位" });
  const clash = db.prepare("SELECT id, username, email, verified FROM users WHERE username=? OR email=?").get(username, email);
  if(clash && clash.verified) return res.status(409).json({ error: "用户名或邮箱已被使用" });
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  if(clash && !clash.verified){
    // 未验证的旧占位允许覆盖重注册
    db.prepare("UPDATE users SET username=?, email=?, pass_hash=?, salt=? WHERE id=?")
      .run(username, email, hash, salt, clash.id);
  }else{
    db.prepare("INSERT INTO users(username, email, pass_hash, salt, verified, created_at) VALUES(?,?,?,?,0,?)")
      .run(username, email, hash, salt, Date.now());
  }
  try{ await issueCode(email, "verify"); }
  catch(e){ return res.status(500).json({ error: "验证码发送失败：" + e.message }); }
  res.json({ ok: true, mailMode: mailMode(),
    hint: mailMode() === "console" ? "未配置邮件服务：验证码已打印在服务器终端里" : "验证码已发送到邮箱" });
});

router.post("/verify", (req, res) => {
  const { email, code } = req.body || {};
  if(!emailOk(email)) return res.status(400).json({ error: "邮箱格式不对" });
  const err = checkCode(email, "verify", code);
  if(err) return res.status(400).json({ error: err });
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!u) return res.status(404).json({ error: "账号不存在" });
  db.prepare("UPDATE users SET verified=1 WHERE id=?").run(u.id);
  createSession(res, u.id);
  res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email } });
});

router.post("/login", (req, res) => {
  if(!rateLimit("login:" + req.ip, 30, 900e3)) return res.status(429).json({ error: "尝试太频繁，稍后再试" });
  const { account, password } = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE username=? OR email=?").get(account || "", account || "");
  if(!u || hashPassword(password || "", u.salt) !== u.pass_hash)
    return res.status(401).json({ error: "账号或密码不对" });
  if(!u.verified) return res.status(403).json({ error: "邮箱还没验证，请先完成注册验证", needVerify: true, email: u.email });
  createSession(res, u.id);
  res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email } });
});

router.post("/request-code", async (req, res) => {
  if(!rateLimit("code:" + req.ip, 8, 3600e3)) return res.status(429).json({ error: "请求太频繁，稍后再试" });
  const { email, purpose } = req.body || {};
  if(!emailOk(email)) return res.status(400).json({ error: "邮箱格式不对" });
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  const p = purpose === "verify" ? "verify" : "login";
  if(p === "login" && (!u || !u.verified)) return res.status(404).json({ error: "该邮箱没有已验证的账号" });
  if(p === "verify" && !u) return res.status(404).json({ error: "该邮箱没有注册记录" });
  try{ await issueCode(email, p); }
  catch(e){ return res.status(500).json({ error: "验证码发送失败：" + e.message }); }
  res.json({ ok: true, mailMode: mailMode(),
    hint: mailMode() === "console" ? "未配置邮件服务：验证码已打印在服务器终端里" : "验证码已发送到邮箱" });
});

router.post("/login-code", (req, res) => {
  const { email, code } = req.body || {};
  if(!emailOk(email)) return res.status(400).json({ error: "邮箱格式不对" });
  const err = checkCode(email, "login", code);
  if(err) return res.status(400).json({ error: err });
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!u || !u.verified) return res.status(404).json({ error: "该邮箱没有已验证的账号" });
  createSession(res, u.id);
  res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email } });
});

router.post("/logout", (req, res) => { clearSession(req, res); res.json({ ok: true }); });

router.get("/me", (req, res) => {
  res.json({ user: req.user ? { id: req.user.id, username: req.user.username, email: req.user.email } : null });
});

module.exports = { router, sessionMiddleware, requireAuth, mailMode };
