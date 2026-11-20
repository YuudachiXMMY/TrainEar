"use strict";
/* 指板扩展模式（共用 fret.js 的指板引擎）：
   - 音名地形 board：每根弦上的音名、看位置说音名、同名音的八度形状
   - 模进训练 motif：同一个音型沿音阶逐级平移（三度、三和弦、四音型、下行、七和弦 + 换调）
   题型通过 FRET_EXT 注册：gen(level) 出题、click(q, cell, ms) 作答、render(q, m) 画答题页。 */

/* ================================================================
   通用小工具
   ================================================================ */
// 贝斯手常用拼写：升降各取习惯的一种
const NOTE_SPELL = ["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
const NATURAL_PC = [0,2,4,5,7,9,11];
const pcName = pc => NOTE_SPELL[((pc % 12) + 12) % 12];
const cellKey = c => c.s + "-" + c.f;
const spellOct = midi => pcName(midi % 12) + (Math.floor(midi/12) - 1);
function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ================================================================
   音名地形（board）
   ================================================================ */
MODES.board = {
  key:"board", stage:"指板 1", name:"音名地形", cssColor:"var(--accent-board)", onColor:"#16130a", meterCls:"b",
  desc:"先认地形，再谈级数。级数定位的第一步是找到这个调的 1，前提是知道每个音名在指板上的位置。这里只练音名和八度形状，和调无关。",
  levels:[
    {id:"b-1", kind:"bfind", name:"档 1 · 低把位找音名",   goal:"给一根弦和一个音名，在 0–5 品点出来。先只出自然音，近 20 题达到 85% 后自动加入升降音", rtLimit:3000, lo:0, hi:5},
    {id:"b-2", kind:"bfind", name:"档 2 · 中高把位找音名", goal:"同上，换到 5–12 品（5 品 = 上一根空弦，12 品 = 空弦高八度）", rtLimit:3000, lo:5, hi:12},
    {id:"b-3", kind:"bname", name:"档 3 · 看位置说音名",   goal:"0–12 品任意位置亮起，从 12 个音名里选出它", rtLimit:2500, lo:0, hi:12},
    {id:"b-4", kind:"ball",  name:"档 4 · 找全所有同名音", goal:"在 0–12 品点出某个音的全部位置，熟悉八度形状（上两弦 +2 品）", rtLimit:2000, lo:0, hi:12}
  ],
  map: renderBoardMap
};
function boardAccOn(level){
  const st = levelStat(level.id), r = recent20Rate(st);
  return st.recent.length >= PASS_N && r !== null && r >= 0.85;
}
FRET_EXT.bfind = {
  gen(level){
    const tun = fretTuning(), acc = boardAccOn(level);
    const pcs = acc ? [0,1,2,3,4,5,6,7,8,9,10,11] : NATURAL_PC;
    const last = S.lastQ[level.id] || "";
    let s, pc, targets = [];
    for(let i=0; i<40; i++){
      s = Math.floor(Math.random()*tun.length); pc = rand(pcs);
      if(s + "|" + pc === last) continue;
      targets = cellsIn(tun, level.lo, level.hi, (p, ss)=> ss === s && p === pc);
      if(targets.length) break;
    }
    S.lastQ[level.id] = s + "|" + pc;
    return {kind:"b-find", tun, s, pc, targets, acc, lo:level.lo, hi:level.hi,
      enabled:(ss, f)=> ss === s && f >= level.lo && f <= level.hi,
      events:[{t:0, dur:1.5, midi:targets[0].midi, voice:"bass", vel:1}]};
  },
  click(q, cell, ms){
    const ok = recordAnswer(q.level.id, pcName(q.pc), pcName(cell.midi % 12), ms);
    fretFinish(ok, {ms, clicked:cell});
  },
  render(q, m){
    const res = q.result;
    let h = '<div class="fret-prompt" style="--mode-c:' + m.cssColor + '">' +
      '<div class="fp-key">' + q.tun.length + ' 弦 ' + tuningText(q.tun) + ' · ' + q.lo + '–' + q.hi + ' 品' + (q.acc ? " · 含升降音" : " · 自然音") + '</div>' +
      '<div class="fp-main">' + pcName(q.pc) + '</div>' +
      '<div class="fp-sub">在 <b>' + stringName(q.tun, q.s) + '</b>上</div>' +
      fretTimerHtml(q, q.level.rtLimit) + '</div>';
    const marks = {};
    if(S.answered){
      // 揭示这根弦上 lo–hi 的全部音名，自然音实心、升降音描边
      for(const c of cellsIn(q.tun, q.lo, q.hi, (p, ss)=> ss === q.s))
        marks[cellKey(c)] = {cls: NATURAL_PC.includes(c.midi % 12) ? "nat" : "muted", label:pcName(c.midi % 12)};
      for(const c of q.targets) marks[cellKey(c)] = {cls:"ok", label:pcName(q.pc)};
      if(!res.ok) marks[cellKey(res.clicked)] = {cls:"bad", label:pcName(res.clicked.midi % 12)};
    }
    h += fretboardHtml({tun:q.tun, marks, from:q.lo, to:q.hi, enabled:q.enabled});
    if(S.answered){
      const c = q.targets[0];
      const open = noteName(q.tun[q.s]);
      let det = pcName(q.pc) + " 在 " + stringName(q.tun, q.s) + " <b>" + q.targets.map(t=>t.f).join("、") + " 品</b>。";
      det += c.f === 0 ? "就是空弦。" : "从空弦 " + open + " 数起：" + c.f + " 个半音" + (c.f === 5 ? "，正好是上一根空弦的音" : c.f === 7 ? "，也就是空弦的五度" : c.f === 12 ? "，空弦高八度" : "") + "。";
      det += ' <span class="muted">' + fretTimeTxt(q, res.ms, res.ok) + '</span>';
      h += fretFeedbackBox(m, res.ok, res.ok ? "对，" + pcName(q.pc) + " 在这里" : "是 " + pcName(q.pc) + "，你点的是 " + pcName(res.clicked.midi % 12), det);
    }
    return h + fretFootHtml("只能点题目那根弦 · 空格听音 · 回车下一题 · Esc 返回");
  }
};
FRET_EXT.bname = {
  gen(level){
    const tun = fretTuning();
    const cells = cellsIn(tun, level.lo, level.hi, ()=>true);
    const cell = pickOther(cells, S.lastQ[level.id], c=>cellKey(c));
    S.lastQ[level.id] = cellKey(cell);
    return {kind:"b-name", tun, cell, optionMode:true, answerValue:pcName(cell.midi % 12),
      options: NOTE_SPELL.map(n=>({value:n, label:n})),
      events:[{t:0, dur:1.5, midi:cell.midi, voice:"bass", vel:1}]};
  },
  render(q, m){
    const res = q.result;
    let h = '<div class="fret-prompt" style="--mode-c:' + m.cssColor + '">' +
      '<div class="fp-key">' + q.tun.length + ' 弦 ' + tuningText(q.tun) + ' · 0–12 品</div>' +
      '<div class="fp-main">这是什么音？</div><div class="fp-sub">亮着的位置</div>' +
      fretTimerHtml(q, q.level.rtLimit) + '</div>';
    const marks = {};
    marks[cellKey(q.cell)] = S.answered ? {cls: res.ok ? "ok" : "bad", label:q.answerValue} : {cls:"target", label:"?"};
    h += fretboardHtml({tun:q.tun, marks, from:0, to:12, wide:true, focus:q.cell.f});
    h += fretOptionsHtml(q, "n12");
    if(S.answered){
      const open = noteName(q.tun[q.cell.s]), f = q.cell.f;
      const near = [0,5,7,12].reduce((a,b)=> Math.abs(b-f) < Math.abs(a-f) ? b : a);
      const anchorTxt = near === f ? "" : "（离它最近的记忆点是 " + near + " 品 = " + pcName((q.tun[q.cell.s] + near) % 12) + "，" + (f > near ? "往上 " : "往下 ") + Math.abs(f - near) + " 个半音）";
      const det = stringName(q.tun, q.cell.s) + " " + f + " 品 = <b>" + spellOct(q.cell.midi) + "</b>" + anchorTxt + "。" +
        ' <span class="muted">' + fretTimeTxt(q, res.ms, res.ok) + '</span>';
      h += fretFeedbackBox(m, res.ok, res.ok ? "对，是 " + q.answerValue : "是 " + q.answerValue + "，你选了 " + res.chosen, det, "再听一遍（空格）");
    }
    return h + fretFootHtml("数字 1–9 选前 9 个 · 空格听音 · 回车下一题 · Esc 返回");
  }
};
FRET_EXT.ball = {
  gen(level){
    const tun = fretTuning();
    const pc = pickOther(NATURAL_PC.concat([1,3,6,8,10]), S.lastQ[level.id], x=>x);
    S.lastQ[level.id] = pc;
    const targets = cellsIn(tun, level.lo, level.hi, p=> p === pc);
    return {kind:"b-all", tun, pc, targets, found:[],
      events: targets.slice().sort((a,b)=>a.midi-b.midi).filter((c,i,a)=> i === 0 || a[i-1].midi !== c.midi)
        .map((c,i)=>({t:i*0.8, dur:0.75, midi:c.midi, voice:"bass", vel:1}))};
  },
  click(q, cell, ms){
    if(q.found.some(c=>sameCell(c, cell))) return;           // 已经找到过的不算错
    if(cell.midi % 12 !== q.pc){
      recordAnswer(q.level.id, pcName(q.pc), pcName(cell.midi % 12), 0);
      fretFinish(false, {ms, clicked:cell});
      return;
    }
    q.found.push(cell);
    if(q.found.length === q.targets.length){
      const per = ms / q.targets.length;
      recordAnswer(q.level.id, pcName(q.pc), pcName(q.pc), per);
      fretFinish(true, {ms, per});
    }else render();
  },
  render(q, m){
    const res = q.result;
    let h = '<div class="fret-prompt" style="--mode-c:' + m.cssColor + '">' +
      '<div class="fp-key">' + q.tun.length + ' 弦 ' + tuningText(q.tun) + ' · 0–12 品</div>' +
      '<div class="fp-main">' + pcName(q.pc) + '</div>' +
      '<div class="fp-sub">点出全部 <b>' + q.targets.length + '</b> 个位置 · 已找到 ' + q.found.length + '</div>' +
      fretTimerHtml(q, q.level.rtLimit * q.targets.length) + '</div>';
    const marks = {};
    for(const c of q.found) marks[cellKey(c)] = {cls:"ok", label:pcName(q.pc)};
    if(S.answered){
      for(const c of q.targets) if(!marks[cellKey(c)]) marks[cellKey(c)] = {cls:"ok ring", label:pcName(q.pc)};
      if(!res.ok) marks[cellKey(res.clicked)] = {cls:"bad", label:pcName(res.clicked.midi % 12)};
    }
    h += fretboardHtml({tun:q.tun, marks, from:0, to:12, wide:true});
    if(S.answered){
      // 八度形状：相差 12 个半音的两两配对
      const sorted = q.targets.slice().sort((a,b)=>a.midi-b.midi || a.s-b.s);
      const shapes = {};
      for(const a of sorted) for(const b of sorted) if(b.midi - a.midi === 12) { const t = relText(a, b); shapes[t] = (shapes[t]||0) + 1; }
      const uni = {};
      for(let i=0; i<sorted.length; i++) for(let j=i+1; j<sorted.length; j++)
        if(sorted[j].midi === sorted[i].midi){ const t = relText(sorted[i], sorted[j]); uni[t] = (uni[t]||0) + 1; }
      let det = "八度形状：" + (Object.keys(shapes).length ? Object.keys(shapes).map(t=>"<b>" + t + "</b>").join("，") : "这一段里没有") + "。";
      if(Object.keys(uni).length) det += "同音异位：" + Object.keys(uni).map(t=>"<b>" + t + "</b>").join("，") + "。";
      const irr = irregularNote(q.tun, [[{s:0,f:0},{s:q.tun.length-1,f:0}]]);
      if(irr) det += '<br><span style="color:var(--warn)">' + irr + '</span>';
      det += ' <span class="muted">' + (res.ok ? fretTimeTxt(q, res.per, true, true) : "") + '</span>';
      h += fretFeedbackBox(m, res.ok, res.ok ? "全部找到：" + pcName(q.pc) + " 有 " + q.targets.length + " 个位置" :
        "那是 " + pcName(res.clicked.midi % 12) + "，绿圈是还没找到的 " + pcName(q.pc), det, "按音高听一遍（空格）");
    }
    return h + fretFootHtml("找到的会变绿，点错一次本题结束 · 空格按音高听一遍 · Esc 返回");
  }
};
function renderBoardMap(){
  const tun = fretTuning(), open = mapFoldOpen("board");
  const marks = {};
  for(const c of cellsIn(tun, 0, 12, ()=>true))
    marks[cellKey(c)] = {cls: NATURAL_PC.includes(c.midi % 12) ? "nat" : "muted", label:pcName(c.midi % 12)};
  const irr = irregularNote(tun, [[{s:0,f:0},{s:tun.length-1,f:0}]]);
  return '<details class="fold card" id="fretMap"' + (open ? " open" : "") + '><summary><b>先看地图</b> <span class="muted small">' +
    tun.length + ' 弦 ' + tuningText(tun) + ' · 0–12 品音名</span></summary>' +
    '<div class="sub small" style="margin:8px 0">实心是自然音，描边是升降音。点任意格子听音。</div>' +
    fretboardHtml({tun, marks, from:0, to:12, wide:true}) +
    '<div class="note-box" style="margin-top:10px">记忆点：空弦和 12 品同名（差一个八度）· 5 品 = 上一根空弦 · 7 品 = 空弦的五度 · ' +
    '自然音之间只有 E–F 和 B–C 相邻 1 品，其余隔 2 品 · 八度 = 上两弦 +2 品。' + (irr ? '<br>' + irr : "") + '</div></details>';
}

/* ================================================================
   模进训练（motif）
   ================================================================ */
// 音型：steps 是音阶级数的偏移（0 = 当前起点），groups 是希望的组数（放不下会自动减少）
const MOTIFS = {
  third:  {name:"三度",          steps:[0,2],       groups:7},
  triad:  {name:"三和弦琶音 1-3-5", steps:[0,2,4],  groups:6},
  seventh:{name:"七和弦琶音 1-3-5-7", steps:[0,2,4,6], groups:4},
  "1235": {name:"音型 1-2-3-5",   steps:[0,1,2,4],   groups:5},
  "1231": {name:"音型 1-2-3-1",   steps:[0,1,2,0],   groups:5},
  "3215": {name:"音型 3-2-1-5（下五度回钩）", steps:[2,1,0,-3], groups:5}
};
MODES.motif = {
  key:"motif", stage:"指板 3", name:"模进训练", cssColor:"var(--accent-motif)", meterCls:"m",
  desc:"同一个音型沿音阶一级一级平移，就是调内模进。它一次练三件事：把位里的音阶、级数决定的大小三度、手在指板上有规律的移动。先按空格听一遍，再按顺序弹出来。",
  levels:[
    {id:"m-1", kind:"motif", name:"阶段 1 · 三度模进",       goal:"1-3、2-4、3-5……音阶上的三度两两一组往上走，注意哪几组是大三度、哪几组是小三度", rtLimit:1500, motifs:["third"], dirs:[1]},
    {id:"m-2", kind:"motif", name:"阶段 2 · 三和弦琶音模进", goal:"每一级弹 1-3-5：1 大、2m 小、3m 小、4 大、5 大、6m 小、7 减。级数决定形状", rtLimit:1500, motifs:["triad"], dirs:[1]},
    {id:"m-3", kind:"motif", name:"阶段 3 · 四音音型",       goal:"1-2-3-5、1-2-3-1、3-2-1-5 沿音阶上行，练手指在把位里的固定套路", rtLimit:1300, motifs:["1235","1231","3215"], dirs:[1]},
    {id:"m-4", kind:"motif", name:"阶段 4 · 下行模进",       goal:"同样的音型从高处一级一级往下走（起点下行，音型本身也反过来）", rtLimit:1500, motifs:["third","triad","1235"], dirs:[-1]},
    {id:"m-5", kind:"motif", name:"阶段 5 · 七和弦 + 换调",   goal:"七和弦琶音与三和弦琶音，随机调、随机把位、上行或下行，不再标 1", rtLimit:1500, motifs:["seventh","triad"], dirs:[1,-1], random:true}
  ],
  map: renderMotifMap
};
function stepMidi(tonic, step){ return tonic + 12*Math.floor(step/7) + MAJOR_SCALE[((step % 7) + 7) % 7]; }
function stepLabel(step){
  const d = ((step % 7) + 7) % 7 + 1, o = Math.floor(step/7);
  return {d:String(d), o};
}
function stepLabelText(step){ const l = stepLabel(step); return l.d + (l.o > 0 ? "（高）" : l.o < 0 ? "（低）" : ""); }
/* 模进的把位：以 1 为原点，原点 −1 到 +3 品（5 品宽，一个把位里装得下一个多八度的音阶） */
function motifWindow(tun, keyPc, random){
  const b = fretBox(tun, keyPc, random);
  return {lo:Math.max(0, b.anchor.f - 1), hi:Math.min(FRET_MAX, b.anchor.f + 3), anchor:b.anchor};
}
/* 生成模进：从 1 出发（上行）或从高音 1 出发（下行），能放几组放几组，至少 3 组 */
function buildMotif(tun, keyPc, win, motif, dir){
  const avail = new Set(cellsIn(tun, win.lo, win.hi, ()=>true).map(c=>c.midi));
  const anchorMidi = tun[win.anchor.s] + win.anchor.f;
  const tonics = [anchorMidi - 12, anchorMidi, anchorMidi + 12].filter(t=>avail.has(t));
  let best = null;
  for(const tonic of tonics){
    for(let g = motif.groups; g >= 3; g--){
      const starts = [];
      for(let i=0; i<g; i++) starts.push(dir > 0 ? i : 7 - i);
      const steps = starts.map(st=> motif.steps.map(x=> dir > 0 ? st + x : st - x));
      const midis = steps.flat().map(st=>stepMidi(tonic, st));
      if(midis.every(mm=>avail.has(mm))){
        if(!best || g > best.groups || (g === best.groups && tonic === anchorMidi)) best = {tonic, groups:g, starts, steps};
        break;
      }
    }
  }
  return best;
}
FRET_EXT.motif = {
  gen(level){
    const tun = fretTuning();
    for(let attempt=0; attempt<30; attempt++){
      const key = level.random ? pickOther(FRET_KEYS, S.lastQ["m-key"], k=>k.name) : fretKey();
      const mid = rand(level.motifs), dir = rand(level.dirs);
      if(level.motifs.length * level.dirs.length > 1 && S.lastQ[level.id] === mid + dir && attempt < 20) continue;
      const win = motifWindow(tun, key.pc, !!level.random);
      const mm = buildMotif(tun, key.pc, win, MOTIFS[mid], dir);
      if(!mm) continue;
      if(level.random) S.lastQ["m-key"] = key.name;
      S.lastQ[level.id] = mid + dir;
      const flat = mm.steps.flat();
      const notes = flat.map(st=>stepMidi(mm.tonic, st));
      const groupOf = []; mm.steps.forEach((g,gi)=> g.forEach(()=> groupOf.push(gi)));
      return {kind:"m-seq", tun, key, box:win, motifId:mid, motif:MOTIFS[mid], dir, tonic:mm.tonic, starts:mm.starts,
        steps:flat, groups:mm.steps, groupOf, notes, step:0, hits:[], showAnchor:!level.random,
        enabled:(s, f)=> f >= win.lo && f <= win.hi,
        events: notes.map((n,i)=>({t:i*0.5 + groupOf[i]*0.25, dur:0.46, midi:n, voice:"bass", vel: i === 0 || groupOf[i] !== groupOf[i-1] ? 1 : 0.8}))};
    }
    throw new Error("当前调弦下放不下这个模进");
  },
  click(q, cell, ms){
    const want = q.notes[q.step];
    if(cell.midi !== want){
      q.hits.push(Object.assign({ok:false}, cell));
      const d = stepLabel(q.steps[q.step]).d;
      const idx = MAJOR_SCALE.indexOf(((cell.midi - q.key.pc) % 12 + 12) % 12);
      const chosen = cell.midi % 12 === want % 12 ? d + "（错八度）" : (idx >= 0 ? String(idx + 1) : "调外");
      recordAnswer(q.level.id, d, chosen, 0);
      fretFinish(false, {ms, clicked:cell, wrongAt:q.step});
      return;
    }
    q.hits.push(Object.assign({ok:true}, cell));
    q.step++;
    if(q.step >= q.notes.length){
      const per = ms / q.notes.length;
      recordAnswer(q.level.id, q.motif.name, q.motif.name, per);
      fretFinish(true, {ms, per});
    }else render();
  },
  render(q, m){
    const res = q.result;
    const W = q.box, A = W.anchor;
    let h = '<div class="fret-prompt" style="--mode-c:' + m.cssColor + '">' +
      '<div class="fp-key">' + q.key.name + ' 大调 · 把位 ' + W.lo + '–' + W.hi + ' 品' +
      (q.showAnchor ? ' · 1 在 ' + stringName(q.tun, A.s) + ' ' + A.f + ' 品' : ' · 先自己找到 1') +
      ' · ' + q.tun.length + ' 弦 ' + tuningText(q.tun) + '</div>' +
      '<div class="fp-sub" style="margin-top:2px"><b>' + q.motif.name + '</b>' +
      (q.dir > 0 ? " · 上行 ↑" : "（倒过来弹：" + q.groups[0].map(st=>stepLabel(st).d).join("-") + "）· 下行 ↓") + ' · ' + q.groups.length + ' 组</div>' +
      '<div class="mt-groups">';
    let idx = 0;
    q.groups.forEach((g, gi)=>{
      h += '<span class="mt-g">';
      g.forEach(st=>{
        const l = stepLabel(st), hit = q.hits[idx];
        const cls = hit ? (hit.ok ? "done" : "bad") : (idx === q.step && !S.answered ? "cur" : "");
        h += '<span class="mt-n ' + cls + (l.o > 0 ? " up" : l.o < 0 ? " dn" : "") + '">' + l.d + '</span>';
        idx++;
      });
      h += '</span>';
    });
    h += '</div>' + fretTimerHtml(q, q.level.rtLimit * q.notes.length) + '</div>';

    const marks = {};
    if(S.answered){
      for(const c of cellsIn(q.tun, W.lo, W.hi, p=> !!degOfPc(q.key.pc, p)))
        marks[cellKey(c)] = {cls:"muted deg-" + degOfPc(q.key.pc, c.midi % 12).fn, label:String(MAJOR_SCALE.indexOf(((c.midi - q.key.pc) % 12 + 12) % 12) + 1)};
    }
    q.hits.forEach((hh, i)=>{
      marks[cellKey(hh)] = {cls: hh.ok ? "ok" : "bad", label: hh.ok ? stepLabel(q.steps[i]).d :
        (degOfPc(q.key.pc, hh.midi % 12) ? String(MAJOR_SCALE.indexOf(((hh.midi - q.key.pc) % 12 + 12) % 12) + 1) : "✕")};
    });
    if(S.answered && !res.ok){
      const want = q.notes[res.wrongAt];
      for(const c of cellsIn(q.tun, W.lo, W.hi, ()=>true)) if(c.midi === want) marks[cellKey(c)] = {cls:"ok ring", label:stepLabel(q.steps[res.wrongAt]).d};
    }
    const ak = cellKey(A);
    if(q.showAnchor || S.answered){
      if(!marks[ak] || marks[ak].cls.includes("muted")) marks[ak] = {cls:"anchor", label:"1"};
      else marks[ak].cls += " anchor";
    }
    let from = Math.max(0, W.lo - 1), to = Math.min(FRET_MAX, W.hi + 1);
    while(to - from < 5){ if(to < FRET_MAX) to++; else from--; }
    h += fretboardHtml({tun:q.tun, box:W, marks, lockOutside:true, from, to});

    if(S.answered){
      let title, det;
      if(res.ok){
        title = "模进完成：" + q.notes.length + " 个音";
        det = motifExplain(q) + ' <span class="muted">' + fretTimeTxt(q, res.per, true, true) + '</span>';
      }else{
        const want = q.notes[res.wrongAt], got = res.clicked.midi;
        title = "第 " + (res.wrongAt + 1) + " 个音应该是 " + stepLabelText(q.steps[res.wrongAt]) + "（" + spellOct(want) + "）";
        det = (got % 12 === want % 12 ? "音名对了，但差了一个八度：模进要保持方向，" + (q.dir > 0 ? "一路往上走" : "一路往下走") + "。" :
          "你点的是 " + spellOct(got) + "。") + "绿圈是正确位置。" + motifExplain(q);
      }
      h += fretFeedbackBox(m, res.ok, title, det, "听整条模进（空格）");
    }
    return h + fretFootHtml("按顺序点 · 同一个音在哪根弦都算 · 空格听整条 · 回车下一题 · Esc 返回");
  }
};
/* 每组的「颜色」：三度看大小，三和弦/七和弦看性质，其余提示半音位置 */
function motifExplain(q){
  const tri = {"4,7":"大", "3,7":"小", "3,6":"减"};
  const sev = {"4,7,11":"大七", "3,7,10":"小七", "4,7,10":"属七", "3,6,10":"半减七"};
  const parts = q.groups.map(g=>{
    const ms = g.map(st=>stepMidi(q.tonic, st));
    const root = Math.min(...ms);
    const lab = stepLabel(q.dir > 0 ? g[0] : g.reduce((a,b)=>Math.min(a,b))).d;
    if(q.motifId === "third"){ const iv = Math.abs(ms[1]-ms[0]); return lab + " " + (iv === 4 ? "大三度" : "小三度"); }
    if(q.motifId === "triad" || q.motifId === "seventh"){
      const ivs = ms.map(x=>x-root).filter(x=>x>0).sort((a,b)=>a-b).join(",");
      return lab + " " + ((q.motifId === "triad" ? tri : sev)[ivs] || "?");
    }
    return null;
  }).filter(Boolean);
  if(parts.length) return "每组的颜色：" + parts.join(" · ") + "。形状变了是因为级数变了，不是你记错了。";
  return "音型不变，起点沿音阶一级一级移动。经过 3→4 和 7→1 时是半音，手的形状会跟着变。";
}
function renderMotifMap(){
  const tun = fretTuning(), key = fretKey(), W = motifWindow(tun, key.pc, false), open = mapFoldOpen("motif");
  const marks = {};
  for(const c of cellsIn(tun, W.lo, W.hi, p=> !!degOfPc(key.pc, p))){
    const d = degOfPc(key.pc, c.midi % 12);
    marks[cellKey(c)] = {cls:"deg-" + d.fn, label:String(MAJOR_SCALE.indexOf(((c.midi - key.pc) % 12 + 12) % 12) + 1)};
  }
  const ak = cellKey(W.anchor); if(marks[ak]) marks[ak].cls += " anchor";
  const anchorMidi = tun[W.anchor.s] + W.anchor.f;
  const inWin = cellsIn(tun, W.lo, W.hi, ()=>true).map(c=>c.midi);
  return '<details class="fold card" id="fretMap"' + (open ? " open" : "") + '><summary><b>先看把位音阶</b> <span class="muted small">' +
    key.name + ' 大调 · ' + W.lo + '–' + W.hi + ' 品</span></summary>' +
    '<div class="sub small" style="margin:8px 0">模进的骨架就是这个把位里的音阶：数字是音阶级数（1 = ' + key.name + '），这个把位能弹到 ' +
    spellOct(Math.min(...inWin)) + '–' + spellOct(Math.max(...inWin)) + '。先从 1（' + spellOct(anchorMidi) + '）上下弹几遍，再进阶段 1。</div>' +
    fretboardHtml({tun, box:W, marks, from:Math.max(0, W.lo - 1), to:Math.min(FRET_MAX, W.hi + 1)}) +
    '<div class="note-box" style="margin-top:10px">什么是模进：选一个短音型（比如 1-3），从 1 开始弹，然后整体挪到 2 上弹 2-4，再挪到 3 上弹 3-5……' +
    '音型的「级数距离」不变，但因为音阶里有半音（3–4、7–1），实际的大小三度和手形会变。这正是级数决定和弦性质的听觉和手感版本。</div></details>';
}
