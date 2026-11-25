/* 端到端测试：起真实服务，跑注册验证登录、答题云同步、采样上传与音源切换。
   运行：npm test（需要本机可用的 Chromium，环境变量 CHROMIUM_PATH 可覆盖路径）

   —— React 化之后的适配说明 ——
   旧版应用是一串 <script> 标签拼起来的全局状态机（S/AE/API/Samples/BuiltinBass/genQuestion/
   render/... 全是 window 全局），导航靠 [data-act="nav-mode"]/[data-act="open-level"]/
   [data-act="back"] 这类状态机动作，表单靠 #f-user 这类固定 id。React 化之后：
   - 引擎函数变成了 client/src/engine/index.js 的具名导出，不再挂 window；为了让这份测试还能
     摸到"页面里正在运行的那一份" S/AE/API/Samples/BuiltinBass/midiFromFilename 等单例，
     client/src/main.tsx 新增了一个纯测试用的出口：URL 带 ?__test=1 时会把它们整理挂到
     window.__ENGINE__ 上（平时不带这个参数完全不暴露，不影响正常用户）。下面所有
     page.evaluate(() => S...) 都换成了 page.evaluate(() => window.__ENGINE__.S...)。
   - 导航变成了真正的 4 个底部 Tab（首页/课程/训练/我的）+ "开始训练确认层"两级确认
     （SessionSheet：点练习卡片先弹层，弹层里先点一次"进入训练"进入"已就绪"态，再点一次
     才真正调 startQuestion() 进答题）——按可见文本/角色去点，不再有 data-act 导航属性。
   - 答题页里原生题型（root/quality/pattern）是手写 JSX，没有 [data-act="answer"] 了，
     继续用键盘数字键作答（这条路径没变）。指板出题（board/fret/motif，以及乐理课里混了
     q.fret 的题）和乐理课出题，都是整段复用旧版 renderFretQuiz()/thRenderQuiz() 的 HTML
     字符串（“换皮不换逻辑”），所以 [data-act="fret-cell"]/.fb-cell/.feedback/
     [data-act="answer"]/[data-act="replay"]/[data-act="next"] 这些旧选择器原样可用。
   - 登录/音源表单的输入框从带 id 的受控输入变成了带 aria-label 的受控输入，一律用
     page.getByLabel(...) 定位，不用旧的 #f-user 这类 id。
   - 顶栏（.topbar）现在只显示固定的头像字"练"，不再显示用户名——登录成功的检查点挪到了
     "我的" Tab 的页面标题（ProfileView 的 <h1>{name}</h1>）。
   - 训练 Tab 的练习卡片（getPracticeItems()）现在每个模式只给"当前推荐档位"一张卡片，
     没有"选第几档"的入口了（旧版"选模式→选档位"两级被合并成了一层，这是步骤6/9已经
     确认过的产品设计，不是这次要改的东西）。要测某个模式的第 2~5 档：先通过卡片正常进入
     第 1 档（验证一次真实 UI 点击链路能跑通），后续档位改用 window.__ENGINE__ 直接把
     S.modeKey/S.levelIdx 设成想测的档、调 startQuestion()——这其实就是旧版
     [data-act="open-level"] 内部做的同一件事，只是不再有"档位列表"这层 UI 可点；只要
     答题页（overlay）还停留在 quiz，这样切换后页面会用新的 S.q 重新渲染，后续仍然走真实
     DOM 点击作答，不是纯逻辑测试。
   - 指板设置面板（弦数/调弦，旧版 [data-fset="strings"/"tuning"/"customStr"]）挂在旧版
     "选模式"中间页上；新架构里这一层被拿掉了，对应的"调弦与指板"设置项（我的 Tab）目前还是
     占位（App.tsx 里明确写了 TODO），没有造一个新 UI 去凑这个测试——这部分改成只验证
     fretTuning()/fretMigrate() 本身的纯逻辑（通过 window.__ENGINE__ 直接调），UI 层面的
     调弦交互覆盖目前确实是空的，留给以后真的做了那个设置面板再补。
   - 旧版"首页下拉里出现采样音源"（select[data-set="bvoice"]）这个音色选择器控件新版还没做
     （同样在"声音与节拍器"设置项 TODO 里），这条断言去掉，改成只验证 Samples.list 里确实有
     这条记录（本来就是前一步已经等待过的条件，不算损失覆盖）。 */
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
const TEST_URL = `${BASE}/?__test=1`;
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

