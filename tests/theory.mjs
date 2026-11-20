/* 乐理课测试：拼写引擎对照标准答案、每个题型批量出题的不变式、每一课和每一档的界面冒烟。
   运行：node tests/theory.mjs（file:// 离线打开，不需要起服务；需要 Playwright 的 Chromium） */
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright/index.js")); }

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const url = pathToFileURL(path.join(root, "public/index.html")).href;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(url);
await page.waitForSelector(".mode-card");

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("  ✕ " + msg); } };

/* ---------- 1. 拼写引擎对照 ---------- */
const spell = await page.evaluate(() => {
  const sc = n => thNotesText(thScale(thP(n)));
  const ch = (r, q) => thNotesText(thChordNotes(thP(r), q));
  const iv = (a, b) => { const x = thIvBetween(thP(a), thP(b)); return x ? x.k : null; };
  return {
    Fs: sc("F♯"), Db: sc("D♭"), B: sc("B"), Eb: sc("E♭"),
    Cdim7: ch("C", "dim7"), Fsm7b5: ch("F♯", "m7b5"), Bb7: ch("B♭", "dom7"), Eaug: ch("E", "aug"), Abmaj7: ch("A♭", "maj7"), Csus4: ch("C", "sus4"),
    iv1: iv("C", "E♭"), iv2: iv("F", "B"), iv3: iv("B", "F"), iv4: iv("E", "C"), iv5: iv("A♭", "G"), iv6: iv("D", "C"),
    dDor: thNotesText(thScale(thP("D"), TH_MODES[1].semis)), ePhr: thNotesText(thScale(thP("E"), TH_MODES[2].semis)),
    dia: TH_DIA.map(d => thDiaChord(TH_KEY_BY["E♭"], d, false)).join(" "),
    dia7: TH_DIA.map(d => thDiaChord(TH_KEY_BY["A"], d, true)).join(" "),
    sec: ["1(7)","2(7)","3(7)","6(7)","7(7)"].map(d => thDegChord(TH_KEY_BY["G"], d).name).join(" "),
    bor: ["4m","♭6","♭7","♭3","5m"].map(d => thDegChord(TH_KEY_BY["D"], d).name).join(" "),
    slash: ["5/7","1/3","6m/5","4/5","4/1"].map(d => thDegChord(TH_KEY_BY["C"], d).name).join(" "),
    rel: TH_KEYS.map(k => k.n + ":" + k.rel + ":" + thNm(thScale(k.t)[5])).filter(x => { const [, r, s6] = x.split(":"); return r !== s6; }),
    sigs: TH_KEYS.map(k => { const sc = thScale(k.t); const n = sc.reduce((a, x) => a + x.acc, 0); return n === k.sig ? null : k.n; }).filter(Boolean),
    form: TH_MODES.map(m => thFormula(m.semis)),
    chordForm: ["dim7","m7b5","aug"].map(thChordFormula)
  };
});
const expect = {
  Fs: "F♯ G♯ A♯ B C♯ D♯ E♯", Db: "D♭ E♭ F G♭ A♭ B♭ C", B: "B C♯ D♯ E F♯ G♯ A♯", Eb: "E♭ F G A♭ B♭ C D",
  Cdim7: "C E♭ G♭ B♭♭", Fsm7b5: "F♯ A C E", Bb7: "B♭ D F A♭", Eaug: "E G♯ B♯", Abmaj7: "A♭ C E♭ G", Csus4: "C F G",
  iv1: "m3", iv2: "A4", iv3: "d5", iv4: "m6", iv5: "M7", iv6: "m7",
  dDor: "D E F G A B C", ePhr: "E F G A B C D",
  dia: "E♭ Fm Gm A♭ B♭ Cm Ddim", dia7: "Amaj7 Bm7 C♯m7 Dmaj7 E7 F♯m7 G♯m7♭5",
  sec: "G7 A7 B7 E7 F♯7", bor: "Gm B♭ C F Am", slash: "G/B C/E Am/G F/G F/C"
};
for (const [k, v] of Object.entries(expect)) check(spell[k] === v, `spell ${k}: got "${spell[k]}" want "${v}"`);
check(spell.rel.length === 0, "相对小调 = 6 级: " + spell.rel.join(","));
check(spell.sigs.length === 0, "调号个数和音阶升降号一致: " + spell.sigs.join(","));
check(spell.form.join("|") === "1 2 3 4 5 6 7|1 2 ♭3 4 5 6 ♭7|1 ♭2 ♭3 4 5 ♭6 ♭7|1 2 3 ♯4 5 6 7|1 2 3 4 5 6 ♭7|1 2 ♭3 4 5 ♭6 ♭7|1 ♭2 ♭3 4 ♭5 ♭6 ♭7", "调式公式: " + spell.form.join("|"));
check(spell.chordForm.join("|") === "1 ♭3 ♭5 ♭♭7|1 ♭3 ♭5 ♭7|1 3 ♯5", "和弦公式: " + spell.chordForm.join("|"));
console.log("拼写引擎：" + (fails ? fails + " 处不对" : "全部对上"));

