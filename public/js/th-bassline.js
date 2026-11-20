"use strict";
/* 乐理 4 · 低音线与节奏：拍子 / 时值 / 数拍、切分与抢拍、低音线基本型、连接音、写低音线的顺序 */

/* ================================================================
   节奏素材
   ================================================================ */
// 一拍 4 格的常用音型（x 起音 / - 延长 / . 休止），权重越大越常出
const TH_FIGS = [
  ["x---",3], ["x-x-",4], ["xxxx",2], ["x-xx",2], ["xx-x",2], ["x--x",2], ["....",1], ["..x-",2], ["x-..",1], [".xx-",1]
];
const TH_SYNC2 = ["x-x---x-", "x--x--x-", "..x---x-"];   // 跨两拍的切分
function thRandBar(){
  for(let i=0; i<40; i++){
    let s = "";
    if(Math.random() < 0.35){
      const at = thPick([0, 2]);
      const sync = thPick(TH_SYNC2);
      for(let b=0; b<4;){ if(b === at){ s += sync; b += 2; } else { s += thWeighted(TH_FIGS.map(([f,w])=>[f,w])); b++; } }
    }else{
      for(let b=0; b<4; b++) s += thWeighted(TH_FIGS.map(([f,w])=>[f,w]));
    }
    // 起音之后的「-」必须接在起音或延长后面；拍首不能是孤立的延长
    s = s.split("").map((c,i,a)=> c === "-" && (i === 0 || a[i-1] === ".") ? "." : c).join("");
    if(s[0] === "x" && (s.match(/x/g) || []).length >= 4) return s;
  }
  return "x-x-x-x-x-x-x-x-";
}
const thSigOf = s => s.split("").map(c=> c === "x" ? "x" : "_").join("");
function thMutateBar(s){
  for(let i=0; i<40; i++){
    const b = Math.floor(Math.random() * 4);
    const f = thWeighted(TH_FIGS.map(([x,w])=>[x,w]));
    let t = s.slice(0, b*4) + f + s.slice(b*4 + 4);
    t = t.split("").map((c,j,a)=> c === "-" && (j === 0 || a[j-1] === ".") ? "." : c).join("");
    if(t[0] === "x" && thSigOf(t) !== thSigOf(s)) return t;
  }
  return null;
}
function thBarDistractors(s, n){
  const out = [], seen = new Set([thSigOf(s)]);
  for(let i=0; i<60 && out.length < n; i++){
    const base = out.length && Math.random() < 0.3 ? thPick(out) : s;
    const t = thMutateBar(base);
    if(t && !seen.has(thSigOf(t))){ seen.add(thSigOf(t)); out.push(t); }
  }
  return out;
}

/* ================================================================
   低音线型：两小节，每小节 8 个八分音符
   记号：数字 = 相对本小节和弦根音的半音；T = 和弦三音；K0 = 调的主音；
         N-1 / N+1 = 下一个和弦根音的下 / 上半音；N7 = 下一个和弦的 5（从下方接近）；- 延长；. 休止
   ================================================================ */