/* ---------------- 新架构导航帮手 ---------------- */
// overlay（quiz/lesson/warmup/auth/sources）打开时底部 Tab/侧边栏整个不渲染（App.tsx 的
// showShell = overlay === null），所以每次要切 Tab 前，如果还停在某个 overlay 里（比如上一步
// 没有显式退出），先点一次"← 返回"关掉它
const closeOverlayIfOpen = async () => {
  const back = page.getByRole("button", { name: "← 返回" });
  if (await back.count()) await back.click();
};
const tab = async name => { await closeOverlayIfOpen(); await page.getByRole("button", { name, exact: true }).click(); };
const goHome = () => tab("首页");
const goLessons = () => tab("课程");
const goPractice = () => tab("训练");
const goProfile = () => tab("我的");
const goBack = () => page.getByRole("button", { name: "← 返回" }).click();
// 练习卡片 → 确认层 → 两次"进入训练" → 真正进答题
const startPractice = async (titleSubstr) => {
  await goPractice();
  await page.locator(".practice-card", { hasText: titleSubstr }).click();
  await page.getByRole("button", { name: "进入训练" }).click();
  await page.getByRole("button", { name: "进入训练" }).click();
};
// 停在答题页（overlay 还是 quiz）时，直接用引擎调用切到某个模式的某一档——
// 等价于旧版点 [data-act="open-level"][data-i=N]，只是新版没有档位列表可点了
const switchLevel = (modeKey, levelIdx) => page.evaluate(([mk, li]) => {
  const E = window.__ENGINE__;
  E.S.modeKey = mk; E.S.levelIdx = li;
  E.AE.ensure(); E.startQuestion();
}, [modeKey, levelIdx]);
const goAuth = async () => { await goProfile(); await page.getByRole("button", { name: "账号与云同步" }).click(); };
const goSources = async () => { await goProfile(); await page.getByRole("button", { name: "自定义音源" }).click(); };

await page.goto(TEST_URL);
await page.waitForSelector("text=让低音更有方向感");

// ---- 基础界面与答题 ----
await step("home + root quiz basic flow", async () => {
  await startPractice("根音追踪");
  await page.waitForSelector(".playzone");
  await page.keyboard.press("1");
  await page.waitForSelector(".feedback");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".feedback"));
  await goBack();
});

