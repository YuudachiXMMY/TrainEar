"use strict";
/* 乐理 3 · 套路与和声进阶：套路词汇表、副属和弦、借用和弦、转调、转位与 slash 和弦 */

import { PATTERNS, KEYS, OUTSIDE_POOL, OUTSIDE_CATS, OUTSIDE_RULE } from "./theory.js";
import { AE, buildProgression } from "./audio.js";
import { S, esc } from "./state.js";
import {
  TH_KEY_BY, TH_KEYS, TH_DIA, thScale, thSame, thNotesText, thChordNotes, thPick, thWeighted, thShuffle,
  thOpts, thFixedOpts, thDegChord, thDiaChord, thChordName, thDegsEvents, thSec, thPlay, thTip, thKey,
  thFretFig, thTable, TH_KINDS, thRegisterCourse
} from "./th-engine.js";
import { TH_ROOTS12 } from "./th-basics.js";

// theory.js 的 PATTERNS 之外再补几个常见套路（只用于讲解和看谱题）
const TH_XPAT = [
  {id:"251",  name:"2-5-1（ツーファイブ）", degs:["2m","5","1","1"],   degText:"2m 5 1",   hint:"根音连续下行五度（强进行），爵士和 city pop 的骨架。加上七音就是 2m7 5(7) 1maj7。"},
  {id:"50s",  name:"50 年代进行",           degs:["1","6m","4","5"],   degText:"1 6m 4 5", hint:"老式流行和 doo-wop 的循环：先亮后暗、出门、紧张，再回到 1。"},
  {id:"456",  name:"456 进行",              degs:["4","5","6m","6m"],  degText:"4 5 6m",   hint:"4 → 5 → 6m 一路往上爬到暗的家，J-Rock 副歌冲刺的常客。和王道一样不碰 1。"},
  {id:"1625", name:"1625 回转",             degs:["1","6m","2m","5"],  degText:"1 6m 2m 5",hint:"段落末尾的回转：6m 2m 5 1 是一条完整的五度下行链，转一圈正好回到开头。"},
  {id:"anda", name:"安达卢西亚终止",        degs:["6m","5","4","3"],   degText:"6m 5 4 3", hint:"小调里根音一步步往下走（A G F E），最后的 3 是大和弦（和声小调的 5 级）。弗拉门戈和激情摇滚的味道。"}
];
function thAllPats(){
  return PATTERNS.map(p=>({id:p.id, name:p.name, degText:p.degText.replace(/b(\d)/g, "♭$1"), hint:p.hint, pat:p})).concat(TH_XPAT);
}
function thLessonKey(){ return S.data.settings.random ? KEYS.find(k=>k.name === "E") : (KEYS.find(k=>k.name === S.data.settings.key) || KEYS[2]); }
function thPatEvents(p){
  const key = thLessonKey();
  if(p.pat) return buildProgression(key, p.pat.steps, 1).events;
  return thDegsEvents(TH_KEY_BY[key.name] || TH_KEY_BY.E, p.degs, 2, "8ths");
}

/* ================================================================
   课
   ================================================================ */
