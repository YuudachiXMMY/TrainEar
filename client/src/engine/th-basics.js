"use strict";
/* 乐理 1 · 基础乐理：音名与半音、音程、大调音阶与级数、小调 / 调式 / 五声、三和弦、七和弦 */

import { fretTuning, fretboardHtml, FRET_MAX, relText, irregularNote, stringName, cellsIn } from "./fret.js";
import { NATURAL_PC, pcName } from "./drills.js";
import { AE, noteName, noteNameOct } from "./audio.js";
import { S, recordAnswer } from "./state.js";
import {
  TH_LET, TH_IV, TH_IV_BY, thIvName, TH_KEYS, TH_KEY_BY, thSigText, TH_MAJOR, thScale, thDegLabel,
  thFormula, TH_MODES, thNotesText, thAscMidis, TH_CH, thChordNotes, thChordName, thChordFormula,
  thPick, thShuffle, thWeighted, thOpts, thFixedOpts, TH_KINDS, thRegisterCourse, thSec, thKey, thPlay,
  thTable, thTip, thFretFig, thTuneNote, thP, thN, thPc, thNm, thUp, thSame, thMelodyEvents, thChordsEvents,
  thKeyPick, thFinish
} from "./th-engine.js";

export const TH_ROOTS12 = ["C","D♭","D","E♭","E","F","F♯","G","A♭","A","B♭","B"].map(thP);
const TH_ROOTS_EASY = ["C","D","E","F","G","A","B","B♭","E♭","F♯"].map(thP);

/* ================================================================
   课
   ================================================================ */
