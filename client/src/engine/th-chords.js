"use strict";
/* 乐理 5 · 和弦与指板：用级数公式（1 3 5 ♭7…）拼和弦，再用「级数地图」把公式直接落到贝斯指板上。
   两层级数：调里的级数（6m7 = 调的 6 级）决定和弦是谁；和弦公式里的级数（♭3、5、♭7）决定点哪个位置。
   题型：公式拼写 / 级数找位置 / 位置认级数 / 点出整个和弦 / 听琶音认公式 / 调内和弦上指板 / 两层级数换算 / 和弦音连接。
   依赖 th-engine.js（拼写、TH_CH、出题工具）和 fret.js（fretboardHtml、cellsIn、relText、irregularNote…）。 */

import { CHORD_SHAPES } from "./theory.js";
import { AE, voiceLead, noteNameOct } from "./audio.js";
import { S, render, recordAnswer } from "./state.js";
import { TH_ROOTS12 } from "./th-basics.js";
import {
  FRET_MAX, CN_NUM, fretTuning, fretBox, cellsIn, sameCell, relText, irregularNote, fretboardHtml, stringName
} from "./fret.js";
import {
  TH_KINDS, thRegisterCourse, TH_LET, thN, thP, thPc, thNm, thUp, TH_KEYS, TH_KEY_BY, TH_MAJOR, thScale,
  thDegLabel, TH_CH, thChordNotes, thChordName, thChordFormula, thNotesText, thDegChord, thBassMidi,
  thChordsEvents, thShuffle, thPick, thWeighted, thOpts, thFixedOpts, thPlay, thTable, thSec, thTip, thKey,
  thFretFig, thTuneNote, thSame, thFinish
} from "./th-engine.js";

/* ================================================================
   补充和弦：六和弦、小大七、七挂四、加九、九和弦
   9 = 2 高一个八度（14 个半音），拼写上和 2 用同一个字母
   ================================================================ */
Object.assign(TH_CH, {
  maj6:    {sym:"6",       zh:"大六和弦",   f:[[1,0],[3,4],[5,7],[6,9]],          feel:"亮、甜，city pop 和老派流行的结尾和弦"},
  min6:    {sym:"m6",      zh:"小六和弦",   f:[[1,0],[3,3],[5,7],[6,9]],          feel:"暗里带亮，多利亚的味道"},
  mMaj7:   {sym:"m(maj7)", zh:"小大七和弦", f:[[1,0],[3,3],[5,7],[7,11]],         feel:"暗而悬，007 / 悬疑片的那个和弦"},
  dom7sus4:{sym:"7sus4",   zh:"属七挂四",   f:[[1,0],[4,5],[5,7],[7,10]],         feel:"属七的推力还在，但三音被 4 顶住，悬着"},
  add9:    {sym:"add9",    zh:"加九和弦",   f:[[1,0],[3,4],[5,7],[9,14]],         feel:"大和弦加一点空气，J-pop 吉他最爱"},
  dom9:    {sym:"9",       zh:"属九和弦",   f:[[1,0],[3,4],[5,7],[7,10],[9,14]],  feel:"属七加 9，funk 的招牌"},
  maj9:    {sym:"maj9",    zh:"大九和弦",   f:[[1,0],[3,4],[5,7],[7,11],[9,14]],  feel:"maj7 更飘一层"},
  min9:    {sym:"m9",      zh:"小九和弦",   f:[[1,0],[3,3],[5,7],[7,10],[9,14]],  feel:"m7 更柔、更都市"}
});
Object.assign(CHORD_SHAPES, {maj6:[0,4,7,9], min6:[0,3,7,9], mMaj7:[0,3,7,11], dom7sus4:[0,5,7,10],
  add9:[0,4,7,14], dom9:[0,4,7,10,14], maj9:[0,4,7,11,14], min9:[0,3,7,10,14]});

const TH_CF_TRI = ["maj","min","dim","aug","sus2","sus4"];
const TH_CF_SEV = ["maj7","dom7","min7","m7b5","dim7"];
const TH_CF_EXT = ["maj6","min6","mMaj7","dom7sus4","add9","dom9","maj9","min9"];
// 出题时的和弦池：三和弦 / 七和弦为主，扩展和弦少一点
function thCfPickQ(level){
  const items = TH_CF_TRI.map(q=>[q, 2]).concat(TH_CF_SEV.map(q=>[q, 3]), (level && level.noExt ? [] : TH_CF_EXT.map(q=>[q, 1])));
  return thWeighted(items);
}
function thCfFamily(q){ return TH_CF_TRI.includes(q) ? TH_CF_TRI : TH_CF_SEV.includes(q) ? TH_CF_SEV : TH_CF_EXT; }
// 公式里的每个音：{num, semi, lab, pc 相对根音}
function thCfTones(q){ return TH_CH[q].f.map(([num, semi])=>({num, semi, lab:thDegLabel(num, semi), rel:semi % 12})); }

/* 一个音级的拼写：选让和弦里升降号最少的写法（E♭ 而不是 D♯，但 C♯ 小三和弦不写 D♭ 小三和弦） */
const TH_CF_SPELL = {0:["C","B♯"],1:["D♭","C♯"],2:["D"],3:["E♭","D♯"],4:["E"],5:["F","E♯"],6:["F♯","G♭"],7:["G"],8:["A♭","G♯"],9:["A"],10:["B♭","A♯"],11:["B","C♭"]};
function thCfRoot(pc, q){
  const cands = TH_CF_SPELL[((pc % 12) + 12) % 12].map(thP);
  const cost = r => { const ns = thChordNotes(r, q); return ns.reduce((a, n)=>a + Math.abs(n.acc) * (Math.abs(n.acc) > 1 ? 4 : 1), 0) + Math.abs(r.acc) * 0.5; };
  return cands.reduce((a, b)=> cost(b) < cost(a) ? b : a);
}
// 任意半音 → 相对根音的级数写法（指板点错时的说法）
const TH_CF_REL = ["1","♭2","2","♭3","3","4","♭5","5","♭6","6","♭7","7"];
// 「调里的级数」：度数 + 半音 → ♭3、♯5 这种写法（半音差落在 −6..6）
function thCfDegLab(num, semi){
  const n = ((num - 1) % 7 + 7) % 7 + 1;
  let d = ((semi - TH_MAJOR[n - 1]) % 12 + 12) % 12; if(d > 6) d -= 12;
  return (d === -2 ? "♭♭" : d === -1 ? "♭" : d === 1 ? "♯" : d === 2 ? "♯♯" : "") + n;
}

/* ================================================================
   调内（和几个常见调外）和弦：级数 → 根音度数、半音、性质
   ================================================================ */
const TH_CF_KEYCH = [
  {k:"1",      num:1, semi:0,  q:"maj",  w:2}, {k:"2m",    num:2, semi:2,  q:"min",  w:2}, {k:"3m",   num:3, semi:4,  q:"min", w:2},
  {k:"4",      num:4, semi:5,  q:"maj",  w:2}, {k:"5",     num:5, semi:7,  q:"maj",  w:2}, {k:"6m",   num:6, semi:9,  q:"min", w:2},
  {k:"1maj7",  num:1, semi:0,  q:"maj7", w:2}, {k:"2m7",   num:2, semi:2,  q:"min7", w:2}, {k:"3m7",  num:3, semi:4,  q:"min7", w:2},
  {k:"4maj7",  num:4, semi:5,  q:"maj7", w:2}, {k:"5(7)",  num:5, semi:7,  q:"dom7", w:3}, {k:"6m7",  num:6, semi:9,  q:"min7", w:2},
  {k:"7m7♭5",  num:7, semi:11, q:"m7b5", w:2},
  {k:"♭7",     num:7, semi:10, q:"maj",  w:1, out:"从平行小调借来"}, {k:"♭6", num:6, semi:8, q:"maj", w:1, out:"从平行小调借来"},
  {k:"4m",     num:4, semi:5,  q:"min",  w:1, out:"从平行小调借来"}, {k:"3(7)", num:3, semi:4, q:"dom7", w:1, out:"副属和弦，推向 6m"},
  {k:"2(7)",   num:2, semi:2,  q:"dom7", w:1, out:"副属和弦，推向 5"}, {k:"1(7)", num:1, semi:0, q:"dom7", w:1, out:"副属和弦，推向 4"}
];
const TH_CF_KEYCH_BY = Object.fromEntries(TH_CF_KEYCH.map(c=>[c.k, c]));
// 级数写法去掉性质：6m7 → 6，♭7 → ♭7，3(7) → 3
function thCfDegNum(k){ return String(k).replace(/(m7♭5|maj7|m7|\(7\)|m)$/, ""); }
function thCfKeyChord(key, c){
  const root = thUp(key.t, c.num, c.semi);
  const tones = thCfTones(c.q).map(t=>Object.assign({}, t, {
    note:thUp(root, t.num, t.semi),
    keyLab:thCfDegLab((c.num - 1) + t.num, c.semi + t.semi),
    pc:(key.pc + c.semi + t.semi) % 12
  }));
  return {root, name:thChordName(root, c.q), tones, rootPc:(key.pc + c.semi) % 12};
}
const TH_CF_TONE_NAME = {1:"根音", 2:"二音", 3:"三音", 4:"四音", 5:"五音", 6:"六音", 7:"七音", 9:"九音"};

