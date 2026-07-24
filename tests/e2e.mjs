/* 端到端测试：起真实服务，跑注册验证登录、答题云同步、采样上传与音源切换。
   运行：npm test（需要本机可用的 Chromium，环境变量 CHROMIUM_PATH 可覆盖路径） */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright/index.js")); }

const PORT = 8324;
const BASE = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), "ett-"));
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");

let serverOut = "";
const server = spawn("node", ["server/index.js"], {
  cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }
});
server.stdout.on("data", d => { serverOut += d.toString(); });
server.stderr.on("data", d => { serverOut += d.toString(); });
await new Promise((res, rej) => {
  const t = setInterval(() => { if (serverOut.includes("已启动")) { clearInterval(t); res(); } }, 100);
  setTimeout(() => { clearInterval(t); rej(new Error("server did not start:\n" + serverOut)); }, 8000);
});

const lastCode = () => { const m = [...serverOut.matchAll(/验证码: (\d{6})/g)]; return m.length ? m[m.length - 1][1] : null; };

// 生成一段 16bit PCM mono wav（110Hz 正弦，0.8s）
function makeWav() {
  const sr = 44100, n = Math.floor(sr * 0.8);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 400) * Math.exp(-i / (sr * 0.5));
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 110 * i / sr) * 22000 * env), 44 + i * 2);
  }
  return buf;
}

const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"]
});
const page = await browser.newPage({ viewport: { width: 880, height: 1000 } });
page.on("console", m => {
  // 401/409 是测试里故意打的负路径请求，不算错
  if (m.type() === "error" && !/status of (401|409)/.test(m.text())) errors.push("console: " + m.text());
});
page.on("pageerror", e => errors.push("pageerror: " + e.message));

const step = async (name, fn) => {
  try { await fn(); console.log("OK  " + name); }
  catch (e) { console.log("FAIL " + name + " :: " + e.message.split("\n")[0]); process.exitCode = 1; }
};

await page.goto(BASE);
await page.waitForSelector('[data-act="nav-mode"]');

// ---- 基础界面与答题 ----
await step("home + root quiz basic flow", async () => {
  await page.click('[data-act="nav-mode"][data-mode="root"]');
  await page.click('[data-act="open-level"][data-i="0"]');
  await page.waitForSelector('[data-act="answer"]');
  await page.keyboard.press("1");
  await page.waitForSelector(".feedback");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".feedback"));
  await page.click('[data-act="back"]'); await page.click('[data-act="back"]');
});

// ---- 注册 + 邮箱验证码验证 ----
await step("register with email verification", async () => {
  await page.click('[data-act="nav-auth"]');
  await page.click('[data-act="auth-tab"][data-tab="reg"]');
  await page.fill("#f-user", "jadyn");
  await page.fill("#f-email", "jadyn@test.local");
  await page.fill("#f-pass2", "bass12345");
  await page.click('[data-act="auth-reg"]');
  await page.waitForSelector("#f-code", { timeout: 5000 });
  const code = lastCode();
  if (!code) throw new Error("no code in server output");
  await page.fill("#f-code", code);
  await page.click('[data-act="auth-verify"]');
  await page.waitForFunction(() => API.user && API.user.username === "jadyn", null, { timeout: 5000 });
  const chip = await page.textContent(".topbar");
  if (!chip.includes("jadyn")) throw new Error("no account chip");
});

// ---- 答题触发云同步 ----
await step("answers sync to server", async () => {
  await page.click('[data-act="nav-mode"][data-mode="quality"]');
  await page.click('[data-act="open-level"][data-i="0"]');
  await page.waitForSelector('[data-act="answer"]');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("1");
    await page.waitForSelector(".feedback");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".feedback"));
  }
  await page.waitForTimeout(2000); // 防抖窗口
  const remote = await page.evaluate(async () => (await (await fetch("/api/progress")).json()));
  if (!remote.data || !remote.data.levels || !remote.data.levels["q-1"]) throw new Error("progress not synced");
  if (remote.data.levels["q-1"].a < 3) throw new Error("synced count wrong");
  await page.click('[data-act="back"]'); await page.click('[data-act="back"]');
});