function thLsNotes(){
  const tun = fretTuning();
  let s = tun.findIndex(m=>m % 12 === 4); if(s < 0) s = 0;           // 优先用 E 弦
  const marks = {};
  for(let f=0; f<=12; f++){
    const pc = (tun[s] + f) % 12;
    marks[s + "-" + f] = {cls: NATURAL_PC.includes(pc) ? "nat" : "muted", label: pcName(pc)};
  }
  const chrom = Array.from({length:13}, (_,i)=>36 + i);
  const whole = [36,38,40,42,44,46,48];
  return thSec("12 个音，循环往复",
      '<p>音名只有 7 个字母：<b>C D E F G A B</b>（do re mi fa sol la si）。但一个八度里一共有 <b>12</b> 个不同的音，字母之间的空当用升降号补上。</p>' +
      '<p>指板上相邻的两品差一个<b>半音</b>；隔一品（两个半音）叫一个<b>全音</b>。12 个半音走完，回到同一个音名、高一个八度（第 12 品）。</p>' +
      '<div class="ls-fig">' + fretboardHtml({tun, marks, from:0, to:12, wide:true}) + '<div class="tiny muted ls-cap">' + noteName(tun[s]) + ' 弦 0–12 品：实心是自然音（字母本身），描边是升降音</div></div>' +
      thKey('两处天然的半音：<b>E–F</b> 和 <b>B–C</b> 之间没有别的音（钢琴上这两处没有黑键）。其余相邻字母之间都隔一个全音。') +
      '<div class="ls-btns">' + thPlay("半音阶 C → C（12 个半音）", ()=>thMelodyEvents(chrom, 0.5)) + thPlay("全音阶 C D E F♯ G♯ A♯ C", ()=>thMelodyEvents(whole, 0.5)) + '</div>') +
    thSec("升号、降号、等音",
      '<p><b>♯ 升号</b>：升高半音（往琴头反方向挪一品）。<b>♭ 降号</b>：降低半音（往琴头挪一品）。</p>' +
      '<p>C♯ 和 D♭ 在同一个品上，声音完全一样，叫<b>等音</b>。写哪一个不是随意的：在一个调或一个和弦里，<b>每个字母只用一次</b>。所以 A 大调写 C♯ 不写 D♭，F 大调写 B♭ 不写 A♯。下一课的音程、第三课的音阶都靠这条规则拼写。</p>' +
      '<p>偶尔还会遇到 <b>E♯</b>（= F）、<b>C♭</b>（= B）、<b>B♭♭</b>（= A）这种写法，原因同上：字母不能重复，也不能跳过。</p>') +
    thSec("八度在指板上",
      '<p>同一个音名、相差 12 个半音叫<b>八度</b>。标准四度调弦下，八度的形状是<b>上两弦 +2 品</b>（例如 E 弦 3 品 G → D 弦 5 品 G），或者同一根弦 +12 品。这个形状在「音名地形」档 4 里专门练。</p>' +
      thTip(thTuneNote()));
}
function thLsIntervals(){
  const C = thP("C");
  const rows = TH_IV.filter(i=>i.k !== "d7" && i.k !== "A5").map(i=>{
    const up = thUp(C, i.num, i.semi);
    const shape = {0:"同一个位置",1:"同弦 +1",2:"同弦 +2",3:"上一弦 −2",4:"上一弦 −1",5:"上一弦同品",6:"上一弦 +1",7:"上一弦 +2",8:"上两弦 −2",9:"上两弦 −1",10:"上两弦同品",11:"上两弦 +1",12:"上两弦 +2"}[i.semi];
    const root = 36;
    return [String(i.semi), '<b>' + i.zh + '</b> ' + i.k, i.d, "C → " + thNm(up), shape,
      thPlay("听", ()=>[{t:0,dur:0.9,midi:root,voice:"bass",vel:1},{t:1,dur:0.9,midi:root+i.semi,voice:"bass",vel:1},
                       {t:2.2,dur:1.8,midi:root,voice:"bass",vel:0.9},{t:2.2,dur:1.8,midi:root+i.semi,voice:"bass",vel:0.8}], 100, "mini")];
  });
  const shapeItems = [[0,"1","nat"],[3,"♭3","deg-T"],[4,"3","deg-T"],[5,"4","deg-S"],[7,"5","deg-D"],[9,"6","deg-S"],[10,"♭7","deg-D"],[11,"7","deg-D"],[12,"8","nat"]];
  return thSec("度数 + 性质",
      '<p>音程 = 两个音的距离，名字分两半：</p>' +
      '<p><b>度数</b>：数字母，<b>两头都算</b>。C → E：C D E，三个字母 = 三度。C → G：五度。</p>' +
      '<p><b>性质</b>：数半音。同样是三度，C → E 是 4 个半音 = <b>大三度</b>；C → E♭ 是 3 个半音 = <b>小三度</b>。</p>' +
      thKey('1、4、5、8 度只有一种「正常」大小，叫<b>纯</b>；2、3、6、7 度有两种，大的叫<b>大</b>、小的叫<b>小</b>。比纯 / 大再多半音叫<b>增</b>，比纯 / 小再少半音叫<b>减</b>。')) +
    thSec("音程表（从 C 往上）",
      thTable(["半音","名称","级数写法","例子","指板形状*","听"], rows) +
      '<div class="tiny muted">* 四度调弦（标准 4 弦 / 5 弦）下从根音出发的形状；「上一弦」= 音高更高的那根弦。也可以在同一根弦上数品。</div>') +
    thSec("在指板上看形状",
      '<p>根音（白圈）附近，最常用的音程都在 4–5 品的范围里。记住这几个形状，比背音名快得多：</p>' +
      thFretFig(0, shapeItems, {caption:"以 C 为根：♭3 / 3 在上一弦往回 2 / 1 品，4 在上一弦同品，5 在上一弦 +2，♭7 在上两弦同品，8 在上两弦 +2"}) +
      thTip(thTuneNote())) +
    thSec("三全音与转位",
      '<p><b>增四度 = 减五度 = 6 个半音</b>，正好把八度劈成两半，叫<b>三全音</b>。它是属七和弦（3 和 ♭7 之间）的紧张来源，后面讲进行时会反复出现。</p>' +
      '<p><b>转位</b>：把音程上下翻过来，两个度数相加等于 9，性质大↔小、增↔减、纯还是纯。C 上方纯五度是 G；G 上方纯四度是 C。</p>' +
      thKey('贝斯手最常用的一条：<b>根音往下弹五度 = 往上弹四度的那个音名</b>。所以「下一弦同品」就是低八度的 5，根五交替往下弹手不用动。'));
}
function thLsMajor(){
  const keys = ["C","G","D","F","B♭"].map(n=>TH_KEY_BY[n]);
  const rows = keys.map(k=>{
    const sc = thScale(k.t);
    return ['<b>' + k.n + ' 大调</b>'].concat(sc.map((n,i)=> i === 0 ? "<b>" + thNm(n) + "</b>" : thNm(n))).concat([thSigText(k.sig).replace(/（.*）/,"")]);
  });
  // 一个八度的指型：从 1 到 8
  const items = TH_MAJOR.concat([12]).map((s,i)=>[s, String(i === 7 ? 1 : i + 1), i === 0 || i === 7 ? "nat" : "deg-T"]);
  return thSec("全全半全全全半",
      '<p>大调音阶 = 从主音出发，按 <b>全 全 半 全 全 全 半</b> 的距离走 7 步回到八度。C 大调正好是 7 个自然音（白键）：E–F、B–C 两处天然半音刚好落在第 3–4、7–8 步。</p>' +
      '<div class="ls-btns">' + thPlay("C 大调上行 + 下行", ()=>thMelodyEvents([36,38,40,41,43,45,47,48,47,45,43,41,40,38,36], 0.5)) +
      thPlay("G 大调", ()=>thMelodyEvents([43,45,47,48,50,52,54,55], 0.5)) + '</div>') +
    thSec("级数：换调不变的名字",
      '<p>音阶里第几个音就叫<b>几级</b>：1 2 3 4 5 6 7。C 大调里 E 是 3 级；G 大调里 B 是 3 级。<b>级数描述的是「在调里的角色」</b>，换调之后还是那个角色。</p>' +
      thKey('TrainEar 所有练习（根音追踪、级数定位、套路）用的都是级数。乐队里说「副歌是 4 5 3m 6m」，不管弹哪个调大家都知道在干什么。')) +
    thSec("用公式拼别的调",
      '<p>从 G 开始照公式走：G A B C D E <b>F♯</b> G。第 6 → 7 步要全音，E → F 只有半音，所以 F 必须升高。<b>字母按顺序各用一次</b>，缺的半音用升降号补。</p>' +
      thTable(["调","1","2","3","4","5","6","7","调号"], rows, "wide") +
      '<p>升降号的数量和顺序是固定的，「调内和声」那门课的五度圈会讲怎么一眼认出来。</p>') +
    thSec("一个把位里的大调音阶",
      thFretFig(0, items, {caption:"以 C 为 1，一个八度的大调音阶。手不用移把位：1 2 3 在一根弦上，4 5 6 在上一根，7 8 在再上一根"}) +
      '<p>这个指型对任何调都一样，挪到哪个品，1 就是哪个音。「模进训练」里所有练习都在这个框里完成。</p>' +
      thTip(thTuneNote()));
}
function thLsModes(){
  const C = thP("C");
  const modeRows = TH_MODES.map(md=>{
    const parent = TH_KEY_BY["C"];
    const tonic = thScale(parent.t)[md.start - 1];
    const notes = thScale(tonic, md.semis);
    return ['<b>' + md.zh + '</b><br><span class="muted">' + md.en + '</span>', "C 大调从 " + md.start + " 级（" + thNm(tonic) + "）", thNotesText(notes),
      thFormula(md.semis), md.feat, md.feel];
  });
  const sameTonic = TH_MODES.filter(md=>["ionian","dorian","mixolydian","aeolian","lydian","phrygian"].includes(md.k)).map(md=>{
    return thPlay("C " + md.zh, ()=>{
      const sc = thAscMidis(thScale(C, md.semis).concat([C]), 48);
      return [{t:0, dur:sc.length * 0.5 + 0.6, midi:36, voice:"bass", vel:0.8}].concat(sc.map((m,i)=>({t:i * 0.5, dur:0.46, midi:m + 12, voice:"ep", vel:0.75})));
    });
  }).join("");
  const nat = thScale(thP("A"), TH_MODES[5].semis);
  return thSec("自然小调与相对小调",
      '<p><b>自然小调</b> = 全 半 全 全 半 全 全。A 小调：' + thNotesText(nat) + '，和 C 大调<b>是同一组音</b>，只是从 6 级 A 开始。</p>' +
      thKey('每个大调的 <b>6 级</b>，就是它的<b>相对小调</b>（关系小调）的主音：C 大调 ↔ A 小调，G 大调 ↔ E 小调，E♭ 大调 ↔ C 小调。两者调号相同。') +
      '<p>换个角度：拿同一个主音比，<b>C 自然小调 = C 大调把 3、6、7 降半音</b>：1 2 ♭3 4 5 ♭6 ♭7。同主音的大小调互称<b>平行调</b>（同主音调）。「套路与和声进阶」里的借用和弦，就是从平行小调借来的。</p>') +
    thSec("和声小调：小调里的 3(7) 从哪来",
      '<p>自然小调的 7 级（♭7）离主音一个全音，回家的拉力弱。把它升高半音变成导音，就是<b>和声小调</b>：1 2 ♭3 4 5 ♭6 <b>7</b>。A 和声小调里 G 变 G♯，5 级和弦从 Em 变成 <b>E / E7</b>。</p>' +
      '<p>按 TrainEar 的相对大调记法（A 小调的歌按 C 大调记，主和弦 = 6m），这个 E7 记作 <b>3(7)</b>：本来调内 3 级是小和弦，这里变成了属七，指向 6m。</p>') +
    thSec("七种调式",
      '<p>大调音阶从不同的级数开始，会得到 7 种不同的「颜色」，叫<b>调式</b>。音还是那 7 个，主音换了，半音的位置就换了。</p>' +
      thTable(["调式","来源","音","公式","特征音","听感 / 场景"], modeRows, "wide") +
      '<p><b>特征音</b>是它和最接近的大调或自然小调相比多出来的那个不一样的音：多利亚 = 小调 + 还原 6；混合利底亚 = 大调 + ♭7；利底亚 = 大调 + ♯4；弗里几亚 = 小调 + ♭2。</p>' +
      '<p>同一个主音 C、在 C 低音上依次听，颜色的差别最清楚：</p><div class="ls-btns">' + sameTonic + '</div>') +
    thSec("五声音阶",
      '<p><b>大调五声</b>：1 2 3 5 6（去掉大调的 4 和 7）。<b>小调五声</b>：1 ♭3 4 5 ♭7（= 相对大调五声从 6 开始）。</p>' +
      '<p>五声音阶里没有半音，任何两个音放在一起都不刺耳，所以是贝斯加花、填空、写 riff 最安全的材料。摇滚里的小调五声 riff 几乎都在一个把位里：</p>' +
      thFretFig(9, [[0,"1","nat"],[3,"♭3","deg-T"],[5,"4","deg-S"],[7,"5","deg-D"],[10,"♭7","deg-D"],[12,"1","nat"]], {caption:"A 小调五声，一个八度"}) +
      '<div class="ls-btns">' + thPlay("A 小调五声", ()=>thMelodyEvents([33,36,38,40,43,45,43,40,38,36,33], 0.5)) + '</div>');
}
function thLsTriads(){
  const C = thP("C");
  const qs = ["maj","min","dim","aug","sus4","sus2"];
  const rows = qs.map(q=>{
    const notes = thChordNotes(C, q);
    return ['<b>' + TH_CH[q].zh + '</b>', "C" + TH_CH[q].sym, thChordFormula(q), thNotesText(notes),
      {maj:"大三 + 小三", min:"小三 + 大三", dim:"小三 + 小三", aug:"大三 + 大三", sus4:"三音换成 4", sus2:"三音换成 2"}[q],
      TH_CH[q].feel, thPlay("听", ()=>thChordsEvents([{rootPc:0, q}], 3, "whole"), 90, "mini")];
  });
  return thSec("三度叠起来",
      '<p>和弦 = 从根音开始<b>隔一个字母取一个音</b>（三度叠置）：根音 <b>1</b>、三音 <b>3</b>、五音 <b>5</b>。C 和弦 = C E G。</p>' +
      '<p>三音决定大小：根音到三音是大三度就是<b>大和弦</b>（亮），小三度就是<b>小和弦</b>（暗）。五音通常是纯五度，被改动时就成了减或增。</p>' +
      thTable(["名称","符号","公式","C 为根","结构","听感","听"], rows, "wide") +
      '<p>符号写法：C（大）、Cm（小，也写 C−）、Cdim（C°）、Caug（C+）。sus 和弦没有三音，不大不小，常在回到正常三和弦前「悬」一下。</p>') +
    thSec("贝斯手眼里的三和弦",
      '<p>根音最重要（决定和弦是谁），五音最安全（大小和弦都一样），<b>三音最有表情</b>（决定亮暗），弹在低音上会变成转位（C/E），要有意为之。</p>' +
      thFretFig(0, [[0,"1","nat"],[4,"3","deg-T"],[7,"5","deg-D"],[12,"8","nat"]], {caption:"C 大三和弦：3 在上一弦 −1，5 在上一弦 +2，8 在上两弦 +2"}) +
      thFretFig(0, [[0,"1","nat"],[3,"♭3","deg-S"],[7,"5","deg-D"],[12,"8","nat"]], {caption:"C 小三和弦：只有三音往回挪一品（上一弦 −2）"}) +
      thTip("大和弦和小和弦在指板上只差一个音、一品。弹琶音前先找三音，这一品决定了整小节的情绪。" ));
}
function thLsSevenths(){
  const C = thP("C");
  const qs = ["maj7","dom7","min7","m7b5","dim7"];
  const rows = qs.map(q=>[ '<b>' + TH_CH[q].zh + '</b>', "C" + TH_CH[q].sym, thChordFormula(q), thNotesText(thChordNotes(C, q)),
    {maj7:"大三和弦 + 大七度", dom7:"大三和弦 + 小七度", min7:"小三和弦 + 小七度", m7b5:"减三和弦 + 小七度", dim7:"减三和弦 + 减七度"}[q],
    TH_CH[q].feel, thPlay("听", ()=>thChordsEvents([{rootPc:0, q}], 3, "whole"), 90, "mini")]);
  return thSec("再叠一个三度",
      '<p>三和弦上再加一个七音，就是七和弦。区分它们只要看两件事：<b>底下是什么三和弦</b>，<b>七音是大七度还是小七度</b>。</p>' +
      thTable(["名称","符号","公式","C 为根","构成","听感","听"], rows, "wide") +
      '<p>别名：maj7 = M7 = Δ7；m7♭5 = ø（半减）；dim7 = °7。日系谱面常写 CM7、Cm7-5。</p>') +
    thSec("属七：进行的发动机",
      '<p>属七和弦里 <b>3 和 ♭7 相距三全音</b>，很不稳定，强烈地想往<b>下五度</b>（上四度）的和弦走：G7 → C。这就是 5 → 1 有「回家感」的原因，也是后面「副属和弦」的原理：在任何和弦前面放一个它的属七，就能把耳朵推过去。</p>' +
      '<div class="ls-btns">' + thPlay("G7 → C", ()=>thChordsEvents([{rootPc:7, q:"dom7"},{rootPc:0, q:"maj"}], 3, "whole"), 90) +
      thPlay("Gmaj7 → C（没有推力）", ()=>thChordsEvents([{rootPc:7, q:"maj7"},{rootPc:0, q:"maj"}], 3, "whole"), 90) + '</div>') +
    thSec("七音在指板上",
      thFretFig(0, [[0,"1","nat"],[4,"3","deg-T"],[7,"5","deg-D"],[10,"♭7","deg-S"],[11,"7","deg-T"]], {caption:"♭7 = 上两弦同品；7 = 上两弦 +1（或者八度往回一品）"}) +
      thTip("调内每个级数天生带一种七和弦（1maj7、2m7、3m7、4maj7、5(7)、6m7、7m7♭5）。下一门课「调内和声与级数」从这里接着讲。"));
}