/* ================================================================
   指板工具
   ================================================================ */
// 随机根音位置：上面至少留一根弦，品位 1–10；窗口 根音−3 到 根音+4
function thCfRootCell(tun){
  const sMax = Math.max(0, tun.length - 2);
  const s = Math.floor(Math.random() * (sMax + 1)), f = 1 + Math.floor(Math.random() * 10);
  return {s, f, midi:tun[s] + f, lo:Math.max(0, f - 3), hi:Math.min(FRET_MAX, f + 4)};
}
function thCfCells(tun, lo, hi, pc, except){
  return cellsIn(tun, lo, hi, p=>p === ((pc % 12) + 12) % 12).filter(c=>!(except && sameCell(c, except)));
}
// 选最顺手的一个位置（离参照点品数近、跨弦少）
function thCfNearest(cells, ref){
  const c = z=>Math.abs(z.f - ref.f) + Math.abs(z.s - ref.s) * 0.6 + (ref.midi !== undefined && Math.abs(z.midi - ref.midi) > 12 ? 3 : 0);
  return cells.reduce((x, y)=> c(y) < c(x) ? y : x);
}
function thCfShapeText(root, cell){ return relText(root, cell) + (cell.midi < root.midi ? "（低八度）" : cell.midi - root.midi >= 12 ? "（高八度）" : ""); }
function thCfChips(chips){
  return '<div class="fp-seq th-chips">' + chips.map(c=>'<span class="' + (c.cls || "") + '">' + c.t + '</span>').join("") + '</div>';
}
// 琶音（贝斯）+ 和弦（电钢）
function thCfArpEvents(rootMidi, q, opt){
  const o = opt || {};
  const tones = thCfTones(q);
  const ev = [];
  const seq = tones.map(t=>rootMidi + t.semi).concat([rootMidi + 12]);
  seq.forEach((m, i)=>ev.push({t:i * 0.5, dur:0.46, midi:m, voice:"bass", vel:i ? 0.88 : 1}));
  if(o.block !== false){
    const t0 = seq.length * 0.5 + 0.35;
    ev.push({t:t0, dur:2.4, midi:rootMidi, voice:"bass", vel:1});
    voiceLead(null, rootMidi % 12, q).forEach((m, i)=>ev.push({t:t0 + i * 0.03, dur:2.4, midi:m, voice:"ep", vel:0.7}));
  }
  return ev;
}

/* ================================================================
   课
   ================================================================ */
function thCfLsFormula(){
  const C = thP("C");
  const row = q=>['<b>' + TH_CH[q].zh + '</b>', "C" + TH_CH[q].sym, '<b>' + thChordFormula(q) + '</b>', thNotesText(thChordNotes(C, q)),
    thPlay("听", ()=>thCfArpEvents(36, q), 100, "mini")];
  const F = thP("F"), Fsc = thScale(F);
  return thSec("公式 = 从和弦自己的根音数级数",
      '<p>和弦公式把每个和弦音写成<b>相对和弦根音的级数</b>：大三和弦 = <b>1 3 5</b>，小七和弦 = <b>1 ♭3 5 ♭7</b>。数字是「根音的大调音阶里第几个音」，♭ 表示比大调里那个音低半音，♯ 表示高半音。</p>' +
      '<p>拼任何和弦都是同一套动作：<b>写出根音的大调音阶 → 按公式取音 → 带 ♭ 的降半音</b>。</p>' +
      thTable(["步骤","Fm7"], [
        ["1. 根音 F 的大调音阶", Fsc.map((n,i)=>(i + 1) + "=" + thNm(n)).join("  ")],
        ["2. 公式", "1 ♭3 5 ♭7"],
        ["3. 取音、降半音", "F · A→<b>A♭</b> · C · E→<b>E♭</b>"],
        ["结果", "<b>" + thNotesText(thChordNotes(F, "min7")) + "</b>"]
      ]) +
      thKey('公式和调无关：<b>所有</b>小七和弦都是 1 ♭3 5 ♭7。记住十几个公式，就能拼出任何根音上的任何和弦，也能在指板上找到它们（下一课）。')) +
    thSec("三和弦与七和弦", thTable(["名称","符号","公式","C 为根","听"], TH_CF_TRI.concat(TH_CF_SEV).map(row), "wide")) +
    thSec("六、九、挂留和小大七", thTable(["名称","符号","公式","C 为根","听"], TH_CF_EXT.map(row), "wide") +
      '<p>大于 7 的数字是<b>高一个八度的音</b>：9 = 2、11 = 4、13 = 6。写成 9 而不是 2，意思是「七音照样在、这个音放在上面」。</p>') +
    thSec("读符号的规则",
      thTable(["符号里看到","公式里改什么","例子"], [
        ["m（或 −）", "3 → <b>♭3</b>", "Cm = 1 ♭3 5"],
        ["单独一个 7", "加 <b>♭7</b>（属七，不是大七）", "C7 = 1 3 5 ♭7"],
        ["maj7 / M7 / Δ", "加 <b>7</b>", "Cmaj7 = 1 3 5 7"],
        ["dim / °", "<b>♭3 ♭5</b>；dim7 再加 ♭♭7", "Cdim = 1 ♭3 ♭5"],
        ["ø / m7♭5 / m7-5", "1 ♭3 ♭5 ♭7", "Cø = C E♭ G♭ B♭"],
        ["aug / +", "5 → <b>♯5</b>", "Caug = 1 3 ♯5"],
        ["sus4 / sus2", "3 换成 4 / 2", "Csus4 = 1 4 5"],
        ["6", "加 6（没有七音）", "C6 = 1 3 5 6"],
        ["9 / maj9 / m9", "七和弦再加 9", "C9 = 1 3 5 ♭7 9"],
        ["add9", "三和弦加 9（没有七音）", "Cadd9 = 1 3 5 9"]
      ]) +
      thTip('这门课里有两种级数：<b>调里的级数</b>（6m7 的「6」，从调的主音数）和<b>和弦公式里的级数</b>（♭3、♭7，从和弦根音数）。第 1–4 课只用后一种，第 5 课把两层接起来。'));
}

// 四度调弦下，一个级数离根音的常用形状
function thCfShapeList(semi){
  const up = [], down = [];
  for(const ds of [0,1,2,3,-1,-2]){
    for(const k of [-1, 0, 1]){
      const p = semi + 12 * k;
      if(p === 0 || p < -12 || p > 21) continue;
      const df = p - 5 * ds;
      if(Math.abs(df) > (ds === 0 ? 4 : 3)) continue;
      const sw = ds === 0 ? "同弦" : (ds > 0 ? "上" + CN_NUM[ds] + "弦" : "下" + CN_NUM[-ds] + "弦");
      const t = sw + " " + (df === 0 ? "同品" : (df > 0 ? "+" : "−") + Math.abs(df));
      (p > 0 ? up : down).push(t + (p >= 12 ? "（高八度）" : ""));
    }
  }
  return {up:up.join("、") || "—", down:down.join("、") || "—"};
}
function thCfLsMap(){
  const all = TH_CF_REL.map((lab, semi)=>[semi, lab, semi === 0 ? "nat" : [3,4].includes(semi) ? "deg-T" : [7,6].includes(semi) ? "deg-D" : [10,11].includes(semi) ? "deg-S" : "muted"]);
  const nat = [[0,"1","nat"],[2,"2","deg-S"],[4,"3","deg-T"],[5,"4","deg-S"],[7,"5","deg-D"],[9,"6","deg-S"],[11,"7","deg-T"],[12,"8","nat"]];
  const rows = TH_CF_REL.slice(1).map((lab, i)=>{
    const semi = i + 1, sh = thCfShapeList(semi);
    const alt = {2:"9", 5:"11", 9:"13", 6:"♯4", 8:"♯5"}[semi];
    return ['<b>' + lab + '</b>' + (alt ? ' <span class="muted">= ' + alt + '</span>' : ""), String(semi), sh.up, sh.down];
  });
  return thSec("根音就是原点",
      '<p>贝斯是四度调弦：相邻两根弦差纯四度（5 个半音）。所以<b>从根音到任何一个级数的形状都是固定的</b>，根音挪到哪，形状跟着平移。这张「级数地图」背熟以后，看到公式就能直接落指，不用先想音名。</p>' +
      thFretFig(0, all, {pcOnly:true, all:true, below:3, above:4, caption:"以 C 为根（白圈）：窗口里每个位置都按「离根音几度」标出来。蓝 = 三音，橙 = 五音，绿 = 七音"}) +
      thTip(thTuneNote())) +
    thSec("级数地图（四度调弦）",
      thTable(["级数","半音","往上找（高音方向）","往下找（低音方向）"], rows, "wide") +
      '<div class="tiny muted">「上一弦」= 音高更高的那根弦（屏幕上也在上面）；+ 是往琴身方向、− 是往琴头方向。</div>' +
      thKey('最常用的五个：<b>5 = 上一弦 +2 或下一弦同品</b>；<b>3 = 上一弦 −1</b>；<b>♭3 = 上一弦 −2</b>；<b>♭7 = 上两弦同品</b>；<b>8 = 上两弦 +2</b>。')) +
    thSec("只背 7 个，带 ♭♯ 的推出来",
      thFretFig(0, nat, {caption:"大调音阶的 1–7 和 8：一个把位里的固定指型"}) +
      thKey('公式里多一个 <b>♭</b> = 从大调那个位置<b>往琴头挪一品</b>；多一个 <b>♯</b> = <b>往琴身挪一品</b>。♭3 是 3 往回一品，♭7 是 7 往回一品，♭5 是 5 往回一品，♯5 是 5 往前一品。') +
      '<p>所以真正要背的只有大调音阶这一个指型。所有和弦公式都是「在这个指型上挑几个点，有的往回挪一品」。</p>') +
    thSec("高八度、低八度都算",
      '<p>和弦音只看音名，不管八度。贝斯上 5 经常弹在根音<b>下面</b>（下一弦同品），♭7 也常在下面（同弦 −2）。9 就是 2 的高八度：同一个音名，写 9 只是提醒它在七音上面。</p>' +
      '<p>如果你的调弦里有一对弦不是四度（比如低音弦调成 C 的 C E A D G，C→E 是大三度），跨过这两根弦的形状要多挪一品，答题反馈里会提醒。</p>');
}