// ---- 指板 · 级数定位：五档各答一对一错，检查判分、反应时间和混淆记录 ----
await step("fretboard degree mode: 5 levels judge right and wrong", async () => {
  const box = await page.evaluate(() => {
    const E = window.__ENGINE__;
    const t = E.fretTuning(), b = E.fretBox(t, 0, false);
    return [t.join(","), b.anchor.s, b.anchor.f, b.lo, b.hi].join("|");
  });
  if (box !== "23,28,33,38,43|2|3|2|5") throw new Error("默认应为 5 弦 BEADG、C 大调 A 弦 3 品、2–5 品，实际 " + box);

  await startPractice("级数定位");
  for (let lv = 0; lv < 5; lv++) {
    if (lv > 0) await switchLevel("fret", lv);
    for (const wantOk of [true, false]) {
      await page.waitForFunction(() => { const E = window.__ENGINE__; return E.S.q && E.S.q.fret && !E.S.answered; });
      const kind = await page.evaluate(() => window.__ENGINE__.S.q.kind);
      if (kind === "f-name") {
        const i = await page.evaluate(w => {
          const E = window.__ENGINE__, q = E.S.q;
          const i = q.options.findIndex(o => o.value === q.answerValue);
          return w ? i : (i + 1) % 7;
        }, wantOk);
        await page.click(`[data-act="answer"][data-i="${i}"]`);
      } else if (kind === "f-seq") {
        const cells = await page.evaluate(w => {
          const E = window.__ENGINE__, q = E.S.q;
          return q.pat.seq.map((dk, i) => {
            const pc = (q.key.pc + E.FDEG_BY[dk].semi) % 12;
            return E.cellsIn(q.tun, q.box.lo, q.box.hi, p => w || i !== 1 ? p === pc : p !== pc)[0];
          });
        }, wantOk);
        for (let i = 0; i < cells.length; i++) {
          await page.click(`[data-act="fret-cell"][data-s="${cells[i].s}"][data-f="${cells[i].f}"]`);
          if (!wantOk && i === 1) break;
        }
      } else {
        const c = await page.evaluate(w => {
          const E = window.__ENGINE__, q = E.S.q;
          return w ? q.targets[0] :
            E.cellsIn(q.tun, q.box.lo, q.box.hi, () => true).find(c => !q.targets.some(t => t.s === c.s && t.f === c.f) &&
              !(c.s === q.box.anchor.s && c.f === q.box.anchor.f));
        }, wantOk);
        await page.click(`[data-act="fret-cell"][data-s="${c.s}"][data-f="${c.f}"]`);
      }
      await page.waitForSelector(".feedback");
      const ok = await page.evaluate(() => window.__ENGINE__.S.q.result.ok);
      if (ok !== wantOk) throw new Error(`档 ${lv + 1} ${kind}: 期望 ${wantOk} 实际 ${ok}`);
      await page.keyboard.press("Enter");
    }
  }
  await goBack();

  const d = await page.evaluate(() => { const E = window.__ENGINE__; return { lv: E.S.data.levels["f-1"], conf: E.S.data.conf.f }; });
  if (d.lv.a !== 2 || d.lv.c !== 1 || !(d.lv.rt && d.lv.rt.length === 1)) throw new Error("f-1 统计不对 " + JSON.stringify(d.lv));
  if (!d.conf || !Object.keys(d.conf).some(k => k.includes(" 认成 "))) throw new Error("没有记录指板混淆");

  // 弦数与调弦、迁移：新版"调弦与指板"设置面板还是占位（App.tsx 里的 TODO），没有 UI 可点，
  // 这里只验证纯引擎逻辑本身没坏，不再驱动 [data-fset=...] 这类已不存在的控件
  const mig = await page.evaluate(() => {
    const E = window.__ENGINE__;
    return [E.fretMigrate({ fretTuning: "CEADG" }), E.fretMigrate({ fretTuning: "custom", fretTuningCustom: "D1 A1 D2 G2" }), E.fretMigrate({ fretTuning: "DADG" })];
  });
  if (mig[0].fretStrings !== 5 || mig[0].fretTuning !== "BEADG") throw new Error("CEADG 迁移不对 " + JSON.stringify(mig[0]));
  if (mig[1].fretStrings !== 4 || mig[1].fretCustom[4].join(",") !== "26,33,38,43") throw new Error("自定义迁移不对 " + JSON.stringify(mig[1]));
  if (mig[2].fretStrings !== 4 || mig[2].fretTuning !== "DADG") throw new Error("Drop D 迁移不对");
});

// ---- 音名地形 + 模进训练：每档一对一错 ----
await step("board + motif modes judge right and wrong", async () => {
  const clicksFor = (wantOk) => page.evaluate(w => {
    const E = window.__ENGINE__, q = E.S.q, cells = (lo, hi) => E.cellsIn(q.tun, lo, hi, () => true);
    if (q.kind === "b-find") { const c = w ? q.targets[0] : cells(q.lo, q.hi).find(c => c.s === q.s && c.midi % 12 !== q.pc); return [c]; }
    if (q.kind === "b-all") return w ? q.targets : [cells(0, 12).find(c => c.midi % 12 !== q.pc)];
    if (q.kind === "m-seq") {
      const win = cells(q.box.lo, q.box.hi);
      return q.notes.map((m, i) => (w || i < 2) ? win.find(c => c.midi === m) : win.find(c => c.midi !== m)).slice(0, w ? undefined : 3);
    }
    return null;
  }, wantOk);
  for (const [mode, title, n] of [["board", "音名地形", null], ["motif", "模进训练", null]]) {
    await startPractice(title);
    const levelCount = n ?? await page.evaluate(mk => Object.values(window.__ENGINE__.MODES[mk].levels).length, mode);
    for (let lv = 0; lv < levelCount; lv++) {
      if (lv > 0) await switchLevel(mode, lv);
      for (const wantOk of [true, false]) {
        await page.waitForFunction(() => { const E = window.__ENGINE__; return E.S.q && E.S.q.fret && !E.S.answered; });
        const kind = await page.evaluate(() => window.__ENGINE__.S.q.kind);
        if (kind === "b-name") {
          const i = await page.evaluate(w => {
            const E = window.__ENGINE__, q = E.S.q;
            const i = q.options.findIndex(o => o.value === q.answerValue);
            return w ? i : (i + 1) % 12;
          }, wantOk);
          await page.click(`[data-act="answer"][data-i="${i}"]`);
        } else {
          for (const c of await clicksFor(wantOk)) {
            if (await page.evaluate(() => window.__ENGINE__.S.answered)) break;
            await page.click(`[data-act="fret-cell"][data-s="${c.s}"][data-f="${c.f}"]`);
          }
        }
        await page.waitForSelector(".feedback");
        const ok = await page.evaluate(() => window.__ENGINE__.S.q.result.ok);
        if (ok !== wantOk) throw new Error(`${mode} 档 ${lv + 1} ${kind}: 期望 ${wantOk} 实际 ${ok}`);
        await page.keyboard.press("Enter");
      }
    }
    await goBack();
  }
  const d = await page.evaluate(() => { const E = window.__ENGINE__; return { b: E.S.data.levels["b-4"], m: E.S.data.levels["m-2"], conf: Object.keys(E.S.data.conf) }; });
  if (d.b.a !== 2 || d.b.c !== 1 || d.m.a !== 2 || d.m.c !== 1) throw new Error("统计不对 " + JSON.stringify(d));
  if (!d.conf.includes("b") || !d.conf.includes("m")) throw new Error("混淆没按模式记录 " + d.conf);
});