/* ================================================================
   题型
   ================================================================ */
// 音程计算：两个音名 → 音程；音程 → 半音数
const TH_IV_QPOOL = ["m2","M2","m3","M3","P4","A4","d5","P5","m6","M6","m7","M7"].map(k=>TH_IV_BY[k]);
TH_KINDS.thIvCalc = {
  gen(level){
    if(Math.random() < 0.3){
      const iv = thPick(TH_IV_QPOOL.concat([TH_IV_BY.P8]));
      const cands = [iv.semi - 2, iv.semi - 1, iv.semi + 1, iv.semi + 2].filter(x=>x >= 1 && x <= 12).map(String);
      return Object.assign({sig:"s" + iv.k, kind2:"semi", iv, prompt:iv.zh + "（" + iv.k + "）", sub:"有几个半音？", optCls:"narrow"},
        thOpts(String(iv.semi), cands));
    }
    let root, iv, up;
    for(let i=0; i<30; i++){
      root = thPick(TH_ROOTS_EASY); iv = thPick(TH_IV_QPOOL); up = thUp(root, iv.num, iv.semi);
      if(Math.abs(up.acc) <= 1) break;
    }
    const pool = TH_IV_QPOOL.filter(x=>x !== iv && (x.num === iv.num || Math.abs(x.semi - iv.semi) <= 1)).map(thIvName);
    const more = TH_IV_QPOOL.filter(x=>x !== iv).map(thIvName);
    return Object.assign({sig:thNm(root) + iv.k, kind2:"pair", root, iv, up,
      prompt:thNm(root) + " → " + thNm(up), sub:"从下往上是什么音程？"},
      thOpts(thIvName(iv), pool.concat(thShuffle(more))));
  },
  fb(q, res, ok){
    const iv = q.iv;
    if(q.kind2 === "semi") return {title: ok ? "对，" + iv.semi + " 个半音" : iv.zh + " 是 " + iv.semi + " 个半音",
      detail:iv.zh + "：" + (iv.num) + " 度，" + iv.semi + " 个半音，级数写作 <b>" + iv.d + "</b>。" + (iv.feel ? iv.feel + "。" : "")};
    const letters = [];
    for(let i=0; i<iv.num; i++) letters.push(TH_LET[(q.root.L + i) % 7]);
    return {title: ok ? "对，" + thIvName(iv) : "是" + thIvName(iv) + "，你选了" + res.chosen.label,
      detail:"度数数字母：<b>" + letters.join(" ") + "</b> = " + iv.num + " 度；性质数半音：" + thNm(q.root) + " 到 " + thNm(q.up) + " 是 <b>" + iv.semi + "</b> 个半音 → " + iv.zh + "。" +
        (iv.k === "A4" || iv.k === "d5" ? "<br>增四度和减五度都是 6 个半音（三全音），名字由字母决定：数出来是四度就叫增四，五度就叫减五。" : "")};
  }
};