function thLsPatterns(){
  const key = thLessonKey();
  const rows = thAllPats().map(p=>[ '<b>' + p.name + '</b>', '<span class="nowrap">' + p.degText + '</span>', p.hint, thPlay("听", ()=>thPatEvents(p), 100, "mini")]);
  return thSec("套路 = 和声里的「单词」",
      '<p>流行和摇滚里，大部分歌的和弦都来自一小撮反复出现的进行。认出套路，一首歌的和声就从 16 个字母变成 2 个单词，背谱和扒歌都快很多。下面是最常见的一批（播放用首页设置的调：' + key.name + ' 大调）：</p>' +
      thTable(["套路","级数","为什么好听","听"], rows)) +
    thSec("怎么认",
      '<p>①<b>先找家</b>：哪个和弦听起来最稳？是 1（亮）还是 6m（暗）？②<b>看起点和落点</b>：从 4 出发、落在 6m 的是王道；从 6m 出发、落在 1 的是小室。③<b>同一组和弦换起点就是另一个套路</b>：1 5 6m 4（Axis）和 6m 4 1 5（悲怆）是同四个和弦，起点不同，情绪完全不同。④<b>有不在调里的和弦</b>（带 ♭、或本该小却变大），看下面两课。</p>' +
      thTip("练耳的「套路整体识别」和指板的「套路根音连弹」用的就是这张表里的前八个。"));
}
const TH_SECDOMS = [
  {deg:"1(7)", target:"4",  t:"把 1 加小七度，推向 4。主歌进副歌、或者 1 → 4 之间常用"},
  {deg:"2(7)", target:"5",  t:"2 级变大（重属），推向 5，听起来「更用力地」走向属和弦"},
  {deg:"3(7)", target:"6m", t:"J-Pop 最常见的副属：亮而躁，然后掉进暗的 6m。丸サ进行的核心"},
  {deg:"6(7)", target:"2m", t:"6m 变成属七推向 2m，常接成 6(7) 2m 5 1 的五度链"},
  {deg:"7(7)", target:"3m", t:"相对少见，推向 3m"}
];
function thLsSecDom(){
  const C = TH_KEY_BY["C"];
  const sc = thScale(C.t);
  const rows = TH_SECDOMS.map(s=>{
    const c = thDegChord(C, s.deg), tg = thDegChord(C, s.target);
    const outs = thChordNotes(c.root, c.q).filter(n=>!sc.some(x=>thSame(x, n)));
    return ['<b>' + s.deg + '</b>', c.name, '→ ' + s.target + '（' + tg.name + '）', thNotesText(outs) || "—", s.t,
      thPlay("听", ()=>thDegsEvents(C, [s.deg, s.target], 3, "whole"), 90, "mini")];
  });
  return thSec("借来的 5",
      '<p>5(7) → 1 的推力来自属七。把这个关系「平移」到别的和弦上：<b>任何调内的大和弦或小和弦，都可以在它前面放一个属于它自己的属七</b>（它上方纯五度的那个属七）。这种和弦叫<b>副属和弦</b>（次属和弦）。</p>' +
      thTable(["写法","C 大调","推向","调外音","说明","听"], rows) +
      thKey('记法 <b>3(7)</b> = 在 3 级根音上的属七。识别：<b>本该小的级数（2、3、6）变成了大和弦或属七</b>，或者出现了一个升高的调外音（E7 里的 G♯），它往上半音正好落到目标和弦的根音。')) +
    thSec("听出差别",
      '<div class="ls-btns">' + thPlay("1 3m 6m 4（全调内）", ()=>thDegsEvents(C, ["1","3m","6m","4"], 2, "half"), 100) +
      thPlay("1 3(7) 6m 4（副属）", ()=>thDegsEvents(C, ["1","3(7)","6m","4"], 2, "half"), 100) +
      thPlay("1 6(7) 2m 5（副属）", ()=>thDegsEvents(C, ["1","6(7)","2m","5"], 2, "half"), 100) + '</div>' +
      '<p>副属前面还可以再加它的「2」：3(7) 前加 7m7♭5，变成 7m7♭5 3(7) 6m，就是小调里的 2-5-1。</p>') +
    thSec("贝斯手怎么处理",
      '<p>副属的根音和调内同级数一样（E7 的根音还是 E），所以<b>根音线本身不变</b>，变的是上方的颜色。弹琶音或经过音时要用副属的三音（E7 的 G♯）：</p>' +
      '<p>1 → 3(7)/♯5 → 6m（C → E7/G♯ → Am）：低音 C – G♯ – A，最后一步是半音往上解决，非常常见的下行线变体。</p>' +
      thFretFig(4, [[0,"1","nat"],[4,"3","deg-D"],[7,"5","deg-T"],[10,"♭7","deg-S"]], {caption:"E7 的和弦音：3（G♯）在上一弦 −1，往上半音就是 A"}));
}
function thLsBorrow(){
  const C = TH_KEY_BY["C"];
  const items = [
    ["4m", "Fm", "4 走到一半变小，一秒变哭腔。4 → 4m → 1 是 J-Pop 用滥的经典"],
    ["♭6", "A♭", "又亮又宽，带点史诗感。♭6 ♭7 1 冲刺式收尾（rock / metal / 游戏配乐）"],
    ["♭7", "B♭", "摇滚味（混合利底亚）：♭7 → 1，或者 1 ♭7 4 1"],
    ["♭3", "E♭", "粗犷的 rock riff 味，常和 ♭7、4 一起出现"],
    ["5m", "Gm", "属和弦变小，失去推力，变得忧郁、松弛"],
    ["2m7♭5", "Dm7♭5", "4m 的亲戚，带着 A♭，常放在 5 前面"]
  ];
  const rows = items.map(([d, nm, why])=>{
    const c = thDegChord(C, d);
    return ['<b>' + d + '</b>', nm, thNotesText(thChordNotes(c.root, c.q)), why];
  });
  return thSec("从平行小调借颜色",
      '<p>C 大调和 C 小调（平行调）共用主音，但小调的 3、6、7 低半音。歌在大调里时，可以<b>临时借用 C 小调的和弦</b>，得到大调里没有的暗色或力量感，这叫<b>借用和弦</b>（调式互换）。</p>' +
      thTable(["写法","C 大调里","组成音","效果"], rows) +
      thKey('识别：<b>根音带 ♭</b>（♭3、♭6、♭7），或者<b>本该大的 4、5 变小了</b>。和副属的区别：副属是「小变大」、多出升号；借用是「大变小」或带降号。')) +
    thSec("听",
      '<div class="ls-btns">' + thPlay("1 4 4m 1", ()=>thDegsEvents(C, ["1","4","4m","1"], 2, "half"), 100) +
      thPlay("1 ♭6 ♭7 1", ()=>thDegsEvents(C, ["1","♭6","♭7","1"], 2, "half"), 100) +
      thPlay("1 ♭7 4 1", ()=>thDegsEvents(C, ["1","♭7","4","1"], 2, "half"), 100) +
      thPlay("1 ♭3 4 1", ()=>thDegsEvents(C, ["1","♭3","4","1"], 2, "half"), 100) + '</div>') +
    thSec("指板形状",
      '<p>借用和弦的根音不在大调音阶里，形状要换：</p>' +
      thFretFig(0, [[0,"1","nat"],[3,"♭3","deg-S"],[5,"4","deg-T"],[8,"♭6","deg-S"],[10,"♭7","deg-S"],[12,"1","nat"]], {caption:"以 C 为 1：♭3 = 上一弦 −2，♭6 = 上一弦 +3，♭7 = 上两弦同品"}) +
      thTip("♭6 ♭7 1 在指板上是「上一弦 +3 → 上两弦同品 → 上两弦 +2」，三个音一直往上爬，冲刺感在手上也感觉得到。"));
}
function thLsModulation(){
  const E = TH_KEY_BY["E"], F = TH_KEY_BY["F"], C = TH_KEY_BY["C"], G = TH_KEY_BY["G"];
  const shift = (a, b, degs)=>{
    const ea = thDegsEvents(a, degs, 2, "8ths");
    const eb = thDegsEvents(b, degs, 2, "8ths").map(e=>Object.assign({}, e, {t:e.t + degs.length * 2}));
    return ea.concat(eb);
  };
  return thSec("借用 vs 转调",
      '<p>借用和副属只是「路过」，一两个和弦后就回到原来的家。<b>转调</b>是换了一个新的家：之后很多小节都围着新的主和弦转，级数要按新调重新数。</p>') +
    thSec("常见的转调",
      thTable(["类型","例子","听感 / 用法","贝斯手怎么办"], [
        ["<b>半音 / 全音上移</b>", "E → F、C → D", "最后一遍副歌整体升调，情绪再推一层（直接转，不准备）", "所有形状整体往上挪 1 或 2 品"],
        ["<b>属调</b>（五度圈顺时针）", "C → G", "只差一个音（F → F♯），很顺，变亮", "新的 1 = 原来的 5"],
        ["<b>下属调</b>（逆时针）", "C → F", "只差一个音（B → B♭），变柔", "新的 1 = 原来的 4"],
        ["<b>相对大小调</b>", "C ↔ Am", "调号不变；按相对大调记法<b>不算转调</b>，只是重心从 1 移到 6m", "级数不用换"],
        ["<b>同主音大小调</b>", "C 大调 → C 小调", "主音不变，突然变暗（或反过来变亮）", "按相对大调记法要换坐标：C 小调按 E♭ 大调记"],
        ["<b>三度关系</b>", "C → E、C → A♭", "戏剧化、电影感，常靠一个共同音连接", "找新的 1，形状整体平移"]
      ]) +
      '<div class="ls-btns">' + thPlay("4 5 3m 6m：E 大调 → F 大调（半音上移）", ()=>shift(E, F, ["4","5","3m","6m"]), 110) +
      thPlay("1 6m 4 5：C 大调 → G 大调（属调）", ()=>shift(C, G, ["1","6m","4","5"]), 110) + '</div>') +
    thSec("怎么转过去",
      '<p>①<b>直接转</b>：上一段结束，下一段直接在新调开始（升 key 副歌）。②<b>属准备</b>：先弹新调的 5(7)，耳朵自然被带到新的 1。③<b>共同和弦</b>：找一个两个调都有的和弦当跳板（C 大调的 Am = G 大调的 2m）。</p>' +
      thKey('看谱 / 扒歌时：一串和弦<b>连续几个都不在原调里</b>，而且有一个新的和弦反复当「家」，就是转调了，找到新的 1 重新数级数。只有一两个外人就先当借用或副属。'));
}
function thLsSlash(){
  const C = TH_KEY_BY["C"];
  const inv = [
    ["C", "原位", "C", "根音在低音，最稳"],
    ["C/E", "第一转位", "E（三音）", "低音变高、变轻，常用来让低音线级进"],
    ["C/G", "第二转位", "G（五音）", "悬着，常出现在 5 前面或当经过"],
    ["C7/B♭", "第三转位", "B♭（七音）", "低音的 ♭7 想往下走到 4 的三音（F/A）"]
  ];
  const key = thLessonKey();
  const canon = PATTERNS.find(p=>p.id === "canon");
  return thSec("斜杠后面是低音",
      '<p><b>C/E</b> 读作「C over E」：上面弹 C 和弦，<b>低音弹 E</b>。贝斯手看到斜杠，弹的就是斜杠后面那个音。</p>' +
      thTable(["写法","名称","低音","效果"], inv) +
      '<p>级数写法同理：<b>5/7</b> = 5 级和弦、低音是 7 级音（C 大调里 G/B）；<b>1/3</b> = C/E；<b>6m/5</b> = Am/G。</p>') +
    thSec("为什么要转位：让低音线走起来",
      '<p>卡农进行 1 5/7 6m 3m/5 4 1/3 4 5：上方的和弦是常见的四度五度跳，低音却是一条下楼梯 C B A G F E F G。转位存在的意义，就是让低音线级进：</p>' +
      '<div class="ls-btns">' + thPlay("卡农（" + key.name + " 大调）", ()=>buildProgression(key, canon.steps, 1).events, 100) +
      thPlay("下行线 1 5/7 6m 6m/5 4 1/3 2m 5", ()=>thDegsEvents(C, ["1","5/7","6m","6m/5","4","1/3","2m","5"], 2, "half"), 100) + '</div>') +
    thSec("低音不在和弦里",
      '<p>斜杠后面也可以不是和弦音：<b>F/G</b>（4/5）= F 和弦配 G 低音，听起来像 G7sus4，是 J-Pop 副歌前的经典「悬」。<b>踏板音</b>：低音一直停在 1，上面 1 → 4/1 → 5/1 → 1 换和弦，张力越积越大。</p>' +
      '<div class="ls-btns">' + thPlay("4/5 → 1", ()=>thDegsEvents(C, ["4/5","4/5","1","1"], 2, "half"), 100) +
      thPlay("踏板：1 4/1 5/1 1", ()=>thDegsEvents(C, ["1","4/1","5/1","1"], 2, "8ths"), 100) + '</div>');
}

