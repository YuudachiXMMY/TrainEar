"use strict";
/* 乐理课引擎：拼写（字母 + 升降号）、课程页、选择题 / 指板题 / 节奏题的出题、作答与渲染。
   课程内容在 th-basics.js、th-harmony.js、th-advanced.js、th-bassline.js 里用 thRegisterCourse 注册。
   依赖：theory.js（MODES、DEGREES、CHORD_SHAPES、PATTERNS、OUTSIDE_POOL…）、audio.js（AE、voiceLead、foldBass…）、
   fret.js（fretboardHtml、fretTuning、fretBox、cellsIn、relText…）。运行时调用 state.js 的 S、render、recordAnswer 等。
   全局名一律以 th / TH_ 开头，避免和其他脚本的顶层声明冲突。 */

import { MODES, CHORD_SHAPES, PASS_N, PASS_RATE } from "./theory.js";
import { AE, voiceLead, bassTonic } from "./audio.js";
import { fretTuning, fretBox, cellsIn, FRET_MAX, fretboardHtml, tuningText } from "./fret.js";
import { S, render, recordAnswer, levelStat, recent20Rate, esc, pct, todayStr, saveData, startQuestion } from "./state.js";

/* ================================================================
   注册表
   ================================================================ */
export const TH_MODE_KEYS = [];   // 课程按注册顺序进首页和进度页
export const TH_KINDS = {};       // 题型：gen(level) → 题；fb(q, res, ok) → {title, detail}；可选 click(q, cell, ms)
export const TH_LESSONS = {};     // 课 id → 课
export function thRegisterCourse(mode){
  MODES[mode.key] = mode;
  TH_MODE_KEYS.push(mode.key);
  for(const l of mode.lessons) TH_LESSONS[l.id] = Object.assign(l, {mode:mode.key});
}
export function isTheoryMode(k){ return TH_MODE_KEYS.includes(k); }
export function thLevel(levelId){
  for(const k of TH_MODE_KEYS){ const lv = MODES[k].levels.find(l=>l.id === levelId); if(lv) return lv; }
  return null;
}
// 混淆记录的措辞：听力题「听成」，其余「答成」
export function thConfVerb(levelId){ const lv = thLevel(levelId); return lv ? (lv.ear ? " 听成 " : " 答成 ") : null; }

/* ================================================================
   拼写：音 = 字母 + 升降号。音程、音阶、和弦都按「每个字母用一次」来拼，
   所以 F♯ 大调的 7 级是 E♯ 而不是 F，C 减七的七音是 B♭♭。
   ================================================================ */