// 指板音程形状：给根音，点出上方的某个音程
const TH_IV_FRET = ["m2","M2","m3","M3","P4","d5","P5","m6","M6","m7","M7","P8"].map(k=>TH_IV_BY[k]);
TH_KINDS.thIvFret = {
  gen(level){
    const tun = fretTuning();
    let iv, root, targets, lo, hi;
    for(let i=0; i<60; i++){
      iv = thPick(TH_IV_FRET);
      const s = Math.floor(Math.random() * Math.max(1, tun.length - 1)), f = 1 + Math.floor(Math.random() * 9);
      root = {s, f, midi:tun[s] + f};
      lo = Math.max(0, f - 3); hi = Math.min(FRET_MAX, f + 4);
      targets = cellsIn(tun, lo, hi, ()=>true).filter(c=>c.midi === root.midi + iv.semi);
      if(targets.length) break;
    }
    const lab = iv.k === "d5" ? "三全音（♭5）" : iv.zh + "（" + iv.d + "）";
    return {sig:iv.k + root.s + root.f, fret:true, options:[], tun, root, iv, targets, lo, hi, lab,
      enabled:(s, f)=> f >= lo && f <= hi,
      prompt:lab, sub:"根音是亮着的 <b>" + noteNameOct(root.midi) + "</b>（" + stringName(tun, root.s) + " " + root.f + " 品），点出它<b>上方</b>的" + lab,
      foot:"点指板作答（只算比根音高的那个音） · 回车下一题 · Esc 返回",
      visual(q){
        const marks = {};
        marks[q.root.s + "-" + q.root.f] = {cls:"nat anchor", label:"1"};
        if(S.answered){
          for(const c of q.targets) marks[c.s + "-" + c.f] = {cls:"ok", label:q.iv.d};
          const ck = q.result.clicked;
          if(ck && !q.result.ok) marks[ck.s + "-" + ck.f] = {cls:"bad", label:q.result.chosenLabel};
        }
        return '<div style="margin-bottom:12px">' + fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled}) + '</div>';
      }};
  },
  click(q, cell){
    const d = cell.midi - q.root.midi;
    const hit = TH_IV.find(i=>i.semi === d && i.k !== "A4" && i.k !== "A5" && i.k !== "d7");
    const chosenLabel = d === 0 ? "根音本身" : d < 0 ? "比根音低" : hit ? (hit.k === "d5" ? "♭5" : hit.d) : "超过八度";
    const ok = d === q.iv.semi;
    recordAnswer(q.level.id, q.iv.k === "d5" ? "♭5" : q.iv.d, chosenLabel, 0);
    thFinish(ok, {clicked:cell, chosenLabel});
  },
  fb(q, res, ok){
    const t = q.targets[0];
    const irr = irregularNote(q.tun, [[q.root, t]]);
    return {title: ok ? "对，" + q.lab + " 在这里" : "那是 " + res.chosenLabel + "，" + q.lab + " 在绿点",
      detail:"从根音出发：" + q.targets.map(c=>"<b>" + relText(q.root, c) + "</b>").join("，") + "（" + noteNameOct(t.midi) + "）。" +
        (irr ? '<br><span style="color:var(--warn)">' + irr + '</span>' : ""),
      actions:[{act:"hear", label:"听这个音程"}]};
  },
  action(q, act){
    if(act === "hear") AE.play([{t:0,dur:0.9,midi:q.root.midi,voice:"bass",vel:1},{t:1,dur:0.9,midi:q.root.midi + q.iv.semi,voice:"bass",vel:1},
      {t:2.2,dur:1.6,midi:q.root.midi,voice:"bass",vel:0.9},{t:2.2,dur:1.6,midi:q.root.midi + q.iv.semi,voice:"bass",vel:0.8}], {bpm:100});
  }
};

