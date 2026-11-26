/* 乐理课测试：拼写引擎对照标准答案、每个题型批量出题的不变式、每一课讲解内容的冒烟检查。
   运行：node tests/theory.mjs
   —— 原来这个文件是用 Playwright 打开 public/index.html、靠全局变量（window.thScale 等）
   跑测试；React 化之后引擎函数变成了 ES module 的具名导出，不再挂在 window 上。这里改成
   直接用 Node 的 import 读 client/src/engine/index.js——函数本身和断言完全没变，只是换了
   "怎么拿到这些函数"的方式，不再需要起浏览器/Chromium，测试本身也更快。
   （给两个引擎模块在 Node 下跑所必需的极简浏览器环境占位：api.js 顶层读 location.protocol
   判断是否离线；state.js/fret.js 的个别函数会摸一下 document——这里只是让它们在 Node 下不
   报 ReferenceError，不代表真的模拟了 DOM。） */
globalThis.location = { protocol: "http:" };
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [] };

const {
  thScale, thP, thNotesText, thChordNotes, thIvBetween, TH_MODES, TH_DIA, thDiaChord,
  TH_KEYS, TH_KEY_BY, thDegChord, thNm, thPc, thFormula, thChordFormula,
  MODES, S, TH_MODE_KEYS, TH_LESSONS, thGenQuestion, thRenderLesson, thMarkRead,
  TH_CH, TH_ROOTS12, FRET_MAX, cellsIn, fretTuning,
  thChordToolTones, thChordToolMarks, THCT_GROUPS,
} = await import("../client/src/engine/index.js");

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log("  ✕ " + msg); } };