/* ---------- 2. 每个题型批量出题 ---------- */
const gen = await page.evaluate(() => {
  const out = {};
  for (const mk of TH_MODE_KEYS) {
    const m = MODES[mk];
    m.levels.forEach((lv, li) => {
      const bad = [];
      const sigs = new Set();
      S.modeKey = mk; S.levelIdx = li;
      for (let i = 0; i < 300; i++) {
        let q;
        try { thGenQuestion(); q = S.q; } catch (e) { bad.push("throw " + e.message); break; }
        sigs.add(q.sig);
        if (q.fret) {
          if (!q.targets || !q.targets.length) bad.push("指板题没有目标");
          continue;
        }
        const labels = q.options.map(o => o.label), values = q.options.map(o => o.value);
        if (q.options.length < 2) bad.push("选项太少 " + q.prompt);
        if (new Set(labels).size !== labels.length) bad.push("选项重复 " + labels.join("|"));
        if (new Set(values).size !== values.length) bad.push("value 重复 " + values.join("|"));
        if (values.filter(v => v === q.answerValue).length !== 1) bad.push("答案不在选项里 " + q.prompt + " → " + q.answerValue + " / " + labels.join("|"));
        if (labels.some(l => /undefined|NaN|null|\?/.test(l))) bad.push("选项里有坏值 " + labels.join("|"));
        if (/undefined|NaN|null/.test(q.prompt + (q.sub || "") + (q.ctx || ""))) bad.push("题面有坏值 " + q.prompt);
        if (lv.ear && !q.events.length) bad.push("听力题没有声音");
        // 讲解也要能生成
        try {
          const corr = q.options.find(o => o.value === q.answerValue);
          const wrong = q.options.find(o => o.value !== q.answerValue);
          q.result = { ok: false, chosen: wrong, correct: corr };
          const f = q.K.fb(q, q.result, false);
          if (!f.title || /undefined|NaN/.test(f.title + f.detail)) bad.push("讲解有坏值 " + f.title + " / " + f.detail.slice(0, 80));
          q.result = { ok: true, chosen: corr, correct: corr };
          q.K.fb(q, q.result, true);
        } catch (e) { bad.push("讲解报错 " + e.message + " @ " + q.prompt); }
      }
      out[lv.id] = { bad: [...new Set(bad)].slice(0, 6), variety: sigs.size };
    });
  }
  S.q = null;
  return out;
});
for (const [id, r] of Object.entries(gen)) {
  check(r.bad.length === 0, id + "：" + r.bad.join(" ‖ "));
  check(r.variety >= 6, id + " 题目变化太少：" + r.variety);
}
console.log("出题不变式：" + Object.keys(gen).length + " 档 × 300 题" + (Object.values(gen).every(r => !r.bad.length) ? "，全部通过" : ""));