// ---- 退出 → 密码登录，进度从云端拉回 ----
await step("logout then password login restores progress", async () => {
  await page.click('[data-act="nav-auth"]');
  await page.click('[data-act="auth-logout"]');
  await page.waitForFunction(() => !API.user);
  await page.evaluate(() => { localStorage.clear(); });  // 模拟新设备
  await page.reload(); await page.waitForSelector('[data-act="nav-auth"]');
  await page.click('[data-act="nav-auth"]');
  await page.fill("#f-account", "jadyn");
  await page.fill("#f-pass", "bass12345");
  await page.click('[data-act="auth-login"]');
  await page.waitForFunction(() => API.user, null, { timeout: 5000 });
  const a = await page.evaluate(() => (S.data.levels["q-1"] || { a: 0 }).a);
  if (a < 3) throw new Error("progress not restored from cloud, a=" + a);
});

// ---- 邮箱验证码登录 ----
await step("email code login", async () => {
  await page.click('[data-act="nav-auth"]');
  await page.click('[data-act="auth-logout"]');
  await page.waitForFunction(() => !API.user);
  await page.click('[data-act="nav-auth"]');
  await page.click('[data-act="auth-tab"][data-tab="code"]');
  await page.fill("#f-email", "jadyn@test.local");
  await page.click('[data-act="auth-sendlogincode"]');
  await page.waitForSelector("#f-code");
  await page.fill("#f-code", lastCode());
  await page.click('[data-act="auth-logincode"]');
  await page.waitForFunction(() => API.user, null, { timeout: 5000 });
});

// ---- 上传采样 → 试听 → 切成贝斯音色出题 ----
await step("upload custom sample and use as bass voice", async () => {
  await page.click('[data-act="nav-sources"]');
  await page.waitForSelector("#f-srcname");
  await page.fill("#f-srcname", "测试P-Bass");
  await page.selectOption("#f-srcroot", "45");   // A2
  await page.setInputFiles("#f-srcfile", { name: "a2.wav", mimeType: "audio/wav", buffer: makeWav() });
  await page.click('[data-act="src-upload"]');
  await page.waitForFunction(() => Samples.list.length === 1, null, { timeout: 5000 });
  await page.click('[data-act="src-prev"]');     // 试听触发解码
  await page.waitForFunction(() => Object.keys(Samples.buffers).length === 1, null, { timeout: 5000 });
  // 切换贝斯音色为采样并出一题（采样已加载，路由应走 sample 分支且不报错）
  const okPlay = await page.evaluate(async () => {
    S.data.settings.bassVoice = "custom:测试P-Bass";
    S.modeKey = "root"; S.levelIdx = 0; S.screen = "quiz";
    genQuestion(); render(); playCurrent(false);
    await new Promise(r => setTimeout(r, 300));
    AE.stopAll();
    return true;
  });
  if (!okPlay) throw new Error("play with sample voice failed");
  // 首页下拉里出现采样音源
  await page.evaluate(() => { S.screen = "home"; render(); });
  const has = await page.locator('select[data-set="bvoice"] option[value="custom:测试P-Bass"]').count();
  if (!has) throw new Error("sample source missing from select");
});

// ---- 删除采样 ----
await step("delete sample", async () => {
  await page.evaluate(() => { S.screen = "sources"; render(); });
  await page.click('[data-act="src-del"]');
  await page.waitForFunction(() => Samples.list.length === 0, null, { timeout: 5000 });
});

// ---- 离线兜底：错误密码、重复注册 ----
await step("bad password and duplicate register rejected", async () => {
  const r1 = await page.evaluate(async () =>
    (await (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "jadyn", password: "wrong" }) })).status));
  if (r1 !== 401) throw new Error("bad password not rejected: " + r1);
  const r2 = await page.evaluate(async () =>
    (await (await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "jadyn", email: "x@y.io", password: "abcdef" }) })).status));
  if (r2 !== 409) throw new Error("duplicate username not rejected: " + r2);
});

console.log(errors.length ? "CONSOLE/PAGE ERRORS:\n" + errors.join("\n") : "NO console/page errors");
await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
process.exit(process.exitCode || 0);