const R8 = [0,0,0,0,0,0,0,0];
const TH_LINES = [
  {code:"R8",   zh:"根音八分",   prog:["1","4"],   bars:[R8, R8], desc:"每个八分都弹根音，J-Rock 最默认的写法。稳、推进、给鼓和吉他铺地"},
  {code:"OCT",  zh:"八度跳",     prog:["6m","4"],  bars:[[0,12,0,12,0,12,0,12],[0,12,0,12,0,12,0,12]], desc:"根音和高八度交替，舞曲、disco、快歌副歌，跳跃感强"},
  {code:"R5",   zh:"根五交替",   prog:["1","5"],   bars:[[0,"-",7,"-",0,"-",7,"-"],[0,"-",7,"-",0,"-",7,"-"]], desc:"根音和五音交替（四分音符），抒情、乡村、慢歌常用。五音也可以弹在根音下方"},
  {code:"R58",  zh:"根五八",     prog:["4","5"],   bars:[[0,"-",7,"-",12,"-",7,"-"],[0,"-",7,"-",12,"-",7,"-"]], desc:"1 5 8 5 上下来回，比根五更开阔"},
  {code:"ARP",  zh:"和弦琶音",   prog:["1","6m"],  bars:[[0,"-","T","-",7,"-",12,"-"],[0,"-","T","-",7,"-",12,"-"]], desc:"1 3 5 8 把和弦弹成一条线。三音跟着和弦大小变（C 弹 E，Am 弹 C）"},
  {code:"PED",  zh:"踏板音",     prog:["4/1","5/1"], bars:[["K0","K0","K0","K0","K0","K0","K0","K0"],["K0","K0","K0","K0","K0","K0","K0","K0"]], desc:"上面的和弦在换，低音一直停在主音上，张力越积越大，常放在副歌前"},
  {code:"KIME", zh:"齐奏切分（キメ）", prog:["6m","4"], bars:[[0,"-","-",0,"-","-",0,"-"],[0,"-","-",0,"-","-",0,"-"]], desc:"3+3+2 的重音，全乐队一起打同一个节奏。间奏、段落开头最常见"},
  {code:"PT",   zh:"音阶经过音", prog:["1","4"],   bars:[[0,"-",0,"-",2,"-",4,"-"], R8], desc:"换和弦前沿着调内音阶走过去：1 2 3 → 4。安全、顺"},
  {code:"CA",   zh:"半音接近",   prog:["1","4"],   bars:[[0,0,0,0,0,0,0,"N-1"], R8], desc:"最后一个八分弹目标根音的下方（或上方）半音，再落到目标上。最「指路」的一种"},
  {code:"DA",   zh:"属音接近",   prog:["4","1"],   bars:[[0,0,0,0,0,0,"N7","-"], R8], desc:"先弹目标和弦的 5，再落到它的根音上：用一个小小的 5 → 1"},
  {code:"LC",   zh:"线条进行（line cliché）", prog:["6m","6m"], bars:[[0,"-","-","-",-1,"-","-","-"],[-2,"-","-","-",-3,"-","-","-"]], desc:"和弦不动，低音每两拍往下半音：1 7 ♭7 6（Am Am/G♯ Am/G Am/F♯）。抒情歌、小调歌常见"}
];
const TH_LINE_BY = Object.fromEntries(TH_LINES.map(l=>[l.code, l]));
const thLineLabel = l => l.code + " " + l.zh;
// 拼写某个音级：调内音按音阶拼，调外音升号调用升、降号调用降
function thSpellPc(key, pc){
  const sc = thScale(key.t);
  const hit = sc.find(n=>thPc(n) === pc);
  if(hit) return thNm(hit);
  return key.sig < 0 ? NOTE_SPELL[pc] : NOTE_NAMES[pc].replace("#", "♯");
}
// 解析一条线 → [{bar, i, midi | null, tie}]
function thLineNotes(key, line){
  const chords = line.prog.map(d=>thDegChord(key, d));
  let prevR = null;
  const roots = chords.map(c=>{
    let r = thBassMidi(c.rootPc);
    if(prevR !== null) for(const cand of [r - 12, r + 12]) if(cand >= 28 && cand <= 47 && Math.abs(cand - prevR) < Math.abs(r - prevR)) r = cand;
    prevR = r; return r;
  });
  const tonic = thBassMidi(key.pc);
  const out = [];
  line.bars.forEach((bar, b)=>{
    const R = roots[b], NR = roots[(b + 1) % roots.length], c = chords[b];
    bar.forEach((tk, i)=>{
      let midi = null, tie = false;
      if(tk === "-") tie = true;
      else if(tk === ".") midi = null;
      else if(tk === "T") midi = R + (c.q === "min" || c.q === "min7" || c.q === "dim" ? 3 : 4);
      else if(tk === "K0"){ midi = tonic; while(midi - R > 6) midi -= 12; while(R - midi > 6) midi += 12; }
      else if(tk === "N-1") midi = NR - 1;
      else if(tk === "N+1") midi = NR + 1;
      else if(tk === "N7") midi = NR - 5;
      else midi = R + tk;
      out.push({bar:b, i, midi, tie});
    });
  });
  return {chords, notes:out, roots};
}
function thLineEvents(key, line, loops){
  const {chords, notes} = thLineNotes(key, line);
  const ev = [];
  let prevV = null;
  for(let lp=0; lp<(loops || 2); lp++){
    const base = lp * line.bars.length * 4;
    chords.forEach((c, b)=>{
      const v = voiceLead(prevV, c.rootPc, c.q); prevV = v;
      v.forEach((m, vi)=> ev.push({t:base + b*4 + vi*0.028, dur:3.9, midi:m, voice:"ep", vel:0.55}));
    });
    for(let j=0; j<notes.length; j++){
      const n = notes[j]; if(n.midi === null || n.tie) continue;
      let len = 1; while(j + len < notes.length && notes[j + len].tie) len++;
      const accent = line.code === "KIME" ? 1 : (n.i % 2 === 0 ? 0.95 : 0.7);
      ev.push({t:base + n.bar*4 + n.i*0.5, dur:len*0.5*0.88, midi:n.midi, voice:"bass", vel:accent});
    }
  }
  return ev;
}
// 两小节的谱面：和弦名 + 8 格音名
function thLineChartHtml(key, line, opt){
  const o = opt || {};
  const {chords, notes, roots} = thLineNotes(key, line);
  let h = '<div class="bl-chart">';
  chords.forEach((c, b)=>{
    h += '<div class="bl-bar"><div class="bl-ch">' + (line.code === "LC" ? (b === 0 ? c.name + " → " + c.name + "/" + thSpellPc(key, (c.rootPc + 11) % 12) : c.name + "/" + thSpellPc(key, (c.rootPc + 10) % 12) + " → " + c.name + "/" + thSpellPc(key, (c.rootPc + 9) % 12)) : c.name) + '</div><div class="bl-cells">';
    notes.filter(n=>n.bar === b).forEach(n=>{
      let lab = n.tie ? "–" : n.midi === null ? "·" : thSpellPc(key, ((n.midi % 12) + 12) % 12);
      if(o.degrees && !n.tie && n.midi !== null){
        const diff = n.midi - roots[b], rel = (diff % 12 + 12) % 12;
        const ivs = {0:"1",3:"♭3",4:"3",5:"4",7:"5",2:"2",11:"7",10:"♭7",9:"6",8:"♭6",1:"♭2",6:"♭5"};
        lab = (diff === 12 ? "8" : (ivs[rel] || "?")) + '<small>' + lab + '</small>';
      }
      h += '<span class="bl-c' + (n.i % 2 === 0 ? " on" : "") + (n.tie ? " tie" : "") + '">' + lab + '</span>';
    });
    h += '</div></div>';
  });
  return h + '</div>';
}

