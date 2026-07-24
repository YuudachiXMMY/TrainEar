"use strict";
/* 应用：状态、存储、出题、界面 */
/* ================================================================
   进度存储（本地文件打开时自动长期保存；侧边栏里用导出/导入迁移）
   ================================================================ */
const DATA_KEY = "jrockEarTrainer.v1";
const store = {
  mem:{}, ok:false,
  init(){ try{ localStorage.setItem("__t","1"); localStorage.removeItem("__t"); this.ok = true; }catch(e){ this.ok = false; } },
  get(k){ if(this.ok){ try{ return localStorage.getItem(k); }catch(e){} } return (k in this.mem)? this.mem[k] : null; },
  set(k,v){ if(this.ok){ try{ localStorage.setItem(k,v); return; }catch(e){} } this.mem[k] = v; }
};
store.init();
function defaultData(){
  return {v:1, days:{}, levels:{}, conf:{}, anchors:{},
          settings:{key:"E", random:false, bpm:100, vol:0.8, chordVoice:"gtr", bassVoice:"ks-bass", rootHighOct:false}};
}
function loadData(){
  try{
    const raw = store.get(DATA_KEY);
    if(raw){ const d = JSON.parse(raw); return Object.assign(defaultData(), d, {settings:Object.assign(defaultData().settings, d.settings||{})}); }
  }catch(e){}
  return defaultData();
}
function saveData(){ try{ store.set(DATA_KEY, JSON.stringify(S.data)); }catch(e){} scheduleSync(); }

