"use strict";
/* 指板 · 级数定位：报级数找根音 / 看位置认级数 / 和弦音形状 / 套路根音连弹 / 换调平移
   按实际调弦出题（默认 C E A D G），以 1 级为原点思考，同时计正确率和反应时间。
   依赖：theory.js（MODES、PATTERNS、SEQ_POOL）、audio.js（AE、noteName），
   运行时调用 app.js 的 S、render、recordAnswer、levelStat 等（只在函数体内引用）。 */

const FRET_MAX = 15;   // 画 0 到 15 品
// 调弦预设，按弦数分组；每组第一个是该弦数的标准调弦（切换弦数时的默认）
const FRET_PRESETS = {
  5:[{id:"BEADG",    label:"B E A D G（标准）",          notes:[23,28,33,38,43]},
     {id:"CEADG",    label:"C E A D G（低 B 调成 C）",   notes:[24,28,33,38,43]},
     {id:"ADGCF",    label:"A D G C F（整体降全音）",    notes:[21,26,31,36,41]},
     {id:"BbEbAbDbGb",label:"B♭ E♭ A♭ D♭ G♭（整体降半音）", notes:[22,27,32,37,42]},
     {id:"EADGC",    label:"E A D G C（高音五弦）",      notes:[28,33,38,43,48]}],
  4:[{id:"EADG",     label:"E A D G（标准）",            notes:[28,33,38,43]},
     {id:"DADG",     label:"D A D G（Drop D）",          notes:[26,33,38,43]},
     {id:"EbAbDbGb", label:"E♭ A♭ D♭ G♭（整体降半音）", notes:[27,32,37,42]},
     {id:"DGCF",     label:"D G C F（整体降全音）",      notes:[26,31,36,41]},
     {id:"CGCF",     label:"C G C F（Drop C）",          notes:[24,31,36,41]}]
};
const FRET_DEFAULT_STRINGS = 5;
const CUSTOM_LO = 18, CUSTOM_HI = 55;   // 自定义每根弦可选 F#0 到 G3
const FRET_KEYS = [
  {name:"C",pc:0},{name:"D♭",pc:1},{name:"D",pc:2},{name:"E♭",pc:3},{name:"E",pc:4},{name:"F",pc:5},
  {name:"F♯",pc:6},{name:"G",pc:7},{name:"A♭",pc:8},{name:"A",pc:9},{name:"B♭",pc:10},{name:"B",pc:11}
];
// 顺阶七级：级数决定和弦性质（方法论文档的规律 1）
const FDEG = [
  {k:"1", semi:0, q:"M7",   chord:"1M7",   fn:"T"},
  {k:"2m",semi:2, q:"m7",   chord:"2m7",   fn:"S"},
  {k:"3m",semi:4, q:"m7",   chord:"3m7",   fn:"T"},
  {k:"4", semi:5, q:"M7",   chord:"4M7",   fn:"S"},
  {k:"5", semi:7, q:"7",    chord:"5(7)",  fn:"D"},
  {k:"6m",semi:9, q:"m7",   chord:"6m7",   fn:"T"},
  {k:"7ø",semi:11,q:"m7b5", chord:"7m7♭5", fn:"D"}
];
const FDEG_BY = Object.fromEntries(FDEG.map(d=>[d.k, d]));
const FQ_TONES = {
  "M7":  [["3",4],["5",7],["7",11],["8",12]],
  "7":   [["3",4],["5",7],["♭7",10],["8",12]],
  "m7":  [["♭3",3],["5",7],["♭7",10],["8",12]],
  "m7b5":[["♭3",3],["♭5",6],["♭7",10],["8",12]]
};
const FQ_NAME = {"M7":"大七：1 3 5 7", "7":"属七：1 3 5 ♭7", "m7":"小七：1 ♭3 5 ♭7", "m7b5":"半减七：1 ♭3 ♭5 ♭7"};
const INT_LABEL = ["1","♭2","2","♭3","3","4","♭5","5","♭6","6","♭7","7"];
const CN_NUM = ["","一","两","三","四","五","六"];

MODES.fret = {
  key:"fret", stage:"指板", name:"级数定位", cssColor:"var(--accent-fret)", meterCls:"f",
  desc:"手和眼的那一半：以 1 为原点，在把位里一眼找到任意级数的根音和和弦音。按你的实际调弦出题，正确率和反应时间都要达标才算过关。",
  levels:[
    {id:"f-1", kind:"find",  name:"档 1 · 报级数找根音", goal:"给一个级数，在把位框里点出它的根音。1 级标出来当原点", rtLimit:3000},
    {id:"f-2", kind:"name",  name:"档 2 · 看位置认级数", goal:"亮一个位置，说出它是几级。和档 1 方向相反，两个方向都要熟", rtLimit:2500},
    {id:"f-3", kind:"tone",  name:"档 3 · 和弦音形状",   goal:"级数决定性质：给出 6m7 的根音，找它的 ♭3、5、♭7（三和弦形状 + 七音）", rtLimit:3500},
    {id:"f-4", kind:"seq",   name:"档 4 · 套路根音连弹", goal:"王道、小室、卡农……按顺序点出每个和弦的根音，计每个音的平均用时", rtLimit:2000},
    {id:"f-5", kind:"mixed", name:"档 5 · 换调平移",     goal:"每题随机调、随机把位，不再标 1：先自己找到 1，再找级数或认级数", rtLimit:4500}
  ]
};
const FRET_LEVEL_IDS = new Set(MODES.fret.levels.map(l=>l.id));
function levelRtLimit(levelId){
  const lv = MODES.fret.levels.find(l=>l.id === levelId);
  return lv ? lv.rtLimit : null;
}
function medianRT(st){
  const a = (st && st.rt || []).filter(x=>x > 0).slice().sort((x,y)=>x-y);
  return a.length ? a[Math.floor(a.length/2)] : null;
}
function fmtSec(ms){ return (ms/1000).toFixed(1) + "s"; }