/* ================================================================
   题型
   ================================================================ */
TH_KINDS.thPatName = {
  gen(level){
    const all = thAllPats(), p = thPick(all);
    if(Math.random() < 0.55){
      return Object.assign({sig:"d" + p.id, p, t:"d2n", prompt:p.degText, sub:"是哪个套路？"}, thOpts(p.name, all.filter(x=>x !== p).map(x=>x.name)));
    }
    return Object.assign({sig:"n" + p.id, p, t:"n2d", prompt:p.name, sub:"级数是？"}, thOpts(p.degText, all.filter(x=>x !== p).map(x=>x.degText)));
  },
  fb(q, res, ok){
    return {title: ok ? "对，" + q.p.name + "：" + q.p.degText : "是 " + q.p.name + "：" + q.p.degText, detail:q.p.hint, actions:[{act:"hear", label:"听一遍"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thPatEvents(q.p), {bpm:100}); }
};
const TH_EASY_KEYS = ["C","G","D","A","E","F","B♭","E♭"];
TH_KINDS.thSecDom = {
  gen(level){
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)], s = thPick(TH_SECDOMS);
    const c = thDegChord(k, s.deg), tg = thDegChord(k, s.target);
    const t = thWeighted([["to",3],["from",3],["deg",2],["out",2]]);
    if(t === "to") return Object.assign({sig:t + k.n + s.deg, t, k, s, c, tg, ctx:k.n + " 大调", prompt:c.name, sub:"这个副属和弦推向哪个和弦？"},
      thOpts(tg.name, TH_DIA.map(d=>thDiaChord(k, d, false)).filter(x=>x !== tg.name)));
    if(t === "from") return Object.assign({sig:t + k.n + s.deg, t, k, s, c, tg, ctx:k.n + " 大调", prompt:"→ " + tg.name, sub:"想把耳朵推向它，用哪个副属和弦？"},
      thOpts(c.name, TH_SECDOMS.filter(x=>x !== s).map(x=>thDegChord(k, x.deg).name).concat([thDegChord(k, "5(7)").name])));
    if(t === "deg") return Object.assign({sig:t + k.n + s.deg, t, k, s, c, tg, ctx:k.n + " 大调", prompt:c.name, sub:"级数怎么写？", optCls:"narrow"},
      thOpts(s.deg, ["1(7)","2(7)","3(7)","6(7)","7(7)","5(7)","3m","6m"]));
    const sc = thScale(k.t);
    const outs = thChordNotes(c.root, c.q).filter(n=>!sc.some(x=>thSame(x, n)));
    const ins = thChordNotes(c.root, c.q).filter(n=>sc.some(x=>thSame(x, n)));
    return Object.assign({sig:t + k.n + s.deg, t, k, s, c, tg, outs, ctx:k.n + " 大调", prompt:c.name + " = " + thNotesText(thChordNotes(c.root, c.q)), sub:"哪个音不在 " + k.n + " 大调里？"},
      thOpts(thNotesText(outs), ins.map(n=>thNotesText([n]))));
  },
  fb(q, res, ok){
    const outs = thChordNotes(q.c.root, q.c.q).filter(n=>!thScale(q.k.t).some(x=>thSame(x, n)));
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:"<b>" + q.s.deg + "</b> = " + q.c.name + "，根音在目标 " + q.tg.name + " 上方纯五度，往下五度解决到 " + q.tg.name + "（" + q.s.target + "）。调外音 <b>" + thNotesText(outs) + "</b>" +
        (outs.length === 1 && q.s.deg !== "1(7)" ? "，往上半音就是 " + q.tg.name.replace(/m$/, "") + " 的根音" : "") + "。" + q.s.t + "。",
      actions:[{act:"hear", label:"听：" + q.c.name + " → " + q.tg.name}]};
  },
  action(q, act){ if(act === "hear") AE.play(thDegsEvents(q.k, ["1", q.s.deg, q.s.target], 2, "half"), {bpm:100}); }
};
const TH_BORROWS = [
  {deg:"4m", lab:"借用 4m"}, {deg:"♭6", lab:"借用 ♭6"}, {deg:"♭7", lab:"借用 ♭7"}, {deg:"♭3", lab:"借用 ♭3"}, {deg:"5m", lab:"借用 5m"}
];
TH_KINDS.thBorrow = {
  gen(level){
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)];
    const t = thWeighted([["what",4],["name",3],["odd",2]]);
    if(t === "what"){
      const pool = TH_BORROWS.map(b=>({b, lab:b.lab})).concat(TH_SECDOMS.slice(0, 4).map(s=>({b:{deg:s.deg}, lab:"副属 " + s.deg})), ["6m","3m","2m","4"].map(d=>({b:{deg:d}, lab:"调内 " + d})));
      const ans = thPick(TH_BORROWS);
      const c = thDegChord(k, ans.deg);
      return Object.assign({sig:t + k.n + ans.deg, t, k, ans, c, ctx:k.n + " 大调的歌里出现了", prompt:c.name, sub:"它是什么？"},
        thOpts(ans.lab, pool.filter(x=>x.lab !== ans.lab).map(x=>x.lab)));
    }
    if(t === "name"){
      const ans = thPick(TH_BORROWS);
      const c = thDegChord(k, ans.deg);
      return Object.assign({sig:t + k.n + ans.deg, t, k, ans, c, ctx:k.n + " 大调", prompt:ans.deg, sub:"借用和弦是哪个？"},
        thOpts(c.name, TH_BORROWS.filter(x=>x !== ans).map(x=>thDegChord(k, x.deg).name).concat([thDegChord(k, {"4m":"4","♭6":"6m","♭7":"7ø","♭3":"3m","5m":"5"}[ans.deg]).name])));
    }
    const odd = thPick(TH_SECDOMS.slice(0, 4));
    const pool = thShuffle(TH_BORROWS.slice()).slice(0, 3).map(b=>thDegChord(k, b.deg).name);
    const c = thDegChord(k, odd.deg);
    return Object.assign({sig:t + k.n + odd.deg, t, k, odd, c, ctx:k.n + " 大调", prompt:"哪一个不是从平行小调借来的？", long:true},
      thOpts(c.name, pool));
  },
  fb(q, res, ok){
    const pm = q.k.n + " 小调";
    if(q.t === "odd") return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:q.c.name + " 是副属 " + q.odd.deg + "（本该小却变成属七，带升号），不是借用。其余几个都来自 " + pm + "（带降号 / 4、5 变小）。"};
    const c = q.c;
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:c.name + " = " + thNotesText(thChordNotes(c.root, c.q)) + "，在 " + q.k.n + " 大调里是 <b>" + q.ans.deg + "</b>，来自平行小调 " + pm + "（" + q.k.n + " 自然小调把 3、6、7 降半音）。",
      actions:[{act:"hear", label:"听：1 → " + c.name + " → 1"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thDegsEvents(q.k, ["1", q.ans.deg, "1"], 2, "half"), {bpm:100}); }
};
// 进行分析：四个和弦名，有没有外人、是哪一类（看谱版的「调外和弦侦测」）
TH_KINDS.thAnalyze = {
  gen(level){
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)];
    const it = thPick(OUTSIDE_POOL);
    const seq = it.seq.map(d=>d.replace(/^b/, "♭"));
    return Object.assign({sig:k.n + it.seq.join(), k, it, seq, lesson:{secdom:"ph-l2", iv:"ph-l3", b67:"ph-l3", none:"dh-l1"}[it.cat], ctx:k.n + " 大调", prompt:seq.map(d=>thDegChord(k, d).name).join("　"), sub:"有没有调外和弦？是哪一类？", long:true},
      thFixedOpts(OUTSIDE_CATS.map(c=>({label:c.label, sub:c.sub || ""})), OUTSIDE_CATS.find(c=>c.value === it.cat).label));
  },
  fb(q, res, ok){
    const it = q.it;
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:"级数：<b>" + q.seq.join(" ") + "</b>。" + (it.outsider ? "外人是 <b>" + it.outsider.replace(/b(\d)/g, "♭$1") + "</b>。" : "") + esc(it.why) + "<br><span class='muted'>" + OUTSIDE_RULE[it.cat] + "</span>",
      actions:[{act:"hear", label:"听一遍"}].concat(it.twin ? [{act:"twin", label:"A/B：全调内版 → 原版"}] : [])};
  },
  action(q, act){
    if(act === "hear") AE.play(thDegsEvents(q.k, q.seq, 2, "half"), {bpm:100});
    if(act === "twin"){
      const a = thDegsEvents(q.k, q.it.twin, 2, "half"), b = thDegsEvents(q.k, q.seq, 2, "half").map(e=>Object.assign({}, e, {t:e.t + 9}));
      AE.play(a.concat(b), {bpm:100});
    }
  }
};
const TH_MOD_TYPES = [
  {k:"semi",  lab:"半音上移",       f:k=>({to:thKeyByPc(k.pc + 1), minor:false})},
  {k:"whole", lab:"全音上移",       f:k=>({to:thKeyByPc(k.pc + 2), minor:false})},
  {k:"dom",   lab:"转到属调",       f:k=>({to:thKeyByPc(k.pc + 7), minor:false})},
  {k:"sub",   lab:"转到下属调",     f:k=>({to:thKeyByPc(k.pc + 5), minor:false})},
  {k:"rel",   lab:"关系小调（相对小调）", f:k=>({toName:k.rel + " 小调", minor:true})},
  {k:"par",   lab:"同主音小调（平行小调）", f:k=>({toName:k.n + " 小调", minor:true})},
  {k:"third", lab:"三度关系转调",   f:k=>({to:thKeyByPc(k.pc + (Math.random() < 0.5 ? 4 : 8)), minor:false})}
];
function thKeyByPc(pc){ pc = ((pc % 12) + 12) % 12; return TH_KEYS.find(k=>k.pc === pc); }
TH_KINDS.thModul = {
  gen(level){
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)];
    if(Math.random() < 0.6){
      const ty = thPick(TH_MOD_TYPES), r = ty.f(k);
      const toName = r.toName || (r.to.n + " 大调");
      return Object.assign({sig:"c" + ty.k + k.n, t:"classify", k, ty, toName, prompt:k.n + " 大调 → " + toName, sub:"这是哪种转调？"},
        thOpts(ty.lab, TH_MOD_TYPES.filter(x=>x !== ty && !(ty.k === "third" && x.k === "whole")).map(x=>x.lab)));
    }
    const up = Math.random() < 0.6 ? 1 : 2;
    const to = thKeyByPc(k.pc + up);
    const prog = thPick([["4","5","3m","6m"],["1","5","6m","4"],["6m","4","5","1"],["4","5","6m","1"]]);
    const names = kk => prog.map(d=>thDegChord(kk, d).name).join(" ");
    return Object.assign({sig:"m" + k.n + up + prog.join(), t:"move", k, to, up, prog, ctx:"最后一遍副歌升" + (up === 1 ? "半音" : "全音"),
      prompt:k.n + " 大调：" + names(k), sub:"升调后弹什么？", long:true},
      thOpts(names(to), [names(thKeyByPc(k.pc + 3 - up)), names(thKeyByPc(k.pc - up)), names(thKeyByPc(k.pc + 7))]));
  },
  fb(q, res, ok){
    if(q.t === "move") return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:"级数不变（" + q.prog.join(" ") + "），只是 1 从 " + q.k.n + " 换成 " + q.to.n + "。指板上所有形状整体往上挪 " + q.up + " 品。",
      actions:[{act:"hear", label:"听：原调 → 升调"}]};
    const why = {semi:"主音往上半音，所有和弦一起升，最后一遍副歌的经典做法。", whole:"主音往上全音（两个半音）。", dom:"新的 1 是原来的 5，五度圈顺时针一格，只差一个音。",
      sub:"新的 1 是原来的 4，五度圈逆时针一格，只差一个音。", rel:"调号不变，主和弦从 1 换到 6m。按相对大调记法，级数不用换。",
      par:"主音不变，3 6 7 变暗。按相对大调记法要换成新的坐标（C 小调按 E♭ 大调记）。", third:"主音相差大三度或小六度，不在五度圈的邻居里，听起来戏剧化。"};
    return {title: ok ? "对，" + q.ty.lab : "是" + q.ty.lab + "，你选了" + res.chosen.label, detail:q.k.n + " 大调 → " + q.toName + "：" + why[q.ty.k]};
  },
  action(q, act){
    if(act !== "hear") return;
    const a = thDegsEvents(q.k, q.prog, 2, "8ths"), b = thDegsEvents(q.to, q.prog, 2, "8ths").map(e=>Object.assign({}, e, {t:e.t + q.prog.length * 2}));
    AE.play(a.concat(b), {bpm:110});
  }
};
// 转位与 slash 和弦
TH_KINDS.thSlash = {
  gen(level){
    const t = thWeighted([["inv",3],["deg2name",3],["name2deg",3]]);
    if(t === "inv"){
      const root = thPick(TH_ROOTS12), q = thPick(["maj","min","dom7","maj","min"]);
      const notes = thChordNotes(root, q);
      const which = thPick(notes.length === 4 ? [0,1,2,3] : [0,1,2]);
      const labs = ["原位（根音在低音）","第一转位（三音在低音）","第二转位（五音在低音）","第三转位（七音在低音）"];
      const name = thChordName(root, q) + (which ? "/" + thNotesText([notes[which]]) : "");
      return Object.assign({sig:t + name, t, root, q, notes, which, prompt:name, sub:"这是哪种转位？"},
        thFixedOpts(labs.slice(0, notes.length), labs[which]));
    }
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)];
    const items = ["5/7","1/3","6m/5","4/5","1/5","2m/1","4/1","5/1","3m/5","4/6"];
    const d = thPick(items);
    const c = thDegChord(k, d);
    const others = items.filter(x=>x !== d);
    if(t === "deg2name"){
      return Object.assign({sig:t + k.n + d, t, k, d, c, ctx:k.n + " 大调", prompt:d, sub:"是哪个和弦？"},
        thOpts(c.name, thShuffle(others).slice(0, 4).map(x=>thDegChord(k, x).name)));
    }
    return Object.assign({sig:t + k.n + d, t, k, d, c, ctx:k.n + " 大调", prompt:c.name, sub:"级数怎么写？", optCls:"narrow"},
      thOpts(d, others));
  },
  fb(q, res, ok){
    if(q.t === "inv") return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:thChordName(q.root, q.q) + " = " + thNotesText(q.notes) + "。斜杠后面是 " + thNotesText([q.notes[q.which]]) + "，是和弦的" + ["根音","三音","五音","七音"][q.which] + "。贝斯弹斜杠后面的音。"};
    const [top, bass] = q.d.split("/");
    const tc = thDegChord(q.k, top);
    const inChord = thChordNotes(tc.root, tc.q).some(n=>thSame(n, q.c.bassNote));
    return {title: ok ? "对：" + q.d + " = " + q.c.name : "正确答案：" + q.answerValue,
      detail:"斜杠前是和弦的级数（" + top + " = " + tc.name + "），斜杠后是低音的级数（" + bass + " 级音 = " + thNotesText([q.c.bassNote]) + "）。" +
        (inChord ? "低音是和弦音，所以是转位。" : "低音不是和弦音（复合和弦 / 踏板），上下各弹各的。"),
      actions:[{act:"hear", label:"听：1 → " + q.c.name}]};
  },
  action(q, act){ if(act === "hear" && q.k) AE.play(thDegsEvents(q.k, ["1", q.d], 3, "whole"), {bpm:90}); }
};