function thCfLsShapes(){
  const fig = (q, cap)=> thFretFig(0, thCfTones(q).map(t=>[t.semi, t.lab, t.num === 1 ? "nat" : t.num === 3 ? "deg-T" : t.num === 5 ? "deg-D" : "deg-S"]), {caption:"C" + TH_CH[q].sym + "（" + thChordFormula(q) + "）：" + cap});
  const ply = (lab, q)=> thPlay(lab, ()=>thCfArpEvents(36, q), 100);
  return thSec("三和弦：先找三音",
      '<p>根音和五音的位置对大和弦、小和弦都一样，<b>三音决定亮暗</b>，也只差一品。</p>' +
      fig("maj", "3 在上一弦 −1，5 在上一弦 +2") + fig("min", "只有三音往琴头挪一品（上一弦 −2）") +
      '<div class="ls-btns">' + ply("C 大三琶音", "maj") + ply("C 小三琶音", "min") + '</div>' +
      fig("dim", "小三和弦的 5 再往回一品（♭5，和根音隔三全音）") + fig("aug", "大三和弦的 5 往前一品（♯5）") +
      '<div class="ls-btns">' + ply("Cdim", "dim") + ply("Caug", "aug") + ply("Csus4", "sus4") + '</div>') +
    thSec("七和弦：在三和弦上加一个点",
      '<p>七音一般找<b>上两弦</b>：♭7 = 上两弦同品，7 = 上两弦 +1。或者在下面：♭7 = 同弦 −2（低八度）。</p>' +
      fig("maj7", "大三和弦 + 7（上两弦 +1）") + fig("dom7", "大三和弦 + ♭7（上两弦同品）") + fig("min7", "小三和弦 + ♭7") +
      fig("m7b5", "m7 的 5 往回一品") + fig("dim7", "m7♭5 的 ♭7 再往回一品 = ♭♭7（和 6 同一个位置）") +
      '<div class="ls-btns">' + TH_CF_SEV.map(q=>ply("C" + TH_CH[q].sym, q)).join("") + '</div>') +
    thSec("一品之差",
      thTable(["从","到","动哪个音"], [
        ["C", "Cm", "3 → ♭3：往琴头一品"],
        ["C", "C7", "加 ♭7：上两弦同品"],
        ["C7", "Cmaj7", "♭7 → 7：往琴身一品"],
        ["Cm7", "Cm7♭5", "5 → ♭5：往琴头一品"],
        ["Cm7♭5", "Cdim7", "♭7 → ♭♭7：往琴头一品"],
        ["C", "Csus4", "3 → 4：往琴身一品（上一弦同品）"],
        ["C", "Caug", "5 → ♯5：往琴身一品"]
      ]) +
      thTip('练习时用「档 4 · 点出整个和弦」：根音亮着，按公式把每个和弦音点出来。先点三音，再点五音、七音，形状会比音名先记住。'));
}

function thCfLsExt(){
  const fig = (q, cap)=> thFretFig(0, thCfTones(q).map(t=>[t.semi, t.lab, t.num === 1 ? "nat" : t.num === 3 ? "deg-T" : t.num === 5 ? "deg-D" : t.num === 9 ? "deg-S" : "deg-S"]), {above:5, caption:"C" + TH_CH[q].sym + "（" + thChordFormula(q) + "）：" + cap});
  const ply = q=> thPlay("C" + TH_CH[q].sym, ()=>thCfArpEvents(36, q), 100);
  return thSec("六和弦：6 不是 ♭7",
      '<p>6 和弦 = 三和弦 + 6，<b>没有七音</b>。6 在上两弦 −1（♭7 往回一品），或者在根音下面：同弦 −3。</p>' +
      fig("maj6", "6 在上两弦 −1") + fig("min6", "小三和弦 + 6，多利亚小调的颜色") +
      '<div class="ls-btns">' + ply("maj6") + ply("min6") + '</div>' +
      '<p>注意：C6 和 Am7 是同一组音（C E G A），区别只在<b>低音弹谁</b>。贝斯弹 C，听起来是 C6；弹 A，就是 Am7。</p>') +
    thSec("九和弦：9 = 高八度的 2",
      '<p>9 和 2 是同一个音名。贝斯上 9 常在<b>上两弦 +4</b>（伸展）或<b>同弦 +2</b>，也可以直接用低八度的 2（同弦 +2 就是）。</p>' +
      fig("dom9", "属七 + 9") + fig("min9", "m7 + 9") +
      thTable(["符号","公式","区别"], [
        ["Cadd9", thChordFormula("add9"), "没有七音"],
        ["C9", thChordFormula("dom9"), "带 ♭7（属九）"],
        ["Cmaj9", thChordFormula("maj9"), "带 7"],
        ["Cm9", thChordFormula("min9"), "小七 + 9"]
      ]) +
      '<div class="ls-btns">' + ["add9","dom9","maj9","min9"].map(ply).join("") + '</div>') +
    thSec("挂留与小大七",
      '<p><b>sus4</b> 把 3 换成 4（上一弦同品），<b>7sus4</b> 再加 ♭7。它们常在属和弦上悬一下，然后 4 落回 3：G7sus4 → G7 → C。</p>' +
      fig("dom7sus4", "4 在上一弦同品，♭7 在上两弦同品") +
      '<p><b>m(maj7)</b> = 小三和弦 + 大七度，常出现在下行半音线 Am → Am(maj7) → Am7 → Am6 里：只有一个音每次往琴头挪一品。</p>' +
      '<div class="ls-btns">' + thPlay("Am → Am(maj7) → Am7 → Am6", ()=>thChordsEvents([{rootPc:9, q:"min"},{rootPc:9, q:"mMaj7"},{rootPc:9, q:"min7"},{rootPc:9, q:"min6"}], 4, "whole"), 90) + '</div>' +
      thTip('贝斯弹扩展和弦时，<b>根音和三音、七音</b>才是主角，9、11、13 多半交给上面的乐器。知道它们在哪，是为了加花和走线时不撞车。'));
}