// 听音程（先分开再一起）
const TH_IV_EAR = ["M2","m3","M3","P4","P5","M6","m7","P8"].map(k=>TH_IV_BY[k]);
function thIvEarEvents(root, semi){
  return [{t:0,dur:0.9,midi:root,voice:"bass",vel:1},{t:1,dur:0.9,midi:root + semi,voice:"bass",vel:1},
          {t:2.3,dur:1.8,midi:root,voice:"bass",vel:0.9},{t:2.3,dur:1.8,midi:root + semi,voice:"bass",vel:0.8}];
}
TH_KINDS.thIvEar = {
  gen(level){
    const iv = thPick(TH_IV_EAR);
    const root = 33 + Math.floor(Math.random() * 12);
    return Object.assign({sig:iv.k, iv, rootMidi:root, ear:true, prompt:"这是什么音程？", sub:"先分开弹一次，再一起弹一次",
      events:thIvEarEvents(root, iv.semi), optCls:"narrow"},
      thFixedOpts(TH_IV_EAR.map(x=>({label:x.zh, sub:x.d})), iv.zh));
  },
  fb(q, res, ok){
    const iv = q.iv;
    return {title: ok ? "对，" + iv.zh : "是" + iv.zh + "，你选了" + res.chosen.label,
      detail:noteNameOct(q.rootMidi) + " → " + noteNameOct(q.rootMidi + iv.semi) + "，" + iv.semi + " 个半音。" + iv.feel + "。",
      actions: ok ? [] : [{act:"cmp", label:"对比听：你选的 → 正确的"}]};
  },
  action(q, act){
    if(act !== "cmp") return;
    const other = TH_IV_EAR.find(x=>x.zh === q.result.chosen.label);
    const a = thIvEarEvents(q.rootMidi, other.semi), b = thIvEarEvents(q.rootMidi, q.iv.semi).map(e=>Object.assign({}, e, {t:e.t + 5}));
    AE.play(a.concat(b), {bpm:100});
  }
};