/* ---------------- 云同步（登录后进度双写：本地 + 服务器，防抖 1.2s） ---------------- */
let syncTimer = null;
function scheduleSync(){
  if(!API.user) return;
  S.syncState = "dirty";
  clearTimeout(syncTimer);
  syncTimer = setTimeout(doSync, 1200);
}
async function doSync(){
  if(!API.user) return;
  S.syncState = "saving";
  const r = await API.putProgress(S.data);
  S.syncState = (r && r.ok) ? "ok" : "err";
  const el = document.getElementById("syncState");
  if(el) el.textContent = syncStateText();
}
function syncStateText(){
  return {dirty:"有改动待同步…", saving:"同步中…", ok:"已同步到云端", err:"同步失败（会自动重试）"}[S.syncState] || "已连接";
}
async function afterLogin(){
  const pr = await API.getProgress();
  if(pr && pr.data){
    S.data = Object.assign(defaultData(), pr.data,
      {settings: Object.assign(defaultData().settings, pr.data.settings || {})});
    try{ store.set(DATA_KEY, JSON.stringify(S.data)); }catch(e){}
    S.syncState = "ok";
  }else if(!pr || !pr.error){
    await API.putProgress(S.data);   // 云端为空：把本地进度带上去
    S.syncState = "ok";
  }
  const ls = await API.listSamples();
  if(ls && ls.samples) Samples.setList(ls.samples);
  for(const v of [S.data.settings.bassVoice, S.data.settings.chordVoice]){
    if(v && v.startsWith("custom:")) Samples.preload(v.slice(7));
  }
}
function todayStr(){ const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function levelStat(id){
  if(!S.data.levels[id]) S.data.levels[id] = {a:0,c:0,streak:0,best:0,recent:[],passed:false};
  return S.data.levels[id];
}
function recent20Rate(st){ if(!st.recent.length) return null; return st.recent.reduce((x,y)=>x+y,0)/st.recent.length; }
function recordAnswer(levelId, correct, chosen){
  const ok = (correct === chosen);
  const st = levelStat(levelId);
  st.a++; if(ok) st.c++;
  st.streak = ok ? st.streak+1 : 0;
  st.best = Math.max(st.best, st.streak);
  st.recent.push(ok?1:0); if(st.recent.length > PASS_N) st.recent.shift();
  if(!st.passed && st.recent.length >= PASS_N && recent20Rate(st) >= PASS_RATE){ st.passed = true; st.passedOn = todayStr(); }
  const day = S.data.days[todayStr()] || (S.data.days[todayStr()] = {n:0,c:0});
  day.n++; if(ok) day.c++;
  if(!ok){
    const cf = S.data.conf[levelId.split("-")[0]] || (S.data.conf[levelId.split("-")[0]] = {});
    const kk = correct + " 听成 " + chosen;
    cf[kk] = (cf[kk]||0) + 1;
  }
  saveData();
  return ok;
}
function dayStreak(){
  const fmt = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const d = new Date();
  const has = ()=> S.data.days[fmt(d)] && S.data.days[fmt(d)].n > 0;
  if(!has()) d.setDate(d.getDate()-1);  // 今天还没练就从昨天开始数
  let n = 0;
  while(has()){ n++; d.setDate(d.getDate()-1); }
  return n;
}

/* ================================================================
   应用状态与渲染
   ================================================================ */
const S = {
  screen:"home", modeKey:null, levelIdx:0,
  q:null, answered:false, feedback:null, chosenIdx:-1,
  lastQ:{}, lastDeg:{}, playing:false, droneOn:false,
  ioText:"", ioMsg:"", resetArmed:false,
  data: loadData()
};

function esc(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function pct(r){ return Math.round(r*100) + "%"; }
function setCaption(t){ const el = document.getElementById("playCaption"); if(el) el.textContent = t; }
function setDot(i){ const el = document.getElementById("beatDots"); if(!el) return;
  [...el.children].forEach((c,j)=> c.classList.toggle("on", j<=i)); }
function clearDots(){ const el = document.getElementById("beatDots"); if(el) [...el.children].forEach(c=>c.classList.remove("on")); }
function setPlaying(b){ S.playing = b; const el = document.getElementById("bigplayBtn"); if(el) el.classList.toggle("playing", b); }

function chordNameForDegree(key, degKey){
  const d = DEGREES[degKey];
  const pc = ((key.pc + d.semi) % 12 + 12) % 12;
  const suf = {maj:"", min:"m", dom7:"7", maj7:"maj7", min7:"m7"}[d.q] || "";
  return NOTE_NAMES[pc] + suf;
}
function patternChordNames(key, pat){
  const suf = {maj:"", min:"m", dom7:"7", maj7:"maj7", min7:"m7"};
  const out = [];
  let prevDeg = null;
  for(const s of pat.steps){
    if(s.deg === prevDeg) continue; prevDeg = s.deg;
    const pc = ((key.pc + s.root) % 12 + 12) % 12;
    let nm = NOTE_NAMES[pc] + (suf[s.shape] || "");
    if(s.bassSemi !== undefined){ nm += "/" + NOTE_NAMES[((key.pc + s.bassSemi) % 12 + 12) % 12]; }
    out.push(nm);
  }
  return out.join("  ");
}
function seqToSteps(seq){
  let prev = null; const steps = [];
  for(const dk of seq){
    const d = DEGREES[dk]; let c = nearestSemi(d.semi);
    if(prev !== null){
      let best = c, bd = Math.abs(c - prev);
      for(const cand of [c-12, c+12]){ const dd = Math.abs(cand - prev); if(dd < bd){ bd = dd; best = cand; } }
      c = best;
    }
    prev = c;
    steps.push({deg:dk, root:c, shape:d.q});
  }
  return steps;
}

/* ---------------- 出题 ---------------- */
function pickAvoid(arr, levelId, keyFn){
  const last = S.lastQ[levelId];
  let x = arr[Math.floor(Math.random()*arr.length)];
  for(let i=0; i<4 && arr.length>1 && keyFn(x)===last; i++) x = arr[Math.floor(Math.random()*arr.length)];
  S.lastQ[levelId] = keyFn(x);
  return x;
}
/* 根音追踪的三八度出题器：
   - 5 和 6m 加权出现（易混对专项）
   - 1 级永远不落在定调的那个八度（高八度或低八度，逼着认「身份」而非记音高）
   - 高八度开关开：所有级数在三个八度里随机；关：非 1 级用默认摆位且不连续重复级数
   - 任何情况下不连续出现完全相同的音高，同一级数最多连续两次 */
const DEG_WEIGHTS = {"5":2.2, "6m":2.2};
function degCandidates(deg, key, hi){
  const tb = bassTonic(key.pc);
  const inRange = m => m >= 26 && m <= 54;
  if(deg === "1"){
    const c = [tb-12, tb+12].filter(inRange);
    return c.length ? c : [tb+12];
  }
  const p0 = foldBass(tb + nearestSemi(DEGREES[deg].semi));
  return (hi ? [p0-12, p0, p0+12] : [p0]).filter(inRange);
}
function genDegTarget(level, key){
  const hi = !!S.data.settings.rootHighOct;
  const last = S.lastDeg[level.id] || {deg:null, midi:null, run:0};
  const pool = level.pool;
  const cum = []; let tot = 0;
  for(const d of pool){ tot += (DEG_WEIGHTS[d] || 1); cum.push(tot); }
  for(let attempt=0; attempt<40; attempt++){
    const r = Math.random()*tot;
    const deg = pool[cum.findIndex(x=>r<x)];
    if(deg === last.deg && last.run >= 2) continue;                 // 同级数最多连两次
    if(!hi && deg !== "1" && deg === last.deg) continue;            // 无八度混合时级数不重复
    const avail = degCandidates(deg, key, hi).filter(m=>m !== last.midi);
    if(!avail.length) continue;
    const midi = avail[Math.floor(Math.random()*avail.length)];
    S.lastDeg[level.id] = {deg, midi, run: deg === last.deg ? last.run+1 : 1};
    return {deg, midi};
  }
  // 兜底：任选一个和上次音高不同的组合
  for(const deg of pool){
    const avail = degCandidates(deg, key, hi).filter(m=>m !== last.midi);
    if(avail.length){ const midi = avail[0]; S.lastDeg[level.id] = {deg, midi, run:1}; return {deg, midi}; }
  }
  const deg = pool[0], midi = degCandidates(deg, key, hi)[0];
  S.lastDeg[level.id] = {deg, midi, run:1};
  return {deg, midi};
}
const VARIANT_DESC = {"8ths":"八分根音", "half":"全音符铺底", "root5":"根五交替"};
function genQuestion(){
  const mode = MODES[S.modeKey], level = mode.levels[S.levelIdx];
  const kind = level.kind;
  const key = keyObj();
  S.answered = false; S.feedback = null; S.chosenIdx = -1;
  if(kind === "deg"){
    const t = genDegTarget(level, key);
    const b = buildRootQuestion(key, t.deg, t.midi);
    S.q = {kind:"root", key, level, events:b.events, bassNote:b.bassNote,
      caps:b.marks, dots:null, answerValue:t.deg,
      options: level.pool.map(k=>({value:k, label:DEGREES[k].label, sub:null})),
      idle:"低音落在几级？"};
  }else if(kind === "seq"){
    const sp = pickAvoid(SEQ_POOL, level.id, x=>x.seq.join());
    const steps = seqToSteps(sp.seq);
    const prog = buildProgression(key, steps, 2);
    const correct = sp.seq.join(" → ");
    const opts = [ sp.seq ].concat(seqDistractors(sp.seq)).map(s=>({value:s.join(" → "), label:s.join(" → "), sub:null}));
    for(let i=opts.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [opts[i],opts[j]] = [opts[j],opts[i]]; }
    S.q = {kind:"seq", key, level, sp, steps, events:prog.events, dots:prog.dots, caps:null,
      bassLineNotes:prog.bassLine, answerValue:correct, options:opts, idle:"根音走向是哪一条？"};
  }else if(kind === "cadence"){
    const cat = pickAvoid(CADENCE_POOL, level.id, x=>x.cat);
    const seq = cat.seqs[Math.floor(Math.random()*cat.seqs.length)];
    const prog = buildProgression(key, seqToSteps(seq), 1);
    S.q = {kind:"cadence", key, level, cat, seq, events:prog.events, dots:prog.dots, caps:null,
      answerValue:cat.cat,
      options: CADENCE_POOL.map(c=>({value:c.cat, label:c.opt, sub:null})),
      idle:"最后停在了哪里？"};
  }else if(kind === "quality"){
    const qNum = S.levelIdx + 1;
    const target = pickAvoid(level.pool, level.id, x=>x);
    const b = buildQualityQuestion(qNum, target);
    const lab = q => qNum===1 ? (q==="maj"?"大三度":"小三度") : QUALITY_INFO[q].label;
    S.q = {kind:"quality", key, level, qNum, root:b.root, events:b.events, caps:null, dots:null,
      answerValue:target,
      options: level.pool.map(k=>({value:k, label:lab(k), sub:QUALITY_INFO[k].feel})),
      idle: qNum===1 ? "亮的还是暗的？" : "这是什么性质？"};
  }else if(kind === "variant"){
    const pat = pickAvoid(PATTERNS, level.id, x=>x.id);
    const vkey = KEYS[Math.floor(Math.random()*KEYS.length)];   // 变奏档强制随机调
    const vopts = {bassStyle: ["8ths","half","root5"][Math.floor(Math.random()*3)],
                   seventh: Math.random() < 0.5};
    const prog = buildProgression(vkey, pat.steps, null, vopts);
    S.q = {kind:"variant", key:vkey, level, pat, vopts, events:prog.events, dots:prog.dots, caps:null,
      answerValue:pat.name,
      options: PATTERNS.map(p=>({value:p.name, label:p.name, sub:p.degText})),
      idle:"换了伴奏和调，是哪个套路？"};
  }else if(kind === "outside"){
    const item = pickAvoid(OUTSIDE_POOL, level.id, x=>x.seq.join());
    const prog = buildProgression(key, seqToSteps(item.seq), 2);
    S.q = {kind:"outside", key, level, item, events:prog.events, dots:prog.dots, caps:null,
      answerValue:item.cat,
      options: OUTSIDE_CATS.map(c=>({value:c.value, label:c.label, sub:c.sub||null})),
      idle:"这段进行里有外人吗？"};
  }else{
    const pool = PATTERNS.filter(p=>p.lv <= level.lv);
    const pat = pickAvoid(pool, level.id, x=>x.id);
    const prog = buildProgression(key, pat.steps);
    S.q = {kind:"pattern", key, level, pat, pool, events:prog.events, dots:prog.dots, caps:null,
      answerValue:pat.name,
      options: pool.map(p=>({value:p.name, label:p.name, sub:p.degText})),
      idle:"这是哪个套路？"};
  }
}
function playCurrent(slow){
  const q = S.q; if(!q) return;
  const bpm = (S.data.settings.bpm || 100) * (slow ? 0.72 : 1);
  const marks = [];
  (q.caps||[]).forEach(c=> marks.push({t:c.t, fn:()=> setCaption(c.text)}));
  (q.dots||[]).forEach(d=> marks.push({t:d.t, fn:()=> setDot(d.i)}));
  AE.play(q.events, {bpm, marks, onEnd:()=>{ setCaption(q.idle); clearDots(); }});
  if(q.caps && q.caps.length) setCaption(q.caps[0].text); else setCaption("播放中…");
}
function playAdhoc(events, caps, bpm){
  const marks = (caps||[]).map(c=>({t:c.t, fn:()=> setCaption(c.text)}));
  AE.play(events, {bpm: bpm || S.data.settings.bpm || 100, marks, onEnd:()=> setCaption(S.q ? S.q.idle : "")});
}

/* ---------------- 作答与讲解 ---------------- */
function submitAnswer(i){
  const q = S.q; if(!q || S.answered) return;
  const opt = q.options[i]; if(!opt) return;
  S.chosenIdx = i;
  const correctLabel = q.options.find(o=>o.value===q.answerValue).label;
  const ok = recordAnswer(q.level.id, correctLabel, opt.label);
  S.answered = true;
  S.feedback = buildFeedback(q, opt, ok);
  render();
}
function buildFeedback(q, chosen, ok){
  const f = {ok, actions:[]};
  const key = q.key;
  if(q.kind === "root"){
    const d = DEGREES[q.answerValue];
    f.title = ok ? "答对了，是 " + d.label : "是 " + d.label + "，你选了 " + chosen.label;
    const tb0 = bassTonic(key.pc);
    const p0 = q.answerValue === "1" ? tb0 : foldBass(tb0 + nearestSemi(d.semi));
    const octNote = q.bassNote === p0 ? "" : (q.bassNote > p0 ? "（高八度）" : "（低八度）");
    let det = "低音是 <b>" + noteNameOct(q.bassNote) + "</b>" + octNote + "（" + key.name + " 大调的 " + d.label + " 级，和弦 " +
      chordNameForDegree(key, q.answerValue) + "）。" + d.color + "。";
    if(q.answerValue === "1")
      det += "<br>这个 1 和定调的 1 不在同一个八度：音高变了，级数身份没变。";
    if(!ok){
      const pair = [q.answerValue, chosen.value];
      if(pair.includes("1") && pair.includes("6m"))
        det += "<br>窍门：1 和 6m 共享两个音，最容易混。听低音落点：<b>亮的家是 1，暗的家是 6m</b>。";
      if(pair.includes("4") && pair.includes("2m"))
        det += "<br>窍门：4 和 2m 同为下属功能，色彩相近。2m 更柔更暗，4 更亮更开阔。";
    }
    f.detail = det;
    f.actions.push({act:"listen-correct", label:"听正确答案"});
    if(!ok) f.actions.push({act:"listen-chosen", label:"听你选的 " + chosen.label});
  }else if(q.kind === "seq"){
    f.title = ok ? "答对了" : "正确走向：" + q.answerValue;
    f.detail = "<b>" + q.answerValue + "</b>，低音走的是 " +
      q.bassLineNotes.map(noteName).join(" → ") + "（" + key.name + " 大调）。" + esc(q.sp.note) + "。";
    f.actions.push({act:"replay", label:"再听一遍"});
    if(!ok) f.actions.push({act:"listen-chosen-seq", label:"听你选的走向"});
  }else if(q.kind === "quality"){
    const info = QUALITY_INFO[q.answerValue];
    const nm = q.qNum===1 ? (q.answerValue==="maj"?"大三度":"小三度") : info.label;
    f.title = ok ? "答对了，是" + nm : "是" + nm + "，你选了" + chosen.label;
    f.detail = "根音 <b>" + noteName(q.root) + "</b>。" + info.feel + "。" +
      (q.answerValue==="dom7" ? "属七 = 大三度加小七度，躁感来自那个小七度。" : "");
    if(!ok){
      f.actions.push({act:"compare", label:"对比听：你选的 → 正确的"});
    }else if(q.level.pool.length === 2){
      f.actions.push({act:"compare-other", label:"对比听另一种"});
    }else{
      f.actions.push({act:"replay", label:"再听一遍"});
    }
  }else if(q.kind === "cadence"){
    f.title = ok ? "答对了：" + q.cat.label : "是" + q.cat.label + "，你选了「" + chosen.label + "」";
    let det = "进行：<b>" + q.seq.join("　") + "</b>（" + key.name + " 大调：" +
      patternChordNames(key, {steps: seqToSteps(q.seq)}) + "）<br>" + esc(q.cat.why);
    const pair = [q.answerValue, chosen.value];
    if(!ok && pair.includes("auth") && pair.includes("dec6"))
      det += "<br>窍门：都在「回家」，但正格回的是亮的家 1，伪终止进的是暗的家 6m。只听最后一个和弦的亮暗。";
    if(!ok && pair.includes("half"))
      det += "<br>窍门：半终止的落点是悬着发紧的（想继续走），终止类的落点是松下来的（走完了）。";
    f.detail = det;
    f.actions.push({act:"replay", label:"再听一遍"});
    if(!ok) f.actions.push({act:"listen-cad-chosen", label:"对比听：你选的 → 正确的"});
  }else if(q.kind === "outside"){
    const it = q.item;
    const catLabel = OUTSIDE_CATS.find(c=>c.value === it.cat).label;
    f.title = ok ? "答对了：" + catLabel : "是「" + catLabel + "」，你选了「" + chosen.label + "」";
    f.detail = "进行：<b>" + it.seq.join("　") + "</b>（" + key.name + " 大调：" +
      patternChordNames(key, {steps: seqToSteps(it.seq)}) + "）<br>" +
      (it.outsider ? "外人是 <b>" + it.outsider + "</b>。" : "") + esc(it.why) +
      "<br><span class='muted'>" + OUTSIDE_RULE[it.cat] + "</span>";
    f.actions.push({act:"replay", label:"再听一遍"});
    if(it.twin) f.actions.push({act:"listen-twin", label:"A/B 对比：全调内版 → 原版"});
  }else{
    const pat = q.pat;
    f.title = ok ? "答对了，是" + pat.name : "是" + pat.name + "，你选了" + chosen.label;
    let det = "<b>" + pat.degText + "</b>（" + key.name + " 大调：" + patternChordNames(key, pat) + "）<br>" + esc(pat.hint);
    if(q.kind === "variant"){
      det += "<br>这遍的变奏：" + VARIANT_DESC[q.vopts.bassStyle] +
        (q.vopts.seventh ? "，和弦全部加了七音" : "") + "。伴奏怎么换，套路的轮廓不变。";
    }
    if(!ok){
      const wrongPat = PATTERNS.find(p=>p.name === chosen.value);
      det += "<br>窍门：" + esc(pat.trick);
      if(wrongPat) f.actions.push({act: q.kind === "variant" ? "listen-chosen-var" : "listen-chosen-pat", label:"听你选的" + wrongPat.name});
    }
    const anchor = S.data.anchors[pat.id];
    det += anchor ? "<br>你的锚点歌：" + esc(anchor) : "<br><span class='muted'>还没设锚点歌，去本模式首页的套路图鉴里给它配 3 首熟悉的歌。</span>";
    f.detail = det;
    f.actions.unshift({act: q.kind === "variant" ? "listen-correct-var" : "listen-correct-pat", label:"再听" + pat.name});
  }
  return f;
}
function runFeedbackAction(act){
  const q = S.q; if(!q) return;
  if(act === "replay"){ playCurrent(false); return; }
  if(act === "replay-slow"){ playCurrent(true); return; }
  if(q.kind === "root"){
    const deg = act === "listen-correct" ? q.answerValue : q.options[S.chosenIdx].value;
    let bn;
    if(act === "listen-correct"){ bn = q.bassNote; }
    else{
      // 你选的级数放在离目标音最近的八度，把差异集中在级数身份上
      const cands = degCandidates(deg, q.key, true);
      bn = cands.reduce((a,b)=> Math.abs(b-q.bassNote) < Math.abs(a-q.bassNote) ? b : a);
    }
    const b = buildRootQuestion(q.key, deg, bn);
    playAdhoc(b.events, [{t:0, text:"定调：1 级"}, {t:2.5, text:DEGREES[deg].label + "（" + noteNameOct(bn) + "，和弦 " + chordNameForDegree(q.key, deg) + "）"}]);
  }else if(q.kind === "seq" && act === "listen-chosen-seq"){
    const seq = q.options[S.chosenIdx].value.split(" → ");
    const prog = buildProgression(q.key, seqToSteps(seq), 2);
    playAdhoc(prog.events, [{t:0, text:"你选的：" + q.options[S.chosenIdx].value}]);
  }else if(q.kind === "quality"){
    const other = q.level.pool.find(p=>p !== q.answerValue);
    const a = act === "compare" ? q.options[S.chosenIdx].value : (act === "compare-other" ? other : q.answerValue);
    const lab = v => q.qNum===1 ? (v==="maj"?"大三度":"小三度") : QUALITY_INFO[v].label;
    playAdhoc(qualityCompareEvents(q.root, a, q.answerValue, q.qNum),
      [{t:0, text:"① " + lab(a)}, {t:3.6, text:"② " + lab(q.answerValue) + "（正确）"}]);
  }else if(q.kind === "pattern"){
    const pat = act === "listen-correct-pat" ? q.pat : PATTERNS.find(p=>p.name === q.options[S.chosenIdx].value);
    if(!pat) return;
    const prog = buildProgression(q.key, pat.steps);
    playAdhoc(prog.events, [{t:0, text:pat.name + "：" + pat.degText}]);
  }else if(q.kind === "variant"){
    const pat = act === "listen-correct-var" ? q.pat : PATTERNS.find(p=>p.name === q.options[S.chosenIdx].value);
    if(!pat) return;
    const prog = buildProgression(q.key, pat.steps, null, q.vopts);
    playAdhoc(prog.events, [{t:0, text:pat.name + "（同样的变奏）：" + pat.degText}]);
  }else if(q.kind === "cadence" && act === "listen-cad-chosen"){
    const chosenCat = CADENCE_POOL.find(c=>c.cat === q.options[S.chosenIdx].value);
    if(!chosenCat) return;
    const ab = concatProgs([
      {prog: buildProgression(q.key, seqToSteps(chosenCat.seqs[0]), 1), cap:"① 你选的：" + chosenCat.label},
      {prog: buildProgression(q.key, seqToSteps(q.seq), 1), cap:"② 正确：" + q.cat.label}
    ]);
    playAdhoc(ab.events, ab.caps);
  }else if(q.kind === "outside" && act === "listen-twin"){
    const ab = concatProgs([
      {prog: buildProgression(q.key, seqToSteps(q.item.twin), 1), cap:"① 全调内版本"},
      {prog: buildProgression(q.key, seqToSteps(q.item.seq), 1), cap:"② 原版（外人：" + q.item.outsider + "）"}
    ]);
    playAdhoc(ab.events, ab.caps);
  }
}

/* ================================================================
   各屏渲染
   ================================================================ */
function levelMeterHtml(mode, level){
  const st = levelStat(level.id);
  const r = recent20Rate(st);
  const w = r === null ? 0 : Math.round(r*100);
  return '<div class="meter-wrap"><div class="meter-label"><span>近 ' + Math.min(st.recent.length||0, PASS_N) + ' 题正确率</span><span>' +
    (r===null ? "还没练过" : pct(r) + " · 共 " + st.a + " 题") + '</span></div>' +
    '<div class="meter ' + mode.meterCls + '"><i style="width:' + w + '%"></i></div></div>';
}
function renderTopbar(){
  const day = S.data.days[todayStr()];
  const n = day ? day.n : 0;
  let left;
  if(S.screen === "home"){
    left = '<div class="title-wrap"><h1>J-Rock 练耳训练器</h1><div class="subtitle">对应《Bassline 学习方法论》第三部分 · 阶段 0 到 3 · Bass 手专用</div></div>';
  }else{
    const names = {warmup:"阶段 0 · 唱级数热身", progress:"进度", auth:"账号", sources:"自定义音源", mode:"", quiz:""};
    let t = names[S.screen];
    if(S.screen === "mode") t = MODES[S.modeKey].stage + " · " + MODES[S.modeKey].name;
    if(S.screen === "quiz") t = MODES[S.modeKey].name + " · " + MODES[S.modeKey].levels[S.levelIdx].name.replace(/^档 \d+ · /,"");
    left = '<button class="backbtn" data-act="back">← 返回</button><div class="title-wrap"><h2 style="margin:0">' + t + '</h2></div>';
  }
  const acct = API.offline ? "" :
    (API.user
      ? '<button class="pill" data-act="nav-auth" title="账号与云同步">☁ ' + esc(API.user.username) + '</button>'
      : '<button class="pill" data-act="nav-auth">登录</button>');
  return '<div class="topbar">' + left + acct + '<span class="pill">今日 <b>' + n + '</b> 题</span></div>';
}
function sourceOptions(kind){
  const opts = kind === "bass"
    ? [["ks-bass","电贝斯"],["synth-bass","合成贝斯"]]
    : [["gtr","电吉他"],["ep","键盘"]];
  for(const n of Samples.groups(kind)) opts.push(["custom:" + n, "采样 · " + n]);
  return opts;
}
function sourceSelect(kind, cur, compact){
  const set = kind === "bass" ? "bvoice" : "cvoice";
  const style = compact ? ' style="padding:3px 6px;font-size:12.5px"' : "";
  return '<select data-set="' + set + '"' + style + '>' +
    sourceOptions(kind).map(([v,l]) =>
      '<option value="' + esc(v) + '"' + (cur === v ? " selected" : "") + '>' + esc(l) + '</option>').join("") +
    '</select>';
}
function renderHome(){
  const st = S.data.settings;
  let h = '<div class="settings-row card" style="padding:12px 14px">' +
    '<label>调 <select data-set="key"' + (st.random?" disabled":"") + '>' +
      KEYS.map(k=>'<option value="'+k.name+'"'+(st.key===k.name?" selected":"")+'>'+k.name+' 大调</option>').join("") +
    '</select></label>' +
    '<label><input type="checkbox" data-set="random"' + (st.random?" checked":"") + '> 每题随机调</label>' +
    '<label>速度 <select data-set="bpm">' +
      [["80","慢"],["100","标准"],["120","快"]].map(([v,l])=>'<option value="'+v+'"'+(String(st.bpm)===v?" selected":"")+'>'+l+' '+v+'</option>').join("") +
    '</select></label>' +
    '<label>贝斯音色 ' + sourceSelect("bass", st.bassVoice || "ks-bass", false) + '</label>' +
    '<label>和弦音色 ' + sourceSelect("chord", st.chordVoice || "gtr", false) + '</label>' +
    '<label>音量 <input type="range" min="0" max="1" step="0.05" value="' + st.vol + '" data-set="vol" style="width:90px"></label>' +
  '</div>';
  h += '<button class="mode-card" data-act="nav-warmup" style="--tag-c:var(--accent-warm)">' +
    '<div class="mode-head"><span class="stage-tag">阶段 0</span><h2>唱级数热身</h2></div>' +
    '<div class="desc">先会唱，才会听。对着 drone 唱数字，每次开练前 2 到 3 分钟，永久保留。</div></button>';
  for(const mk of ["root","quality","pattern"]){
    const m = MODES[mk];
    const dots = m.levels.map((lv,i)=>{
      const stt = levelStat(lv.id);
      return '<span class="lv-dot' + (stt.passed?" passed":"") + '">档' + (i+1) + (stt.passed?" ✓":"") + '</span>';
    }).join("");
    h += '<button class="mode-card" data-act="nav-mode" data-mode="' + mk + '" style="--tag-c:' + m.cssColor + '">' +
      '<div class="mode-head"><span class="stage-tag">' + m.stage + '</span><h2>' + m.name + '</h2></div>' +
      '<div class="desc">' + m.desc + '</div><div class="lv-dots">' + dots + '</div></button>';
  }
  h += '<button class="mode-card" data-act="nav-progress" style="--tag-c:var(--ink-3)">' +
    '<div class="mode-head"><span class="stage-tag">记录</span><h2>进度与数据</h2></div>' +
    '<div class="desc">每日题量、各档正确率、最常混淆的听错组合、数据导出' +
    (API.user ? '，云端自动同步' : '') + '。</div></button>';
  if(!API.offline){
    h += '<button class="mode-card" data-act="nav-sources" style="--tag-c:var(--accent-quality)">' +
      '<div class="mode-head"><span class="stage-tag">音源</span><h2>自定义音源</h2></div>' +
      '<div class="desc">上传你自己录的贝斯（或任何乐器）采样，标注音名后引擎就近变调铺满全音域，答题时可直接选用。' +
      (Samples.list.length ? ' 已有 ' + Samples.groups("bass").concat(Samples.groups("chord")).filter((v,i,a)=>a.indexOf(v)===i).length + ' 个音源。' : '') + '</div></button>';
  }
  h += '<div class="note-box">每天 10 到 15 分钟，远胜周末突击 2 小时。顺序建议：热身唱 2 分钟 → 当前主攻档位 10 分钟 → 性质听辨 2 分钟。每档过关线：近 ' + PASS_N + ' 题正确率 ' + pct(PASS_RATE) + '。</div>';
  return h;
}
function renderMode(){
  const m = MODES[S.modeKey];
  let h = '<div class="card" style="margin-bottom:12px"><div class="sub small">' + m.desc + '</div></div>';
  const firstUnpassed = m.levels.findIndex(lv=>!levelStat(lv.id).passed);
  h += m.levels.map((lv,i)=>{
    const st = levelStat(lv.id);
    return '<button class="level-btn" data-act="open-level" data-i="' + i + '">' +
      '<span class="lv-name">' + lv.name + '</span>' +
      (st.passed ? '<span class="badge-pass">已过关 ' + (st.passedOn||"") + '</span>' : (i === firstUnpassed ? '<span class="badge-rec">当前推荐</span>' : "")) +
      '<div class="lv-goal">' + lv.goal + '</div>' + levelMeterHtml(m, lv) + '</button>';
  }).join("");
  if(S.modeKey === "root"){
    const key = S.data.settings.random ? KEYS.find(k=>k.name==="E") : (KEYS.find(k=>k.name===S.data.settings.key)||KEYS[2]);
    h += '<hr class="divider"><h3>先熟悉声音（' + key.name + ' 大调）</h3><div class="sub small" style="margin-bottom:8px">先知道答案再练耳朵，是学习；上来就盲猜，是挫败感生成器。点着听几遍再进档位。</div><div class="opts narrow">' +
      ["1","2m","3m","4","5","6m"].map(d=>'<button class="opt" style="padding:10px" data-act="preview-deg" data-deg="' + d + '">' + d +
        '<span class="opt-sub">' + chordNameForDegree(key,d) + '</span></button>').join("") + '</div>';
  }
  if(S.modeKey === "quality"){
    h += '<hr class="divider"><h3>先熟悉五种颜色</h3><div class="sub small" style="margin-bottom:8px">在自己 bass 上也弹一遍：弹完唱，唱完听。</div><div class="opts narrow">' +
      [["maj","大三和弦","亮、开阔"],["min","小三和弦","暗、收拢"],["dom7","属七和弦","亮但躁"],["maj7","大七和弦","亮但飘"],["min7","小七和弦","暗但松弛"]].map(([v,l,s])=>
        '<button class="opt" style="padding:10px;font-size:15px" data-act="preview-q" data-q="' + v + '">' + l +
        '<span class="opt-sub">' + s + '</span></button>').join("") + '</div>';
  }
  if(S.modeKey === "pattern"){
    h += '<hr class="divider"><h3>套路图鉴</h3><div class="sub small" style="margin-bottom:8px">给每个套路配 3 首你熟的锚点歌，反复对照听。以后听到新歌先条件反射「是不是王道」，再核对细节。</div>';
    h += PATTERNS.map(p=>{
      return '<div class="dex-item"><div class="row">' +
        '<button class="playmini" data-act="dex-play" data-id="' + p.id + '">▶</button>' +
        '<div class="grow"><span class="deg">' + p.name + '</span> <span class="muted small">' + p.degText + '</span>' +
        '<div class="hint">' + esc(p.hint) + '</div></div></div>' +
        '<div class="anchor-row"><span class="tiny muted" style="flex:none">锚点歌</span>' +
        '<input type="text" placeholder="写下 3 首你熟的、用这个套路的歌" value="' + esc(S.data.anchors[p.id]||"") + '" data-set="anchor" data-id="' + p.id + '"></div></div>';
    }).join("");
  }
  return h;
}
function renderQuiz(){
  const m = MODES[S.modeKey], level = m.levels[S.levelIdx], q = S.q;
  const st = levelStat(level.id);
  const r = recent20Rate(st);
  let h = '<div class="quiz-head"><span class="small muted">' + level.name + '</span>' +
    '<div class="quiz-stats"><span>近' + PASS_N + ' <b>' + (r===null?"–":pct(r)) + '</b></span>' +
    '<span>连对 <b>' + st.streak + '</b></span><span>本档 <b>' + st.c + "/" + st.a + '</b></span>' +
    (st.passed ? '<span style="color:var(--good)">✓ 已过关</span>' : "") + '</div></div>';
  const dotN = q.dots ? q.dots.length : 0;
  h += '<div class="playzone" style="--mode-c:' + m.cssColor + '">' +
    '<button class="bigplay' + (S.playing?" playing":"") + '" id="bigplayBtn" data-act="replay" title="再听一遍（空格）">▶</button>' +
    '<div class="beat-dots" id="beatDots">' + Array.from({length:dotN},()=>'<span class="beat-dot"></span>').join("") + '</div>' +
    '<div class="play-caption" id="playCaption">' + q.idle + '</div>' +
    '<div class="replay-row"><button data-act="replay">再听 <span class="kbd">空格</span></button>' +
    '<button data-act="replay-slow">慢速再听</button></div></div>';
  const st2 = S.data.settings;
  const showCv = !(q.kind === "quality" && q.qNum === 1);
  const showMix = (q.kind !== "quality" && q.kind !== "variant");
  const showHi = q.kind === "root";
  {
    h += '<div class="row small" style="justify-content:center;gap:16px;margin:-4px 0 12px;color:var(--ink-3)">' +
      '<label style="display:flex;align-items:center;gap:5px">贝斯 ' + sourceSelect("bass", st2.bassVoice || "ks-bass", true) + '</label>' +
      (showCv ? '<label style="display:flex;align-items:center;gap:5px">和弦 ' + sourceSelect("chord", st2.chordVoice || "gtr", true) + '</label>' : "") +
      (showMix ? '<label title="每题随机换一个大调" style="display:flex;align-items:center;gap:5px"><input type="checkbox" data-set="random"'+(st2.random?" checked":"")+'> 打混调</label>' : "") +
      (showHi ? '<label title="目标音在当前、高、低三个八度里随机出现" style="display:flex;align-items:center;gap:5px"><input type="checkbox" data-set="hioct"'+(st2.rootHighOct?" checked":"")+'> 高八度</label>' : "") +
      ((showMix || showHi) ? '<span class="tiny">改动下一题生效</span>' : "") +
    '</div>';
  }
  const narrow = q.kind === "root" || q.kind === "quality";
  h += '<div class="opts' + (narrow?" narrow":"") + '">' + q.options.map((o,i)=>{
    let cls = "opt";
    if(S.answered){
      if(o.value === q.answerValue) cls += " correct";
      else if(i === S.chosenIdx) cls += " wrong";
      else cls += " dim";
    }
    const fs = (q.kind === "seq" || q.kind === "cadence" || q.kind === "outside") ? "font-size:14.5px;"
             : ((q.kind === "pattern" || q.kind === "variant") ? "font-size:15px;" : "");
    return '<button class="' + cls + '" style="' + fs + '" data-act="answer" data-i="' + i + '"' + (S.answered?" disabled":"") + '>' +
      '<span class="key-hint">' + (i+1) + '</span>' + esc(o.label) +
      (o.sub ? '<span class="opt-sub">' + esc(o.sub) + '</span>' : "") + '</button>';
  }).join("") + '</div>';
  if(S.answered && S.feedback){
    const f = S.feedback;
    h += '<div class="feedback ' + (f.ok?"ok":"no") + '" style="--mode-c:' + m.cssColor + '">' +
      '<div class="fb-title">' + (f.ok?"✓ ":"✕ ") + esc(f.title) + '</div>' +
      '<div class="fb-detail">' + f.detail + '</div>' +
      '<div class="fb-actions">' + f.actions.map(a=>'<button data-act="fb" data-fb="' + a.act + '">' + esc(a.label) + '</button>').join("") +
      '<button class="next" data-act="next">下一题 <span class="kbd" style="color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.35)">回车</span></button></div></div>';
  }
  h += '<div class="tiny muted" style="text-align:center">键盘：数字选答案 · 空格再听 · 回车下一题 · Esc 返回</div>';
  return h;
}
function renderWarmup(){
  const st = S.data.settings;
  const key = KEYS.find(k=>k.name===st.key) || KEYS[2];
  const tonic3 = 48 + key.pc;
  let h = '<div class="card" style="margin-bottom:12px"><div class="sub small">' +
    '放着 drone，对它唱<b>数字</b>：先唱再弹确认，唱不准的音程永远听不出来。前期一半时间在唱，不在听。<br>' +
    '过关标准：不看琴，能对着 drone 稳定唱准 1、3、4、5、6 之间的任意跳进。</div></div>';
  h += '<div class="drone-row"><button class="playmini" style="width:auto;padding:0 16px;border-radius:10px" data-act="drone">' +
    (S.droneOn ? "■ 停止 Drone" : "▶ 播放 Drone") + '</button>' +
    '<div class="grow small sub">持续音 <b>' + key.name + '</b>（在首页可换调）</div></div>';
  h += WARMUP_PATTERNS.map((p,i)=>{
    const segs = p.degs.map((d,j)=>'<span data-warm="' + i + '-' + j + '">' + (d===8?"1":(d<0?"低"+(-d):d)) + '</span>').join(" ");
    return '<div class="pattern-row"><button class="playmini" data-act="warm-play" data-i="' + i + '">▶</button>' +
      '<div class="grow"><div class="deg-seq" id="warmseq-' + i + '">' + segs + '</div>' +
      '<div class="why">' + p.name + ' · ' + p.why + '</div></div></div>';
  }).join("");
  h += '<div class="note-box" style="margin-top:12px">琴和嗓子互相校准：弹一个音接着唱出来；先唱一个音再在琴上找到它。这一页的参考音在 ' +
    key.name + '3 附近，觉得高就低八度唱。</div>';
  return h;
}
function renderProgress(){
  const days = S.data.days;
  const today = days[todayStr()] || {n:0,c:0};
  let totN = 0, totC = 0;
  Object.values(days).forEach(d=>{ totN += d.n; totC += d.c; });
  let h = '<div class="tiles">' +
    '<div class="tile"><div class="t-label">今日题数</div><div class="t-value">' + today.n + '</div><div class="t-note">' + (today.n?("正确率 " + pct(today.c/today.n)):"还没开始") + '</div></div>' +
    '<div class="tile"><div class="t-label">连续练习</div><div class="t-value">' + dayStreak() + '<span style="font-size:14px"> 天</span></div><div class="t-note">每天 10 到 15 分钟就算数</div></div>' +
    '<div class="tile"><div class="t-label">累计题数</div><div class="t-value">' + totN + '</div><div class="t-note">' + Object.keys(days).length + ' 个练习日</div></div>' +
    '<div class="tile"><div class="t-label">总正确率</div><div class="t-value">' + (totN?pct(totC/totN):"–") + '</div><div class="t-note">过关线 ' + pct(PASS_RATE) + '</div></div></div>';
  for(const mk of ["root","quality","pattern"]){
    const m = MODES[mk];
    h += '<div class="prog-section card" style="margin-bottom:12px"><h3>' + m.stage + ' · ' + m.name + '</h3>' +
      m.levels.map(lv=>{
        const st = levelStat(lv.id);
        return '<div style="margin-top:10px"><div class="small sub">' + lv.name +
          (st.passed?' <span class="badge-pass">已过关</span>':"") +
          ' <span class="tiny muted">最长连对 ' + st.best + '</span></div>' + levelMeterHtml(m, lv) + '</div>';
      }).join("") + '</div>';
  }
  const confRows = [];
  const secName = {root:"根音", q:"性质", p:"套路"};
  Object.entries(S.data.conf).forEach(([sec,map])=>{
    Object.entries(map).forEach(([k,v])=> confRows.push({sec:secName[sec]||sec, k, v}));
  });
  confRows.sort((a,b)=>b.v-a.v);
  h += '<div class="prog-section card"><h3>最常混淆</h3>';
  h += confRows.length ? confRows.slice(0,6).map(r=>'<div class="conf-item"><span>' + r.sec + '：把 ' + esc(r.k) + '</span><span class="muted">' + r.v + ' 次</span></div>').join("")
    : '<div class="small muted">还没有听错记录。</div>';
  h += '</div>';
  h += '<div class="prog-section card"><h3>数据</h3><div class="small muted" style="margin:6px 0 10px">' +
    (store.ok ? "进度自动保存在这台设备的浏览器里。" : "当前打开方式不支持本地自动保存，进度只在本次打开期间有效，记得导出备份。") +
    (API.user ? " 已登录 " + esc(API.user.username) + "，答题后自动同步到服务器，换设备登录即可续上。"
              : (API.offline ? " 换设备时用导出/导入迁移。" : " 登录账号后可自动同步到服务器（右上角「登录」）。")) +
    '</div><div class="row" style="margin-bottom:8px">' +
    '<button data-act="export">导出到文本框</button><button data-act="import">从文本框导入</button>' +
    '<button data-act="reset" style="color:var(--bad)">' + (S.resetArmed?"再点一次确认清空":"清空全部进度") + '</button></div>' +
    '<textarea id="ioArea" placeholder="导出的进度会出现在这里；导入时把之前导出的文本粘贴到这里">' + esc(S.ioText) + '</textarea>' +
    (S.ioMsg ? '<div class="small" style="margin-top:6px;color:var(--accent)">' + esc(S.ioMsg) + '</div>' : "") + '</div>';
  return h;
}
/* ---------------- 账号界面 ---------------- */
function authInput(id, ph, type){
  return '<input type="' + type + '" id="' + id + '" placeholder="' + ph + '" ' +
    'style="width:100%;margin-bottom:10px" autocomplete="off">';
}
function renderAuth(){
  if(API.user){
    return '<div class="card" style="max-width:440px;margin:26px auto">' +
      '<h2 style="margin-bottom:10px">账号</h2>' +
      '<div class="sub small">用户名：<b>' + esc(API.user.username) + '</b><br>邮箱：' + esc(API.user.email) + '</div>' +
      '<div class="small" style="margin-top:10px">云同步：<span id="syncState" style="color:var(--accent)">' + syncStateText() + '</span></div>' +
      '<div class="row" style="margin-top:14px"><button data-act="auth-syncnow">立即同步</button>' +
      '<button data-act="auth-logout" style="color:var(--bad)">退出登录</button></div>' +
      '<div class="note-box" style="margin-top:14px">答题后约 1 秒自动同步；换设备登录同一账号即可续上进度和自定义音源。</div></div>';
  }
  const tab = S.authTab || "login";
  const tabBtn = (id, label) => '<button data-act="auth-tab" data-tab="' + id + '" style="flex:1;' +
    (tab === id ? 'border-color:var(--accent);color:var(--ink)' : 'color:var(--ink-3)') + '">' + label + '</button>';
  let form = "";
  if(tab === "login"){
    form = authInput("f-account", "用户名或邮箱", "text") + authInput("f-pass", "密码", "password") +
      '<button data-act="auth-login" style="width:100%;background:var(--accent);border-color:transparent;font-weight:600">登录</button>';
  }else if(tab === "reg"){
    if(S.authStep === "code"){
      form = '<div class="sub small" style="margin-bottom:10px">验证码已发往 <b>' + esc(S.authEmail || "") + '</b>' +
        '<br><span class="muted">本地未配置邮件服务时，验证码打印在运行 npm start 的那个终端里。</span></div>' +
        authInput("f-code", "6 位验证码", "text") +
        '<div class="row"><button data-act="auth-verify" style="flex:1;background:var(--accent);border-color:transparent;font-weight:600">完成验证</button>' +
        '<button data-act="auth-resend">重发</button></div>';
    }else{
      form = authInput("f-user", "用户名（2 到 24 字符）", "text") +
        authInput("f-email", "邮箱", "email") +
        authInput("f-pass2", "密码（至少 6 位）", "password") +
        '<button data-act="auth-reg" style="width:100%;background:var(--accent);border-color:transparent;font-weight:600">发送验证码并注册</button>';
    }
  }else{
    if(S.authStep === "code"){
      form = '<div class="sub small" style="margin-bottom:10px">验证码已发往 <b>' + esc(S.authEmail || "") + '</b></div>' +
        authInput("f-code", "6 位验证码", "text") +
        '<div class="row"><button data-act="auth-logincode" style="flex:1;background:var(--accent);border-color:transparent;font-weight:600">登录</button>' +
        '<button data-act="auth-resend-login">重发</button></div>';
    }else{
      form = authInput("f-email", "注册时用的邮箱", "email") +
        '<button data-act="auth-sendlogincode" style="width:100%">发送登录验证码</button>';
    }
  }
  return '<div class="card" style="max-width:440px;margin:26px auto">' +
    '<div class="row" style="margin-bottom:14px;gap:8px">' + tabBtn("login","密码登录") + tabBtn("code","验证码登录") + tabBtn("reg","注册") + '</div>' +
    form +
    (S.authMsg ? '<div class="small" style="margin-top:10px;color:' + (S.authErr ? "var(--bad)" : "var(--accent)") + '">' + esc(S.authMsg) + '</div>' : "") +
    '<div class="note-box" style="margin-top:14px">账号用于跨设备同步进度和保存自定义音源。不登录也能正常练，进度存在本机浏览器里。</div></div>';
}

/* ---------------- 自定义音源界面 ---------------- */
function renderSources(){
  if(!API.user){
    return '<div class="card" style="text-align:center;padding:28px;max-width:440px;margin:26px auto">' +
      '<div class="sub">自定义音源保存在你的账号里，先登录再上传。</div>' +
      '<button style="margin-top:14px" data-act="nav-auth">去登录 / 注册</button></div>';
  }
  const noteOpts = [];
  for(let m = 28; m <= 64; m++) noteOpts.push('<option value="' + m + '"' + (m === 40 ? ' selected' : '') + '>' + noteNameOct(m) + '</option>');
  const allNames = [...new Set(Samples.list.map(s => s.name))];
  let h = '<div class="card" style="margin-bottom:12px"><h3>上传采样</h3>' +
    '<div class="sub small" style="margin-bottom:10px">录一个干净的单音（wav / mp3 等），标注它的音名。同一个音源名可以传多个音，播放时就近变调；低中高各录一个，音质就很稳。</div>' +
    '<div class="row" style="gap:10px">' +
    '<input type="text" id="f-srcname" placeholder="音源名（如 我的P-Bass）" list="srcNames" style="flex:1;min-width:150px">' +
    '<datalist id="srcNames">' + allNames.map(n => '<option value="' + esc(n) + '">').join("") + '</datalist>' +
    '<select id="f-srcrole"><option value="any">贝斯和和弦都可用</option><option value="bass">仅作贝斯音色</option><option value="chord">仅作和弦音色</option></select>' +
    '<label class="small muted">这个音是 <select id="f-srcroot">' + noteOpts.join("") + '</select></label>' +
    '</div><div class="row" style="margin-top:10px;gap:10px">' +
    '<input type="file" id="f-srcfile" accept="audio/*" style="flex:1">' +
    '<button data-act="src-upload">上传</button></div>' +
    (S.srcMsg ? '<div class="small" style="margin-top:8px;color:var(--accent)">' + esc(S.srcMsg) + '</div>' : "") + '</div>';
  if(!allNames.length){
    h += '<div class="note-box">还没有采样。建议第一步：录你贝斯的空弦 E1、A1、D2、G2 各一个音传上来，然后在任意答题页把「贝斯」音色切成它。</div>';
  }
  for(const n of allNames){
    const rows = Samples.groupSamples(n);
    h += '<div class="dex-item"><div class="row"><div class="grow"><span class="deg">' + esc(n) + '</span> ' +
      '<span class="muted small">' + rows.length + ' 个采样 · ' + ({any:"贝斯/和弦通用", bass:"仅贝斯", chord:"仅和弦"}[rows[0].role] || "") + '</span></div></div>' +
      rows.map(s => '<div class="row" style="margin-top:8px;padding-left:4px">' +
        '<button class="playmini" data-act="src-prev" data-id="' + s.id + '">▶</button>' +
        '<span class="small sub" style="width:56px">' + noteNameOct(s.rootMidi) + '</span>' +
        '<span class="grow"></span>' +
        '<button style="color:var(--bad);font-size:12px;padding:5px 10px" data-act="src-del" data-id="' + s.id + '">删除</button></div>').join("") +
      '</div>';
  }
  return h;
}

function render(){
  const el = document.getElementById("app");
  let body = "";
  switch(S.screen){
    case "home": body = renderHome(); break;
    case "mode": body = renderMode(); break;
    case "quiz": body = renderQuiz(); break;
    case "warmup": body = renderWarmup(); break;
    case "progress": body = renderProgress(); break;
    case "auth": body = renderAuth(); break;
    case "sources": body = renderSources(); break;
  }
  el.innerHTML = renderTopbar() + body;
}

/* ================================================================
   事件
   ================================================================ */
function goBack(){
  AE.stopAll();
  S.droneOn = false;
  if(S.screen === "quiz"){ S.screen = "mode"; }
  else { S.screen = "home"; }
  S.q = null; S.answered = false; S.ioMsg = ""; S.resetArmed = false;
  render();
}
document.addEventListener("click", e=>{
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const act = btn.dataset.act;
  if(act === "back"){ goBack(); return; }
  if(act === "nav-mode"){ AE.stopAll(); S.modeKey = btn.dataset.mode; S.screen = "mode"; render(); return; }
  if(act === "nav-warmup"){ S.screen = "warmup"; render(); return; }
  if(act === "nav-progress"){ S.screen = "progress"; S.ioText=""; S.ioMsg=""; render(); return; }
  if(act === "nav-auth"){ S.screen = "auth"; S.authMsg=""; S.authErr=false; render(); return; }
  if(act === "nav-sources"){ S.screen = "sources"; S.srcMsg=""; render(); return; }
  if(act.startsWith("auth-")){ handleAuth(act, btn); return; }
  if(act.startsWith("src-")){ handleSources(act, btn); return; }
  if(act === "open-level"){
    S.levelIdx = parseInt(btn.dataset.i,10); S.screen = "quiz";
    AE.ensure(); genQuestion(); render(); playCurrent(false); return;
  }
  if(act === "answer"){ submitAnswer(parseInt(btn.dataset.i,10)); return; }
  if(act === "next"){ AE.ensure(); genQuestion(); render(); playCurrent(false); return; }
  if(act === "replay"){ AE.ensure(); playCurrent(false); return; }
  if(act === "replay-slow"){ AE.ensure(); playCurrent(true); return; }
  if(act === "fb"){ AE.ensure(); runFeedbackAction(btn.dataset.fb); return; }
  if(act === "preview-deg"){
    AE.ensure();
    const key = S.data.settings.random ? KEYS.find(k=>k.name==="E") : (KEYS.find(k=>k.name===S.data.settings.key)||KEYS[2]);
    const b = buildRootQuestion(key, btn.dataset.deg);
    AE.play(b.events.filter(ev=>ev.t>=2.4).map(ev=>({...ev, t:ev.t-2.5})), {bpm:S.data.settings.bpm});
    return;
  }
  if(act === "preview-q"){
    AE.ensure();
    const b = buildQualityQuestion(2, btn.dataset.q);
    AE.play(b.events, {bpm:S.data.settings.bpm}); return;
  }
  if(act === "dex-play"){
    AE.ensure();
    const pat = PATTERNS.find(p=>p.id === btn.dataset.id);
    const key = S.data.settings.random ? KEYS.find(k=>k.name==="E") : (KEYS.find(k=>k.name===S.data.settings.key)||KEYS[2]);
    const prog = buildProgression(key, pat.steps);
    AE.play(prog.events, {bpm:S.data.settings.bpm}); return;
  }
  if(act === "drone"){
    AE.ensure();
    const key = KEYS.find(k=>k.name===S.data.settings.key) || KEYS[2];
    const tonic3 = 48 + key.pc;
    S.droneOn = AE.toggleDrone(tonic3-24, tonic3-12);
    render(); return;
  }
  if(act === "warm-play"){
    AE.ensure();
    const i = parseInt(btn.dataset.i,10);
    const key = KEYS.find(k=>k.name===S.data.settings.key) || KEYS[2];
    const tonic3 = 48 + key.pc;
    const p = WARMUP_PATTERNS[i];
    const ev = [], marks = [];
    p.degs.forEach((d,j)=>{
      const semi = d===8 ? 12 : (d<0 ? MAJOR_SCALE[(-d)-1]-12 : MAJOR_SCALE[d-1]);
      ev.push({t:j, dur:0.92, midi:tonic3+semi, voice:"tone", vel:0.9});
      marks.push({t:j, fn:()=>{
        document.querySelectorAll('#warmseq-'+i+' span').forEach((s,k)=> s.classList.toggle("cur", k===j));
      }});
    });
    AE.play(ev, {bpm:66, marks, onEnd:()=> document.querySelectorAll('#warmseq-'+i+' span').forEach(s=>s.classList.remove("cur"))});
    return;
  }
  if(act === "export"){
    S.ioText = JSON.stringify(S.data); S.ioMsg = "已导出，全选复制保存到备忘录即可。"; render(); return;
  }
  if(act === "import"){
    const ta = document.getElementById("ioArea");
    try{
      const d = JSON.parse(ta.value);
      if(!d || typeof d !== "object" || !d.v) throw new Error("bad");
      S.data = Object.assign(defaultData(), d, {settings:Object.assign(defaultData().settings, d.settings||{})});
      saveData(); S.ioText = ta.value; S.ioMsg = "导入成功。"; render();
    }catch(err){ S.ioText = ta.value; S.ioMsg = "导入失败：这段文本不是有效的进度数据。"; render(); }
    return;
  }
  if(act === "reset"){
    if(!S.resetArmed){ S.resetArmed = true; render(); setTimeout(()=>{ if(S.resetArmed){ S.resetArmed=false; if(S.screen==="progress") render(); } }, 3000); }
    else { const st = S.data.settings; S.data = defaultData(); S.data.settings = st; saveData(); S.resetArmed = false; S.ioText=""; S.ioMsg="已清空。"; render(); }
    return;
  }
});
/* ---------------- 账号与音源的异步动作 ---------------- */
const $v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
function authMsg(msg, isErr){ S.authMsg = msg || ""; S.authErr = !!isErr; render(); }
async function handleAuth(act, btn){
  if(act === "auth-tab"){ S.authTab = btn.dataset.tab; S.authStep = "form"; authMsg(""); return; }
  if(act === "auth-logout"){
    await API.logout(); API.user = null; Samples.setList([]); S.syncState = null;
    S.screen = "home"; render(); return;
  }
  if(act === "auth-syncnow"){ await doSync(); const el = document.getElementById("syncState"); if(el) el.textContent = syncStateText(); return; }
  if(act === "auth-login"){
    const r = await API.login($v("f-account"), document.getElementById("f-pass").value);
    if(r.ok){ API.user = r.user; await afterLogin(); S.screen = "home"; render(); }
    else if(r.needVerify){ S.authTab = "reg"; S.authStep = "code"; S.authEmail = r.email; authMsg(r.error, true); }
    else authMsg(r.error || "登录失败", true);
    return;
  }
  if(act === "auth-reg"){
    const email = $v("f-email");
    const r = await API.register($v("f-user"), email, document.getElementById("f-pass2").value);
    if(r.ok){ S.authStep = "code"; S.authEmail = email; authMsg(r.hint || "验证码已发送"); }
    else authMsg(r.error || "注册失败", true);
    return;
  }
  if(act === "auth-verify"){
    const r = await API.verify(S.authEmail, $v("f-code"));
    if(r.ok){ API.user = r.user; await afterLogin(); S.screen = "home"; render(); }
    else authMsg(r.error || "验证失败", true);
    return;
  }
  if(act === "auth-resend"){
    const r = await API.requestCode(S.authEmail, "verify");
    authMsg(r.ok ? (r.hint || "已重发") : r.error, !r.ok); return;
  }
  if(act === "auth-sendlogincode"){
    const email = $v("f-email");
    const r = await API.requestCode(email, "login");
    if(r.ok){ S.authEmail = email; S.authStep = "code"; authMsg(r.hint || "验证码已发送"); }
    else authMsg(r.error || "发送失败", true);
    return;
  }
  if(act === "auth-resend-login"){
    const r = await API.requestCode(S.authEmail, "login");
    authMsg(r.ok ? (r.hint || "已重发") : r.error, !r.ok); return;
  }
  if(act === "auth-logincode"){
    const r = await API.loginCode(S.authEmail, $v("f-code"));
    if(r.ok){ API.user = r.user; await afterLogin(); S.screen = "home"; render(); }
    else authMsg(r.error || "登录失败", true);
    return;
  }
}
async function handleSources(act, btn){
  if(act === "src-upload"){
    const fileEl = document.getElementById("f-srcfile");
    const name = $v("f-srcname"), role = $v("f-srcrole"), root = parseInt($v("f-srcroot"), 10);
    if(!name){ S.srcMsg = "先给音源起个名字"; render(); return; }
    if(!fileEl.files[0]){ S.srcMsg = "先选择一个音频文件"; render(); return; }
    const fd = new FormData();
    fd.append("name", name); fd.append("role", role); fd.append("rootMidi", root);
    fd.append("file", fileEl.files[0]);
    S.srcMsg = "上传中…"; render();
    const r = await API.uploadSample(fd);
    if(r.ok){
      const ls = await API.listSamples();
      if(ls.samples) Samples.setList(ls.samples);
      S.srcMsg = "已上传：" + name + " · " + noteNameOct(root);
    }else S.srcMsg = r.error || "上传失败";
    render(); return;
  }
  if(act === "src-prev"){
    const s = Samples.list.find(x => x.id === parseInt(btn.dataset.id, 10));
    if(!s) return;
    AE.ensure();
    await Samples.preload(s.name);
    AE.stopAll(true);
    AE.group = AE.ctx.createGain(); AE.group.connect(AE.master);
    AE.sample(AE.group, AE.ctx.currentTime + 0.05, 1.8, s.rootMidi, 1, s.name);
    return;
  }
  if(act === "src-del"){
    const r = await API.deleteSample(parseInt(btn.dataset.id, 10));
    if(r.ok){
      const ls = await API.listSamples();
      Samples.setList(ls.samples || []);
    }else S.srcMsg = r.error || "删除失败";
    render(); return;
  }
}

document.addEventListener("change", e=>{
  const el = e.target.closest("[data-set]");
  if(!el) return;
  const st = S.data.settings;
  switch(el.dataset.set){
    case "key": st.key = el.value; break;
    case "random": st.random = el.checked; break;
    case "bpm": st.bpm = parseInt(el.value,10); break;
    case "cvoice": st.chordVoice = el.value; if(el.value.startsWith("custom:")) Samples.preload(el.value.slice(7)); break;
    case "bvoice": st.bassVoice = el.value; if(el.value.startsWith("custom:")) Samples.preload(el.value.slice(7)); break;
    case "hioct": st.rootHighOct = el.checked; break;
    case "vol": st.vol = parseFloat(el.value); AE.setVol(st.vol); break;
    case "anchor": S.data.anchors[el.dataset.id] = el.value.trim(); break;
  }
  saveData();
  if(el.dataset.set === "key" || el.dataset.set === "random") render();
});
document.addEventListener("keydown", e=>{
  if(e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
  if(S.screen !== "quiz"){ if(e.key === "Escape" && S.screen !== "home") goBack(); return; }
  if(e.key === "Escape"){ goBack(); return; }
  if(e.key === " "){ e.preventDefault(); AE.ensure(); playCurrent(false); return; }
  if(e.key === "Enter"){ if(S.answered){ AE.ensure(); genQuestion(); render(); playCurrent(false); } return; }
  const n = parseInt(e.key,10);
  if(!isNaN(n) && n >= 1 && S.q && n <= S.q.options.length && !S.answered){ submitAnswer(n-1); }
});

/* ---------------- 启动：先渲染，再恢复登录态与云端数据 ---------------- */
render();
(async function init(){
  if(API.offline) return;
  const r = await API.me();
  if(r && r.user){
    API.user = r.user;
    await afterLogin();
    if(!S.syncState) S.syncState = "ok";
  }
  render();
})();