// 调内和弦在把位框里：调的 1 当原点，和弦音按公式标
function thCfKeyFig(key, ck, cap){
  const tun = fretTuning();
  const box = fretBox(tun, key.pc, false), a = box.anchor;
  const lo = Math.max(0, a.f - 2), hi = Math.min(FRET_MAX, a.f + 4);
  const c = TH_CF_KEYCH_BY[ck], kc = thCfKeyChord(key, c);
  const marks = {};
  for(const t of kc.tones) for(const cell of thCfCells(tun, lo, hi, t.pc))
    marks[cell.s + "-" + cell.f] = {cls:t.num === 1 ? "deg-D" : t.num === 3 ? "deg-T" : "deg-S", label:t.lab};
  const k1 = a.s + "-" + a.f;
  let both = "";
  if(marks[k1]){ both = "。白框那个音既是调的 1，也是 " + kc.name + " 的 " + marks[k1].label; marks[k1] = Object.assign(marks[k1], {cls:marks[k1].cls + " anchor"}); }
  else marks[k1] = {cls:"nat anchor", label:"调1"};
  return '<div class="ls-fig">' + fretboardHtml({tun, marks, from:lo, to:hi}) + '<div class="tiny muted ls-cap">' + cap + both + '</div></div>';
}
function thCfLsKey(){
  const C = TH_KEY_BY["C"], G = TH_KEY_BY["G"];
  const sev = ["1maj7","2m7","3m7","4maj7","5(7)","6m7","7m7♭5"];
  const rows = sev.map(k=>{
    const c = TH_CF_KEYCH_BY[k], kc = thCfKeyChord(C, c);
    return ['<b>' + k + '</b>', kc.name, thChordFormula(c.q), thNotesText(kc.tones.map(t=>t.note)), '<b>' + kc.tones.map(t=>t.keyLab).join(" ") + '</b>'];
  });
  const outRows = ["♭7","♭6","4m","3(7)","2(7)"].map(k=>{
    const c = TH_CF_KEYCH_BY[k], kc = thCfKeyChord(C, c);
    return ['<b>' + k + '</b>', kc.name, thChordFormula(c.q), thNotesText(kc.tones.map(t=>t.note)), kc.tones.map(t=>/[♭♯]/.test(t.keyLab) ? '<b class="fn-D">' + t.keyLab + '</b>' : t.keyLab).join(" "), c.out];
  });
  const g6 = thCfKeyChord(G, TH_CF_KEYCH_BY["6m7"]);
  return thSec("两层级数",
      '<p>「G 大调 6m7 的 ♭3」里有两个级数：</p>' +
      thTable(["层","说的是","从哪数","例子"], [
        ["调里的级数", "哪个和弦", "调的主音（G）", "6 → <b>" + thNm(g6.root) + "</b>"],
        ["和弦公式的级数", "和弦里的哪个音", "和弦根音（" + thNm(g6.root) + "）", "♭3 → <b>" + thNm(g6.tones[1].note) + "</b>"]
      ]) +
      thKey('级数后面的性质（m、7、maj7）直接告诉你用哪个公式：<b>6m7 → 1 ♭3 5 ♭7</b>，<b>5(7) → 1 3 5 ♭7</b>，<b>4maj7 → 1 3 5 7</b>。顺阶和弦的性质是固定的（第 2 门课），所以只要知道级数，公式就定了。')) +
    thSec("三步上指板",
      '<p><b>① 找调的 1</b>（任何一个八度都行）→ <b>② 用级数地图找和弦根音</b>（6 = 1 的上一弦 −1 品、或下一弦 +4……）→ <b>③ 从和弦根音再用一次级数地图，按公式点和弦音</b>。</p>' +
      thCfKeyFig(C, "2m7", "C 大调 · 2m7（Dm7）：白框是调的 1，橙 = 和弦根音 D，蓝 = ♭3，绿 = 5 / ♭7") +
      thCfKeyFig(C, "5(7)", "C 大调 · 5(7)（G7）：同一个把位里，换一个根音、换一个公式") +
      thTip(thTuneNote() + ' 档 6「调内和弦上指板」就是这三步：调的 1 标出来，先点和弦根音，再点三音、五音、七音（题面不给公式，要从级数自己想）。')) +
    thSec("同一个音，两个名字",
      '<p>调内和弦就是<b>在调里隔一个级数取一个</b>：2m7 = 调里的 2 4 6 1，5(7) = 5 7 2 4。同一个位置，站在调的角度叫「4」，站在 Dm7 的角度叫「♭3」。</p>' +
      thTable(["级数","C 大调","公式","组成音","= 调里的级数"], rows, "wide") +
      thKey('走低音线时两种名字都要会：<b>和弦公式</b>告诉你这个音在和弦里稳不稳（1 3 5 稳，♭7 想走）；<b>调里的级数</b>告诉你它和前后的和弦有什么关系（比如 5(7) 的 ♭7 = 调里的 4，下一拍落到 1 和弦的 3，正好半音下行）。')) +
    thSec("调外和弦：多出来的那个音",
      '<p>调外和弦的公式照旧，只是有一两个音不在调里，那个音就是它的颜色：</p>' +
      thTable(["级数","C 大调","公式","组成音","= 调里的级数","来源"], outRows, "wide") +
      '<p>3(7) 里的 ♯5（G♯）是 6m 的导音，所以 3(7) 那么想去 6m。档 7「两层级数换算」专门练这种对照。</p>');
}

function thCfLsConnect(){
  const C = TH_KEY_BY["C"];
  const slash = ["1/3","5/7","6m/5","4/5","4/1"].map(d=>{
    const dc = thDegChord(C, d);
    const rel = ((dc.bassPc - dc.rootPc) % 12 + 12) % 12;
    const tone = thCfTones(dc.q).find(t=>t.rel === rel);
    return ['<b>' + d + '</b>', dc.name, tone ? tone.lab : TH_CF_REL[rel], tone ? (tone.num === 3 ? "三音在低音：最常见，用来做级进的低音线" : tone.num === 5 ? "五音在低音：稳，常当经过" : tone.num === 7 ? "七音在低音：要往下解决" : "根音") : "和弦外的低音（踏板）"];
  });
  const root = [{rootPc:0,q:"maj"},{rootPc:9,q:"min"},{rootPc:5,q:"maj"},{rootPc:7,q:"maj"}];
  const line = [{rootPc:0,q:"maj",bassPc:4},{rootPc:9,q:"min",bassPc:0},{rootPc:5,q:"maj",bassPc:9},{rootPc:7,q:"maj",bassPc:11}];
  return thSec("琶音：按公式顺序弹",
      '<p>琶音就是把和弦音按 1 → 3 → 5 → 7 → 8 一个个弹出来。用级数地图，一个琶音在一个把位里两根到三根弦就弹完，不用移手。</p>' +
      thFretFig(9, thCfTones("min7").map(t=>[t.semi, t.lab, t.num === 1 ? "nat" : "deg-T"]).concat([[12,"8","nat"]]), {caption:"Am7 琶音：1（A）→ ♭3 上一弦 −2 → 5 上一弦 +2 → ♭7 上两弦同品 → 8 上两弦 +2"}) +
      '<div class="ls-btns">' + thPlay("Am7 琶音", ()=>thCfArpEvents(33, "min7"), 100) + thPlay("Cmaj7 琶音", ()=>thCfArpEvents(36, "maj7"), 100) +
      thPlay("G7 琶音", ()=>thCfArpEvents(31, "dom7"), 100) + '</div>') +
    thSec("转位：低音换成别的公式音",
      '<p>斜线和弦 X/Y 的 Y 是低音。只要 Y 是和弦音，就是<b>转位</b>：低音弹的是公式里的 3、5 或 7。</p>' +
      thTable(["级数","C 大调","低音是公式里的","用途"], slash) +
      thTip('看到斜线和弦，先问「低音是这个和弦的几度」。是 3，就从和弦根音找上一弦 −1 品（或者下两弦 +2）；是 5，就上一弦 +2 或下一弦同品。')) +
    thSec("连接：走到下一个和弦最近的和弦音",
      '<p>换和弦时，不一定每次都跳回根音。从当前的音出发，找<b>下一个和弦里离得最近的和弦音</b>（一般在一两个半音以内），低音线会变成级进，像唱出来的旋律。</p>' +
      '<p>1 → 6m → 4 → 5（C Am F G）从 C 的 3（E）出发：E → Am 最近的 C → F 最近的 A → G 最近的 B（或 G）。合起来是 <b>E C A B</b>，也就是 C/E → Am/C → F/A → G/B。</p>' +
      '<div class="ls-btns">' + thPlay("根音版：C A F G", ()=>thChordsEvents(root, 4, "half"), 90) + thPlay("最近和弦音版：E C A B", ()=>thChordsEvents(line, 4, "half"), 90) + '</div>' +
      thFretFig(0, [[4,"①","deg-T"],[0,"②","deg-T"],[-3,"③","deg-T"],[-1,"④","deg-T"]], {below:3, above:3, caption:"同一个把位里：① E → ② C → ③ A → ④ B，手几乎不动"}) +
      thKey('规则：<b>共同音可以保持</b>；要动的话，<b>半音或全音</b>就近走到下一个和弦的 1、3 或 5。档 8 只练「要动」的情况：从亮着的和弦音出发，点出下一个和弦音高最近的和弦音。'));
}

/* ================================================================
   题型
   ================================================================ */
// 档 1 · 公式拼写
TH_KINDS.thCfFormula = {
  gen(level){
    const t = thWeighted([["sym2f",3],["f2name",2],["tone",3],["which",2]]);
    const q = thCfPickQ(level), fam = thCfFamily(q);
    let root = thPick(TH_ROOTS12);
    for(let i=0; i<20 && thChordNotes(root, q).some(n=>Math.abs(n.acc) > 1) && q !== "dim7"; i++) root = thPick(TH_ROOTS12);
    const name = thChordName(root, q), tones = thCfTones(q), notes = thChordNotes(root, q);
    const base = {t, q, root, name, tones, notes};
    if(t === "sym2f"){
      const pool = fam.filter(x=>x !== q).map(thChordFormula).concat(TH_CF_SEV.concat(TH_CF_TRI).filter(x=>x !== q).map(thChordFormula));
      return Object.assign(base, {sig:t + q, prompt:name, sub:"公式是？"}, thOpts(thChordFormula(q), pool));
    }
    if(t === "f2name"){
      const lab = x=>TH_CH[x].zh + "（" + (TH_CH[x].sym || "大三") + "）";
      return Object.assign(base, {sig:t + q, prompt:thChordFormula(q), sub:"这是什么和弦？"},
        thOpts(lab(q), fam.filter(x=>x !== q).map(lab).concat(TH_CF_SEV.filter(x=>x !== q).map(lab))));
    }
    const i = 1 + Math.floor(Math.random() * (tones.length - 1));
    const tone = tones[i], note = notes[i];
    base.i = i; base.tone = tone; base.note = note;
    if(t === "tone"){
      const enh = [];
      for(let L=0; L<7; L++) for(const a of [-1,0,1]){ const x = thN(L, a); if(thPc(x) === thPc(note) && !thSame(x, note)) enh.push(x); }
      const pool = [thN(note.L, note.acc + 1), thN(note.L, note.acc - 1)].filter(x=>Math.abs(x.acc) <= 2).concat(enh, notes.filter((_,j)=>j !== i)).map(thNm);
      return Object.assign(base, {sig:t + q + thNm(root) + i, ctx:name + " = " + thChordFormula(q), prompt:name + " 的 " + tone.lab, sub:"是哪个音？"}, thOpts(thNm(note), pool));
    }
    const pool = tones.filter((_,j)=>j !== i).map(x=>x.lab).concat(["♭3","3","♭5","5","♯5","6","♭7","7","4","2","9"])
      .filter(x=>!(tone.lab === "9" && x === "2") && !(tone.lab === "2" && x === "9"));
    return Object.assign(base, {sig:t + q + thNm(root) + i, ctx:name + " = " + thNotesText(notes), prompt:thNm(note), sub:"在 " + name + " 里是几度？", optCls:"narrow"}, thOpts(tone.lab, pool));
  },
  fb(q, res, ok){
    const corr = q.options.find(o=>o.value === q.answerValue).label;
    const sc = thScale(q.root);
    const line = q.tones.map((t, j)=>"<b>" + t.lab + "</b>=" + thNm(q.notes[j])).join("　");
    let extra = "";
    if(q.t === "tone" || q.t === "which"){
      const majN = sc[(q.tone.num - 1) % 7];
      extra = "<br>" + thNm(q.root) + " 大调的第 " + ((q.tone.num - 1) % 7 + 1) + " 个音是 " + thNm(majN) +
        (thSame(majN, q.note) ? "，公式里是 " + q.tone.lab + "，不用改。" : "，公式写 " + q.tone.lab + "，所以是 <b>" + thNm(q.note) + "</b>。") +
        (res.chosen && !ok && thP(res.chosen.label) && thPc(thP(res.chosen.label)) === thPc(q.note) ? "<br>声音一样，但字母要按度数数：" + q.tone.num + " 度必须用 " + TH_LET[q.note.L] + "。" : "");
    }
    return {title: ok ? "对，" + corr : "正确答案：" + corr,
      detail:TH_CH[q.q].zh + "（" + q.name + "）= " + line + "。" + extra + "<br>" + TH_CH[q.q].feel + "。",
      actions:[{act:"hear", label:"听 " + q.name}]};
  },
  action(q, act){ if(act === "hear") AE.play(thCfArpEvents(thBassMidi(thPc(q.root)), q.q), {bpm:100}); }
};