// ---- 注册 + 邮箱验证码验证 ----
await step("register with email verification", async () => {
  await goAuth();
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await page.getByLabel("用户名").fill("jadyn");
  await page.getByLabel("邮箱").fill("jadyn@test.local");
  await page.getByLabel("密码").fill("bass12345");
  await page.getByRole("button", { name: "发送验证码并注册" }).click();
  await page.waitForSelector('[aria-label="6 位验证码"]', { timeout: 5000 });
  const code = lastCode();
  if (!code) throw new Error("no code in server output");
  await page.getByLabel("6 位验证码").fill(code);
  await page.getByRole("button", { name: "完成验证" }).click();
  await page.waitForFunction(() => { const u = window.__ENGINE__.API.user; return u && u.username === "jadyn"; }, null, { timeout: 5000 });
  await goProfile();
  await page.waitForSelector("h1:has-text(\"jadyn\")", { timeout: 5000 });
});

// ---- 答题触发云同步 ----
await step("answers sync to server", async () => {
  await startPractice("性质听辨");
  await page.waitForSelector(".playzone");
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
  await goBack();
});

// ---- 退出 → 密码登录，进度从云端拉回 ----
await step("logout then password login restores progress", async () => {
  await goAuth();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.waitForFunction(() => !window.__ENGINE__.API.user);
  await page.evaluate(() => { localStorage.clear(); });  // 模拟新设备
  await page.goto(TEST_URL);
  await page.waitForSelector("text=让低音更有方向感");
  await goAuth();
  await page.getByLabel("用户名或邮箱").fill("jadyn");
  await page.getByLabel("密码").fill("bass12345");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForFunction(() => window.__ENGINE__.API.user, null, { timeout: 5000 });
  await page.waitForFunction(() => window.__ENGINE__.S.data.levels["q-1"], null, { timeout: 5000 }).catch(() => {});
  const a = await page.evaluate(() => (window.__ENGINE__.S.data.levels["q-1"] || { a: 0 }).a);
  if (a < 3) throw new Error("progress not restored from cloud, a=" + a);
});

// ---- 邮箱验证码登录 ----
await step("email code login", async () => {
  await goAuth();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.waitForFunction(() => !window.__ENGINE__.API.user);
  await goAuth();
  await page.getByRole("button", { name: "验证码登录", exact: true }).click();
  await page.getByLabel("注册时用的邮箱").fill("jadyn@test.local");
  await page.getByRole("button", { name: "发送登录验证码" }).click();
  await page.waitForSelector('[aria-label="6 位验证码"]');
  await page.getByLabel("6 位验证码").fill(lastCode());
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForFunction(() => window.__ENGINE__.API.user, null, { timeout: 5000 });
});