/* ---------- 3. 界面冒烟：每一课、每一档 ---------- */
const modes = await page.evaluate(() => TH_MODE_KEYS.map(k => ({ k, lessons: MODES[k].lessons.map(l => l.id), levels: MODES[k].levels.length })));
check((await page.locator(".mode-card[data-mode=tb]").count()) === 1, "首页有基础乐理卡片");
for (const m of modes) {
  await page.click(`.mode-card[data-mode=${m.k}]`);
  await page.waitForSelector(".lesson-btn");
  for (const id of m.lessons) {
    await page.click(`.lesson-btn[data-id="${id}"]`);
    await page.waitForSelector(".lesson-foot");
    const n = await page.locator(".ls-sec").count();
    check(n >= 2, id + " 段落太少 " + n);
    const txt = await page.locator(".lesson").innerText();
    check(!/undefined|NaN|\[object/.test(txt), id + " 课文里有坏值");
    // 点一个播放按钮
    if (await page.locator(".th-pbtn").count()) await page.locator(".th-pbtn").first().click();
    await page.keyboard.press("Escape");
    await page.waitForSelector(".lesson-btn");
  }
  for (let i = 0; i < m.levels; i++) {
    await page.locator(".level-btn:not(.lesson-btn)").nth(i).click();
    await page.waitForSelector(".th-prompt");
    for (let r = 0; r < 4; r++) {
      const isFret = await page.evaluate(() => !!S.q.fret);
      if (isFret) {
        const t = await page.evaluate(() => S.q.targets[0]);
        await page.click(`.fb-cell[data-s="${t.s}"][data-f="${t.f}"]`);
      } else {
        const k = await page.evaluate(() => S.q.options.findIndex(o => o.value === S.q.answerValue) + 1);
        await page.keyboard.press(String(r === 1 ? (k === 1 ? 2 : 1) : k));   // 第 2 题故意答错
      }
      await page.waitForSelector(".feedback");
      const fb = await page.locator(".feedback").innerText();
      check(!/undefined|NaN|\[object/.test(fb), m.k + " 档" + (i + 1) + " 反馈有坏值：" + fb.slice(0, 80));
      if (r === 1 && await page.locator('.feedback [data-act="th-lesson"]').count()) {
        await page.click('.feedback [data-act="th-lesson"]');
        await page.waitForSelector(".lesson");
        await page.keyboard.press("Escape");          // 回到刚才那道题
        await page.waitForSelector(".feedback");
      }
      await page.keyboard.press("Enter");
      await page.waitForSelector(".th-prompt");
    }
    await page.keyboard.press("Escape");
    await page.waitForSelector(".lesson-btn");
  }
  await page.keyboard.press("Escape");
  await page.waitForSelector(".mode-card");
}
const stats = await page.evaluate(() => ({ lessons: Object.keys(S.data.lessons || {}).length, answered: Object.keys(S.data.levels).filter(k => /^(tb|dh|ph|bl)-/.test(k)).length }));
check(stats.lessons === modes.reduce((a, m) => a + m.lessons.length, 0), "所有课标记已读：" + stats.lessons);
await page.click('[data-act="nav-progress"]');
await page.waitForSelector(".prog-section");
check((await page.locator(".prog-section h3", { hasText: "基础乐理" }).count()) === 1, "进度页有乐理课");
check(errors.length === 0, "浏览器报错：\n    " + errors.join("\n    "));
console.log("界面冒烟：" + modes.reduce((a, m) => a + m.lessons.length, 0) + " 课 / " + stats.answered + " 档都打开并作答过");

await browser.close();
console.log(fails ? `\n✕ ${fails} 项失败` : "\n✓ 乐理课测试全部通过");
process.exit(fails ? 1 : 0);