// 音阶拼写：某调第几级是什么音 / 某音是几级 / 整条音阶
TH_KINDS.thScaleQ = {
  gen(level){
    const k = thKeyPick(level), sc = thScale(k.t);
    const t = thWeighted([["deg2note",4],["note2deg",3],["whole",2]]);
    if(t === "deg2note"){
      const i = 1 + Math.floor(Math.random() * 6), n = sc[i];
      const enh = TH_LET.map((_,L)=>thN(L, 0)).flatMap(x=>[-1,0,1].map(a=>thN(x.L, a))).filter(x=>thPc(x) === thPc(n) && !thSame(x, n));
      const pool = [thN(n.L, n.acc + 1), thN(n.L, n.acc - 1)].filter(x=>Math.abs(x.acc) <= 1).concat(enh, [sc[(i + 1) % 7], sc[i - 1]]).map(thNm);
      return Object.assign({sig:t + k.n + i, t, k, i, n, ctx:k.n + " 大调", prompt:(i + 1) + " 级", sub:"是哪个音？"}, thOpts(thNm(n), pool));
    }
    if(t === "note2deg"){
      const i = 1 + Math.floor(Math.random() * 6), n = sc[i];
      return Object.assign({sig:t + k.n + i, t, k, i, n, ctx:k.n + " 大调", prompt:thNm(n), sub:"是几级？", optCls:"deg7"},
        thFixedOpts(["1","2","3","4","5","6","7"], String(i + 1)));
    }
    // 整条音阶：一个音被改错的干扰项
    const wrong = [];
    for(let j=1; j<7 && wrong.length < 6; j++){
      for(const d of [1,-1]){
        const x = sc.slice(); x[j] = thN(sc[j].L, sc[j].acc + d);
        if(Math.abs(x[j].acc) <= 1) wrong.push(thNotesText(x));
      }
    }
    return Object.assign({sig:t + k.n, t, k, sc, ctx:"大调音阶", prompt:k.n + " 大调", sub:"哪一条是对的？", long:false},
      thOpts(thNotesText(sc), thShuffle(wrong)));
  },
  fb(q, res, ok){
    const sc = thScale(q.k.t);
    const line = sc.map((n,j)=> j === q.i ? "<b>" + thNm(n) + "</b>" : thNm(n)).join(" ");
    const base = q.k.n + " 大调：" + line + "（" + thSigText(q.k.sig) + "）";
    if(q.t === "deg2note") return {title: ok ? "对，是 " + thNm(q.n) : "是 " + thNm(q.n) + "，你选了 " + res.chosen.label,
      detail:base + "。" + (res.chosen && thP(res.chosen.label) && thPc(thP(res.chosen.label)) === thPc(q.n) && !ok ? "<br>声音一样，但写法不对：音阶里每个字母只用一次，这里必须用 " + TH_LET[q.n.L] + "。" : "")};
    if(q.t === "note2deg") return {title: ok ? "对，" + thNm(q.n) + " 是 " + (q.i + 1) + " 级" : "是 " + (q.i + 1) + " 级，你选了 " + res.chosen.label, detail:base + "。"};
    return {title: ok ? "对" : "不对，正确的是 " + thNotesText(sc), detail:base + "。按 全全半全全全半 走，每个字母用一次。"};
  }
};