// 档 2 · 级数找位置：根音亮着，点出公式里的某个音
TH_KINDS.thCfDegFret = {
  gen(level){
    const tun = fretTuning();
    let q, root, tone, targets;
    for(let i=0; i<60; i++){
      q = thCfPickQ(level); root = thCfRootCell(tun);
      const ts = thCfTones(q).slice(1);
      tone = thPick(ts);
      targets = thCfCells(tun, root.lo, root.hi, root.midi + tone.semi, root);
      if(targets.length) break;
    }
    const rn = thCfRoot(root.midi % 12, q), name = thChordName(rn, q);
    const note = thUp(rn, tone.num, tone.semi);
    return {sig:q + tone.lab + root.s + root.f, fret:true, options:[], tun, root, q, rn, name, tone, note, targets, lo:root.lo, hi:root.hi,
      enabled:(s, f)=> f >= root.lo && f <= root.hi,
      ctx:name + " = " + thChordFormula(q),
      prompt:name + " 的 " + tone.lab,
      sub:"根音 <b>" + thNm(rn) + "</b> 亮着（" + stringName(tun, root.s) + " " + root.f + " 品）。点出 " + tone.lab + "，高八度、低八度都算",
      foot:"点指板作答 · 回车下一题 · Esc 返回",
      visual(q){
        const marks = {};
        if(S.answered){
          for(const t of thCfTones(q.q).slice(1)) for(const c of thCfCells(q.tun, q.lo, q.hi, q.root.midi + t.semi, q.root)) marks[c.s + "-" + c.f] = {cls:"muted", label:t.lab};
          for(const c of q.targets) marks[c.s + "-" + c.f] = {cls:"ok", label:q.tone.lab};
          const ck = q.result.clicked;
          if(ck && !q.result.ok) marks[ck.s + "-" + ck.f] = {cls:"bad", label:q.result.chosenLabel};
        }
        marks[q.root.s + "-" + q.root.f] = {cls:"nat anchor", label:"1"};
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled}) + '</div>';
      }};
  },
  click(q, cell){
    if(sameCell(cell, q.root)){ q.hint = "这是根音 1 本身"; render(); return; }
    const rel = ((cell.midi - q.root.midi) % 12 + 12) % 12;
    const ok = rel === q.tone.rel;
    const chosenLabel = ok ? q.tone.lab : (rel === 0 ? "1（根音的八度）" : TH_CF_REL[rel]);
    recordAnswer(q.level.id, q.tone.lab, chosenLabel, 0);
    thFinish(ok, {clicked:cell, chosenLabel});
  },
  fb(q, res, ok){
    const best = thCfNearest(q.targets, q.root);
    const irr = irregularNote(q.tun, [[q.root, best]]);
    const others = q.targets.filter(c=>!sameCell(c, best)).map(c=>thCfShapeText(q.root, c));
    return {title: ok ? "对，" + q.tone.lab + " = " + thNm(q.note) : "那是 " + res.chosenLabel + "，" + q.tone.lab + " 在绿点",
      detail:q.name + "：" + thChordFormula(q.q) + " = " + thNotesText(thChordNotes(q.rn, q.q)) + "。<br>" +
        q.tone.lab + "（" + thNm(q.note) + "）离根音 <b>" + thCfShapeText(q.root, best) + "</b>" + (others.length ? "；也可以 " + others.join("、") : "") + "。" +
        (!ok && res.chosenLabel && /^[♭♯]?\d$/.test(res.chosenLabel) ? "<br>你点的是 " + res.chosenLabel + "，" + (Math.abs(((q.tone.rel - TH_CF_REL.indexOf(res.chosenLabel)) % 12 + 18) % 12 - 6) === 1 ? "只差一品：公式里的 ♭ / ♯ 就是往琴头 / 琴身挪一品。" : "回看级数地图。") : "") +
        (irr ? '<br><span style="color:var(--warn)">' + irr + '</span>' : ""),
      actions:[{act:"hear", label:"听根音 → " + q.tone.lab + " → 和弦"}]};
  },
  action(q, act){
    if(act !== "hear") return;
    const t = q.targets[0].midi;
    AE.play([{t:0,dur:0.9,midi:q.root.midi,voice:"bass",vel:1},{t:1,dur:0.9,midi:t,voice:"bass",vel:1}].concat(thCfArpEvents(q.root.midi, q.q).map(e=>Object.assign({}, e, {t:e.t + 2.3}))), {bpm:100});
  }
};

// 档 3 · 位置认级数：根音和另一个点亮着，说出是几度
const TH_CF_DEG_OPTS = [
  {label:"♭2"}, {label:"2", sub:"9"}, {label:"♭3"}, {label:"3"}, {label:"4", sub:"11"}, {label:"♭5", sub:"♯4"},
  {label:"5"}, {label:"♭6", sub:"♯5"}, {label:"6", sub:"13"}, {label:"♭7"}, {label:"7"}
];
TH_KINDS.thCfFretDeg = {
  gen(level){
    const tun = fretTuning();
    let root, rel, cell;
    for(let i=0; i<60; i++){
      root = thCfRootCell(tun);
      rel = thWeighted([[3,3],[4,3],[7,3],[10,3],[11,3],[2,2],[5,2],[9,2],[1,1],[6,1],[8,1]]);
      const cells = thCfCells(tun, root.lo, root.hi, root.midi + rel, root);
      if(cells.length){ cell = thPick(cells); break; }
    }
    const lab = TH_CF_REL[rel];
    return Object.assign({sig:rel + "|" + root.s + root.f + cell.s + cell.f, tun, root, cell, rel, lab, optCls:"n12",
      prompt:"亮点是根音的几度？", sub:"白圈 = 根音 1（" + noteNameOct(root.midi) + "）。按形状认，不用想音名",
      visual(q){
        const marks = {};
        marks[q.root.s + "-" + q.root.f] = {cls:"nat anchor", label:"1"};
        marks[q.cell.s + "-" + q.cell.f] = {cls:S.answered ? (S.q.result.ok ? "ok" : "bad") : "target", label:S.answered ? q.lab : "?"};
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.root.lo, to:q.root.hi}) + '</div>';
      }}, thFixedOpts(TH_CF_DEG_OPTS, lab));
  },
  fb(q, res, ok){
    const semi = ((q.cell.midi - q.root.midi) % 12 + 12) % 12;
    const used = {3:"小和弦的三音", 4:"大和弦的三音", 7:"几乎所有和弦的五音", 10:"属七、小七的七音", 11:"大七和弦的七音", 2:"9 音 / sus2", 5:"sus4 / 11", 9:"六和弦 / 13", 6:"减和弦、半减七的 ♭5", 8:"增和弦的 ♯5", 1:"♭9，紧张音"}[semi];
    return {title: ok ? "对，" + q.lab : "是 " + q.lab + "，你选了 " + res.chosen.label,
      detail:"形状：<b>" + thCfShapeText(q.root, q.cell) + "</b>，" + semi + " 个半音（" + noteNameOct(q.root.midi) + " → " + noteNameOct(q.cell.midi) + "）。" + (used ? "常见于" + used + "。" : "") +
        (!ok && res.chosen ? "<br>" + res.chosen.label + " 在别的位置：" + (()=>{ const r = TH_CF_REL.indexOf(res.chosen.label); const c = thCfCells(q.tun, q.root.lo, q.root.hi, q.root.midi + r, q.root); return c.length ? thCfShapeText(q.root, thCfNearest(c, q.root)) : "这个窗口外"; })() + "。" : ""),
      actions:[{act:"hear", label:"听根音 → 亮点"}]};
  },
  action(q, act){ if(act === "hear") AE.play([{t:0,dur:0.9,midi:q.root.midi,voice:"bass",vel:1},{t:1,dur:0.9,midi:q.cell.midi,voice:"bass",vel:1},
    {t:2.2,dur:1.6,midi:q.root.midi,voice:"bass",vel:0.9},{t:2.2,dur:1.6,midi:q.cell.midi,voice:"bass",vel:0.8}], {bpm:100}); }
};

