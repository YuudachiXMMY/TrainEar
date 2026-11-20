"use strict";
/* 乐理 2 · 调内和声与级数：调内七个和弦、级数记法、T/S/D 功能与终止式、小调歌的相对大调记法、五度圈与调号 */

/* ================================================================
   课
   ================================================================ */
function thDiaRows(key, seventh){
  return TH_DIA.map(d=>{
    const sc = thScale(key.t);
    const q = seventh ? d.sev : d.tri;
    return [ '<b>' + (seventh ? d.k7 : d.k) + '</b>', d.roman, thChordName(sc[d.i], q), thNotesText(thChordNotes(sc[d.i], q)), TH_CH[q].zh, '<span class="fn-' + d.fn + '">' + d.fn + '</span>'];
  });
}
function thLsDiatonic(){
  const C = TH_KEY_BY["C"], G = TH_KEY_BY["G"];
  const triEv = ()=> thChordsEvents(TH_DIA.map(d=>({rootPc:[0,2,4,5,7,9,11][d.i], q:d.tri})).concat([{rootPc:0, q:"maj"}]), 2, "half");
  const sevEv = ()=> thChordsEvents(TH_DIA.map(d=>({rootPc:[0,2,4,5,7,9,11][d.i], q:d.sev})).concat([{rootPc:0, q:"maj7"}]), 2, "half");
  return thSec("每个音阶音上叠一个和弦",
      '<p>拿大调音阶的 7 个音，每个音当根音、<b>只用调内的音</b>往上隔一个取一个（三度叠置），就得到这个调的 7 个<b>调内和弦</b>（顺阶和弦）。</p>' +
      thTable(["级数","罗马","C 大调","组成音","性质","功能"], thDiaRows(C, false)) +
      '<div class="ls-btns">' + thPlay("C 大调七个三和弦", triEv, 110) + '</div>' +
      thKey('性质的顺序在<b>每个大调都一样</b>：<b>大 小 小 大 大 小 减</b>。所以只要知道级数，就知道它是大和弦还是小和弦，这就是级数记法里 1、2m、3m、4、5、6m、7ø 的由来。')) +
    thSec("七和弦版本",
      '<p>再叠一个调内的三度，就是七和弦。顺序同样固定：<b>maj7 m7 m7 maj7 7 m7 m7♭5</b>。调内只有一个属七（5 级），这是 5 级「想回家」特别强的原因。</p>' +
      thTable(["级数","罗马","C 大调","组成音","性质","功能"], thDiaRows(C, true)) +
      '<div class="ls-btns">' + thPlay("C 大调七个七和弦", sevEv, 110) + '</div>') +
    thSec("换一个调，规律不变",
      '<p>G 大调（一个升号 F♯）：</p>' + thTable(["级数","罗马","G 大调","组成音","性质","功能"], thDiaRows(G, false)) +
      thTip("7 级的减和弦在流行歌里很少单独用，常常换成 5(7) 或者当经过和弦。TrainEar 里写作 7ø（半减七 m7♭5）。"));
}
function thLsDegrees(){
  const keys = ["C","G","E","B♭"].map(n=>TH_KEY_BY[n]);
  const prog = ["4","5","3m","6m"];
  const rows = keys.map(k=>['<b>' + k.n + ' 大调</b>'].concat(prog.map(d=>thDegChord(k, d).name)).concat([thPlay("听", ()=>thDegsEvents(k, prog, 2, "8ths"), 100, "mini")]));
  return thSec("级数怎么写",
      '<p>TrainEar 和这套课程统一用<b>阿拉伯数字级数</b>，性质写在后面：</p>' +
      thTable(["写法","意思","C 大调的例子"], [
        ["1 4 5", "大和弦（顺阶本来就是大的）", "C F G"],
        ["2m 3m 6m", "小和弦", "Dm Em Am"],
        ["7ø", "半减七（7 级）", "Bm7♭5"],
        ["5(7)、1maj7、6m7", "七和弦写全", "G7、Cmaj7、Am7"],
        ["3(7)、6(7)", "调外：本该小的级数变成属七（副属和弦）", "E7、A7"],
        ["♭6、♭7、4m", "调外：从平行小调借来的和弦", "A♭、B♭、Fm"],
        ["5/7、1/3", "斜杠后面是低音的级数（转位）", "G/B、C/E"]
      ]) +
      '<p>和罗马数字的对照：I ii iii IV V vi vii°（大写 = 大和弦，小写 = 小和弦）。日本的歌本常用罗马数字，意思完全一样。</p>') +
    thSec("为什么 bass 手要用级数",
      '<p>同一个王道进行 4 5 3m 6m，换到四个调：</p>' + thTable(["调","4","5","3m","6m","听"], rows) +
      thKey('和弦名全变了，<b>级数和指板上的形状一个没变</b>。记一首歌记级数，换调、和乐队沟通、认出套路都快得多；「级数定位」那组练习就是把这个形状练成反射。')) +
    thSec("从和弦名读出级数",
      '<p>三步：①确定调（看调号、看开头结尾落在哪、看哪个和弦最像「家」）；②把和弦根音换成级数（在调的音阶里是第几个）；③看性质和调内规律对不对得上，对不上的就是调外和弦（副属、借用），在进阶课里讲。</p>');
}
function thLsFunction(){
  const C = TH_KEY_BY["C"];
  const cad = [
    ["正格终止", "5 → 1", "最强的「回家」", ["1","4","5","1"]],
    ["变格终止", "4 → 1", "柔和的回家，「阿门」终止", ["1","5","4","1"]],
    ["伪终止", "5 → 6m", "以为到家，进了另一扇门", ["1","4","5","6m"]],
    ["半终止", "… → 5", "停在 5 上悬着，等下一段", ["1","6m","2m","5"]]
  ];
  return thSec("三种功能",
      '<p>调内 7 个和弦按「在调里起的作用」分三组：</p>' +
      thTable(["功能","级数","作用","为什么归一组"], [
        ['<span class="fn-T">主 T</span>', "<b>1</b>、6m、3m", "稳定、家", "6m 和 1 共享 C E 两个音，3m 和 1 共享 E G"],
        ['<span class="fn-S">下属 S</span>', "<b>4</b>、2m", "出门、离开家", "2m 和 4 共享 F A"],
        ['<span class="fn-D">属 D</span>', "<b>5</b>、7ø", "紧张、想回家", "7ø 和 5(7) 共享 B D F（含三全音）"]
      ]) +
      '<p>同一组里的和弦可以互相<b>代理</b>：把 1 换成 6m，故事不变但颜色变暗；把 4 换成 2m 更柔。最基本的故事线是 <b>T → S → D → T</b>（家 → 出门 → 紧张 → 回家），大部分进行都是它的变形。</p>') +
    thSec("终止式：段落怎么收尾",
      thTable(["名称","动作","听感","听（C 大调）"], cad.map(c=>[ '<b>' + c[0] + '</b>', c[1], c[2], thPlay(c[3].join(" "), ()=>thDegsEvents(C, c[3], 2, "half"), 100, "mini")])) +
      '<p>根音追踪档 4 就是这一节的听力版。</p>') +
    thSec("强进行：根音下行五度",
      '<p>根音<b>往下五度（= 往上四度）</b>移动时推动力最强：2m → 5 → 1、6m → 2m → 5 → 1、3m → 6m → 2m → 5 → 1。这条链按五度圈逆时针走，爵士的 2-5-1 和很多 J-Pop 副歌都在这条链上。</p>' +
      '<div class="ls-btns">' + thPlay("3m 6m 2m 5 1", ()=>thDegsEvents(C, ["3m","6m","2m","5","1"], 2, "half"), 100) + '</div>' +
      thKey('贝斯手的福利：四度调弦下「往上四度」就是<b>上一弦同品</b>，往下五度就是<b>下一弦同品</b>。一整条五度链，手几乎只在两根弦之间横跳。'));
}
function thLsMinor(){
  const Am = TH_KEY_BY["C"], Em = TH_KEY_BY["G"];
  const ex = [
    [Am, ["6m","4","5","6m"]], [Em, ["6m","4","5","6m"]], [Am, ["6m","2m","3(7)","6m"]], [Am, ["6m","4","1","5"]]
  ];
  return thSec("小调的歌记成 6m",
      '<p>一首 A 小调的歌，主和弦是 Am。TrainEar 的约定是：<b>小调歌按它的相对大调记级数</b>，A 小调就按 C 大调记，主和弦 Am = <b>6m</b>。</p>' +
      thTable(["调","和弦","相对大调记法","听"], ex.map(([k, degs])=>[ '<b>' + k.rel + ' 小调</b>', degs.map(d=>thDegChord(k, d).name).join(" "), "<b>" + degs.join(" ") + "</b>",
        thPlay("听", ()=>thDegsEvents(k, degs, 2, "8ths"), 100, "mini")])) +
      thKey('好处：小室进行 6m 4 5 1、悲怆 6m 4 1 5 这些「从小调开始」的套路，和大调的套路用同一套数字；歌在 1 和 6m 之间来回（大调段落 ↔ 小调段落）时也不用换坐标。')) +
    thSec("小调里的 3(7)",
      '<p>上一门课讲过和声小调：小调里常把 5 级和弦变成大和弦或属七（A 小调的 E、E7），制造回到主和弦的拉力。在相对大调记法下，它是调内 3 级（Em）变成了属七，所以写作 <b>3(7)</b>，指向 6m。</p>' +
      '<div class="ls-btns">' + thPlay("6m 4 3m 6m（自然小调）", ()=>thDegsEvents(Am, ["6m","4","3m","6m"], 2, "half"), 100) +
      thPlay("6m 4 3(7) 6m（和声小调）", ()=>thDegsEvents(Am, ["6m","4","3(7)","6m"], 2, "half"), 100) + '</div>') +
    thSec("另一种记法",
      '<p>古典和爵士教材常用「小调主音 = 1」的记法：A 小调的 Am F G 写作 i ♭VI ♭VII（1m ♭6 ♭7）。两种都对，只是坐标原点不同。读别人的谱时先看清对方用的是哪种；在 TrainEar 和这套课程里一律用相对大调记法。</p>');
}
function thLsCircle(){
  const order = ["C","G","D","A","E","B","F♯","D♭","A♭","E♭","B♭","F"];
  let svg = '<svg viewBox="0 0 320 320" class="th-circle" role="img" aria-label="五度圈">';
  svg += '<circle cx="160" cy="160" r="142" class="c-ring"/><circle cx="160" cy="160" r="92" class="c-ring"/>';
  order.forEach((n, i)=>{
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const k = TH_KEY_BY[n];
    const x1 = 160 + Math.cos(a) * 118, y1 = 160 + Math.sin(a) * 118;
    const x2 = 160 + Math.cos(a) * 70, y2 = 160 + Math.sin(a) * 70;
    const x3 = 160 + Math.cos(a) * 150, y3 = 160 + Math.sin(a) * 150;
    svg += '<text x="' + x1.toFixed(1) + '" y="' + (y1 + 6).toFixed(1) + '" class="c-maj">' + (n === "F♯" ? "F♯/G♭" : n) + '</text>';
    svg += '<text x="' + x2.toFixed(1) + '" y="' + (y2 + 5).toFixed(1) + '" class="c-min">' + k.rel + 'm</text>';
    svg += '<text x="' + x3.toFixed(1) + '" y="' + (y3 + 4).toFixed(1) + '" class="c-sig">' + (k.sig === 0 ? "" : k.sig > 0 ? k.sig + "♯" : (-k.sig) + "♭") + '</text>';
  });
  svg += '<text x="160" y="156" class="c-mid">顺时针 +♯</text><text x="160" y="174" class="c-mid">逆时针 +♭</text></svg>';
  return thSec("五度圈",
      '<div class="ls-fig center">' + svg + '</div>' +
      '<p>12 个大调按<b>纯五度</b>排成一圈：从 C 顺时针每走一格（往上五度）多一个升号，逆时针每走一格（往上四度）多一个降号。内圈是各自的相对小调，和外圈共用调号。</p>') +
    thSec("认调号",
      thTable(["规则","内容"], [
        ["升号的顺序", "<b>F C G D A E B</b>（每个比前一个高五度）"],
        ["降号的顺序", "<b>B E A D G C F</b>（正好反过来）"],
        ["升号调怎么认", "最后一个升号往上半音 = 大调主音（3 个升号 F♯ C♯ G♯ → A 大调）"],
        ["降号调怎么认", "倒数第二个降号 = 大调主音（3 个降号 B♭ E♭ A♭ → E♭ 大调）；只有一个降号是 F 大调"],
        ["相对小调", "大调主音往下小三度（= 6 级）"]
      ])) +
    thSec("近关系调",
      '<p>圈上相邻的调只差一个音：C 大调的邻居是 <b>G 大调（属调）</b>和 <b>F 大调（下属调）</b>，再加上三者的相对小调，一共 6 个近关系调。歌在它们之间转调最顺耳，进阶课的「转调」会用到。</p>' +
      thKey('逆时针读五度圈就是根音的「强进行」链：… E → A → D → G → C。2-5-1 就是圈上相邻的三格。'));
}