/* ================================================================
   课
   ================================================================ */
function thGridDemo(label, steps, note){
  return '<div class="rg-demo"><div class="rg-demo-h"><b>' + label + '</b> <span class="muted small">' + thCountText(steps) + '</span> ' +
    thPlay("听", ()=>thRhythmEvents(steps, 40, 2), 90, "mini") + '</div>' + thGridHtml(steps, {labels:true}) + (note ? '<div class="tiny muted">' + note + '</div>' : "") + '</div>';
}
function thLsBeats(){
  return thSec("拍、小节、拍号",
      '<p><b>拍</b>是音乐里均匀的脉搏（跟着点头的那个）。几拍组成一个<b>小节</b>，<b>拍号</b>告诉你一小节几拍、什么音符算一拍：</p>' +
      thTable(["拍号","意思","感觉"], [
        ["<b>4/4</b>", "每小节 4 拍，四分音符一拍", "流行和摇滚的绝大多数"],
        ["<b>3/4</b>", "每小节 3 拍", "华尔兹，「强 弱 弱」"],
        ["<b>6/8</b>", "每小节 6 个八分音符，感觉成 2 大拍（每拍 3 个）", "摇摆的抒情摇滚、叙事曲"]
      ])) +
    thSec("时值（4/4）",
      thTable(["音符","拍数","等于"], [
        ["全音符", "4", "2 个二分"], ["二分音符", "2", "2 个四分"], ["四分音符", "1", "2 个八分"], ["八分音符", "½", "2 个十六分"], ["十六分音符", "¼", "—"],
        ["附点二分", "3", "附点 = 原时值再加一半"], ["附点四分", "1½", "= 3 个八分"], ["附点八分", "¾", "= 3 个十六分"]
      ]) +
      '<p>休止符的时值和对应音符一样，只是不出声。贝斯的休止和音符一样重要：停得准，律动才干净。</p>') +
    thSec("数拍：1 e & a",
      '<p>把一拍分成 4 份，念作 <b>1 e & a</b>（「一 e 嗯 a」），第二拍 2 e & a……八分音符落在数字和 &；十六分音符四个都占。</p>' +
      '<p>下面的节奏格就是一小节：16 格 = 16 个十六分音符，粗线隔开每一拍。<b>实心</b> = 起音，<b>浅色</b> = 延长，<b>空</b> = 休止。</p>' +
      thGridDemo("四分音符", "x---x---x---x---") +
      thGridDemo("八分音符", "x-x-x-x-x-x-x-x-", "J-Rock 根音八分就是这个") +
      thGridDemo("十六分音符", "xxxxxxxxxxxxxxxx") +
      thGridDemo("附点八分 + 十六分（gallop）", "x--xx--xx--xx--x", "1 . . a：金属和快歌的「马蹄」节奏") +
      thGridDemo("八分 + 两个十六分", "x-xxx-xxx-xxx-xx") +
      thTip("练习时出声数拍（至少在心里），用节拍器。「节奏读谱」档就是看格子念出数拍，「节奏听写」档反过来听节奏选格子。"));
}
function thLsSync(){
  return thSec("切分：重音落在弱的位置",
      '<p>拍子有强弱：4/4 里第 1、3 拍强，2、4 拍次强；每拍的 & 比数字弱，e 和 a 更弱。<b>切分</b>就是把起音放在弱的位置、并延长到下一个强的位置，让本该有重音的地方「空」出来，产生向前推的感觉。</p>' +
      thGridDemo("八分 – 四分 – 八分", "x-x---x-x-x---x-", "第 2、4 拍头被前面的音延长盖住了") +
      thGridDemo("3 + 3 + 2", "x--x--x-x--x--x-", "三个八分 + 三个八分 + 两个八分，キメ和舞曲的骨架")) +
    thSec("抢拍（食い）",
      '<p>J-Rock 的招牌：下一个和弦<b>提前一个八分</b>在上一小节的「4 &」进来，并延长到下一小节。乐谱上写成跨小节的连线，日本乐手叫「食い」。贝斯、吉他、底鼓要一起抢，抢得整齐，副歌才有往前冲的劲。</p>' +
      '<div class="ls-btns">' + thPlay("不抢：C 在第 1 拍换", ()=>thChordsEvents([{rootPc:9,q:"min"},{rootPc:5,q:"maj"}], 4, "8ths"), 110) +
      thPlay("抢拍：F 提前在 4& 进来", ()=>{
        const ev = thChordsEvents([{rootPc:9,q:"min"}], 4, "8ths").filter(e=>e.t < 3.5);
        const f = thChordsEvents([{rootPc:5,q:"maj"}], 4, "8ths").map(e=>Object.assign({}, e, {t:e.t + 3.5}));
        return ev.concat(f);
      }, 110) + '</div>') +
    thSec("三连音和 shuffle",
      '<p>一拍分成三份叫<b>三连音</b>（数作 1 & a 或「1 2 3」）。把八分音符弹成三连音的「长 + 短」（前两份连起来 + 第三份），就是 <b>shuffle / swing</b> 律动：蓝调、摇摆、部分 J-Pop 的轻快感。看谱时常在开头标「♪♪ = ♪³」。</p>') +
    thSec("ghost note（闷音）",
      '<p>用左手轻按住弦、不按实品位弹出的「哒」声，没有音高，只有打击感。放在八分音符的弱位置填空，律动会变得更紧更 funky。初学时先把每个音的时值弹准，再加 ghost。</p>');
}
function thLsLines(){
  const C = TH_KEY_BY["C"];
  const list = ["R8","OCT","R5","R58","ARP","PED","KIME"].map(c=>TH_LINE_BY[c]);
  return thSec("七种基本型",
      '<p>低音线最基础的几种「织法」。下面每个都在 C 大调上写成两小节：上面是和弦，格子里是每个八分音符弹的音（大字 = 相对和弦根音的级数，小字 = 音名，– 表示延长）。</p>' +
      list.map(l=>'<div class="bl-demo"><div class="bl-demo-h"><b>' + l.code + '</b> ' + l.zh + ' ' + thPlay("听", ()=>thLineEvents(C, l, 2), 100, "mini") + '</div>' +
        thLineChartHtml(C, l, {degrees:true}) + '<div class="small sub">' + l.desc + '</div></div>').join("")) +
    thSec("怎么选",
      thTable(["段落","常见选择","为什么"], [
        ["主歌", "R8 / R5 / 长音", "给人声留空间，稳"],
        ["预副歌", "PED、R8 加强、上行经过音", "积累张力"],
        ["副歌", "R8 加重、OCT、ARP", "能量最大、音域打开"],
        ["间奏 / 段落开头", "KIME、riff", "和全队对齐，打出记忆点"]
      ]) +
      thTip("「低音型识别」两档：一档看谱认型（看音名判断是哪一种），一档听音认型。"));
}
function thLsApproach(){
  const C = TH_KEY_BY["C"];
  const list = ["PT","CA","DA","LC"].map(c=>TH_LINE_BY[c]);
  return thSec("连接音：给下一个和弦指路",
      '<p>换和弦前的最后一拍（或最后一个八分）是贝斯的「方向盘」：用一个音把耳朵带到下一个根音。规则只有一条：<b>连接音放在弱拍，目标根音落在下一小节的强拍</b>。</p>' +
      thTable(["类型","做法","C → F 的例子","效果"], [
        ["<b>半音接近</b>（下方）", "目标根音往下半音", "最后弹 E → F", "最强的指向，最常用"],
        ["<b>半音接近</b>（上方）", "目标根音往上半音", "最后弹 G♭ → F", "更有张力，像从上面滑下来"],
        ["<b>属音接近</b>", "先弹目标和弦的 5", "最后弹 C → F（F 的 5 是 C）", "一个迷你 5 → 1，稳"],
        ["<b>音阶接近</b>", "沿调内音级进", "C D E → F", "顺、安全，像走楼梯"]
      ])) +
    thSec("例子",
      list.map(l=>'<div class="bl-demo"><div class="bl-demo-h"><b>' + l.code + '</b> ' + l.zh + ' ' + thPlay("听", ()=>thLineEvents(C, l, 2), 100, "mini") + '</div>' +
        thLineChartHtml(C, l, {degrees:true}) + '<div class="small sub">' + l.desc + '</div></div>').join("") +
      thKey('半音接近的音大多不在调里（C → A 前的 G♯），听起来有点「歪」，但因为马上解决，耳朵会把它当成方向而不是错音。连续几个小节都用就太花了，一个段落挑关键的换和弦处用。'));
}
function thLsWriting(){
  return thSec("写一条低音线的顺序",
      thTable(["步骤","做什么","检查"], [
        ["1 先弹根音", "全曲先用长音或 R8 把根音弹一遍", "和弦、结构、换和弦的位置都对"],
        ["2 对齐底鼓", "把节奏改成和底鼓一致（听鼓的 kick）", "贝斯和底鼓像一件乐器"],
        ["3 加连接音", "在换和弦处挑几个地方加经过音 / 半音接近", "连接音在弱拍、目标在强拍"],
        ["4 分段落", "主歌、副歌、间奏用不同的型（R8 / OCT / KIME…）", "段落之间有明显的能量差"],
        ["5 留空间", "人声密的地方少花样，间奏和尾奏再展开", "不和主唱抢"]
      ])) +
    thSec("音的优先级",
      '<p>不知道弹什么的时候，按这个顺序选：<b>根音 > 五音 > 八度 > 三音 > 七音 > 经过音 / 接近音</b>。越往前越稳，越往后越有色彩但越容易打架。三音会让听感变成转位（C/E），五音放在低音也会变「悬」，所以长音和强拍尽量给根音。</p>' +
      thTip("配合别的课：和弦里是哪些音看「基础乐理」；进行为什么这样走看「调内和声」和「套路与进阶」。扒歌时先认出套路，再看低音用的是哪一种型。"));
}