/* 多步指板题的通用作答：q.steps = [{lab, chip, pcs:[pc], found:null, cells}]；q.order = true 时第 0 步必须先完成 */
function thCfStepNext(q){
  const st = q.steps.find(x=>!x.found);
  return st ? st.cells[0] : q.targets[0];
}
function thCfStepClick(q, cell, opt){
  const o = opt || {};
  const pc = cell.midi % 12;
  const pending = q.steps.filter(x=>!x.found);
  if(o.before && o.before(cell)) return;
  const first = q.order ? pending[0] : null;
  let hit = (first && first.order) ? (first.pcs.includes(pc) ? first : null) : pending.find(x=>x.pcs.includes(pc));
  if(!hit && first && first.order && pending.some(x=>x.pcs.includes(pc))){ q.hint = o.orderHint || "先完成第一步"; render(); return; }
  if(!hit){
    const done = q.steps.find(x=>x.found && x.pcs.includes(pc));
    if(done){ q.hint = done.chip + " 已经点过了"; render(); return; }
    const want = pending.reduce((a, b)=>{ const d = x=>Math.min(...x.pcs.map(p=>{ const v = Math.abs(p - pc) % 12; return Math.min(v, 12 - v); })); return d(b) < d(a) ? b : a; });
    const chosenLabel = o.label(cell);
    q.wrongStep = want;
    recordAnswer(q.level.id, want.rec || want.lab, chosenLabel, 0);
    thFinish(false, {clicked:cell, chosenLabel});
    return;
  }
  hit.found = cell; q.hint = "";
  if(o.onHit) o.onHit(hit, cell);
  if(q.steps.every(x=>x.found)){
    recordAnswer(q.level.id, q.recKey, q.recKey, 0);
    thFinish(true, {});
  }else{ q.sub = q.subFn(q); render(); }
}

// 档 4 · 点出整个和弦
TH_KINDS.thCfChordFret = {
  gen(level){
    const tun = fretTuning();
    let q, root, steps;
    for(let i=0; i<80; i++){
      q = thCfPickQ(level); root = thCfRootCell(tun);
      steps = thCfTones(q).slice(1).map(t=>({lab:t.lab, chip:t.lab, rec:t.lab, tone:t, pcs:[(root.midi + t.semi) % 12],
        cells:thCfCells(tun, root.lo, root.hi, root.midi + t.semi, root), found:null}));
      if(steps.every(s=>s.cells.length)) break;
    }
    const rn = thCfRoot(root.midi % 12, q), name = thChordName(rn, q);
    const qq = {sig:q + root.s + root.f, fret:true, multi:true, options:[], tun, root, q, rn, name, steps, lo:root.lo, hi:root.hi, recKey:name,
      targets:[].concat(...steps.map(s=>s.cells)),
      enabled:(s, f)=> f >= root.lo && f <= root.hi,
      ctx:"根音 " + thNm(rn) + " 亮着（" + stringName(tun, root.s) + " " + root.f + " 品）",
      prompt:name,
      subFn(q){ return thCfChips([{t:"1", cls:"done"}].concat(q.steps.map(s=>({t:s.chip, cls:s.found ? "done" : (S.answered && q.wrongStep === s ? "bad" : "")})))) +
        '<div class="small muted">按公式点出其余的和弦音，顺序随意，高八度低八度都算</div>'; },
      foot:"点指板作答 · 回车下一题 · Esc 返回",
      nextTarget(){ return thCfStepNext(this); },
      visual(q){
        const marks = {};
        if(S.answered) for(const s of q.steps) for(const c of s.cells) marks[c.s + "-" + c.f] = {cls:"ok ring", label:s.lab};
        for(const s of q.steps) if(s.found) marks[s.found.s + "-" + s.found.f] = {cls:"ok", label:s.lab};
        if(S.answered && q.result && q.result.clicked) marks[q.result.clicked.s + "-" + q.result.clicked.f] = {cls:"bad", label:q.result.chosenLabel};
        marks[q.root.s + "-" + q.root.f] = {cls:"nat anchor", label:"1"};
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled}) + '</div>';
      }};
    qq.sub = qq.subFn(qq);
    return qq;
  },
  click(q, cell){
    thCfStepClick(q, cell, {
      before(c){
        if(sameCell(c, q.root)){ q.hint = "这是根音 1"; render(); return true; }
        if(c.midi % 12 === q.root.midi % 12){ q.hint = "那是根音的八度，根音不用再点"; render(); return true; }
        return false;
      },
      label(c){ return TH_CF_REL[((c.midi - q.root.midi) % 12 + 12) % 12]; }
    });
  },
  fb(q, res, ok){
    q.sub = q.subFn(q);
    const shapes = q.steps.map(s=>"<b>" + s.lab + "</b> " + thCfShapeText(q.root, thCfNearest(s.cells, q.root))).join("；");
    const irr = irregularNote(q.tun, q.steps.map(s=>[q.root, thCfNearest(s.cells, q.root)]));
    return {title: ok ? "对，" + q.name + " 全部找到" : "点到了 " + res.chosenLabel + "，" + q.name + " 里没有它（缺的是 " + q.wrongStep.lab + "）",
      detail:q.name + " = " + thChordFormula(q.q) + " = " + thNotesText(thChordNotes(q.rn, q.q)) + "。<br>从根音出发：" + shapes + "。" +
        (irr ? '<br><span style="color:var(--warn)">' + irr + '</span>' : ""),
      actions:[{act:"hear", label:"听 " + q.name + " 琶音"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thCfArpEvents(q.root.midi, q.q), {bpm:100}); }
};

// 档 5 · 听琶音认公式
const TH_CF_EAR_FAM = [["maj","min","dim","aug","sus4"], ["maj7","dom7","min7","m7b5","dim7","maj6"]];
TH_KINDS.thCfEar = {
  gen(level){
    const fam = Math.random() < 0.4 ? TH_CF_EAR_FAM[0] : TH_CF_EAR_FAM[1];
    const q = thPick(fam), rootMidi = 31 + Math.floor(Math.random() * 12);
    return Object.assign({sig:q, q, fam, rootMidi, ear:true, prompt:"这是什么和弦？", sub:"贝斯先弹琶音（1 → … → 8），再整体弹一次。选公式",
      events:thCfArpEvents(rootMidi, q)},
      thFixedOpts(fam.map(x=>({label:thChordFormula(x), sub:TH_CH[x].zh})), thChordFormula(q)));
  },
  fb(q, res, ok){
    const ch = TH_CH[q.q];
    const other = res.chosen && TH_CH[q.fam.find(x=>thChordFormula(x) === res.chosen.label)];
    return {title: ok ? "对，" + ch.zh + "（" + thChordFormula(q.q) + "）" : "是" + ch.zh + "（" + thChordFormula(q.q) + "），你选了 " + res.chosen.label,
      detail:"根音 " + noteNameOct(q.rootMidi) + "，" + thNm(thCfRoot(q.rootMidi % 12, q.q)) + ch.sym + " = " + thNotesText(thChordNotes(thCfRoot(q.rootMidi % 12, q.q), q.q)) + "。" + ch.feel + "。" +
        (!ok && other ? "<br>" + other.zh + "：" + other.feel + "。" : ""),
      actions: ok ? [] : [{act:"cmp", label:"对比听：你选的 → 正确的"}]};
  },
  action(q, act){
    if(act !== "cmp") return;
    const oq = q.fam.find(x=>thChordFormula(x) === q.result.chosen.label);
    const a = thCfArpEvents(q.rootMidi, oq), dur = Math.max(...a.map(e=>e.t + e.dur)) + 0.8;
    AE.play(a.concat(thCfArpEvents(q.rootMidi, q.q).map(e=>Object.assign({}, e, {t:e.t + dur}))), {bpm:100});
  }
};

// 档 6 · 调内和弦上指板：调的 1 标出来；先点和弦根音，再点三音、五音、七音（不给公式）
TH_KINDS.thCfKeyChord = {
  gen(level){
    const tun = fretTuning();
    let key, c, kc, box, lo, hi, steps;
    for(let i=0; i<80; i++){
      key = thPick(TH_KEYS);
      c = thWeighted(TH_CF_KEYCH.map(x=>[x, x.w]));
      kc = thCfKeyChord(key, c);
      box = fretBox(tun, key.pc, true);
      lo = Math.max(0, box.anchor.f - 3); hi = Math.min(FRET_MAX, box.anchor.f + 4);
      const rootCells = thCfCells(tun, lo, hi, kc.rootPc);
      const rs = thCfDegNum(c.k);
      steps = [{lab:c.k + " 的根音", chip:"根音 " + rs, rec:"根音 " + rs, order:true, isRoot:true, pcs:[kc.rootPc], cells:rootCells, found:null}]
        .concat(kc.tones.slice(1).map(t=>({lab:t.lab, chip:TH_CF_TONE_NAME[t.num], rec:t.lab, tone:t, pcs:[t.pc], cells:thCfCells(tun, lo, hi, t.pc), found:null})));
      if(steps.every(s=>s.cells.length)) break;
    }
    const q = {sig:key.n + c.k, fret:true, multi:true, order:true, options:[], tun, key, c, kc, anchor:box.anchor, lo, hi, steps, recKey:c.k,
      targets:[].concat(...steps.map(s=>s.cells)),
      enabled:(s, f)=> f >= lo && f <= hi,
      ctx:key.n + " 大调 · 调的 1 已标出",
      prompt:c.k,
      subFn(q){ return thCfChips(q.steps.map(s=>({t:s.found ? (s.isRoot ? "根音 ✓" : s.lab) : s.chip, cls:s.found ? "done" : (S.answered && q.wrongStep === s ? "bad" : "")}))) +
        '<div class="small muted">先找和弦根音，再按级数的性质点出和弦音（公式自己想）</div>'; },
      foot:"点指板作答 · 回车下一题 · Esc 返回",
      nextTarget(){ return thCfStepNext(this); },
      visual(q){
        const marks = {};
        if(S.answered) for(const s of q.steps) for(const cl of s.cells) marks[cl.s + "-" + cl.f] = {cls:"ok ring", label:s.isRoot ? "1" : s.lab};
        for(const s of q.steps) if(s.found) marks[s.found.s + "-" + s.found.f] = {cls:s.isRoot ? "deg-D" : "ok", label:s.isRoot ? "1" : s.lab};
        if(S.answered && q.result && q.result.clicked) marks[q.result.clicked.s + "-" + q.result.clicked.f] = {cls:"bad", label:q.result.chosenLabel};
        const ak = q.anchor.s + "-" + q.anchor.f;
        marks[ak] = marks[ak] ? Object.assign({}, marks[ak], {cls:marks[ak].cls + " anchor"}) : {cls:"nat anchor", label:"调1"};
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled}) + '</div>';
      }};
    q.sub = q.subFn(q);
    return q;
  },
  click(q, cell){
    const root = q.steps[0];
    thCfStepClick(q, cell, {
      orderHint:"先找 " + q.c.k + " 的根音（调里的 " + thCfDegNum(q.c.k) + " 级）",
      before(c){
        if(root.found && c.midi % 12 === q.kc.rootPc){ q.hint = "根音已经找到了，接着点和弦音"; render(); return true; }
        return false;
      },
      label(c){
        if(!root.found) return "根音 " + thCfKeyLabOfPc(q.key, c.midi % 12);
        return TH_CF_REL[((c.midi % 12 - q.kc.rootPc) % 12 + 12) % 12];
      }
    });
  },
  fb(q, res, ok){
    q.sub = q.subFn(q);
    const kc = q.kc;
    const rootBest = thCfNearest(q.steps[0].cells, q.anchor);
    const rootStr = thCfDegNum(q.c.k);
    const w = q.wrongStep;
    return {title: ok ? "对，" + q.c.k + "（" + kc.name + "）全部找到" :
        (w && w.isRoot ? "那是 " + res.chosenLabel.replace("根音 ", "") + " 级，" + q.c.k + " 的根音是调里的 " + rootStr + " 级" : "点到了 " + res.chosenLabel + "，" + kc.name + " 里没有它（缺 " + w.lab + "）"),
      detail:"① " + q.key.n + " 大调的 " + rootStr + " 级 = <b>" + thNm(kc.root) + "</b>，离调的 1 " + relText(q.anchor, rootBest) + "。<br>" +
        "② " + q.c.k + " 的性质 → 公式 <b>" + thChordFormula(q.c.q) + "</b>" + (q.c.out ? "（调外：" + q.c.out + "）" : "") + "。<br>" +
        "③ " + kc.name + " = " + thNotesText(kc.tones.map(t=>t.note)) + " = 调里的 " + kc.tones.map(t=>t.keyLab).join(" ") + "。",
      actions:[{act:"hear", label:"听：调的 1 → " + kc.name}]};
  },
  action(q, act){
    if(act !== "hear") return;
    const k1 = q.tun[q.anchor.s] + q.anchor.f;
    const r = (q.steps[0].found || q.steps[0].cells[0]).midi;
    AE.play([{t:0,dur:1.6,midi:k1,voice:"bass",vel:0.9}].concat(voiceLead(null, q.key.pc, "maj").map((m,i)=>({t:i*0.03,dur:1.6,midi:m,voice:"ep",vel:0.6})),
      thCfArpEvents(r, q.c.q).map(e=>Object.assign({}, e, {t:e.t + 2.2}))), {bpm:100});
  }
};
// 调里某个音级的级数写法（点错根音时用）
function thCfKeyLabOfPc(key, pc){
  const rel = ((pc - key.pc) % 12 + 12) % 12;
  return ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"][rel];
}