/* ---------- 1. 拼写引擎对照 ---------- */
const sc = n => thNotesText(thScale(thP(n)));
const ch = (r, q) => thNotesText(thChordNotes(thP(r), q));
const iv = (a, b) => { const x = thIvBetween(thP(a), thP(b)); return x ? x.k : null; };
const spell = {
  Fs: sc("F♯"), Db: sc("D♭"), B: sc("B"), Eb: sc("E♭"),
  Cdim7: ch("C", "dim7"), Fsm7b5: ch("F♯", "m7b5"), Bb7: ch("B♭", "dom7"), Eaug: ch("E", "aug"), Abmaj7: ch("A♭", "maj7"), Csus4: ch("C", "sus4"),
  iv1: iv("C", "E♭"), iv2: iv("F", "B"), iv3: iv("B", "F"), iv4: iv("E", "C"), iv5: iv("A♭", "G"), iv6: iv("D", "C"),
  dDor: thNotesText(thScale(thP("D"), TH_MODES[1].semis)), ePhr: thNotesText(thScale(thP("E"), TH_MODES[2].semis)),
  dia: TH_DIA.map(d => thDiaChord(TH_KEY_BY["E♭"], d, false)).join(" "),
  dia7: TH_DIA.map(d => thDiaChord(TH_KEY_BY["A"], d, true)).join(" "),
  sec: ["1(7)", "2(7)", "3(7)", "6(7)", "7(7)"].map(d => thDegChord(TH_KEY_BY["G"], d).name).join(" "),
  bor: ["4m", "♭6", "♭7", "♭3", "5m"].map(d => thDegChord(TH_KEY_BY["D"], d).name).join(" "),
  slash: ["5/7", "1/3", "6m/5", "4/5", "4/1"].map(d => thDegChord(TH_KEY_BY["C"], d).name).join(" "),
  rel: TH_KEYS.map(k => k.n + ":" + k.rel + ":" + thNm(thScale(k.t)[5])).filter(x => { const [, r, s6] = x.split(":"); return r !== s6; }),
  sigs: TH_KEYS.map(k => { const sc2 = thScale(k.t); const n = sc2.reduce((a, x) => a + x.acc, 0); return n === k.sig ? null : k.n; }).filter(Boolean),
  form: TH_MODES.map(m => thFormula(m.semis)),
  chordForm: ["dim7", "m7b5", "aug"].map(thChordFormula),
  ext: ["maj6", "min6", "mMaj7", "dom7sus4", "add9", "dom9", "maj9", "min9"].map(q => ch("C", q)).join(" | "),
  extForm: ["maj6", "dom7sus4", "dom9", "mMaj7"].map(thChordFormula).join(" | "),
};
const expect = {
  Fs: "F♯ G♯ A♯ B C♯ D♯ E♯", Db: "D♭ E♭ F G♭ A♭ B♭ C", B: "B C♯ D♯ E F♯ G♯ A♯", Eb: "E♭ F G A♭ B♭ C D",
  Cdim7: "C E♭ G♭ B♭♭", Fsm7b5: "F♯ A C E", Bb7: "B♭ D F A♭", Eaug: "E G♯ B♯", Abmaj7: "A♭ C E♭ G", Csus4: "C F G",
  ext: "C E G A | C E♭ G A | C E♭ G B | C F G B♭ | C E G D | C E G B♭ D | C E G B D | C E♭ G B♭ D",
  extForm: "1 3 5 6 | 1 4 5 ♭7 | 1 3 5 ♭7 9 | 1 ♭3 5 7",
  iv1: "m3", iv2: "A4", iv3: "d5", iv4: "m6", iv5: "M7", iv6: "m7",
  dDor: "D E F G A B C", ePhr: "E F G A B C D",
  dia: "E♭ Fm Gm A♭ B♭ Cm Ddim", dia7: "Amaj7 Bm7 C♯m7 Dmaj7 E7 F♯m7 G♯m7♭5",
  sec: "G7 A7 B7 E7 F♯7", bor: "Gm B♭ C F Am", slash: "G/B C/E Am/G F/G F/C",
};
for (const [k, v] of Object.entries(expect)) check(spell[k] === v, `spell ${k}: got "${spell[k]}" want "${v}"`);
check(spell.rel.length === 0, "相对小调 = 6 级: " + spell.rel.join(","));
check(spell.sigs.length === 0, "调号个数和音阶升降号一致: " + spell.sigs.join(","));
check(spell.form.join("|") === "1 2 3 4 5 6 7|1 2 ♭3 4 5 6 ♭7|1 ♭2 ♭3 4 5 ♭6 ♭7|1 2 3 ♯4 5 6 7|1 2 3 4 5 6 ♭7|1 2 ♭3 4 5 ♭6 ♭7|1 ♭2 ♭3 4 ♭5 ♭6 ♭7", "调式公式: " + spell.form.join("|"));
check(spell.chordForm.join("|") === "1 ♭3 ♭5 ♭♭7|1 ♭3 ♭5 ♭7|1 3 ♯5", "和弦公式: " + spell.chordForm.join("|"));
console.log("拼写引擎：" + (fails ? fails + " 处不对" : "全部对上"));

/* ---------- 2. 每个题型批量出题（含判分讲解） ---------- */
const gen = {};
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
        if (q.steps && q.steps.some(s => !s.cells.length)) bad.push("多步指板题有一步没有位置 " + q.prompt);
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
    gen[lv.id] = { bad: [...new Set(bad)].slice(0, 6), variety: sigs.size };
  });
}
for (const [id, r] of Object.entries(gen)) {
  check(r.bad.length === 0, id + "：" + r.bad.join(" ‖ "));
  check(r.variety >= 6, id + " 题目变化太少：" + r.variety);
}
S.q = null;
console.log("出题不变式：" + Object.keys(gen).length + " 档 × 300 题" + (Object.values(gen).every(r => !r.bad.length) ? "，全部通过" : ""));