/* ================================================================
   题型
   ================================================================ */
const thFrac = x => ({0.25:"¼", 0.5:"½", 0.75:"¾", 1.5:"1½", 2.5:"2½", 3.5:"3½"}[x] || String(x));
TH_KINDS.thDur = {
  gen(level){
    const items = [
      ["全音符是几拍？（4/4）", 4], ["二分音符是几拍？", 2], ["附点二分音符是几拍？", 3], ["附点四分音符是几拍？", 1.5],
      ["附点八分音符 = 几个十六分音符？", 3], ["一个四分音符 = 几个十六分音符？", 4], ["4/4 一小节能放几个八分音符？", 8],
      ["4/4 一小节能放几个十六分音符？", 16], ["3/4 一小节有几拍？", 3], ["6/8 一小节有几个八分音符？", 6], ["6/8 一般感觉成几大拍？", 2],
      ["附点四分 + 附点四分 + 四分 = 几拍？", 4], ["八分休止符占几拍？", 0.5], ["一拍里的八分三连音有几个音？", 3], ["十六分音符是几拍？", 0.25],
      ["二分音符 = 几个八分音符？", 4], ["附点八分 + 十六分 = 几拍？", 1]
    ];
    const [qq, a] = thPick(items);
    const cands = [a/2, a*2, a + 1, a - 1, a + 0.5, a - 0.5, a * 1.5].filter(x=>x > 0 && x !== a && x <= 32);
    return Object.assign({sig:qq, qq, a, prompt:qq, long:true, optCls:"narrow"}, thOpts(thFrac(a), thShuffle(cands).map(thFrac)));
  },
  fb(q, res, ok){
    return {title: ok ? "对，" + thFrac(q.a) : "是 " + thFrac(q.a) + "，你选了 " + res.chosen.label,
      detail:"4/4 里：全音符 4 拍、二分 2、四分 1、八分 ½、十六分 ¼；附点 = 原时值再加一半（附点四分 = 1½ 拍 = 3 个八分）。6/8 = 6 个八分，分成两组 3 个。"};
  }
};
TH_KINDS.thCount = {
  gen(level){
    const s = thRandBar();
    const ds = thBarDistractors(s, 3);
    return Object.assign({sig:s, steps:s, prompt:"怎么数？", sub:"16 格 = 一小节十六分音符，粗线是拍头；实心起音、浅色延长、空格休止",
      events:thRhythmEvents(s, 40, 1), playLabel:"听这个节奏",
      visual(q){ return '<div class="card" style="margin-bottom:12px">' + thGridHtml(q.steps, {labels:S.answered}) + '</div>'; }},
      thOpts(thCountText(s), ds.map(thCountText)));
  },
  fb(q, res, ok){
    return {title: ok ? "对" : "正确数法：" + q.answerValue,
      detail:"每拍 4 格念 <b>1 e & a</b>：拍头是数字，第 2 格 e，第 3 格 &，第 4 格 a。只写出有起音的位置，没起音的拍头写在括号里。"};
  }
};
TH_KINDS.thRhythmEar = {
  gen(level){
    const s = thRandBar();
    const ds = thBarDistractors(s, 3);
    const mk = st => ({label:thCountText(st), value:thCountText(st), html:thGridHtml(st, {small:true}), steps:st});
    const o = thOpts(mk(s), ds.map(mk));
    return Object.assign({sig:s, steps:s, prompt:"听到的是哪一个？", sub:"先数 4 下，然后弹两遍", optCls:"rg-opts",
      events:thRhythmEvents(s, 40, 2)}, o);
  },
  fb(q, res, ok){
    return {title: ok ? "对" : "是 " + q.answerValue,
      detail:'正确的节奏：' + thGridHtml(q.steps, {labels:true, small:true}) + (ok ? "" : '<br>你选的：' + thGridHtml(res.chosen.steps, {labels:true, small:true})),
      actions: ok ? [] : [{act:"cmp", label:"听你选的那个"}]};
  },
  action(q, act){ if(act === "cmp") AE.play(thRhythmEvents(q.result.chosen.steps, 40, 2), {bpm:S.data.settings.bpm || 100}); }
};
// 看谱认低音型
TH_KINDS.thLineRead = {
  gen(level){
    const k = TH_KEY_BY[thPick(["C","G","D","A","E","F"])];
    const l = thPick(TH_LINES);
    return Object.assign({sig:l.code + k.n, l, k, ctx:k.n + " 大调", prompt:"这是哪种低音型？", sub:"格子里是每个八分音符弹的音（– 延长）", events:thLineEvents(k, l, 1), playLabel:"听这两小节",
      visual(q){ return '<div class="card" style="margin-bottom:12px">' + thLineChartHtml(q.k, q.l, {degrees:S.answered}) + '</div>'; }},
      thOpts(thLineLabel(l), TH_LINES.filter(x=>x !== l).map(thLineLabel)));
  },
  fb(q, res, ok){ return {title: ok ? "对，" + thLineLabel(q.l) : "是 " + thLineLabel(q.l), detail:q.l.desc + "。格子里的大字是相对和弦根音的级数。"}; }
};
// 听音认低音型
const TH_LINE_EAR = ["R8","OCT","R5","R58","ARP","KIME","PED","CA"];
TH_KINDS.thLineEar = {
  gen(level){
    const k = TH_KEY_BY[thPick(["C","D","E","F","G","A"])];
    const l = TH_LINE_BY[thPick(TH_LINE_EAR)];
    return Object.assign({sig:l.code, l, k, prompt:"贝斯弹的是哪种型？", sub:"两小节循环两遍", events:thLineEvents(k, l, 2), optCls:"narrow"},
      thFixedOpts(TH_LINE_EAR.map(c=>({label:c, sub:TH_LINE_BY[c].zh})), l.code));
  },
  fb(q, res, ok){
    return {title: ok ? "对，" + thLineLabel(q.l) : "是 " + thLineLabel(q.l) + "，你选了 " + res.chosen.label,
      detail:q.l.desc + "。" + thLineChartHtml(q.k, q.l, {degrees:true}),
      actions: ok ? [] : [{act:"cmp", label:"听你选的 " + res.chosen.label}]};
  },
  action(q, act){ if(act === "cmp") AE.play(thLineEvents(q.k, TH_LINE_BY[q.result.chosen.label], 2), {bpm:S.data.settings.bpm || 100}); }
};
// 连接音：分类 / 计算
const TH_APP = [
  {k:"below", lab:"半音接近（下方）", f:t=>thUp(t, 7, 11)},
  {k:"above", lab:"半音接近（上方）", f:t=>thUp(t, 2, 1)},
  {k:"dom",   lab:"属音接近（目标的 5）", f:t=>thUp(t, 5, 7)},
  {k:"scale", lab:"音阶接近（调内全音）", f:null}
];
TH_KINDS.thApproach = {
  gen(level){
    const k = TH_KEY_BY[thPick(TH_EASY_KEYS)], sc = thScale(k.t);
    const inKey = n => sc.some(x=>thPc(x) === thPc(n));
    for(let tries=0; tries<80; tries++){
      const from = thPick(TH_DIA.slice(0, 6)), to = thPick(TH_DIA.slice(0, 6));
      if(from === to) continue;
      const fromN = sc[from.i], toN = sc[to.i];
      if(Math.random() < 0.6){
        const ap = thPick(TH_APP);
        let note;
        if(ap.k === "scale"){
          const cands = [sc[(to.i + 6) % 7], sc[(to.i + 1) % 7]].filter(n=>{ const d = ((thPc(n) - thPc(toN)) % 12 + 12) % 12; return d === 2 || d === 10; });
          if(!cands.length) continue;
          note = thPick(cands);
        }else{
          note = ap.f(toN);
          if(ap.k !== "dom" && inKey(note)) continue;               // 半音接近只出调外音，避免和音阶接近混淆
        }
        if(thPc(note) === thPc(fromN)) continue;                    // 和当前根音相同就分不出来
        if(ap.k !== "dom" && thPc(note) === thPc(thUp(toN, 5, 7))) continue;
        const fc = thDiaChord(k, from), tc = thDiaChord(k, to);
        return Object.assign({sig:"c" + k.n + from.k + to.k + ap.k, t:"classify", k, ap, note, fc, tc, ctx:k.n + " 大调",
          prompt:fc + " → " + tc, sub:"换和弦前最后一个八分弹 <b>" + thNm(note) + "</b>，这是哪种连接音？", long:true},
          thFixedOpts(TH_APP.map(a=>a.lab), ap.lab));
      }
      const ap = thPick(TH_APP.slice(0, 3));
      const note = ap.f(toN);
      if(thPc(note) === thPc(fromN)) continue;
      const fc = thDiaChord(k, from), tc = thDiaChord(k, to);
      const pool = TH_APP.slice(0, 3).filter(a=>a !== ap).map(a=>thNm(a.f(toN))).concat([thNm(toN), thNm(thUp(toN, 3, from.tri === "min" ? 3 : 4))]);
      return Object.assign({sig:"f" + k.n + from.k + to.k + ap.k, t:"find", k, ap, note, fc, tc, ctx:k.n + " 大调",
        prompt:fc + " → " + tc, sub:"用<b>" + ap.lab + "</b>，换和弦前最后一个八分弹哪个音？", long:true, optCls:"narrow"},
        thOpts(thNm(note), pool));
    }
    return this.gen(level);
  },
  fb(q, res, ok){
    const tgt = q.tc.replace(/m$|dim$/, "");
    const why = {below:"比目标根音 " + tgt + " 低半音", above:"比目标根音 " + tgt + " 高半音", dom:"是目标和弦 " + q.tc + " 的五音（先 5 再 1）", scale:"和目标根音差一个全音，而且在调内"};
    return {title: ok ? "对" : "正确答案：" + q.answerValue,
      detail:"<b>" + thNm(q.note) + "</b> " + why[q.ap.k] + "。连接音放在弱拍（最后一个八分），目标根音落在下一小节第一拍。",
      actions:[{act:"hear", label:"听一遍"}]};
  },
  action(q, act){
    if(act !== "hear") return;
    const fromPc = thPc(thP(q.fc.replace(/m$|dim$/, ""))), toPc = thPc(thP(q.tc.replace(/m$|dim$/, "")));
    const fq = /dim$/.test(q.fc) ? "dim" : /m$/.test(q.fc) ? "min" : "maj", tq = /dim$/.test(q.tc) ? "dim" : /m$/.test(q.tc) ? "min" : "maj";
    let R = thBassMidi(fromPc), T = thBassMidi(toPc);
    let N = thBassMidi(thPc(q.note)); while(N - T > 6) N -= 12; while(T - N > 6) N += 12;
    const ev = [];
    voiceLead(null, fromPc, fq).forEach(m=>ev.push({t:0, dur:3.9, midi:m, voice:"ep", vel:0.55}));
    voiceLead(null, toPc, tq).forEach(m=>ev.push({t:4, dur:3.9, midi:m, voice:"ep", vel:0.55}));
    for(let i=0; i<7; i++) ev.push({t:i*0.5, dur:0.42, midi:R, voice:"bass", vel:i % 2 ? 0.7 : 0.95});
    ev.push({t:3.5, dur:0.42, midi:N, voice:"bass", vel:1});
    for(let i=0; i<4; i++) ev.push({t:4 + i*0.5, dur:0.42, midi:T, voice:"bass", vel:i % 2 ? 0.7 : 1});
    AE.play(ev, {bpm:100});
  }
};