/* ---------------- 调弦、调、把位 ---------------- */
function parseTuning(str){
  const toks = String(str||"").trim().split(/[\s,，]+/).filter(Boolean);
  if(toks.length < 4 || toks.length > 7) return null;
  const out = [];
  for(const t of toks){
    const m = t.match(/^([A-Ga-g])([#b♯♭]?)(-?\d)$/);
    if(!m) return null;
    const base = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1].toLowerCase()];
    const acc = (m[2]==="#"||m[2]==="♯") ? 1 : ((m[2]==="b"||m[2]==="♭") ? -1 : 0);
    out.push(base + acc + (parseInt(m[3],10)+1)*12);
  }
  for(let i=1; i<out.length; i++) if(out[i] <= out[i-1]) return null;
  return out;
}
function fretStrings(){ return S.data.settings.fretStrings === 4 ? 4 : 5; }
function validTuning(arr, n){
  if(!Array.isArray(arr) || arr.length !== n) return false;
  for(let i=0; i<n; i++){
    if(!Number.isInteger(arr[i]) || arr[i] < CUSTOM_LO || arr[i] > CUSTOM_HI) return false;
    if(i && arr[i] <= arr[i-1]) return false;
  }
  return true;
}
function fretCustom(n){
  const c = (S.data.settings.fretCustom || {})[n];
  return validTuning(c, n) ? c.slice() : FRET_PRESETS[n][0].notes.slice();
}
function fretTuning(){
  const st = S.data.settings, n = fretStrings();
  if(st.fretTuning === "custom") return fretCustom(n);
  const p = FRET_PRESETS[n].find(x=>x.id === st.fretTuning) || FRET_PRESETS[n][0];
  return p.notes.slice();
}
function tuningText(tun){ return tun.map(noteName).join(" "); }
/* 一次性迁移：旧版只有 fretTuning 一个字段（默认 CEADG）。
   新版拆成 弦数 + 调弦，默认改为 5 弦 BEADG（2026-11-20 按 Jadyn 要求）。 */
function fretMigrate(st){
  if(!st || st.fretTuneV >= 2) return st;
  const old = st.fretTuning;
  if(old === "custom"){
    const arr = parseTuning(st.fretTuningCustom);
    if(arr && (arr.length === 4 || arr.length === 5) && validTuning(arr, arr.length)){
      st.fretStrings = arr.length;
      st.fretCustom = Object.assign({}, st.fretCustom, {[arr.length]: arr});
    }else{ st.fretStrings = FRET_DEFAULT_STRINGS; st.fretTuning = "BEADG"; }
  }else if(old === "EADG" || old === "DADG"){ st.fretStrings = 4; }
  else if(old === "EADGC"){ st.fretStrings = 5; }
  else { st.fretStrings = FRET_DEFAULT_STRINGS; st.fretTuning = "BEADG"; }
  delete st.fretTuningCustom;
  st.fretTuneV = 2;
  return st;
}
function fretKey(){ return FRET_KEYS.find(k=>k.name === S.data.settings.fretKey) || FRET_KEYS[0]; }
function stringName(tun, s){ return noteName(tun[s]) + " 弦"; }
function degOfPc(keyPc, pc){ const rel = ((pc - keyPc) % 12 + 12) % 12; return FDEG.find(d=>d.semi === rel) || null; }
function degLabelOfPc(keyPc, pc){
  const d = degOfPc(keyPc, pc);
  return d ? d.k : "调外 " + INT_LABEL[((pc - keyPc) % 12 + 12) % 12];
}
/* 把位框：以某个 1 为原点，覆盖 原点−1 到 原点+2 品。
   四度调弦下这 4 品里七个级数全都有（7 在同弦 −1，3m 在上一弦 −1，2 在同弦 +2……）。
   原点优先放在下面还留一根弦、上面还留两根弦的位置，这样 5、6m 在下方也找得到。 */
function fretAnchors(tun, keyPc){
  const out = [], sMax = Math.max(0, tun.length - 3);
  for(let s=0; s<=sMax; s++) for(let f=1; f<=FRET_MAX-3; f++)
    if((tun[s] + f) % 12 === keyPc) out.push({s, f});
  return out;
}
function fretBox(tun, keyPc, random){
  let cands = fretAnchors(tun, keyPc);
  const pref = cands.filter(a=>a.s >= 1);
  if(pref.length) cands = pref;
  let a;
  if(random){ a = cands[Math.floor(Math.random()*cands.length)]; }
  else{
    const ok = cands.filter(c=>c.f >= 2);
    a = (ok.length ? ok : cands).reduce((x,y)=> (y.f < x.f || (y.f === x.f && y.s > x.s)) ? y : x);
  }
  return {lo:Math.max(0, a.f-1), hi:Math.min(FRET_MAX, a.f+2), anchor:a};
}
function cellsIn(tun, lo, hi, pred){
  const out = [];
  for(let s=0; s<tun.length; s++) for(let f=Math.max(0,lo); f<=Math.min(FRET_MAX,hi); f++){
    const midi = tun[s] + f;
    if(pred(midi % 12, s, f)) out.push({s, f, midi});
  }
  return out;
}
const sameCell = (a,b)=> a && b && a.s === b.s && a.f === b.f;
/* 两个位置的相对形状，用「上一弦 −1 品」这种说法（上 = 音高更高的弦，屏幕上也在上面） */
function relText(a, b){
  const ds = b.s - a.s, df = b.f - a.f;
  const sw = ds === 0 ? "同弦" : (ds > 0 ? "上" + CN_NUM[ds] + "弦" : "下" + CN_NUM[-ds] + "弦");
  const fw = df === 0 ? "同品" : ((df > 0 ? "+" : "−") + Math.abs(df) + " 品");
  return sw + " " + fw;
}
/* 两根弦之间不是纯四度（如 C→E 是大三度）时，跨过它的形状要挪品 */
function irregularBetween(tun, a, b){
  const lo = Math.min(a.s, b.s), hi = Math.max(a.s, b.s);
  for(let s=lo; s<hi; s++){ const iv = tun[s+1] - tun[s]; if(iv !== 5) return {s, iv}; }
  return null;
}
function irregularNote(tun, pairs){
  for(const [a,b] of pairs){
    const ir = irregularBetween(tun, a, b);
    if(ir){
      const nm = {3:"小三度",4:"大三度",6:"三全音",7:"纯五度"}[ir.iv] || (ir.iv + " 个半音");
      const shift = 5 - ir.iv;
      return "注意：" + noteName(tun[ir.s]) + " 弦到 " + noteName(tun[ir.s+1]) + " 弦之间是" + nm + "（不是四度），" +
        "跨过这两根弦的形状要往" + (shift > 0 ? "高" : "低") + "处挪 " + Math.abs(shift) + " 品。";
    }
  }
  return "";
}

/* ---------------- 出题 ---------------- */
function fretPatternPool(){
  const out = [], seen = new Set();
  const add = (name, seq)=>{ const k = seq.join(" "); if(seen.has(k)) return; seen.add(k); out.push({name, seq}); };
  for(const p of PATTERNS){
    const seq = []; let prev = null;
    for(const s of p.steps){ if(s.deg === prev) continue; prev = s.deg; seq.push(s.deg); }
    if(seq.every(d=>FDEG_BY[d])) add(p.name, seq);
  }
  const short = {"1 6m 4 5":"50 年代循环", "1 3m 6m 4":"鲜花主循环", "2m 5 1 6m":"2m 5 1 加 6m", "1 4 5 4":"1 4 5 循环"};
  for(const s of SEQ_POOL){
    if(s.seq.every(d=>FDEG_BY[d])) add(short[s.seq.join(" ")] || s.note.split(/[，：]/)[0].replace(/^这就是/, ""), s.seq);
  }
  return out;
}
function pickOther(arr, last, keyFn){
  let x = arr[Math.floor(Math.random()*arr.length)];
  for(let i=0; i<6 && arr.length > 1 && keyFn(x) === last; i++) x = arr[Math.floor(Math.random()*arr.length)];
  return x;
}
function degSoundEvents(anchorMidi, targetMidi){
  return [{t:0, dur:0.9, midi:anchorMidi, voice:"bass", vel:0.9},
          {t:1, dur:1.5, midi:targetMidi, voice:"bass", vel:1}];
}
function genFretQuestion(){
  const level = MODES.fret.levels[S.levelIdx];
  const tun = fretTuning();
  const mixed = level.kind === "mixed";
  const key = mixed ? pickOther(FRET_KEYS, S.lastQ["f-key"], k=>k.name) : fretKey();
  if(mixed) S.lastQ["f-key"] = key.name;
  const box = fretBox(tun, key.pc, mixed);
  const kind = mixed ? (Math.random() < 0.5 ? "find" : "name") : level.kind;
  const anchorMidi = tun[box.anchor.s] + box.anchor.f;
  const q = {fret:true, level, key, tun, box, kind:"f-" + kind, showAnchor:!mixed, noAutoPlay:true,
             events:[], options:[], answerValue:null, result:null, t0:0};
  const last = S.lastQ[level.id];

  if(kind === "find"){
    const ok = FDEG.map(d=>({d, cells: cellsIn(tun, box.lo, box.hi, pc=>pc === (key.pc + d.semi) % 12)
                              .filter(c=> !(q.showAnchor && sameCell(c, box.anchor)))}))
                   .filter(x=>x.cells.length);
    const pick = pickOther(ok, last, x=>x.d.k);
    S.lastQ[level.id] = pick.d.k;
    q.target = pick.d; q.targets = pick.cells; q.answerValue = pick.d.k;
    q.prompt = pick.d.k; q.promptSub = pick.d.k === "1" && q.showAnchor ? "找另一个八度的 1" : "点出它的根音";
    q.events = degSoundEvents(anchorMidi, pick.cells[0].midi);
  }else if(kind === "name"){
    const cells = cellsIn(tun, box.lo, box.hi, pc=>!!degOfPc(key.pc, pc))
      .filter(c=> !(q.showAnchor && sameCell(c, box.anchor)));
    const cell = pickOther(cells, last, c=>c.s + "-" + c.f);
    S.lastQ[level.id] = cell.s + "-" + cell.f;
    const d = degOfPc(key.pc, cell.midi % 12);
    q.cell = cell; q.target = d; q.answerValue = d.k;
    q.prompt = "这是几级？"; q.promptSub = "亮着的位置";
    q.options = FDEG.map(x=>({value:x.k, label:x.k, sub:x.chord}));
    q.events = degSoundEvents(anchorMidi, cell.midi);
  }else if(kind === "tone"){
    for(let attempt=0; attempt<40; attempt++){
      const d = pickOther(FDEG, last && last.split("|")[0], x=>x.k);
      const rootPc = (key.pc + d.semi) % 12;
      const roots = cellsIn(tun, 2, FRET_MAX-3, (pc,s)=> pc === rootPc && s <= tun.length - 2);
      if(!roots.length) continue;
      const root = roots[Math.floor(Math.random()*roots.length)];
      const tones = FQ_TONES[d.q];
      const tone = Math.random() < 0.12 ? tones[3] : tones[Math.floor(Math.random()*3)];
      const lo = Math.max(0, root.f-2), hi = Math.min(FRET_MAX, root.f+3);
      const targets = cellsIn(tun, lo, hi, pc=> pc === (rootPc + tone[1]) % 12).filter(c=>!sameCell(c, root));
      if(!targets.length) continue;
      if(last === d.k + "|" + tone[0]) continue;
      S.lastQ[level.id] = d.k + "|" + tone[0];
      q.box = {lo, hi, anchor:{s:root.s, f:root.f}};
      q.target = d; q.tone = tone; q.targets = targets; q.answerValue = tone[0]; q.rootMidi = root.midi;
      q.prompt = d.chord + " 的 " + tone[0];
      q.promptSub = FQ_NAME[d.q] + " · 根音已标出";
      q.events = [0,1,2,3].map(i=>{
        const iv = i === 0 ? 0 : tones[i-1][1];
        return {t:i*0.75, dur:0.7, midi:root.midi + iv, voice:"bass", vel:i ? 0.85 : 1};
      }).concat([{t:3.2, dur:1.4, midi:root.midi + tone[1], voice:"bass", vel:1}]);
      break;
    }
  }else if(kind === "seq"){
    const pool = fretPatternPool();
    const pat = pickOther(pool, last, p=>p.seq.join(" "));
    S.lastQ[level.id] = pat.seq.join(" ");
    q.pat = pat; q.step = 0; q.hits = []; q.answerValue = pat.name;
    q.prompt = pat.seq.join("  "); q.promptSub = pat.name + " · 按顺序点根音";
    q.events = pat.seq.map((dk,i)=>{
      const pc = (key.pc + FDEG_BY[dk].semi) % 12;
      const c = cellsIn(tun, box.lo, box.hi, p=>p === pc)[0];
      return {t:i, dur:0.92, midi:c ? c.midi : anchorMidi, voice:"bass", vel:1};
    });
  }
  S.q = q;
  q.t0 = performance.now();
}

/* ---------------- 作答 ---------------- */
function playFretNote(midi){
  if(S.data.settings.fretSound === false) return;
  AE.ensure();
  AE.play([{t:0, dur:1.3, midi, voice:"bass", vel:1}], {bpm:100});
}
function fretFinish(ok, extra){
  const q = S.q;
  S.answered = true;
  q.result = Object.assign({ok}, extra || {});
  render();
}
function fretCellClick(s, f){
  const q = S.q;
  const inQuiz = S.screen === "quiz" && q && q.fret;
  const tun = inQuiz ? q.tun : fretTuning();
  const midi = tun[s] + f;
  if(!inQuiz){ playFretNote(midi); return; }
  if(S.answered || q.kind === "f-name"){ playFretNote(midi); return; }
  if(f < q.box.lo || f > q.box.hi) return;
  const cell = {s, f, midi};
  if(q.kind === "f-tone" && sameCell(cell, q.box.anchor)){
    playFretNote(midi);
    q.hint = "这是根音本身" + (q.tone[0] === "8" ? "，找它的八度" : "");
    render(); return;
  }
  if(q.kind === "f-find" && q.showAnchor && sameCell(cell, q.box.anchor)){
    playFretNote(midi);
    q.hint = q.target.k === "1" ? "这个就是标出来的 1，找另一个八度的 1" : "这是原点 1";
    render(); return;
  }
  playFretNote(midi);
  const ms = performance.now() - q.t0;
  if(q.kind === "f-seq"){
    const dk = q.pat.seq[q.step];
    const want = (q.key.pc + FDEG_BY[dk].semi) % 12;
    const ok = midi % 12 === want;
    q.hits.push({s, f, midi, ok, dk});
    if(!ok){
      recordAnswer(q.level.id, dk, degLabelOfPc(q.key.pc, midi % 12), 0);
      fretFinish(false, {ms, clicked:cell, wrongAt:q.step});
      return;
    }
    q.step++;
    q.hint = "";
    if(q.step >= q.pat.seq.length){
      const per = ms / q.pat.seq.length;
      recordAnswer(q.level.id, q.pat.name, q.pat.name, per);
      fretFinish(true, {ms, per});
    }else render();
    return;
  }
  let chosen;
  if(q.kind === "f-tone"){
    const rel = ((midi - q.rootMidi) % 12 + 12) % 12;
    chosen = q.tone[1] % 12 === rel ? q.tone[0] : INT_LABEL[rel];   // 统一用题面写法（8、♭5 等）
  }else{
    chosen = degLabelOfPc(q.key.pc, midi % 12);
  }
  const ok = recordAnswer(q.level.id, q.answerValue, chosen, ms);
  fretFinish(ok, {ms, clicked:cell, chosen});
}
function fretSubmitOption(i){
  const q = S.q; const opt = q.options[i]; if(!opt) return;
  const ms = performance.now() - q.t0;
  S.chosenIdx = i;
  playFretNote(q.cell.midi);
  const ok = recordAnswer(q.level.id, q.answerValue, opt.value, ms);
  fretFinish(ok, {ms, chosen:opt.value});
}

/* ---------------- 渲染 ---------------- */
function fretboardHtml(o){
  const tun = o.tun, n = tun.length, box = o.box, marks = o.marks || {};
  let h = '<div class="fb-scroll"' + (box ? ' data-lo="' + box.lo + '"' : "") + '><div class="fb">';
  for(let s=n-1; s>=0; s--){
    const th = Math.max(1, 3.2 - s*0.5).toFixed(1);
    h += '<div class="fb-row" style="--th:' + th + 'px"><span class="fb-open">' + noteName(tun[s]) + '</span>';
    for(let f=0; f<=FRET_MAX; f++){
      const inb = !box || (f >= box.lo && f <= box.hi);
      const mk = marks[s + "-" + f];
      const cls = "fb-cell" + (f === 0 ? " nut" : "") + (box ? (inb ? " inbox" : " outbox") : "");
      const dis = o.lockOutside && !inb;
      h += '<button class="' + cls + '" data-act="fret-cell" data-s="' + s + '" data-f="' + f + '"' + (dis ? " disabled" : "") +
        ' title="' + noteNameOct(tun[s] + f) + '">' +
        (mk ? '<span class="fb-dot ' + mk.cls + '">' + esc(mk.label || "") + '</span>' : "") + '</button>';
    }
    h += '</div>';
  }
  h += '<div class="fb-row fb-nums"><span class="fb-open"></span>';
  for(let f=0; f<=FRET_MAX; f++){
    const dot = [3,5,7,9,15].includes(f) ? " dot" : (f === 12 ? " dot2" : "");
    h += '<span class="fb-num' + dot + '">' + f + '</span>';
  }
  h += '</div></div></div>';
  return h;
}
/* 调内级数全图：所有调内音标级数，按功能着色（T 主 / S 下属 / D 属） */
function degreeMarks(tun, key, lo, hi, opt){
  const marks = {};
  for(const c of cellsIn(tun, lo, hi, pc=>!!degOfPc(key.pc, pc))){
    const d = degOfPc(key.pc, c.midi % 12);
    marks[c.s + "-" + c.f] = {cls:"deg-" + d.fn + (opt && opt.muted ? " muted" : ""), label:d.k};
  }
  return marks;
}
function fretSettingsHtml(){
  const st = S.data.settings, n = fretStrings();
  const presets = FRET_PRESETS[n];
  const tid = st.fretTuning === "custom" ? "custom" : (presets.find(p=>p.id === st.fretTuning) || presets[0]).id;
  let h = '<div class="settings-row card" style="padding:12px 14px;flex-direction:column;align-items:stretch;gap:10px">' +
    '<div class="row" style="gap:12px">' +
    '<label>贝斯 <select data-fset="strings">' +
      [4,5].map(k=>'<option value="' + k + '"' + (n === k ? " selected" : "") + '>' + k + ' 弦</option>').join("") +
    '</select></label>' +
    '<label>调弦 <select data-fset="tuning">' +
      presets.map(p=>'<option value="' + p.id + '"' + (tid === p.id ? " selected" : "") + '>' + p.label + '</option>').join("") +
      '<option value="custom"' + (tid === "custom" ? " selected" : "") + '>自定义…</option>' +
    '</select></label>';
  h += '<label>调 <select data-fset="key">' +
      FRET_KEYS.map(k=>'<option value="' + k.name + '"' + (fretKey().name === k.name ? " selected" : "") + '>' + k.name + ' 大调</option>').join("") +
    '</select></label>' +
    '<label><input type="checkbox" data-fset="sound"' + (st.fretSound !== false ? " checked" : "") + '> 点击发声</label>' +
    '</div>';
  if(tid === "custom"){
    const cur = fretCustom(n);
    const opts = sel => { let o = ""; for(let m=CUSTOM_LO; m<=CUSTOM_HI; m++) o += '<option value="' + m + '"' + (m === sel ? " selected" : "") + '>' + noteNameOct(m) + '</option>'; return o; };
    h += '<div class="row" style="gap:8px"><span class="small muted">每根弦（低 → 高）</span>' +
      cur.map((m,i)=>'<select data-fset="customStr" data-i="' + i + '" title="第 ' + (n - i) + ' 弦">' + opts(m) + '</select>').join("") +
      '</div>';
  }
  h += '</div>';
  if(S.fretMsg) h += '<div class="small" style="margin:-6px 0 12px;color:var(--bad)">' + esc(S.fretMsg) + '</div>';
  return h;
}
function renderFretMap(){
  const tun = fretTuning(), key = fretKey(), box = fretBox(tun, key.pc, false);
  const whole = !!S.data.settings.fretMapWhole;
  const marks = whole ? degreeMarks(tun, key, 0, FRET_MAX) : degreeMarks(tun, key, box.lo, box.hi);
  const am = marks[box.anchor.s + "-" + box.anchor.f];
  if(am) am.cls += " anchor";
  let h = '<hr class="divider"><h3>先看地图（' + key.name + ' 大调）</h3>' +
    '<div class="sub small" style="margin-bottom:8px">先知道答案再练。原点 1 在 <b>' + stringName(tun, box.anchor.s) + ' ' + box.anchor.f + ' 品</b>，' +
    '把位框 ' + box.lo + '–' + box.hi + ' 品里七个级数都有。颜色：<span class="fn-T">主功能 1 3m 6m</span> · ' +
    '<span class="fn-S">下属 2m 4</span> · <span class="fn-D">属 5 7ø</span>。点任意格子听音。</div>' +
    '<div class="row small" style="margin-bottom:8px"><label style="display:flex;gap:6px;align-items:center;color:var(--ink-2)">' +
    '<input type="checkbox" data-fset="mapWhole"' + (whole ? " checked" : "") + '> 显示整条指板</label></div>';
  h += fretboardHtml({tun, box, marks});
  h += '<div class="note-box" style="margin-top:10px">以 1 为原点的根音形状（四度调弦的弦之间）：2 = 同弦 +2 · 3m = 上一弦 −1 · 4 = 上一弦同品 · 5 = 下一弦同品 / 上一弦 +2 · 6m = 下一弦 +2 · 7ø = 同弦 −1。' +
    (irregularNote(tun, [[{s:0,f:0},{s:tun.length-1,f:0}]]) ? '<br>' + irregularNote(tun, [[{s:0,f:0},{s:tun.length-1,f:0}]]) : "") + '</div>';
  return h;
}
function fretRtBadge(level){
  const st = levelStat(level.id), md = medianRT(st);
  return '中位用时 <b>' + (md === null ? "–" : fmtSec(md)) + '</b> / ' + fmtSec(level.rtLimit);
}
function renderFretQuiz(){
  const m = MODES.fret, level = m.levels[S.levelIdx], q = S.q;
  const st = levelStat(level.id);
  const r = recent20Rate(st);
  const res = q.result;
  let h = '<div class="quiz-head"><span class="small muted">' + level.name + '</span>' +
    '<div class="quiz-stats"><span>近' + PASS_N + ' <b>' + (r === null ? "–" : pct(r)) + '</b></span>' +
    '<span>' + fretRtBadge(level) + '</span><span>连对 <b>' + st.streak + '</b></span>' +
    (st.passed ? '<span style="color:var(--good)">✓ 已过关</span>' : "") + '</div></div>';

  // 题面
  const boxTxt = q.kind === "f-tone" ? "" : ' · 把位 ' + q.box.lo + '–' + q.box.hi + ' 品';
  const anchorTxt = q.kind === "f-tone" ? "" :
    (q.showAnchor ? ' · 1 在 ' + stringName(q.tun, q.box.anchor.s) + ' ' + q.box.anchor.f + ' 品' : ' · 先自己找到 1');
  h += '<div class="fret-prompt" style="--mode-c:' + m.cssColor + '">' +
    '<div class="fp-key">' + q.key.name + ' 大调' + boxTxt + anchorTxt + ' · ' + q.tun.length + ' 弦 ' + tuningText(q.tun) + '</div>';
  if(q.kind === "f-seq"){
    h += '<div class="fp-seq">' + q.pat.seq.map((d,i)=>{
      const hit = q.hits[i];
      const cls = hit ? (hit.ok ? "done" : "bad") : (i === q.step && !S.answered ? "cur" : "");
      return '<span class="' + cls + '">' + d + '</span>';
    }).join("") + '</div>';
  }else{
    h += '<div class="fp-main">' + esc(q.prompt) + '</div>';
  }
  h += '<div class="fp-sub">' + esc(q.promptSub) + '</div>' +
    (q.hint && !S.answered ? '<div class="fp-hint">' + esc(q.hint) + '</div>' : "") + '</div>';

  // 指板标记
  const marks = {};
  const ak = q.box.anchor.s + "-" + q.box.anchor.f;
  if(S.answered){
    if(q.kind === "f-tone"){
      const rootPc = q.rootMidi % 12;
      const tones = [["1",0]].concat(FQ_TONES[q.target.q].slice(0,3));
      for(const c of cellsIn(q.tun, q.box.lo, q.box.hi, ()=>true)){
        const rel = ((c.midi % 12 - rootPc) + 12) % 12;
        const t = tones.find(x=>x[1] % 12 === rel);
        if(t) marks[c.s + "-" + c.f] = {cls:"muted", label:t[0]};
      }
      for(const c of q.targets) marks[c.s + "-" + c.f] = {cls:"ok", label:q.tone[0]};
    }else{
      Object.assign(marks, degreeMarks(q.tun, q.key, q.box.lo, q.box.hi, {muted:true}));
      if(q.kind === "f-find") for(const c of q.targets) marks[c.s + "-" + c.f] = {cls:"ok", label:q.target.k};
      if(q.kind === "f-name") marks[q.cell.s + "-" + q.cell.f] = {cls: res.ok ? "ok" : "bad", label:q.target.k};
    }
    if(q.kind === "f-seq"){
      q.hits.forEach((hh,i)=>{ marks[hh.s + "-" + hh.f] = {cls: hh.ok ? "ok" : "bad", label: hh.ok ? hh.dk : degLabelOfPc(q.key.pc, hh.midi % 12)}; });
      if(!res.ok){
        const dk = q.pat.seq[res.wrongAt], pc = (q.key.pc + FDEG_BY[dk].semi) % 12;
        for(const c of cellsIn(q.tun, q.box.lo, q.box.hi, p=>p === pc))
          if(!marks[c.s + "-" + c.f] || marks[c.s + "-" + c.f].cls.includes("muted")) marks[c.s + "-" + c.f] = {cls:"ok ring", label:dk};
      }
    }
    if(res.clicked && !res.ok && q.kind !== "f-seq"){
      const lab = q.kind === "f-tone" ? res.chosen : degLabelOfPc(q.key.pc, res.clicked.midi % 12);
      marks[res.clicked.s + "-" + res.clicked.f] = {cls:"bad", label:lab};
    }
  }else{
    if(q.kind === "f-name") marks[q.cell.s + "-" + q.cell.f] = {cls:"target", label:"?"};
    if(q.kind === "f-seq") q.hits.forEach(hh=>{ marks[hh.s + "-" + hh.f] = {cls:"ok", label:hh.dk}; });
  }
  if(q.showAnchor || S.answered){
    if(q.kind === "f-tone") marks[ak] = {cls:"anchor", label:q.target.k};
    else if(!marks[ak] || marks[ak].cls.includes("muted")) marks[ak] = {cls:"anchor", label:"1"};
    else marks[ak].cls += " anchor";
  }
  h += fretboardHtml({tun:q.tun, box:q.box, marks, lockOutside:true});

  // 认级数：选项
  if(q.kind === "f-name"){
    h += '<div class="opts narrow" style="margin-top:12px">' + q.options.map((o,i)=>{
      let cls = "opt";
      if(S.answered){
        if(o.value === q.answerValue) cls += " correct";
        else if(i === S.chosenIdx) cls += " wrong";
        else cls += " dim";
      }
      return '<button class="' + cls + '" data-act="answer" data-i="' + i + '"' + (S.answered ? " disabled" : "") + '>' +
        '<span class="key-hint">' + (i+1) + '</span>' + esc(o.label) + '<span class="opt-sub">' + esc(o.sub) + '</span></button>';
    }).join("") + '</div>';
  }

  if(S.answered && res) h += fretFeedbackHtml(q, res, m);
  h += '<div class="tiny muted" style="text-align:center;margin-top:10px">' +
    (q.kind === "f-name" ? "键盘：数字 1–7 选级数 · " : "直接点指板作答 · ") +
    '空格听级数 · 回车下一题 · Esc 返回</div>';
  return h;
}
function fretFeedbackHtml(q, res, m){
  const lim = q.level.rtLimit;
  const t = q.kind === "f-seq" && res.ok ? res.per : res.ms;
  const timeTxt = '用时 ' + fmtSec(t) + (q.kind === "f-seq" && res.ok ? " / 每个音" : "") +
    (res.ok ? (t <= lim ? '，在目标 ' + fmtSec(lim) + ' 内' : '，<span style="color:var(--warn)">慢于目标 ' + fmtSec(lim) + '</span>') : "");
  const A = q.box.anchor;
  let title, det = "", irr = "";
  if(q.kind === "f-find"){
    title = res.ok ? "对，" + q.target.k + " 在这里" : "是 " + q.target.k + "，你点的是 " + res.chosen;
    det = "从 1 出发：" + q.targets.map(c=>"<b>" + relText(A, c) + "</b>").join("，") +
      "。和弦 " + q.target.chord + "（" + FQ_NAME[q.target.q] + "）。";
    irr = irregularNote(q.tun, q.targets.map(c=>[A, c]));
  }else if(q.kind === "f-name"){
    title = res.ok ? "对，是 " + q.target.k : "是 " + q.target.k + "，你选了 " + res.chosen;
    det = "这个位置是 <b>" + noteName(q.cell.midi) + "</b>，从 1 出发 <b>" + relText(A, q.cell) + "</b>。和弦 " + q.target.chord + "（" + FQ_NAME[q.target.q] + "）。";
    irr = irregularNote(q.tun, [[A, q.cell]]);
  }else if(q.kind === "f-tone"){
    title = res.ok ? "对，" + q.prompt : q.prompt + " 不在那里，你点的是 " + res.chosen;
    det = "从根音出发：" + q.targets.map(c=>"<b>" + relText(A, c) + "</b>").join("，") + "。" +
      q.target.k + " 级是" + FQ_NAME[q.target.q].split("：")[0] + "，琶音 " + FQ_NAME[q.target.q].split("：")[1] + "。";
    irr = irregularNote(q.tun, q.targets.map(c=>[A, c]));
  }else{
    const p = q.pat;
    if(res.ok){
      title = "对，" + p.name + " 一口气点完";
      const legs = [];
      for(let i=1; i<q.hits.length; i++) legs.push(q.hits[i-1].dk + "→" + q.hits[i].dk + " " + relText(q.hits[i-1], q.hits[i]));
      det = "你走的根音线：" + legs.join(" · ") + "。";
      irr = irregularNote(q.tun, q.hits.slice(1).map((hh,i)=>[q.hits[i], hh]));
    }else{
      const hh = q.hits[q.hits.length-1];
      title = "第 " + (res.wrongAt+1) + " 个应该是 " + hh.dk + "，你点的是 " + degLabelOfPc(q.key.pc, hh.midi % 12);
      det = "绿圈是 " + hh.dk + " 在这个把位里的位置。" + p.name + "：" + p.seq.join(" ") + "。";
    }
  }
  return '<div class="feedback ' + (res.ok ? "ok" : "no") + '" style="--mode-c:' + m.cssColor + ';margin-top:12px">' +
    '<div class="fb-title">' + (res.ok ? "✓ " : "✕ ") + title + '</div>' +
    '<div class="fb-detail">' + det + ' <span class="muted">' + timeTxt + '</span>' +
    (irr ? '<br><span style="color:var(--warn)">' + irr + '</span>' : "") + '</div>' +
    '<div class="fb-actions"><button data-act="replay">听级数（空格）</button>' +
    '<button class="next" data-act="next">下一题 <span class="kbd" style="color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.35)">回车</span></button></div></div>';
}

/* 窄屏时指板横向滚动：每次渲染后把把位框滚进视野 */
function fretAfterRender(){
  document.querySelectorAll(".fb-scroll[data-lo]").forEach(el=>{
    if(el.scrollWidth <= el.clientWidth) return;
    const cell = el.querySelector('.fb-cell[data-f="' + el.dataset.lo + '"]');
    if(cell) el.scrollLeft = Math.max(0, cell.offsetLeft - 70);
  });
}

/* ---------------- 事件 ---------------- */
function handleFretAct(act, btn){
  if(act === "fret-cell"){ fretCellClick(parseInt(btn.dataset.s,10), parseInt(btn.dataset.f,10)); }
}
document.addEventListener("change", e=>{
  const el = e.target.closest("[data-fset]");
  if(!el) return;
  const st = S.data.settings;
  S.fretMsg = "";
  switch(el.dataset.fset){
    case "strings": {
      const n = parseInt(el.value, 10) === 4 ? 4 : 5;
      st.fretStrings = n;
      // 换弦数后，原调弦若不属于新弦数就回到标准调弦；自定义保持（每种弦数各存一份）
      if(st.fretTuning !== "custom" && !FRET_PRESETS[n].some(p=>p.id === st.fretTuning)) st.fretTuning = FRET_PRESETS[n][0].id;
      break;
    }
    case "tuning": st.fretTuning = el.value; break;
    case "customStr": {
      const n = fretStrings(), arr = fretCustom(n);
      arr[parseInt(el.dataset.i, 10)] = parseInt(el.value, 10);
      if(validTuning(arr, n)) st.fretCustom = Object.assign({}, st.fretCustom, {[n]: arr});
      else S.fretMsg = "每根弦要比下面那根高：从低到高依次升高，没有保存这次改动";
      break;
    }
    case "key": st.fretKey = el.value; break;
    case "sound": st.fretSound = el.checked; break;
    case "mapWhole": st.fretMapWhole = el.checked; break;
  }
  saveData();
  render();
});