// 档 7 · 两层级数换算
const TH_CF_KEYORDER = ["1","♭2","2","♭3","3","4","♯4","5","♯5","♭6","6","♭7","7"];
const TH_CF_CHORDORDER = ["1","♭3","3","4","♭5","5","♯5","6","♭7","7"];
TH_KINDS.thCfConvert = {
  gen(level){
    const key = thPick(TH_KEYS);
    const c = thWeighted(TH_CF_KEYCH.map(x=>[x, x.w]));
    const kc = thCfKeyChord(key, c);
    const i = 1 + Math.floor(Math.random() * (kc.tones.length - 1));
    const t = kc.tones[i];
    const base = {key, c, kc, i, tone:t, ctx:key.n + " 大调 · " + c.k + "（" + kc.name + "）"};
    if(Math.random() < 0.55){
      const list = ["1","2","3","4","5","6","7"];
      if(!list.includes(t.keyLab)) list.push(t.keyLab);
      list.sort((a, b)=>TH_CF_KEYORDER.indexOf(a) - TH_CF_KEYORDER.indexOf(b));
      return Object.assign(base, {sig:"c2k" + key.n + c.k + i, dir:"c2k", prompt:c.k + " 的 " + t.lab, sub:"是调里的几级？（" + thNm(t.note) + "）", optCls:"deg7"},
        thFixedOpts(list, t.keyLab));
    }
    const labs = kc.tones.map(x=>x.lab);
    const extra = TH_CF_CHORDORDER.filter(x=>!labs.includes(x) && x !== "1");
    const list = labs.concat(thShuffle(extra).slice(0, 2)).filter((x, j, a)=>a.indexOf(x) === j);
    list.sort((a, b)=>TH_CF_CHORDORDER.indexOf(a) - TH_CF_CHORDORDER.indexOf(b));
    return Object.assign(base, {sig:"k2c" + key.n + c.k + i, dir:"k2c", prompt:"调里的 " + t.keyLab + "（" + thNm(t.note) + "）", sub:"在 " + c.k + " 里是几度？", optCls:"narrow"},
      thFixedOpts(list, t.lab));
  },
  fb(q, res, ok){
    const corr = q.options.find(o=>o.value === q.answerValue).label;
    const kc = q.kc;
    const row = kc.tones.map(t=>(t === q.tone ? "<b>" : "") + t.lab + "=" + thNm(t.note) + "=调" + t.keyLab + (t === q.tone ? "</b>" : "")).join("　");
    return {title: ok ? "对，" + corr : "正确答案：" + corr,
      detail:q.c.k + " 的根音 = 调里的 " + thCfDegNum(q.c.k) + " 级（" + thNm(kc.root) + "），公式 " + thChordFormula(q.c.q) + "：<br>" + row + "。" +
        (q.c.out ? "<br>" + q.c.out + "，调外音是带 ♭♯ 的那个。" : "<br>调内和弦 = 在调里隔一个级数取一个。"),
      actions:[{act:"hear", label:"听 " + kc.name}]};
  },
  action(q, act){ if(act === "hear") AE.play(thCfArpEvents(thBassMidi(q.kc.rootPc), q.c.q), {bpm:100}); }
};

// 档 8 · 和弦音连接：从 A 和弦的一个音出发，点 B 和弦音高最近的和弦音（不能停在原音）
const TH_CF_MOVES = [["1","6m"],["6m","4"],["4","5"],["5","1"],["2m","5"],["1","4"],["3m","6m"],["4","3m"],["5","6m"],["6m","2m"],
  ["2m7","5(7)"],["5(7)","1maj7"],["6m7","2m7"],["1maj7","4maj7"],["3m7","6m7"],["4","4m"],["1","♭7"],["4","♭6"],["1","3(7)"],["3(7)","6m"]];