thRegisterCourse({
  key:"bl", stage:"乐理 4", name:"低音线与节奏", cssColor:"var(--accent-bl)", meterCls:"bl",
  desc:"拍子、时值、数拍、切分与抢拍；R8 / OCT / R5 / ARP / PED / KIME 等低音型；半音、属音、音阶接近；一条低音线怎么从根音写起。",
  lessons:[
    {id:"bl-l1", title:"拍子、时值与数拍", sum:"拍号、音符时值、附点；1 e & a；节奏格怎么读", body:thLsBeats, practice:["bl-1","bl-2","bl-3"]},
    {id:"bl-l2", title:"切分、抢拍与律动", sum:"重音落在弱位置；J-Rock 的抢拍（食い）；三连音、shuffle、ghost note", body:thLsSync, practice:["bl-2","bl-3"]},
    {id:"bl-l3", title:"低音线基本型", sum:"R8、OCT、R5、R58、ARP、PED、KIME：长什么样、什么时候用", body:thLsLines, practice:["bl-4","bl-5"]},
    {id:"bl-l4", title:"连接音", sum:"半音接近、属音接近、音阶经过、线条进行：怎么把耳朵带到下一个和弦", body:thLsApproach, practice:["bl-6"]},
    {id:"bl-l5", title:"写一条低音线", sum:"从根音到成品的五步；音的优先级", body:thLsWriting, practice:["bl-4"]}
  ],
  levels:[
    {id:"bl-1", kind:"thDur",        name:"档 1 · 时值计算", goal:"音符和附点几拍、一小节放几个、3/4 和 6/8", lesson:"bl-l1"},
    {id:"bl-2", kind:"thCount",      name:"档 2 · 节奏读谱", goal:"看一小节节奏格，选出正确的数拍（1 e & a）", lesson:"bl-l1"},
    {id:"bl-3", kind:"thRhythmEar",  name:"档 3 · 节奏听写", goal:"听一小节节奏，从四个格子里选出它", lesson:"bl-l1", ear:true},
    {id:"bl-4", kind:"thLineRead",   name:"档 4 · 看谱认低音型", goal:"看两小节的和弦和低音音名，判断是 11 种型里的哪一种", lesson:"bl-l3"},
    {id:"bl-5", kind:"thLineEar",    name:"档 5 · 听音认低音型", goal:"听两小节伴奏，认出贝斯弹的是哪一种型", lesson:"bl-l3", ear:true},
    {id:"bl-6", kind:"thApproach",   name:"档 6 · 连接音", goal:"判断连接音的类型；给定类型算出该弹哪个音", lesson:"bl-l4"}
  ]
});
