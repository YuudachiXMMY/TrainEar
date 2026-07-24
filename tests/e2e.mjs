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

const makeWavBuf = makeWav();

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

// ---- 内置采样电贝斯：默认音色、加载、RR 轮换 ----
await step("builtin sampled bass loads and rotates RR", async () => {
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForSelector('[data-act="nav-mode"]');
  const bv = await page.evaluate(() => S.data.settings.bassVoice);
  if (bv !== "smp-bass") throw new Error("default bassVoice=" + bv);
  await page.waitForFunction(() =>
    ["40_1","40_2","47_1","47_2"].every(k => { const b = BuiltinBass.buffers[k]; return b && b.duration; }) &&
    Object.values(BuiltinBass.buffers).filter(b => b && b.duration).length >= 20,
    null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    AE.ensure();
    AE.stopAll();
    AE.group = AE.ctx.createGain(); AE.group.connect(AE.master);
    const t0 = AE.ctx.currentTime + 0.05;
    const ok1 = AE.smpBass(AE.group, t0, 0.4, 40, 1);
    const ok2 = AE.smpBass(AE.group, t0 + 0.5, 0.4, 40, 1);
    const ok48 = AE.smpBass(AE.group, t0 + 1.0, 0.4, 48, 1); // 库空档，走 47 变调
    const seq = BuiltinBass.seq[40];
    AE.stopAll();
    return { ok1, ok2, ok48, seq };
  });
  if (!r.ok1 || !r.ok2 || !r.ok48) throw new Error("smpBass returned false: " + JSON.stringify(r));
  if (r.seq !== 2) throw new Error("RR did not rotate, seq=" + r.seq);
});

// ---- 采样与 KS 响度对比（信息性）----
await step("sampled vs KS loudness sanity", async () => {
  const r = await page.evaluate(async () => {
    const buf40 = BuiltinBass.buffers[BuiltinBass.key(40, 1)];
    const off = new OfflineAudioContext(1, 44100 * 2, 44100);
    const g = off.createGain(); g.connect(off.destination);
    const saved = AE.ctx; AE.ctx = off; AE.ksCache = {};
    AE.bass(g, 0.02, 1.5, 40, 1);
    const ks = await off.startRendering();
    AE.ctx = saved; AE.ksCache = {};
    const rms = d => { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]; return Math.sqrt(s / (d.length / 4)); };
    const smp = buf40.getChannelData(0);
    return { ks: rms(ks.getChannelData(0)), smp: rms(smp) * 0.62 };
  });
  console.log(`    ks rms=${r.ks.toFixed(3)} | smp(×0.62 gain) rms=${r.smp.toFixed(3)}`);
  if (r.smp < 0.01) throw new Error("sampled bass too quiet");
});

// ---- 多文件上传：按文件名识别音高 ----
await step("multi-file upload with filename pitch parsing", async () => {
  const parse = await page.evaluate(() =>
    [midiFromFilename("E1.wav"), midiFromFilename("A#1.wav"), midiFromFilename("Db2.flac"), midiFromFilename("nope.wav")]);
  if (JSON.stringify(parse) !== JSON.stringify([28, 34, 37, null]))
    throw new Error("midiFromFilename wrong: " + JSON.stringify(parse));
  // 确保登录（cookie 可能仍有效）
  const loggedIn = await page.evaluate(() => !!API.user);
  if (!loggedIn) {
    await page.click('[data-act="nav-auth"]');
    await page.fill("#f-account", "jadyn");
    await page.fill("#f-pass", "bass12345");
    await page.click('[data-act="auth-login"]');
    await page.waitForFunction(() => API.user, null, { timeout: 10000 });
  }
  await page.evaluate(() => { S.screen = "sources"; render(); });
  await page.fill("#f-srcname", "GP自制");
  await page.setInputFiles("#f-srcfile", [
    { name: "E1.wav", mimeType: "audio/wav", buffer: makeWavBuf },
    { name: "A1.wav", mimeType: "audio/wav", buffer: makeWavBuf }
  ]);
  await page.click('[data-act="src-upload"]');
  await page.waitForFunction(() => Samples.list.length === 2, null, { timeout: 8000 });
  const roots = await page.evaluate(() => Samples.list.map(s => s.rootMidi).sort((a, b) => a - b));
  if (JSON.stringify(roots) !== JSON.stringify([28, 33])) throw new Error("parsed roots wrong: " + roots);
  // 清理
  await page.evaluate(async () => { for (const s of [...Samples.list]) await API.deleteSample(s.id); });
});

console.log(errors.length ? "CONSOLE/PAGE ERRORS:\n" + errors.join("\n") : "NO console/page errors");
await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
process.exit(process.exitCode || 0);