// ---- 上传采样 → 试听 → 切成贝斯音色出题 ----
await step("upload custom sample and use as bass voice", async () => {
  await goSources();
  await page.getByLabel("音源名").fill("测试P-Bass");
  await page.getByLabel("这个音是").selectOption("45");   // A2
  await page.getByLabel("选择音频文件").setInputFiles({ name: "a2.wav", mimeType: "audio/wav", buffer: makeWav() });
  await page.getByRole("button", { name: "上传", exact: true }).click();
  await page.waitForFunction(() => window.__ENGINE__.Samples.list.length === 1, null, { timeout: 5000 });
  await page.locator('[aria-label^="试听："]').first().click();     // 试听触发解码
  await page.waitForFunction(() => Object.keys(window.__ENGINE__.Samples.buffers).length === 1, null, { timeout: 5000 });
  // 切换贝斯音色为采样并出一题（采样已加载，路由应走 sample 分支且不报错）——纯引擎调用，
  // 旧版"首页下拉里出现采样音源"的 UI 控件（select[data-set="bvoice"]）新版还没做，不测
  const okPlay = await page.evaluate(async () => {
    const E = window.__ENGINE__;
    E.S.data.settings.bassVoice = "custom:测试P-Bass";
    E.S.modeKey = "root"; E.S.levelIdx = 0; E.S.screen = "quiz";
    E.genQuestion(); E.render(); E.playCurrent(false);
    await new Promise(r => setTimeout(r, 300));
    E.AE.stopAll();
    return true;
  });
  if (!okPlay) throw new Error("play with sample voice failed");
  const has = await page.evaluate(() => window.__ENGINE__.Samples.list.some(s => s.name === "测试P-Bass"));
  if (!has) throw new Error("sample source missing from Samples.list");
});

// ---- 删除采样 ----
await step("delete sample", async () => {
  await goSources();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.waitForFunction(() => window.__ENGINE__.Samples.list.length === 0, null, { timeout: 5000 });
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
  await page.goto(TEST_URL);
  await page.waitForSelector("text=让低音更有方向感");
  const bv = await page.evaluate(() => window.__ENGINE__.S.data.settings.bassVoice);
  if (bv !== "smp-bass") throw new Error("default bassVoice=" + bv);
  await page.waitForFunction(() => {
    const B = window.__ENGINE__.BuiltinBass;
    return ["40_1", "40_2", "47_1", "47_2"].every(k => { const b = B.buffers[k]; return b && b.duration; }) &&
      Object.values(B.buffers).filter(b => b && b.duration).length >= 20;
  }, null, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const E = window.__ENGINE__, AE = E.AE, BuiltinBass = E.BuiltinBass;
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
    const E = window.__ENGINE__, AE = E.AE, BuiltinBass = E.BuiltinBass;
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
  const parse = await page.evaluate(() => {
    const m = window.__ENGINE__.midiFromFilename;
    return [m("E1.wav"), m("A#1.wav"), m("Db2.flac"), m("nope.wav")];
  });
  if (JSON.stringify(parse) !== JSON.stringify([28, 34, 37, null]))
    throw new Error("midiFromFilename wrong: " + JSON.stringify(parse));
  // 确保登录（cookie 可能仍有效）
  const loggedIn = await page.evaluate(() => !!window.__ENGINE__.API.user);
  if (!loggedIn) {
    await goAuth();
    await page.getByLabel("用户名或邮箱").fill("jadyn");
    await page.getByLabel("密码").fill("bass12345");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForFunction(() => window.__ENGINE__.API.user, null, { timeout: 10000 });
  }
  await goSources();
  await page.getByLabel("音源名").fill("GP自制");
  await page.getByLabel("选择音频文件").setInputFiles([
    { name: "E1.wav", mimeType: "audio/wav", buffer: makeWavBuf },
    { name: "A1.wav", mimeType: "audio/wav", buffer: makeWavBuf }
  ]);
  await page.getByRole("button", { name: "上传", exact: true }).click();
  await page.waitForFunction(() => window.__ENGINE__.Samples.list.length === 2, null, { timeout: 8000 });
  const roots = await page.evaluate(() => window.__ENGINE__.Samples.list.map(s => s.rootMidi).sort((a, b) => a - b));
  if (JSON.stringify(roots) !== JSON.stringify([28, 33])) throw new Error("parsed roots wrong: " + roots);
  // 清理
  await page.evaluate(async () => { const E = window.__ENGINE__; for (const s of [...E.Samples.list]) await E.API.deleteSample(s.id); });
});

console.log(errors.length ? "CONSOLE/PAGE ERRORS:\n" + errors.join("\n") : "NO console/page errors");
await browser.close();
server.kill();
rmSync(dataDir, { recursive: true, force: true });
process.exit(process.exitCode || 0);