TH_KINDS.thCfConnect = {
  gen(level){
    const tun = fretTuning();
    let key, mv, A, B, start, startTone, lo, hi, targets, bCells, best = null;
    for(let i=0; i<80; i++){
      key = thPick(TH_KEYS); mv = thPick(TH_CF_MOVES);
      A = thCfKeyChord(key, TH_CF_KEYCH_BY[mv[0]]); B = thCfKeyChord(key, TH_CF_KEYCH_BY[mv[1]]);
      startTone = thPick(A.tones);
      const starts = cellsIn(tun, 2, 11, p=>p === startTone.pc);
      if(!starts.length) continue;
      start = thPick(starts);
      lo = Math.max(0, start.f - 3); hi = Math.min(FRET_MAX, start.f + 3);
      bCells = [];
      for(const t of B.tones) for(const c of thCfCells(tun, lo, hi, t.pc)) if(c.midi !== start.midi) bCells.push(Object.assign({}, c, {t}));
      if(!bCells.length) continue;
      const dmin = Math.min(...bCells.map(c=>Math.abs(c.midi - start.midi)));
      targets = bCells.filter(c=>Math.abs(c.midi - start.midi) === dmin);
      best = {key, mv, A, B, start, startTone, lo, hi, targets, bCells};
      if(dmin <= 4) break;
    }
    ({key, mv, A, B, start, startTone, lo, hi, targets, bCells} = best);
    const tLabs = [...new Set(targets.map(c=>c.t.lab))];
    const want = mv[1] + " 的 " + tLabs.join(" / ");
    return {sig:key.n + mv.join(">") + startTone.lab + start.s + start.f, fret:true, options:[], tun, key, mv, A, B, start, startTone, lo, hi, targets, bCells, want,
      enabled:(s, f)=> f >= lo && f <= hi,
      ctx:key.n + " 大调 · " + mv[0] + " → " + mv[1] + "（" + A.name + " → " + B.name + "）",
      prompt:"从 " + mv[0] + " 的 " + startTone.lab + " 走到 " + mv[1],
      sub:"亮着的是 " + A.name + " 的 " + startTone.lab + "（" + thNm(startTone.note) + "）。点出 " + B.name + "（" + thChordFormula(TH_CF_KEYCH_BY[mv[1]].q) + "）里<b>音高最近</b>的和弦音，不能停在原音",
      foot:"点指板作答（比的是音高，不是品数） · 回车下一题 · Esc 返回",
      visual(q){
        const marks = {};
        if(S.answered) for(const c of q.bCells) marks[c.s + "-" + c.f] = {cls:"muted", label:c.t.lab};
        if(S.answered) for(const c of q.targets) marks[c.s + "-" + c.f] = {cls:"ok", label:c.t.lab};
        if(S.answered && q.result && q.result.clicked && !q.result.ok) marks[q.result.clicked.s + "-" + q.result.clicked.f] = {cls:"bad", label:q.result.short};
        marks[q.start.s + "-" + q.start.f] = {cls:"nat anchor", label:q.startTone.lab};
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled}) + '</div>';
      }};
  },
  click(q, cell){
    if(cell.midi === q.start.midi){ q.hint = sameCell(cell, q.start) ? "这是出发的音，要走到下一个和弦" : "和出发的音同一个音高，要动"; render(); return; }
    const ok = q.targets.some(c=>c.midi === cell.midi);
    const bt = q.B.tones.find(t=>t.pc === cell.midi % 12);
    const d = cell.midi - q.start.midi;
    const chosen = bt ? q.mv[1] + " 的 " + bt.lab : "和弦外音";
    recordAnswer(q.level.id, ok ? chosen : q.want, chosen, 0);
    thFinish(ok, {clicked:cell, chosen, short:bt ? bt.lab : "×", d});
  },
  fb(q, res, ok){
    const t = q.targets[0], d = t.midi - q.start.midi;
    const step = Math.abs(d) === 1 ? "半音" : Math.abs(d) === 2 ? "全音" : Math.abs(d) + " 个半音";
    return {title: ok ? "对，" + (d > 0 ? "上行" : "下行") + step + "到 " + q.mv[1] + " 的 " + t.t.lab :
        (res.chosen === "和弦外音" ? "那不是 " + q.B.name + " 的和弦音" : "那是 " + res.chosen + "，差 " + Math.abs(res.d) + " 个半音；最近的是 " + q.want),
      detail:q.A.name + " 的 " + q.startTone.lab + "（" + thNm(q.startTone.note) + "）→ " + q.B.name + " 的 <b>" + t.t.lab + "</b>（" + thNm(t.t.note) + "），" + (d > 0 ? "上行" : "下行") + step + "，形状 " + relText(q.start, t) + "。<br>" +
        q.B.name + " = " + thNotesText(q.B.tones.map(x=>x.note)) + "（" + thChordFormula(TH_CF_KEYCH_BY[q.mv[1]].q) + "）。" +
        (q.A.tones.some(a=>q.B.tones.some(b=>b.pc === a.pc)) ? "<br>两个和弦的共同音：" + q.A.tones.filter(a=>q.B.tones.some(b=>b.pc === a.pc)).map(a=>thNm(a.note)).join("、") + "。实际弹的时候共同音也可以保持不动。" : ""),
      actions:[{act:"hear", label:"听这一步"}]};
  },
  action(q, act){
    if(act !== "hear") return;
    const vA = voiceLead(null, q.A.rootPc, TH_CF_KEYCH_BY[q.mv[0]].q), vB = voiceLead(vA, q.B.rootPc, TH_CF_KEYCH_BY[q.mv[1]].q);
    const ev = [{t:0, dur:1.9, midi:q.start.midi, voice:"bass", vel:1}, {t:2, dur:1.9, midi:q.targets[0].midi, voice:"bass", vel:1}];
    vA.forEach((m,i)=>ev.push({t:i*0.03, dur:1.9, midi:m, voice:"ep", vel:0.6}));
    vB.forEach((m,i)=>ev.push({t:2 + i*0.03, dur:1.9, midi:m, voice:"ep", vel:0.6}));
    AE.play(ev, {bpm:90});
  }
};

/* ================================================================
   注册
   ================================================================ */
thRegisterCourse({
  key:"cf", stage:"乐理 5", name:"和弦与指板", cssColor:"var(--accent-cf)", meterCls:"cf",
  desc:"用级数公式（1 3 5 ♭7…）拼任何和弦，再把公式直接落到指板上：级数地图、三和弦 / 七和弦 / 扩展和弦的形状、调里的级数 → 和弦根音 → 和弦音、琶音与连接。",
  lessons:[
    {id:"cf-l1", title:"和弦公式：用级数写和弦", sum:"公式 = 从和弦根音数的级数；读符号的规则；十九种常用和弦", body:thCfLsFormula, practice:["cf-1"]},
    {id:"cf-l2", title:"级数地图：公式在指板上的位置", sum:"四度调弦下每个级数离根音的固定形状；只背大调指型，♭ 往琴头一品、♯ 往琴身一品", body:thCfLsMap, practice:["cf-2","cf-3"]},
    {id:"cf-l3", title:"三和弦与七和弦的形状", sum:"先找三音；七音在上两弦；相邻和弦之间只差一品", body:thCfLsShapes, practice:["cf-4","cf-5"]},
    {id:"cf-l4", title:"六、九、挂留与小大七", sum:"6 不是 ♭7；9 = 高八度的 2；sus4、7sus4、m(maj7) 的用法", body:thCfLsExt, practice:["cf-4","cf-1"]},
    {id:"cf-l5", title:"调里的级数 → 指板上的和弦", sum:"两层级数；三步上指板；同一个音在调里和在和弦里的两个名字", body:thCfLsKey, practice:["cf-6","cf-7"]},
    {id:"cf-l6", title:"琶音、转位与和弦连接", sum:"一个把位弹完琶音；斜线和弦的低音是公式里的几度；走到下一个和弦最近的和弦音", body:thCfLsConnect, practice:["cf-8"]}
  ],
  levels:[
    {id:"cf-1", kind:"thCfFormula",   name:"档 1 · 公式拼写",       goal:"和弦符号 ↔ 级数公式 ↔ 组成音：Fm7 的 ♭7 是哪个音、E♭ 在 Cm7 里是几度", lesson:"cf-l1"},
    {id:"cf-2", kind:"thCfDegFret",   name:"档 2 · 级数找位置",     goal:"根音亮着，按公式点出 ♭3、5、♭7、9…（按你的调弦，高低八度都算）", lesson:"cf-l2"},
    {id:"cf-3", kind:"thCfFretDeg",   name:"档 3 · 位置认级数",     goal:"根音和另一个点亮着，说出它是根音的几度。和档 2 方向相反", lesson:"cf-l2"},
    {id:"cf-4", kind:"thCfChordFret", name:"档 4 · 点出整个和弦",   goal:"给和弦符号和根音位置，把公式里的每个和弦音都点出来", lesson:"cf-l3"},
    {id:"cf-5", kind:"thCfEar",       name:"档 5 · 听琶音认公式",   goal:"听贝斯弹一遍琶音，选出它的公式：三和弦五种、七和弦与六和弦六种", lesson:"cf-l3", ear:true},
    {id:"cf-6", kind:"thCfKeyChord",  name:"档 6 · 调内和弦上指板", goal:"随机调、调的 1 标出来：先点 6m7 / 5(7) / ♭7… 的根音，再点三音、五音、七音（不给公式）", lesson:"cf-l5"},
    {id:"cf-7", kind:"thCfConvert",   name:"档 7 · 两层级数换算",   goal:"2m7 的 ♭7 是调里几级？调里的 4 在 5(7) 里是几度？", lesson:"cf-l5"},
    {id:"cf-8", kind:"thCfConnect",   name:"档 8 · 和弦音连接",     goal:"从一个和弦音出发，点出下一个和弦里音高最近的和弦音，练级进的低音线", lesson:"cf-l6"}
  ]
});