export const TH_LET = ["C","D","E","F","G","A","B"];
export const TH_LET_PC = [0,2,4,5,7,9,11];
export const TH_ACC = {"-2":"♭♭", "-1":"♭", "0":"", "1":"♯", "2":"♯♯"};
export function thN(L, acc){ return {L:((L % 7) + 7) % 7, acc:acc || 0}; }
export function thP(str){
  const m = String(str).trim().match(/^([A-G])(♯♯|##|♭♭|bb|♯|#|♭|b)?$/);
  if(!m) return null;
  const a = m[2] || "";
  const acc = {"":0, "♯":1, "#":1, "♯♯":2, "##":2, "♭":-1, "b":-1, "♭♭":-2, "bb":-2}[a];
  return thN(TH_LET.indexOf(m[1]), acc);
}
export function thPc(n){ return ((TH_LET_PC[n.L] + n.acc) % 12 + 12) % 12; }
export function thNm(n){ return TH_LET[n.L] + (TH_ACC[n.acc] ?? "?"); }
// 从 n 往上 num 度、semi 个半音的音（字母先定，再补升降号）
export function thUp(n, num, semi){
  const L = ((n.L + num - 1) % 7 + 7) % 7;
  let acc = ((thPc(n) + semi - TH_LET_PC[L]) % 12 + 12) % 12;
  if(acc > 6) acc -= 12;
  return thN(L, acc);
}
export const thSame = (a, b)=> a.L === b.L && a.acc === b.acc;

/* ---------------- 音程 ---------------- */
export const TH_IV = [
  {k:"P1", num:1, semi:0,  zh:"纯一度", d:"1"},
  {k:"m2", num:2, semi:1,  zh:"小二度", d:"♭2", feel:"最刺、最紧"},
  {k:"M2", num:2, semi:2,  zh:"大二度", d:"2",  feel:"一步，音阶里最常见的走法"},
  {k:"m3", num:3, semi:3,  zh:"小三度", d:"♭3", feel:"暗，小和弦的颜色"},
  {k:"M3", num:3, semi:4,  zh:"大三度", d:"3",  feel:"亮，大和弦的颜色"},
  {k:"P4", num:4, semi:5,  zh:"纯四度", d:"4",  feel:"开阔、悬着，贝斯相邻两根空弦"},
  {k:"A4", num:4, semi:6,  zh:"增四度", d:"♯4", feel:"三全音，最不稳定"},
  {k:"d5", num:5, semi:6,  zh:"减五度", d:"♭5", feel:"三全音，最不稳定"},
  {k:"P5", num:5, semi:7,  zh:"纯五度", d:"5",  feel:"空、稳，power chord 的骨架"},
  {k:"A5", num:5, semi:8,  zh:"增五度", d:"♯5", feel:"增和弦里的那个音"},
  {k:"m6", num:6, semi:8,  zh:"小六度", d:"♭6", feel:"甜里带苦"},
  {k:"M6", num:6, semi:9,  zh:"大六度", d:"6",  feel:"甜、明亮"},
  {k:"d7", num:7, semi:9,  zh:"减七度", d:"♭♭7", feel:"减七和弦的七音"},
  {k:"m7", num:7, semi:10, zh:"小七度", d:"♭7", feel:"属七的味道，想继续走"},
  {k:"M7", num:7, semi:11, zh:"大七度", d:"7",  feel:"差半音到八度，飘"},
  {k:"P8", num:8, semi:12, zh:"纯八度", d:"8",  feel:"同一个音高一层"}
];
export const TH_IV_BY = Object.fromEntries(TH_IV.map(i=>[i.k, i]));
export function thIvName(iv){ return iv.zh + "（" + iv.k + "）"; }
// 两个拼写音之间的上行音程（八度以内；同音名同音高算纯一度）
export function thIvBetween(a, b){
  const num = ((b.L - a.L) % 7 + 7) % 7 + 1;
  const semi = ((thPc(b) - thPc(a)) % 12 + 12) % 12;
  return TH_IV.find(i=>i.num === num && i.semi === semi) || null;
}

/* ---------------- 调 ---------------- */
// sig > 0 = 升号个数，< 0 = 降号个数；rel = 相对小调主音
export const TH_KEYS = [
  {n:"C", sig:0, rel:"A"}, {n:"G", sig:1, rel:"E"}, {n:"D", sig:2, rel:"B"}, {n:"A", sig:3, rel:"F♯"},
  {n:"E", sig:4, rel:"C♯"}, {n:"B", sig:5, rel:"G♯"}, {n:"F♯", sig:6, rel:"D♯"},
  {n:"F", sig:-1, rel:"D"}, {n:"B♭", sig:-2, rel:"G"}, {n:"E♭", sig:-3, rel:"C"}, {n:"A♭", sig:-4, rel:"F"}, {n:"D♭", sig:-5, rel:"B♭"}
].map(k=>Object.assign(k, {t:thP(k.n), pc:thPc(thP(k.n))}));
export const TH_KEY_BY = Object.fromEntries(TH_KEYS.map(k=>[k.n, k]));
export const TH_SHARPS = ["F","C","G","D","A","E","B"], TH_FLATS = ["B","E","A","D","G","C","F"];
export function thSigText(sig){
  if(sig === 0) return "没有升降号";
  return sig > 0 ? sig + " 个升号（" + TH_SHARPS.slice(0, sig).map(x=>x + "♯").join(" ") + "）"
                 : (-sig) + " 个降号（" + TH_FLATS.slice(0, -sig).map(x=>x + "♭").join(" ") + "）";
}
// 出题用的调：默认 12 个大调；level.keys 可限定
export function thKeyPick(level){
  const pool = level && level.keys ? level.keys.map(n=>TH_KEY_BY[n]) : TH_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------------- 音阶与调式 ---------------- */
export const TH_MAJOR = [0,2,4,5,7,9,11];
export function thScale(tonic, semis){ return (semis || TH_MAJOR).map((s,i)=>thUp(tonic, i + 1, s)); }
// 一个 [度数, 半音] 相对大调音阶的写法：3 个半音的三度 = ♭3
export function thDegLabel(num, semi){
  const base = TH_MAJOR[(num - 1) % 7] + (num > 7 ? 12 : 0);
  const d = semi - base;
  return (d === -2 ? "♭♭" : d === -1 ? "♭" : d === 1 ? "♯" : d === 2 ? "♯♯" : "") + num;
}
export function thFormula(semis){ return semis.map((s,i)=>thDegLabel(i + 1, s)).join(" "); }
export const TH_MODES = [
  {k:"ionian",     zh:"伊奥尼亚",   en:"Ionian",     start:1, semis:[0,2,4,5,7,9,11], feat:"—（就是大调）", feel:"明亮、稳定，流行歌默认"},
  {k:"dorian",     zh:"多利亚",     en:"Dorian",     start:2, semis:[0,2,3,5,7,9,10], feat:"6",  feel:"小调但不苦，带一点亮（还原 6）。funk、city pop、摇滚 jam 常用"},
  {k:"phrygian",   zh:"弗里几亚",   en:"Phrygian",   start:3, semis:[0,1,3,5,7,8,10], feat:"♭2", feel:"最暗、带异域感。金属 riff、弗拉门戈"},
  {k:"lydian",     zh:"利底亚",     en:"Lydian",     start:4, semis:[0,2,4,6,7,9,11], feat:"♯4", feel:"比大调更亮、飘，像电影配乐的「梦」"},
  {k:"mixolydian", zh:"混合利底亚", en:"Mixolydian", start:5, semis:[0,2,4,5,7,9,10], feat:"♭7", feel:"大调但带摇滚的粗糙，♭7 1 就是它"},
  {k:"aeolian",    zh:"爱奥利亚",   en:"Aeolian",    start:6, semis:[0,2,3,5,7,8,10], feat:"♭6（和多利亚的区别）", feel:"就是自然小调"},
  {k:"locrian",    zh:"洛克里亚",   en:"Locrian",    start:7, semis:[0,1,3,5,6,8,10], feat:"♭5", feel:"主和弦是减和弦，几乎不当调用"}
];
export const TH_PENTA = {
  maj:{zh:"大调五声", semis:[0,2,4,7,9], f:"1 2 3 5 6"},
  min:{zh:"小调五声", semis:[0,3,5,7,10], f:"1 ♭3 4 5 ♭7"}
};

/* ---------------- 和弦 ---------------- */
export const TH_CH = {
  maj: {sym:"",     zh:"大三和弦",   f:[[1,0],[3,4],[5,7]],          feel:"亮、稳"},
  min: {sym:"m",    zh:"小三和弦",   f:[[1,0],[3,3],[5,7]],          feel:"暗、收"},
  dim: {sym:"dim",  zh:"减三和弦",   f:[[1,0],[3,3],[5,6]],          feel:"紧、不稳，想解决"},
  aug: {sym:"aug",  zh:"增三和弦",   f:[[1,0],[3,4],[5,8]],          feel:"悬、怪，常当经过和弦"},
  sus4:{sym:"sus4", zh:"挂四和弦",   f:[[1,0],[4,5],[5,7]],          feel:"没有三音，不亮不暗，等着回到 3"},
  sus2:{sym:"sus2", zh:"挂二和弦",   f:[[1,0],[2,2],[5,7]],          feel:"没有三音，空灵"},
  maj7:{sym:"maj7", zh:"大七和弦",   f:[[1,0],[3,4],[5,7],[7,11]],   feel:"亮但飘，city pop 的空气感"},
  dom7:{sym:"7",    zh:"属七和弦",   f:[[1,0],[3,4],[5,7],[7,10]],   feel:"亮但躁，想往下五度走"},
  min7:{sym:"m7",   zh:"小七和弦",   f:[[1,0],[3,3],[5,7],[7,10]],   feel:"暗但松弛"},
  m7b5:{sym:"m7♭5", zh:"半减七和弦", f:[[1,0],[3,3],[5,6],[7,10]],   feel:"暗而紧，小调里的 2 级"},
  dim7:{sym:"dim7", zh:"减七和弦",   f:[[1,0],[3,3],[5,6],[7,9]],    feel:"全是小三度叠起来，最紧，常当经过和弦"}
};
// 播放用的形状补齐（theory.js 只有 maj/min/dom7/maj7/min7）
Object.assign(CHORD_SHAPES, {dim:[0,3,6], aug:[0,4,8], sus4:[0,5,7], sus2:[0,2,7], m7b5:[0,3,6,10], dim7:[0,3,6,9]});
export function thChordNotes(root, q){ return TH_CH[q].f.map(([num, semi])=>thUp(root, num, semi)); }
export function thChordName(root, q){ return thNm(root) + TH_CH[q].sym; }
export function thChordFormula(q){ return TH_CH[q].f.map(([n,s])=>thDegLabel(n, s)).join(" "); }
export function thNotesText(notes){ return notes.map(thNm).join(" "); }

/* ---------------- 调内和弦 ---------------- */
export const TH_DIA = [
  {k:"1",  i:0, tri:"maj", sev:"maj7", fn:"T", roman:"I",    k7:"1maj7"},
  {k:"2m", i:1, tri:"min", sev:"min7", fn:"S", roman:"ii",   k7:"2m7"},
  {k:"3m", i:2, tri:"min", sev:"min7", fn:"T", roman:"iii",  k7:"3m7"},
  {k:"4",  i:3, tri:"maj", sev:"maj7", fn:"S", roman:"IV",   k7:"4maj7"},
  {k:"5",  i:4, tri:"maj", sev:"dom7", fn:"D", roman:"V",    k7:"5(7)"},
  {k:"6m", i:5, tri:"min", sev:"min7", fn:"T", roman:"vi",   k7:"6m7"},
  {k:"7ø", i:6, tri:"dim", sev:"m7b5", fn:"D", roman:"vii°", k7:"7m7♭5"}
];
export const TH_DIA_BY = Object.fromEntries(TH_DIA.map(d=>[d.k, d]));
export const TH_FN = {T:"主功能（T）", S:"下属功能（S）", D:"属功能（D）"};
export function thDiaChord(key, deg, seventh){
  const d = typeof deg === "string" ? TH_DIA_BY[deg] : deg;
  const sc = thScale(key.t);
  return thChordName(sc[d.i], seventh ? d.sev : d.tri);
}
/* 任意级数（含调外：♭6、3(7)、4m、5/7 等，沿用 theory.js DEGREES 的写法）→ 和弦名 */
export const TH_XDEG = {
  "1":[1,0,"maj"], "2m":[2,2,"min"], "3m":[3,4,"min"], "4":[4,5,"maj"], "5":[5,7,"maj"], "6m":[6,9,"min"], "7ø":[7,11,"dim"],
  "1(7)":[1,0,"dom7"], "2(7)":[2,2,"dom7"], "3(7)":[3,4,"dom7"], "6(7)":[6,9,"dom7"], "7(7)":[7,11,"dom7"],
  "2":[2,2,"maj"], "3":[3,4,"maj"], "6":[6,9,"maj"],
  "4m":[4,5,"min"], "5m":[5,7,"min"], "♭3":[3,3,"maj"], "♭6":[6,8,"maj"], "♭7":[7,10,"maj"], "♭2":[2,1,"maj"],
  "b3":[3,3,"maj"], "b6":[6,8,"maj"], "b7":[7,10,"maj"],
  "2m7♭5":[2,2,"m7b5"], "4maj7":[4,5,"maj7"], "1maj7":[1,0,"maj7"], "6m7":[6,9,"min7"], "2m7":[2,2,"min7"], "3m7":[3,4,"min7"], "5(7)":[5,7,"dom7"]
};
// 级数（可带 /低音级数）→ {name, root, q, rootPc, bassPc}
export function thDegChord(key, deg){
  const [top, bass] = String(deg).split("/");
  const x = TH_XDEG[top];
  if(!x) return null;
  const root = thUp(key.t, x[0], x[1]);
  let name = thChordName(root, x[2]), bassPc = thPc(root), bassNote = null;
  if(bass){
    const bm = bass.match(/^(♭|♯|b|#)?(\d)$/);
    const num = parseInt(bm[2], 10), shift = bm[1] ? (/[♭b]/.test(bm[1]) ? -1 : 1) : 0;
    bassNote = thUp(key.t, num, TH_MAJOR[num - 1] + shift);
    name += "/" + thNm(bassNote); bassPc = thPc(bassNote);
  }
  return {name, root, q:x[2], rootPc:thPc(root), bassPc, bassNote};
}

/* ================================================================
   声音
   ================================================================ */
// 低音区里的某个音级（G1–F♯2）
export function thBassMidi(pc){ return bassTonic(((pc % 12) + 12) % 12); }
// 一串和弦：[{rootPc, q, bassPc?}]，每个 beats 拍，低音按 style（"half" 二分 / "8ths" 八分 / "whole" 全音符）
export function thChordsEvents(chords, beats, style){
  const ev = [];
  let prevV = null, prevB = null;
  beats = beats || 2;
  chords.forEach((c, i)=>{
    const t = i * beats;
    const v = voiceLead(prevV, c.rootPc, c.q); prevV = v;
    v.forEach((m, vi)=> ev.push({t:t + vi * 0.028, dur:beats - 0.05, midi:m, voice:"ep", vel:0.7}));
    let b = thBassMidi(c.bassPc ?? c.rootPc);
    if(prevB !== null){ for(const cand of [b - 12, b + 12]) if(cand >= 28 && cand <= 50 && Math.abs(cand - prevB) < Math.abs(b - prevB)) b = cand; }
    prevB = b;
    if(style === "8ths"){ for(let k=0; k<beats*2; k++) ev.push({t:t + k*0.5, dur:0.42, midi:b, voice:"bass", vel:k % 2 ? 0.65 : 0.95}); }
    else if(style === "whole"){ ev.push({t, dur:beats - 0.05, midi:b, voice:"bass", vel:1}); }
    else { for(let k=0; k<beats; k+=2) ev.push({t:t + k, dur:Math.min(2, beats - k) - 0.08, midi:b, voice:"bass", vel:1}); }
  });
  return ev;
}
// 级数串 → 和弦事件
export function thDegsEvents(key, degs, beats, style){
  return thChordsEvents(degs.map(d=>{ const c = thDegChord(key, d); return {rootPc:c.rootPc, q:c.q, bassPc:c.bassPc}; }), beats, style);
}
// 一串音（midi），每个 dur 拍
export function thMelodyEvents(midis, dur, voice, gap){
  return midis.map((m, i)=>({t:i * (dur + (gap || 0)), dur:dur * 0.95, midi:m, voice:voice || "bass", vel:0.95}));
}
// 拼写音 → midi（第一个音在 lo 附近，之后一路往上，字母绕回时升八度）
export function thAscMidis(notes, startMidi){
  const out = []; let prev = null;
  for(const n of notes){
    let m = prev === null ? startMidi + ((thPc(n) - startMidi % 12) + 12) % 12 : prev + ((thPc(n) - prev % 12) + 12) % 12;
    if(prev !== null && m === prev) m += 12;
    out.push(m); prev = m;
  }
  return out;
}

/* ================================================================
   出题工具
   ================================================================ */
export function thShuffle(a){ for(let i=a.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
export function thPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
export function thWeighted(items){ // [[item, weight], …]
  let tot = 0; for(const [,w] of items) tot += w;
  let r = Math.random() * tot;
  for(const [it, w] of items){ if((r -= w) < 0) return it; }
  return items[items.length - 1][0];
}
/* 选项：correct 和干扰项都可以是字符串或 {value,label,sub,html}；按 label 去重，正确项永远在内。
   keepOrder = true 时不打乱（如 1–7 级数、T/S/D）。 */
export function thOpts(correct, pool, n, keepOrder){
  const norm = x => typeof x === "object" ? Object.assign({value:x.label}, x) : {value:String(x), label:String(x)};
  const c = norm(correct);
  const out = [c], seen = new Set([c.label]);
  const rest = keepOrder ? pool.map(norm) : thShuffle(pool.map(norm));
  for(const p of rest){ if(out.length >= (n || 4)) break; if(!seen.has(p.label)){ seen.add(p.label); out.push(p); } }
  let opts = out;
  if(keepOrder){
    const order = pool.map(norm).map(p=>p.label);
    opts = out.slice().sort((a,b)=>{ const ia = order.indexOf(a.label), ib = order.indexOf(b.label); return (ia < 0 ? -1 : ia) - (ib < 0 ? -1 : ib); });
  }else thShuffle(opts);
  return {options:opts, answerValue:c.value};
}
// 固定选项列表（全部给出），correctLabel 必须在其中
export function thFixedOpts(list, correctLabel){
  return {options:list.map(x=> typeof x === "object" ? Object.assign({value:x.label}, x) : {value:String(x), label:String(x)}), answerValue:String(correctLabel)};
}

/* ================================================================
   答题：出题 / 作答 / 渲染
   ================================================================ */
export function thGenQuestion(){
  const mode = MODES[S.modeKey], level = mode.levels[S.levelIdx];
  const K = TH_KINDS[level.kind];
  let q;
  for(let i=0; i<10; i++){ q = K.gen(level); if(!q.sig || q.sig !== S.lastQ[level.id]) break; }
  S.lastQ[level.id] = q.sig;
  q.theory = true; q.level = level; q.K = K; q.t0 = performance.now();
  q.events = q.events || [];
  q.ear = !!level.ear;
  if(!q.events.length || !q.ear) q.noAutoPlay = true;   // 只有听力题自动播放
  q.idle = q.idle || "";
  if(q.fret) q.ext = {click:(qq, cell, ms)=> K.click(qq, cell, ms)};
  S.q = q; S.answered = false; S.feedback = null; S.chosenIdx = -1;
}
export function thSubmit(i){
  const q = S.q; if(!q || S.answered || !q.options) return;
  const opt = q.options[i]; if(!opt) return;
  S.chosenIdx = i;
  const corr = q.options.find(o=>o.value === q.answerValue);
  const ok = recordAnswer(q.level.id, corr.label, opt.label, 0);
  thFinish(ok, {chosen:opt, correct:corr});
}
export function thFinish(ok, res){
  const q = S.q;
  S.answered = true;
  q.result = Object.assign({ok}, res || {});
  S.feedback = Object.assign({ok, title:"", detail:""}, q.K.fb ? q.K.fb(q, q.result, ok) : {});
  render();
}
export function thOptHtml(q){
  if(!q.options || !q.options.length) return "";
  return '<div class="opts ' + (q.optCls || "") + '">' + q.options.map((o,i)=>{
    let cls = "opt";
    if(S.answered){
      if(o.value === q.answerValue) cls += " correct";
      else if(i === S.chosenIdx) cls += " wrong";
      else cls += " dim";
    }
    return '<button class="' + cls + '" data-act="answer" data-i="' + i + '"' + (S.answered ? " disabled" : "") + '>' +
      (i < 9 ? '<span class="key-hint">' + (i+1) + '</span>' : "") + (o.html || esc(o.label)) +
      (o.sub ? '<span class="opt-sub">' + esc(o.sub) + '</span>' : "") + '</button>';
  }).join("") + '</div>';
}
export function thRenderQuiz(){
  const m = MODES[S.modeKey], level = m.levels[S.levelIdx], q = S.q;
  const st = levelStat(level.id), r = recent20Rate(st);
  let h = '<div class="quiz-head"><span class="small muted">' + level.name.split(" · ")[0] + '</span>' +
    '<div class="quiz-stats"><span>近' + PASS_N + ' <b>' + (r === null ? "–" : pct(r)) + '</b></span>' +
    '<span>连对 <b>' + st.streak + '</b></span><span>本档 <b>' + st.c + "/" + st.a + '</b></span>' +
    (st.passed ? '<span style="color:var(--good)">✓ 已过关</span>' : "") + '</div></div>';
  h += '<div class="fret-prompt th-prompt" style="--mode-c:' + m.cssColor + '">' +
    (q.ctx ? '<div class="fp-key">' + q.ctx + '</div>' : "") +
    '<div class="fp-main' + (q.long ? " th-long" : "") + '">' + q.prompt + '</div>' +
    (q.sub ? '<div class="fp-sub">' + q.sub + '</div>' : "") +
    (q.hint && !S.answered ? '<div class="fp-hint">' + esc(q.hint) + '</div>' : "") +
    (q.events.length ? '<div class="replay-row" style="justify-content:center;margin-top:10px">' +
      '<button id="bigplayBtn" class="th-playbtn' + (S.playing ? " playing" : "") + '" data-act="replay">▶ ' + (q.playLabel || "播放") + ' <span class="kbd">空格</span></button>' +
      (q.ear ? '<button data-act="replay-slow">慢速</button>' : "") + '</div>' : "") +
    '</div>';
  if(q.visual) h += q.visual(q);
  h += thOptHtml(q);
  if(S.answered && S.feedback){
    const f = S.feedback;
    const acts = (f.actions || []).map(a=>'<button data-act="th-fb" data-fb="' + a.act + '">' + esc(a.label) + '</button>').join("");
    h += '<div class="feedback ' + (f.ok ? "ok" : "no") + '" style="--mode-c:' + m.cssColor + ';--on-mode:' + (m.onColor || "#fff") + '">' +
      '<div class="fb-title">' + (f.ok ? "✓ " : "✕ ") + f.title + '</div>' +
      '<div class="fb-detail">' + f.detail + '</div>' +
      '<div class="fb-actions">' +
      (q.events.length ? '<button data-act="replay">再听一遍</button>' : "") + acts +
      ((q.lesson || level.lesson) ? '<button data-act="th-lesson" data-id="' + (q.lesson || level.lesson) + '">回看讲解：' + esc(TH_LESSONS[q.lesson || level.lesson].title) + '</button>' : "") +
      '<button class="next" data-act="next">下一题 <span class="kbd" style="color:inherit;border-color:currentColor;opacity:.75">回车</span></button></div></div>';
  }
  h += '<div class="tiny muted" style="text-align:center">' + (q.foot || ("键盘：数字选答案" + (q.events.length ? " · 空格播放" : "") + " · 回车下一题 · Esc 返回")) + '</div>';
  return h;
}
export function thFbAction(act){
  const q = S.q; if(!q || !q.K.action) return;
  q.K.action(q, act);
}

/* ================================================================
   课程页
   ================================================================ */
// 课里的播放按钮：渲染时登记，点击时按编号取事件
export function thPlay(label, evFn, bpm, cls){
  S.thPlays = S.thPlays || [];
  S.thPlays.push({evFn, bpm});
  return '<button class="th-pbtn' + (cls ? " " + cls : "") + '" data-act="th-play" data-i="' + (S.thPlays.length - 1) + '">▶ ' + label + '</button>';
}
export function thTable(head, rows, cls){
  return '<div class="th-tablewrap"><table class="th-table' + (cls ? " " + cls : "") + '"><thead><tr>' + head.map(x=>'<th>' + x + '</th>').join("") + '</tr></thead><tbody>' +
    rows.map(r=>'<tr>' + r.map(c=>'<td>' + c + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>';
}
export function thSec(title, html){ return '<section class="ls-sec"><h3>' + title + '</h3>' + html + '</section>'; }
export function thTip(html){ return '<div class="note-box ls-tip">' + html + '</div>'; }
export function thKey(html){ return '<div class="ls-key">' + html + '</div>'; }
/* 指板示意：以 rootPc 为根，在用户的调弦上找一个舒服的位置，把 items 里每个 [半音, 标签, 样式] 标出来。
   每个半音只标离根音最近的一个位置（优先根音那根弦和它上面的弦）。 */
export function thFretFig(rootPc, items, opt){
  const o = opt || {};
  const tun = fretTuning();
  const a = (o.anchor) || fretBox(tun, rootPc, false).anchor;
  const rootMidi = tun[a.s] + a.f;
  const lo = Math.max(0, a.f - (o.below ?? 3)), hi = Math.min(FRET_MAX, a.f + (o.above ?? 5));
  const marks = {};
  for(const [semi, label, cls] of items){
    const cands = cellsIn(tun, lo, hi, ()=>true).filter(c=> o.pcOnly ? (c.midi % 12) === ((rootMidi + semi) % 12) : c.midi === rootMidi + semi);
    if(!cands.length) continue;
    const pick = o.all ? cands : [cands.reduce((x,y)=>{
      const cost = c => Math.abs(c.f - a.f) + (c.s < a.s ? 4 : 0) + Math.abs(c.s - a.s) * 0.6;
      return cost(y) < cost(x) ? y : x;
    })];
    for(const c of pick){ const k = c.s + "-" + c.f; if(!marks[k]) marks[k] = {cls:cls || "nat", label}; }
  }
  const rk = a.s + "-" + a.f;
  if(marks[rk]) marks[rk].cls += " anchor";
  return '<div class="ls-fig">' + fretboardHtml({tun, marks, from:lo, to:hi}) +
    (o.caption ? '<div class="tiny muted ls-cap">' + o.caption + '</div>' : "") + '</div>';
}
export function thTuneNote(){
  const tun = fretTuning();
  return '<span class="muted">指板图按你在指板模式里设的调弦：' + tun.length + ' 弦 ' + tuningText(tun) + '。点格子能听音。</span>';
}
export function thLessonRead(id){ return !!(S.data.lessons && S.data.lessons[id]); }
export function thMarkRead(id){ S.data.lessons = S.data.lessons || {}; if(!S.data.lessons[id]){ S.data.lessons[id] = todayStr(); saveData(); } }
export function thRenderLesson(){
  const L = TH_LESSONS[S.lessonId], m = MODES[L.mode];
  S.thPlays = [];
  const idx = m.lessons.indexOf(L);
  let h = '<article class="lesson" style="--mode-c:' + m.cssColor + '">' +
    '<div class="lesson-head"><span class="stage-tag" style="--tag-c:' + m.cssColor + '">' + m.stage + ' · 第 ' + (idx + 1) + ' 课</span>' +
    '<h2>' + L.title + '</h2><div class="sub small">' + L.sum + '</div></div>';
  h += L.body();
  const lvIdx = (L.practice || []).map(id=>m.levels.findIndex(x=>x.id === id)).filter(i=>i >= 0);
  h += '<div class="lesson-foot">' +
    lvIdx.map(i=>'<button class="go" data-act="th-practice" data-i="' + i + '">去练 ' + esc(m.levels[i].name) + '</button>').join("") +
    (idx < m.lessons.length - 1 ? '<button data-act="th-next-lesson">下一课：' + esc(m.lessons[idx + 1].title) + ' →</button>'
                                : '<button data-act="back">回到课程目录</button>') +
    '</div></article>';
  return h;
}
export function thLessonListHtml(modeKey){
  const m = MODES[modeKey];
  const read = m.lessons.filter(l=>thLessonRead(l.id)).length;
  let h = '<h3 class="th-list-h">讲解课 <span class="muted small">' + read + '/' + m.lessons.length + ' 已读</span></h3>';
  h += m.lessons.map((l,i)=>'<button class="level-btn lesson-btn" data-act="th-open-lesson" data-id="' + l.id + '">' +
    '<span class="lv-name">第 ' + (i + 1) + ' 课 · ' + l.title + '</span>' +
    (thLessonRead(l.id) ? '<span class="badge-pass">已读</span>' : "") +
    '<div class="lv-goal">' + l.sum + '</div></button>').join("");
  h += '<h3 class="th-list-h">分档练习 <span class="muted small">近 ' + PASS_N + ' 题 ' + pct(PASS_RATE) + ' 过关</span></h3>';
  return h;
}
export function thHomeCards(){
  if(!TH_MODE_KEYS.length) return "";
  let h = '<h3 class="home-sec">乐理课 · 讲解 + 分档练习</h3>';
  for(const mk of TH_MODE_KEYS){
    const m = MODES[mk];
    const read = m.lessons.filter(l=>thLessonRead(l.id)).length;
    const dots = '<span class="lv-dot' + (read === m.lessons.length ? " passed" : "") + '">讲解 ' + read + '/' + m.lessons.length + '</span>' +
      m.levels.map((lv,i)=>{ const st = levelStat(lv.id); return '<span class="lv-dot' + (st.passed ? " passed" : "") + '">档' + (i + 1) + (st.passed ? " ✓" : "") + '</span>'; }).join("");
    h += '<button class="mode-card" data-act="nav-mode" data-mode="' + mk + '" style="--tag-c:' + m.cssColor + '">' +
      '<div class="mode-head"><span class="stage-tag">' + m.stage + '</span><h2>' + m.name + '</h2></div>' +
      '<div class="desc">' + m.desc + '</div><div class="lv-dots wrap">' + dots + '</div></button>';
  }
  return h;
}
export function handleTheoryAct(act, btn){
  if(act === "th-open-lesson"){
    AE.stopAll(); S.lessonId = btn.dataset.id; S.screen = "lesson"; thMarkRead(S.lessonId); render(); window.scrollTo(0, 0); return;
  }
  if(act === "th-lesson"){
    AE.stopAll(); S.lessonId = btn.dataset.id; S.lessonFromQuiz = true; S.screen = "lesson"; thMarkRead(S.lessonId); render(); window.scrollTo(0, 0); return;
  }
  if(act === "th-next-lesson"){
    const L = TH_LESSONS[S.lessonId], ls = MODES[L.mode].lessons, i = ls.indexOf(L);
    if(i < ls.length - 1){ AE.stopAll(); S.lessonId = ls[i + 1].id; thMarkRead(S.lessonId); render(); window.scrollTo(0, 0); }
    return;
  }
  if(act === "th-practice"){
    AE.stopAll();
    S.modeKey = TH_LESSONS[S.lessonId].mode; S.lessonFromQuiz = false;
    S.levelIdx = parseInt(btn.dataset.i, 10); S.screen = "quiz";
    S.data.last = {mode:S.modeKey, i:S.levelIdx}; saveData();
    AE.ensure(); startQuestion(); window.scrollTo(0, 0); return;
  }
  if(act === "th-play"){
    const p = (S.thPlays || [])[parseInt(btn.dataset.i, 10)]; if(!p) return;
    AE.ensure(); AE.play(p.evFn(), {bpm:p.bpm || S.data.settings.bpm || 100}); return;
  }
  if(act === "th-fb"){ AE.ensure(); thFbAction(btn.dataset.fb); return; }
}

/* ================================================================
   节奏格（16 格 = 一小节 4/4 的十六分音符）
   step 字符：x = 起音，- = 延长，. = 休止
   ================================================================ */
export const TH_SUB = ["", "e", "&", "a"];
export function thGridHtml(steps, opt){
  const o = opt || {};
  let h = '<div class="rg' + (o.small ? " sm" : "") + '">';
  for(let i=0; i<steps.length; i++){
    const c = steps[i];
    h += '<span class="rg-c' + (i % 4 === 0 ? " b" : "") + (c === "x" ? " x" : c === "-" ? " s" : "") + '"></span>';
  }
  h += '</div>';
  if(o.labels){
    h += '<div class="rg rg-l' + (o.small ? " sm" : "") + '">';
    for(let i=0; i<steps.length; i++) h += '<span class="' + (i % 4 === 0 ? "b" : "") + '">' + (i % 4 === 0 ? (i / 4 + 1) : TH_SUB[i % 4]) + '</span>';
    h += '</div>';
  }
  return h;
}
// 数拍文字：起音处写出来，没起音的拍头写成 (2)
export function thCountText(steps){
  const out = [];
  for(let i=0; i<steps.length; i++){
    const beat = Math.floor(i / 4) + 1, sub = i % 4;
    if(sub === 0) out.push(steps[i] === "x" ? String(beat) : "(" + beat + ")");
    else if(steps[i] === "x") out.push(TH_SUB[sub]);
  }
  return out.join(" ");
}
// 节奏 → 事件：先数 4 拍，再弹一小节（附拍点）；reps 小节数
export function thRhythmEvents(steps, midi, reps){
  const ev = [];
  for(let b=0; b<4; b++) ev.push({t:b, dur:0.08, midi:b === 0 ? 96 : 89, voice:"tone", vel:0.5});
  for(let r=0; r<(reps || 1); r++){
    const base = 4 + r * 4;
    for(let b=0; b<4; b++) ev.push({t:base + b, dur:0.06, midi:b === 0 ? 96 : 89, voice:"tone", vel:0.22});
    for(let i=0; i<steps.length; i++){
      if(steps[i] !== "x") continue;
      let len = 1; while(i + len < steps.length && steps[i + len] === "-") len++;
      ev.push({t:base + i * 0.25, dur:len * 0.25 * 0.9, midi:midi || 40, voice:"bass", vel:i % 4 === 0 ? 1 : 0.85});
    }
  }
  return ev;
}