// 调式、相对小调、平行小调、五声
TH_KINDS.thModeQ = {
  gen(level){
    const t = thWeighted([["parent",3],["feat",2],["rel",3],["formula",2],["name",2]]);
    if(t === "parent"){
      const md = thPick(TH_MODES.slice(1, 7)), k = thPick(TH_KEYS);
      const tonic = thScale(k.t)[md.start - 1];
      const lab = (kk, st)=> kk.n + " 大调从 " + st + " 级开始";
      const pool = [];
      for(const st of [1,2,3,4,5,6,7]) if(st !== md.start){
        // 同一个主音、别的调式会对应的母调
        const md2 = TH_MODES[st - 1];
        const par = TH_KEYS.find(kk=>thSame(thScale(kk.t)[st - 1], tonic));
        if(par) pool.push(lab(par, st));
      }
      for(const kk of TH_KEYS) if(kk !== k) pool.push(lab(kk, md.start));
      return Object.assign({sig:t + md.k + k.n, t, md, k, tonic, prompt:thNm(tonic) + " " + md.zh, sub:md.en + " = 哪个大调的音、从第几级开始？", long:true},
        thOpts(lab(k, md.start), pool.slice(0, 6)));
    }
    if(t === "feat"){
      const feats = {dorian:"6", phrygian:"♭2", lydian:"♯4", mixolydian:"♭7", locrian:"♭5"};
      const fk = thPick(Object.keys(feats)), md = TH_MODES.find(x=>x.k === fk);
      return Object.assign({sig:t + md.k, t, md, prompt:md.zh + "（" + md.en + "）", sub:"特征音是哪个？（和最接近的大调或自然小调比）", optCls:"narrow"},
        thOpts(feats[md.k], Object.values(feats)));
    }
    if(t === "rel"){
      const k = thPick(TH_KEYS);
      if(Math.random() < 0.5){
        return Object.assign({sig:t + "m" + k.n, t, k, dir:"maj2min", prompt:k.n + " 大调", sub:"相对小调是？"},
          thOpts(k.rel + " 小调", TH_KEYS.filter(x=>x !== k).map(x=>x.rel + " 小调").concat([k.n + " 小调"])));
      }
      return Object.assign({sig:t + "M" + k.n, t, k, dir:"min2maj", prompt:k.rel + " 小调", sub:"相对大调是？"},
        thOpts(k.n + " 大调", TH_KEYS.filter(x=>x !== k).map(x=>x.n + " 大调").concat([k.rel + " 大调"])));
    }
    if(t === "formula"){
      const items = [
        {q:"自然小调", a:"1 2 ♭3 4 5 ♭6 ♭7"}, {q:"和声小调", a:"1 2 ♭3 4 5 ♭6 7"},
        {q:"大调五声", a:"1 2 3 5 6"}, {q:"小调五声", a:"1 ♭3 4 5 ♭7"},
        {q:"多利亚（Dorian）", a:"1 2 ♭3 4 5 6 ♭7"}, {q:"混合利底亚（Mixolydian）", a:"1 2 3 4 5 6 ♭7"}
      ];
      const it = thPick(items);
      return Object.assign({sig:t + it.q, t, it, prompt:it.q, sub:"公式是？"}, thOpts(it.a, items.filter(x=>x !== it).map(x=>x.a).concat(["1 2 3 4 5 ♭6 ♭7","1 ♭2 ♭3 4 5 ♭6 ♭7"])));
    }
    const md = thPick(TH_MODES);
    return Object.assign({sig:t + md.k, t, md, prompt:thFormula(md.semis), sub:"这是哪个调式？", long:true},
      thOpts(md.zh + " " + md.en, TH_MODES.filter(x=>x !== md).map(x=>x.zh + " " + x.en)));
  },
  fb(q, res, ok){
    const title = ok ? "对" : "正确答案：" + q.options.find(o=>o.value === q.answerValue).label;
    if(q.t === "parent"){
      const notes = thScale(q.tonic, q.md.semis);
      return {title, detail:q.k.n + " 大调的第 " + q.md.start + " 个音是 " + thNm(q.tonic) + "。从它开始弹 " + q.k.n + " 大调的音：<b>" + thNotesText(notes) + "</b> = " +
        thNm(q.tonic) + " " + q.md.zh + "（" + thFormula(q.md.semis) + "）。"};
    }
    if(q.t === "feat") return {title, detail:q.md.zh + "：" + thFormula(q.md.semis) + "。" + q.md.feel + "。"};
    if(q.t === "rel") return {title, detail:"相对大小调共用一组音：大调的 6 级就是相对小调的主音（往下小三度）。" + q.k.n + " 大调 ↔ " + q.k.rel + " 小调，" + thSigText(q.k.sig) + "。"};
    if(q.t === "formula") return {title, detail:q.it.q + " = " + q.it.a + "。公式里的 ♭ 是和同主音的大调比。"};
    return {title, detail:q.md.zh + "（" + q.md.en + "）= 大调从 " + q.md.start + " 级开始，特征音 " + q.md.feat + "。"};
  }
};