thRegisterCourse({
  key:"ph", stage:"乐理 3", name:"套路与和声进阶", cssColor:"var(--accent-ph)", meterCls:"ph",
  desc:"常用套路词汇表、副属和弦、借用和弦、转调、转位与 slash 和弦。回答「这个和弦为什么在这里」，把听到的和看到的接到一起。",
  lessons:[
    {id:"ph-l1", title:"套路词汇表", sum:"王道、小室、Axis、卡农、2-5-1、456、安达卢西亚……每个为什么好听、怎么认", body:thLsPatterns, practice:["ph-1"]},
    {id:"ph-l2", title:"副属和弦", sum:"任何和弦都能有自己的 5；3(7)、6(7) 的识别与解决；贝斯怎么处理", body:thLsSecDom, practice:["ph-2","ph-4"]},
    {id:"ph-l3", title:"借用和弦", sum:"从平行小调借来的 4m、♭6、♭7、♭3；和副属的区别；指板形状", body:thLsBorrow, practice:["ph-3","ph-4"]},
    {id:"ph-l4", title:"转调", sum:"借用 vs 转调；半音上移、属调、关系调、同主音调；怎么转、怎么认", body:thLsModulation, practice:["ph-5"]},
    {id:"ph-l5", title:"转位与 slash 和弦", sum:"C/E 读法；转位让低音线级进；复合和弦与踏板音", body:thLsSlash, practice:["ph-6"]}
  ],
  levels:[
    {id:"ph-1", kind:"thPatName", name:"档 1 · 套路词汇", goal:"级数 ↔ 套路名，13 个常用套路", lesson:"ph-l1"},
    {id:"ph-2", kind:"thSecDom",  name:"档 2 · 副属和弦", goal:"副属推向谁、想去某个和弦用哪个副属、级数写法、调外音", lesson:"ph-l2"},
    {id:"ph-3", kind:"thBorrow",  name:"档 3 · 借用和弦", goal:"认出 4m、♭6、♭7、♭3、5m；和副属区分开", lesson:"ph-l3"},
    {id:"ph-4", kind:"thAnalyze", name:"档 4 · 进行分析", goal:"看一行和弦名：全调内、副属、借用 4m 还是借用 ♭6 ♭7", lesson:"ph-l2"},
    {id:"ph-5", kind:"thModul",   name:"档 5 · 转调", goal:"转调类型的判断；升调副歌弹什么", lesson:"ph-l4"},
    {id:"ph-6", kind:"thSlash",   name:"档 6 · 转位与 slash", goal:"读转位、级数斜杠写法 ↔ 和弦名", lesson:"ph-l5"}
  ]
});