/* ---------- 3. 讲解内容冒烟：每一课渲染出来的 HTML 没有坏值、段落数量合理 ---------- */
let lessonCount = 0;
for (const mk of TH_MODE_KEYS) {
  const m = MODES[mk];
  for (const l of m.lessons) {
    lessonCount++;
    S.lessonId = l.id;
    let html;
    try { html = thRenderLesson(); } catch (e) { check(false, l.id + " 渲染报错：" + e.message); continue; }
    const n = (html.match(/class="ls-sec"/g) || []).length;
    check(n >= 2, l.id + " 段落太少 " + n);
    check(!/undefined|NaN|\[object/.test(html), l.id + " 课文里有坏值");
    thMarkRead(l.id);
    check(!!(S.data.lessons && S.data.lessons[l.id]), l.id + " 应标记为已读");
  }
}
console.log("讲解内容冒烟：" + lessonCount + " 课全部渲染并标记已读");

/* ---------- 4. 和弦工具：级数 + 字母音名 + 整条指板的位置 ---------- */
{
  const tun = fretTuning();
  const checkChord = (rootName, q) => {
    const root = thP(rootName);
    const tones = thChordToolTones(root, q);
    const formula = TH_CH[q].f;
    check(tones.length === formula.length, `${rootName}${q} 音数应等于公式音数`);
    tones.forEach((t, i) => {
      const [num, semi] = formula[i];
      check(t.num === num && t.semi === semi, `${rootName}${q} 第 ${i} 个音的级数/半音应和公式一致`);
      check(typeof t.lab === "string" && t.lab.length > 0, `${rootName}${q} 第 ${i} 个音应有级数标签`);
      check(typeof t.name === "string" && /^[A-G]/.test(t.name), `${rootName}${q} 第 ${i} 个音应有字母音名`);
    });

    const { marks } = thChordToolMarks(root, q);
    const pcs = tones.map(t => (thPc(root) + t.semi) % 12);
    const expectCells = cellsIn(tun, 0, FRET_MAX, pc => pcs.includes(pc));
    check(Object.keys(marks).length === expectCells.length,
      `${rootName}${q} 全指板标记数应等于该和弦音在整条指板出现的次数：got ${Object.keys(marks).length} want ${expectCells.length}`);
    for (const c of expectCells) {
      const key = c.s + "-" + c.f;
      const mk = marks[key];
      check(!!mk, `${rootName}${q} 位置 ${key} 应该有标记`);
      if (mk) {
        const t = tones.find(t => (thPc(root) + t.semi) % 12 === c.midi % 12);
        check(mk.label === t.lab, `${rootName}${q} 位置 ${key} 的级数标签应为 ${t.lab}，实际 ${mk.label}`);
      }
    }
    // 边界品位（第 0 品和第 FRET_MAX 品）如果本来就该有音，不能被漏掉
    const edgeCells = expectCells.filter(c => c.f === 0 || c.f === FRET_MAX);
    for (const c of edgeCells) check(!!marks[c.s + "-" + c.f], `${rootName}${q} 边界品位 ${c.s}-${c.f} 不应被漏掉`);
  };
  checkChord("C", "dom7");
  checkChord("F♯", "min7");
  checkChord("B♭", "maj9");

  // 所有 12 个根音 × 已注册的每种和弦质量都不应该抛错、且至少有一个标记位置
  for (const root of TH_ROOTS12) {
    for (const q of Object.keys(TH_CH)) {
      let marks;
      try { ({ marks } = thChordToolMarks(root, q)); } catch (e) { check(false, `${thNm(root)}${q} 生成指板标记报错：${e.message}`); continue; }
      check(Object.keys(marks).length > 0, `${thNm(root)}${q} 应该至少有一个指板位置`);
    }
  }
  // 分组清单不能漏掉或多出和弦质量，否则选择器里会少一种或多一个不存在的 key
  const grouped = THCT_GROUPS.flatMap(g => g.keys);
  check(grouped.length === Object.keys(TH_CH).length, "和弦质量分组数量应等于 TH_CH 里登记的种类数：got " + grouped.length + " want " + Object.keys(TH_CH).length);
  check(new Set(grouped).size === grouped.length, "和弦质量分组不应有重复");
  for (const k of grouped) check(!!TH_CH[k], "分组里的 " + k + " 应该是已注册的和弦质量");

  console.log("和弦工具：" + (fails ? "有失败项" : "级数/音名/指板全部通过"));
}

console.log(fails ? `\n✕ ${fails} 项失败` : "\n✓ 乐理课测试全部通过");
process.exit(fails ? 1 : 0);