// 和弦构成：符号 → 音 / 音 → 符号 / 公式 → 名称
const TH_CH_Q3 = ["maj","min","dim","aug","sus4"], TH_CH_Q4 = ["maj7","dom7","min7","m7b5","dim7"];
TH_KINDS.thChordQ = {
  gen(level){
    const t = thWeighted([["sym2notes",4],["notes2sym",3],["formula",2]]);
    const q = thPick(TH_CH_Q3.concat(TH_CH_Q4, TH_CH_Q4));
    const fam = TH_CH_Q3.includes(q) ? TH_CH_Q3 : TH_CH_Q4;
    let root = thPick(TH_ROOTS12);
    for(let i=0; i<20 && thChordNotes(root, q).some(n=>Math.abs(n.acc) > 1) && q !== "dim7"; i++) root = thPick(TH_ROOTS12);
    if(t === "sym2notes"){
      const pool = fam.filter(x=>x !== q).map(x=>thNotesText(thChordNotes(root, x)));
      return Object.assign({sig:t + q + thNm(root), t, q, root, prompt:thChordName(root, q), sub:"由哪几个音组成？"}, thOpts(thNotesText(thChordNotes(root, q)), pool));
    }
    if(t === "notes2sym"){
      return Object.assign({sig:t + q + thNm(root), t, q, root, prompt:thNotesText(thChordNotes(root, q)), sub:"是什么和弦？（第一个音是根音）"},
        thOpts(thChordName(root, q), fam.filter(x=>x !== q).map(x=>thChordName(root, x))));
    }
    return Object.assign({sig:t + q, t, q, root, prompt:thChordFormula(q), sub:"这是什么和弦？"},
      thOpts(TH_CH[q].zh, fam.filter(x=>x !== q).map(x=>TH_CH[x].zh)));
  },
  fb(q, res, ok){
    const ch = TH_CH[q.q];
    return {title: ok ? "对，" + thChordName(q.root, q.q) + " = " + thNotesText(thChordNotes(q.root, q.q)) : "正确答案：" + q.options.find(o=>o.value === q.answerValue).label,
      detail:ch.zh + " = <b>" + thChordFormula(q.q) + "</b>。以 " + thNm(q.root) + " 为根：" + thNotesText(thChordNotes(q.root, q.q)) + "。" + ch.feel + "。",
      actions:[{act:"hear", label:"听这个和弦"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thChordsEvents([{rootPc:thPc(q.root), q:q.q}], 3, "whole"), {bpm:90}); }
};

/* ================================================================
   注册
   ================================================================ */
thRegisterCourse({
  key:"tb", stage:"乐理 1", name:"基础乐理", cssColor:"var(--accent-tb)", meterCls:"tb",
  desc:"音名、半音全音、音程、大调音阶与级数、小调和调式、三和弦与七和弦。后面所有课和所有练耳关卡都建立在这些名词上。",
  lessons:[
    {id:"tb-l1", title:"音名、半音与全音", sum:"12 个音怎么排、升降号和等音、八度在指板上的样子", body:thLsNotes, practice:["tb-4"]},
    {id:"tb-l2", title:"音程：两个音的距离", sum:"度数数字母、性质数半音；纯 / 大 / 小 / 增 / 减；指板形状与转位", body:thLsIntervals, practice:["tb-1","tb-2","tb-3"]},
    {id:"tb-l3", title:"大调音阶与级数", sum:"全全半全全全半；级数是换调不变的名字；用公式拼任何调", body:thLsMajor, practice:["tb-4"]},
    {id:"tb-l4", title:"小调、调式与五声音阶", sum:"相对 / 平行小调、和声小调、七种调式的特征音、五声音阶", body:thLsModes, practice:["tb-5"]},
    {id:"tb-l5", title:"三和弦：1 3 5", sum:"三度叠置；大、小、减、增、sus；贝斯手眼里的根音、三音、五音", body:thLsTriads, practice:["tb-6"]},
    {id:"tb-l6", title:"七和弦", sum:"maj7、属七、m7、m7♭5、dim7；属七为什么想解决", body:thLsSevenths, practice:["tb-6"]}
  ],
  levels:[
    {id:"tb-1", kind:"thIvCalc",  name:"档 1 · 音程计算",     goal:"两个音名是什么音程；某个音程有几个半音。数字母定度数，数半音定性质", lesson:"tb-l2"},
    {id:"tb-2", kind:"thIvFret",  name:"档 2 · 指板音程形状", goal:"给一个根音，在指板上点出它上方的某个音程（按你的调弦）", lesson:"tb-l2"},
    {id:"tb-3", kind:"thIvEar",   name:"档 3 · 听音程",       goal:"八个常用音程：大二、小三、大三、纯四、纯五、大六、小七、八度", lesson:"tb-l2", ear:true},
    {id:"tb-4", kind:"thScaleQ",  name:"档 4 · 音阶拼写",     goal:"12 个大调：第几级是什么音、某个音是几级、整条音阶怎么写", lesson:"tb-l3"},
    {id:"tb-5", kind:"thModeQ",   name:"档 5 · 小调与调式",   goal:"相对大小调、调式的来源和特征音、小调 / 五声 / 调式的公式", lesson:"tb-l4"},
    {id:"tb-6", kind:"thChordQ",  name:"档 6 · 和弦构成",     goal:"和弦符号 ↔ 组成音 ↔ 公式：大、小、减、增、sus4 和五种七和弦", lesson:"tb-l6"}
  ]
});