/* ================================================================
   题型
   ================================================================ */
// 级数 → 和弦名（三和弦或七和弦）
TH_KINDS.thDegToChord = {
  gen(level){
    const k = thKeyPick(level), d = thPick(TH_DIA), sev = Math.random() < 0.4;
    const sc = thScale(k.t);
    const ans = thDiaChord(k, d, sev);
    const qs = sev ? ["maj7","min7","dom7","m7b5"] : ["maj","min","dim"];
    const pool = qs.filter(x=>x !== (sev ? d.sev : d.tri)).map(x=>thChordName(sc[d.i], x))
      .concat([thDiaChord(k, TH_DIA[(d.i + 1) % 7], sev), thDiaChord(k, TH_DIA[(d.i + 6) % 7], sev)]);
    return Object.assign({sig:k.n + d.k + sev, k, d, sev, ctx:k.n + " 大调", prompt:sev ? d.k7 : d.k, sub:"是哪个和弦？"}, thOpts(ans, pool));
  },
  fb(q, res, ok){
    const sc = thScale(q.k.t);
    return {title: ok ? "对，" + q.options.find(o=>o.value === q.answerValue).label : "是 " + q.answerValue + "，你选了 " + res.chosen.label,
      detail:q.k.n + " 大调：" + sc.map((n,j)=> j === q.d.i ? "<b>" + thNm(n) + "</b>" : thNm(n)).join(" ") + "。" + (q.d.i + 1) + " 级的根音是 " + thNm(sc[q.d.i]) +
        "，顺阶性质 " + (q.sev ? "maj7 m7 m7 maj7 7 m7 m7♭5" : "大 小 小 大 大 小 减") + " → " + TH_CH[q.sev ? q.d.sev : q.d.tri].zh + "。",
      actions:[{act:"hear", label:"在调里听：1 → 这个和弦"}]};
  },
  action(q, act){
    if(act === "hear") AE.play(thChordsEvents([{rootPc:q.k.pc, q:q.sev ? "maj7" : "maj"}, {rootPc:thPc(thScale(q.k.t)[q.d.i]), q:q.sev ? q.d.sev : q.d.tri}], 3, "whole"), {bpm:90});
  }
};
// 和弦名 → 级数
TH_KINDS.thChordToDeg = {
  gen(level){
    const k = thKeyPick(level), d = thPick(TH_DIA);
    return Object.assign({sig:k.n + d.k, k, d, ctx:k.n + " 大调", prompt:thDiaChord(k, d, false), sub:"是几级？", optCls:"deg7"},
      thFixedOpts(TH_DIA.map(x=>x.k), d.k));
  },
  fb(q, res, ok){
    const sc = thScale(q.k.t);
    return {title: ok ? "对，是 " + q.d.k : "是 " + q.d.k + "，你选了 " + res.chosen.label,
      detail:q.k.n + " 大调：" + sc.map((n,j)=> j === q.d.i ? "<b>" + thNm(n) + "</b>" : thNm(n)).join(" ") + "。根音 " + thNm(sc[q.d.i]) + " 是第 " + (q.d.i + 1) + " 个音。"};
  }
};
// 顺阶性质规律
TH_KINDS.thDiaQual = {
  gen(level){
    const t = thWeighted([["tri",3],["sev",3],["which",2]]);
    if(t === "tri"){
      const d = thPick(TH_DIA);
      return Object.assign({sig:t + d.k, t, d, prompt:(d.i + 1) + " 级三和弦", sub:"在任何大调里都是什么性质？"},
        thFixedOpts(["大三和弦","小三和弦","减三和弦"], TH_CH[d.tri].zh));
    }
    if(t === "sev"){
      const d = thPick(TH_DIA);
      const lab = q=>({maj7:"maj7 大七", min7:"m7 小七", dom7:"7 属七", m7b5:"m7♭5 半减七"}[q]);
      return Object.assign({sig:t + d.k, t, d, prompt:(d.i + 1) + " 级七和弦", sub:"在任何大调里都是什么性质？"},
        thFixedOpts(["maj7","min7","dom7","m7b5"].map(lab), lab(d.sev)));
    }
    const items = [
      {q:"调内唯一的属七和弦在几级？", a:"5", o:["1","4","5","7"]},
      {q:"调内唯一的减（半减）和弦在几级？", a:"7", o:["2","3","6","7"]},
      {q:"调内哪几级是大和弦？", a:"1 4 5", o:["1 4 5","2 3 6","1 5 6","1 3 4"]},
      {q:"调内哪几级是小和弦？", a:"2 3 6", o:["2 3 6","1 4 5","2 3 7","3 6 7"]},
      {q:"哪两级的七和弦是 maj7？", a:"1 和 4", o:["1 和 4","1 和 5","4 和 5","1 和 6"]}
    ];
    const it = thPick(items);
    return Object.assign({sig:t + it.q, t, it, prompt:it.q, long:true}, thFixedOpts(it.o, it.a));
  },
  fb(q, res, ok){
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:"大调顺阶：三和弦 <b>大 小 小 大 大 小 减</b>（1 2m 3m 4 5 6m 7ø）；七和弦 <b>maj7 m7 m7 maj7 7 m7 m7♭5</b>。"};
  }
};
// 功能、代理、终止式
TH_KINDS.thFunc = {
  gen(level){
    const t = thWeighted([["fn",3],["sub",2],["cad",3]]);
    if(t === "fn"){
      const d = thPick(TH_DIA);
      return Object.assign({sig:t + d.k, t, d, prompt:d.k, sub:"属于什么功能？"},
        thFixedOpts([TH_FN.T, TH_FN.S, TH_FN.D], TH_FN[d.fn]));
    }
    if(t === "sub"){
      const items = [
        {k:"1", a:thPick(["6m","3m"])}, {k:"4", a:"2m"}, {k:"5", a:"7ø"}, {k:"2m", a:"4"}, {k:"6m", a:"1"}
      ];
      const it = thPick(items);
      const fnOf = TH_DIA_BY[it.k].fn;
      const pool = TH_DIA.filter(x=>x.fn !== fnOf).map(x=>x.k);
      return Object.assign({sig:t + it.k, t, it, prompt:"哪个和弦能代理 " + it.k + "？", sub:"同一功能、共享两个音"}, thOpts(it.a, pool));
    }
    const cads = [
      {seq:["4","5","1"], a:"正格终止"}, {seq:["2m","5","1"], a:"正格终止"},
      {seq:["1","4","1"], a:"变格终止"}, {seq:["5","4","1"], a:"变格终止"},
      {seq:["4","5","6m"], a:"伪终止"}, {seq:["2m","5","6m"], a:"伪终止"},
      {seq:["1","6m","5"], a:"半终止"}, {seq:["1","4","5"], a:"半终止"}
    ];
    const c = thPick(cads);
    return Object.assign({sig:t + c.seq.join(), t, c, prompt:c.seq.join(" → "), sub:"这一句停在哪里，叫什么终止？（最后一个和弦是段落结尾）"},
      thFixedOpts(["正格终止","变格终止","伪终止","半终止"], c.a));
  },
  fb(q, res, ok){
    const title = ok ? "对" : "正确答案：" + q.answerValue;
    if(q.t === "fn") return {title, detail:"主 T：1 6m 3m（稳）；下属 S：4 2m（出门）；属 D：5 7ø（紧张）。" + q.d.k + " 是" + TH_FN[q.d.fn] + "。"};
    if(q.t === "sub") return {title, detail:"同功能的和弦共享两个音，可以互相代理：1 ≈ 6m ≈ 3m，4 ≈ 2m，5 ≈ 7ø。"};
    const why = {"正格终止":"5 → 1：最强的回家。", "变格终止":"4 → 1：不经过 5，柔和地回家。", "伪终止":"5 → 6m：该回 1 却落到 6m（同为主功能的暗版）。", "半终止":"停在 5 上，悬着等下一句。"};
    return {title, detail:why[q.answerValue], actions:[{act:"hear", label:"听一遍"}]};
  },
  action(q, act){ if(act === "hear" && q.c) AE.play(thDegsEvents(TH_KEY_BY["C"], q.c.seq, 2, "half"), {bpm:100}); }
};
// 读进行 / 移调
const TH_DIA_PROGS = [
  ["1","5","6m","4"], ["6m","4","5","1"], ["4","5","3m","6m"], ["1","6m","4","5"], ["6m","4","1","5"],
  ["1","3m","6m","4"], ["2m","5","1","6m"], ["1","4","5","4"], ["4","5","6m","1"], ["1","6m","2m","5"]
];
TH_KINDS.thTranspose = {
  gen(level){
    const t = thWeighted([["deg2names",3],["names2deg",3],["move",3]]);
    const prog = thPick(TH_DIA_PROGS);
    const names = (k, p)=> p.map(d=>thDegChord(k, d).name).join(" ");
    if(t === "names2deg"){
      const k = thKeyPick(level);
      const pool = TH_DIA_PROGS.filter(p=>p !== prog).map(p=>p.join(" "));
      // 「差一个级数」的干扰项
      const near = prog.map((d,i)=>{ const p = prog.slice(); p[i] = {"1":"6m","6m":"1","4":"2m","2m":"4","5":"3m","3m":"5"}[d] || d; return p.join(" "); });
      return Object.assign({sig:t + k.n + prog.join(), t, k, prog, ctx:k.n + " 大调", prompt:names(k, prog), sub:"用级数怎么写？"}, thOpts(prog.join(" "), near.concat(pool)));
    }
    if(t === "deg2names"){
      const k = thKeyPick(level);
      const ki = TH_KEYS.indexOf(k);
      const wrongKeys = [TH_KEYS[(ki + 1) % 12], TH_KEYS[(ki + 11) % 12]].map(x=>names(x, prog));
      const qual = prog.map((d,i)=>{ const p = prog.map(x=>thDegChord(k, x).name); const r = thDegChord(k, d); p[i] = thChordName(r.root, r.q === "maj" ? "min" : "maj"); return p.join(" "); });
      return Object.assign({sig:t + k.n + prog.join(), t, k, prog, ctx:k.n + " 大调", prompt:prog.join(" "), sub:"弹哪几个和弦？"}, thOpts(names(k, prog), thShuffle(qual).slice(0, 2).concat(wrongKeys)));
    }
    const a = thKeyPick(level); let b = thKeyPick(level);
    for(let i=0; i<10 && b === a; i++) b = thKeyPick(level);
    const bi = TH_KEYS.indexOf(b);
    const pool = [names(TH_KEYS[(bi + 1) % 12], prog), names(TH_KEYS[(bi + 11) % 12], prog), names(a, prog)];
    const qual = prog.map((d,i)=>{ const p = prog.map(x=>thDegChord(b, x).name); const r = thDegChord(b, d); p[i] = thChordName(r.root, r.q === "maj" ? "min" : "maj"); return p.join(" "); });
    return Object.assign({sig:t + a.n + b.n + prog.join(), t, k:b, from:a, prog, ctx:"移调：" + a.n + " 大调 → " + b.n + " 大调", prompt:names(a, prog), sub:"在 " + b.n + " 大调里弹什么？", long:true},
      thOpts(names(b, prog), pool.concat([thPick(qual)])));
  },
  fb(q, res, ok){
    const k = q.k;
    let det = "级数：<b>" + q.prog.join(" ") + "</b>。" + k.n + " 大调：" + q.prog.map(d=>thDegChord(k, d).name).join(" ") + "。";
    if(q.t === "move") det = "先读出级数（在 " + q.from.n + " 大调里是 <b>" + q.prog.join(" ") + "</b>），再在 " + k.n + " 大调里按级数取和弦：" + q.prog.map(d=>thDegChord(k, d).name).join(" ") + "。";
    return {title: ok ? "对" : "正确答案：" + q.answerValue, detail:det, actions:[{act:"hear", label:"听这条进行"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thDegsEvents(q.k, q.prog, 2, "8ths"), {bpm:100}); }
};
// 调号与五度圈
TH_KINDS.thKeySig = {
  gen(level){
    const t = thWeighted([["sig2key",3],["key2sig",3],["which",2],["neighbor",2]]);
    const k = thPick(TH_KEYS);
    const sigLab = s => s === 0 ? "没有升降号" : s > 0 ? s + " 个升号" : (-s) + " 个降号";
    if(t === "sig2key"){
      return Object.assign({sig:t + k.n, t, k, prompt:sigLab(k.sig), sub:"是什么大调？"}, thOpts(k.n + " 大调", TH_KEYS.filter(x=>x !== k).map(x=>x.n + " 大调")));
    }
    if(t === "key2sig"){
      const pool = [k.sig + 1, k.sig - 1, -k.sig, k.sig + 2].filter(s=>s >= -6 && s <= 6 && s !== k.sig).map(sigLab);
      return Object.assign({sig:t + k.n, t, k, prompt:k.n + " 大调", sub:"调号是？"}, thOpts(sigLab(k.sig), pool));
    }
    if(t === "which"){
      const want = thPick([2,3,4,5,-2,-3,-4,-5]), kk = TH_KEYS.find(x=>x.sig === want);
      const lst = s => s > 0 ? TH_SHARPS.slice(0, s).map(x=>x + "♯").join(" ") : TH_FLATS.slice(0, -s).map(x=>x + "♭").join(" ");
      const pool = [lst(kk.sig > 0 ? kk.sig + 1 : kk.sig - 1), lst(kk.sig > 0 ? kk.sig - 1 : kk.sig + 1)];
      const scrambled = kk.sig > 0 ? TH_SHARPS.slice(1, kk.sig + 1).map(x=>x + "♯").join(" ") : TH_FLATS.slice(1, -kk.sig + 1).map(x=>x + "♭").join(" ");
      return Object.assign({sig:t + kk.n, t, k:kk, prompt:kk.n + " 大调", sub:"调号里是哪几个音？"}, thOpts(lst(kk.sig), pool.concat([scrambled])));
    }
    const up = Math.random() < 0.5;
    const ord = ["C","G","D","A","E","B","F♯","D♭","A♭","E♭","B♭","F"];
    const i = ord.indexOf(k.n), ans = ord[(i + (up ? 1 : 11)) % 12];
    return Object.assign({sig:t + k.n + up, t, k, up, prompt:k.n + " 大调的" + (up ? "属调" : "下属调"), sub:(up ? "五度圈顺时针下一格（上五度）" : "五度圈逆时针下一格（上四度）")},
      thOpts(ans + " 大调", [ord[(i + (up ? 11 : 1)) % 12], ord[(i + 2) % 12], ord[(i + 10) % 12], ord[(i + 6) % 12]].map(x=>x + " 大调")));
  },
  fb(q, res, ok){
    const title = ok ? "对" : "正确答案：" + q.answerValue;
    if(q.t === "neighbor") return {title, detail:"五度圈顺时针是属调（+1 升号），逆时针是下属调（+1 降号）。" + q.answerValue + "和 " + q.k.n + " 大调只差一个音。"};
    const k = q.k;
    const how = k.sig > 0 ? "最后一个升号 " + TH_SHARPS[k.sig - 1] + "♯ 往上半音 = " + k.n : k.sig < -1 ? "倒数第二个降号 = " + TH_FLATS[-k.sig - 2] + "♭" : k.sig === -1 ? "一个降号就是 F 大调" : "C 大调没有升降号";
    return {title, detail:k.n + " 大调：" + thSigText(k.sig) + "。认法：" + how + "。相对小调 " + k.rel + " 小调。"};
  }
};
// 小调歌的相对大调记法
const TH_MINOR_PROGS = [
  ["6m","4","5","6m"], ["6m","4","1","5"], ["6m","5","4","5"], ["6m","2m","3(7)","6m"], ["6m","4","5","3(7)"], ["6m","1","5","4"], ["6m","2m","5","1"]
];
TH_KINDS.thMinorKey = {
  gen(level){
    const k = thPick(TH_KEYS);
    const t = thWeighted([["prog",3],["one",2]]);
    if(t === "prog"){
      const prog = thPick(TH_MINOR_PROGS);
      const names = prog.map(d=>thDegChord(k, d).name).join(" ");
      // 小调主音 = 1 的另一种记法，作为干扰项（提醒：这套课程用相对大调记法）
      const alt = prog.map(d=>({"6m":"1m","4":"♭6","5":"♭7","1":"♭3","2m":"4m","3(7)":"5(7)","3m":"5m"}[d] || d)).join(" ");
      const near = prog.map((d,i)=>{ const p = prog.slice(); p[i] = {"6m":"1","4":"2m","5":"3m","1":"6m","2m":"4","3(7)":"3m"}[d] || d; return p.join(" "); });
      return Object.assign({sig:t + k.n + prog.join(), t, k, prog, ctx:k.rel + " 小调的歌", prompt:names, sub:"用相对大调记法（主和弦 = 6m）怎么写？", long:true},
        thOpts(prog.join(" "), [alt].concat(thShuffle(near))));
    }
    const items = [["6m","主和弦"], ["3(7)","属七（和声小调的 5 级）"], ["4","♭6 级的大和弦"], ["5","♭7 级的大和弦"], ["2m","4 级小和弦"], ["1","♭3 级的大和弦"]];
    const [deg, desc] = thPick(items);
    const c = thDegChord(k, deg);
    return Object.assign({sig:t + k.n + deg, t, k, deg, ctx:k.rel + " 小调的歌", prompt:c.name, sub:"相对大调记法写作？", optCls:"narrow"},
      thOpts(deg, ["6m","1","4","5","3m","3(7)","2m","1m"]));
  },
  fb(q, res, ok){
    const k = q.k;
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:k.rel + " 小调的相对大调是 <b>" + k.n + " 大调</b>，按 " + k.n + " 大调记：" + k.rel + "m = 6m。" +
        (q.t === "prog" && q.prog.includes("3(7)") ? "<br>" + thDegChord(k, "3(7)").name + " 是和声小调的属七：调内 3 级本该是小和弦，变成属七推向 6m，写作 3(7)。" : "") +
        (q.t === "prog" ? "<br>选项里的 1m ♭6 ♭7 是「小调主音 = 1」的另一种记法，也对，但不是这套课程用的。" : ""),
      actions:[{act:"hear", label:"听一遍"}]};
  },
  action(q, act){ if(act === "hear") AE.play(thDegsEvents(q.k, q.prog || [q.deg], 2, "8ths"), {bpm:100}); }
};

thRegisterCourse({
  key:"dh", stage:"乐理 2", name:"调内和声与级数", cssColor:"var(--accent-dh)", onColor:"#14180c", meterCls:"dh",
  desc:"一个调里的七个和弦、级数记法、T / S / D 功能与终止式、小调歌怎么记、五度圈。学完就能把任何和弦谱翻译成级数。",
  lessons:[
    {id:"dh-l1", title:"调内七个和弦", sum:"音阶上叠三度；大 小 小 大 大 小 减；七和弦版本", body:thLsDiatonic, practice:["dh-1","dh-2","dh-3"]},
    {id:"dh-l2", title:"级数记法", sum:"1 2m 3m 4 5 6m 7ø、罗马数字、调外和斜杠的写法；为什么贝斯手用级数", body:thLsDegrees, practice:["dh-5"]},
    {id:"dh-l3", title:"和声功能与终止式", sum:"主 / 下属 / 属、代理和弦、四种终止、根音下行五度的强进行", body:thLsFunction, practice:["dh-4"]},
    {id:"dh-l4", title:"小调歌：相对大调记法", sum:"小调主和弦记作 6m；和声小调的 3(7)；另一种记法", body:thLsMinor, practice:["dh-7"]},
    {id:"dh-l5", title:"五度圈与调号", sum:"升降号顺序、一眼认调、相对小调、近关系调", body:thLsCircle, practice:["dh-6"]}
  ],
  levels:[
    {id:"dh-1", kind:"thDegToChord", name:"档 1 · 级数 → 和弦", goal:"12 个大调：给级数说出和弦名（含七和弦）", lesson:"dh-l1"},
    {id:"dh-2", kind:"thChordToDeg", name:"档 2 · 和弦 → 级数", goal:"给调和和弦名，说出它是几级", lesson:"dh-l1"},
    {id:"dh-3", kind:"thDiaQual",    name:"档 3 · 顺阶性质规律", goal:"每一级天生是什么三和弦 / 七和弦", lesson:"dh-l1"},
    {id:"dh-4", kind:"thFunc",       name:"档 4 · 功能与终止", goal:"T / S / D 归类、代理和弦、四种终止式", lesson:"dh-l3"},
    {id:"dh-5", kind:"thTranspose",  name:"档 5 · 读进行与移调", goal:"和弦名 ↔ 级数，一条进行从一个调搬到另一个调", lesson:"dh-l2"},
    {id:"dh-6", kind:"thKeySig",     name:"档 6 · 调号与五度圈", goal:"调号 ↔ 调、调号里有哪些音、属调和下属调", lesson:"dh-l5"},
    {id:"dh-7", kind:"thMinorKey",   name:"档 7 · 小调歌的记法", goal:"小调的歌按相对大调写级数：主和弦 6m、属七 3(7)", lesson:"dh-l4"}
  ]
});
