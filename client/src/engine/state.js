"use strict";
/* 应用状态、持久化、计分与出题调度。
   这些函数原本都定义在旧版 public/js/app.js 里（状态 S、本地存储、云同步、recordAnswer、
   genQuestion/startQuestion/submitAnswer/buildFeedback 等），只是和 app.js 里"把 HTML 拼成字符串
   塞进 #app"的渲染代码写在同一个文件里。迁移时把渲染部分留给 React（步骤 3 起），只把这部分
   状态/计分/持久化/出题调度原样搬到这里 —— 因为 fret.js、th-engine.js 等引擎文件在运行时需要
   调用 S、recordAnswer、levelStat、saveData、render、startQuestion 等，必须先有这一层才能独立
   成为可 import 的模块。算法与行为保持原样，没有新增或删减逻辑。 */

import { API } from "./api.js";
import {
  DEGREES, NOTE_NAMES, PATTERNS, SEQ_POOL, CADENCE_POOL, OUTSIDE_POOL, OUTSIDE_CATS,
  OUTSIDE_RULE, QUALITY_INFO, KEYS, MODES, PASS_N, PASS_RATE, seqDistractors
} from "./theory.js";
import {
  AE, Samples, buildRootQuestion, buildProgression, buildQualityQuestion, qualityCompareEvents,
  concatProgs, keyObj, bassTonic, nearestSemi, foldBass, noteName, noteNameOct
} from "./audio.js";
import { fretMigrate, isFretLevel, levelRtLimit, medianRT, isFretMode, genFretQuestion, fretSubmitOption } from "./fret.js";
import { isTheoryMode, thGenQuestion, thConfVerb, thSubmit } from "./th-engine.js";

/* ================================================================
   渲染钩子：原来的全局 render() 会把 #app 整个重新拼成 HTML。
   React 化之后由 React 自己负责重渲染，这里只留一个可替换的钩子，
   让仍然调用 render() 的旧引擎代码（fret.js/th-engine.js 的事件处理里）不报错。
   ================================================================ */
let _renderHook = () => {};
export function render(){ _renderHook(); }
export function setRenderer(fn){ _renderHook = fn || (()=>{}); }

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
export { store };
export function defaultData(){
  return {v:1, days:{}, levels:{}, conf:{}, anchors:{}, lessons:{},
          settings:{key:"E", random:false, bpm:100, vol:0.8, chordVoice:"gtr", bassVoice:"smp-bass", rootHighOct:false,
                    fretStrings:5, fretTuning:"BEADG", fretCustom:{}, fretTuneV:2, fretKey:"C", fretSound:true}};
}
export function loadData(){
  try{
    const raw = store.get(DATA_KEY);
    if(raw){
      const d = JSON.parse(raw);
      const merged = Object.assign(defaultData(), d, {settings:fretMigrate(Object.assign(defaultData().settings, d.settings||{}, {fretTuneV:(d.settings||{}).fretTuneV||0}))});
      // 一次性迁移：把老默认的建模贝斯升级为采样电贝斯（用户之后仍可手动选回）
      if(!merged.settings.srcMigrated){
        if(merged.settings.bassVoice === "ks-bass") merged.settings.bassVoice = "smp-bass";
        merged.settings.srcMigrated = 1;
      }
      return merged;
    }
  }catch(e){}
  return defaultData();
}
export function saveData(){ try{ store.set(DATA_KEY, JSON.stringify(S.data)); }catch(e){} scheduleSync(); }

/* ---------------- 云同步（登录后进度双写：本地 + 服务器，防抖 1.2s） ---------------- */
let syncTimer = null;
export function scheduleSync(){
  if(!API.user) return;
  S.syncState = "dirty";
  clearTimeout(syncTimer);
  syncTimer = setTimeout(doSync, 1200);
}
export async function doSync(){
  if(!API.user) return;
  S.syncState = "saving";
  const r = await API.putProgress(S.data);
  S.syncState = (r && r.ok) ? "ok" : "err";
  const el = document.getElementById("syncState");
  if(el) el.textContent = syncStateText();
}
export function syncStateText(){
  return {dirty:"有改动待同步…", saving:"同步中…", ok:"已同步到云端", err:"同步失败（会自动重试）"}[S.syncState] || "已连接";
}
export async function afterLogin(){
  const pr = await API.getProgress();
  if(pr && pr.data){
    S.data = Object.assign(defaultData(), pr.data,
      {settings: fretMigrate(Object.assign(defaultData().settings, pr.data.settings || {}, {fretTuneV:(pr.data.settings||{}).fretTuneV||0}))});
    if(!S.data.settings.srcMigrated){
      if(S.data.settings.bassVoice === "ks-bass") S.data.settings.bassVoice = "smp-bass";
      S.data.settings.srcMigrated = 1;
    }
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
export function todayStr(){ const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
export function levelStat(id){
  if(!S.data.levels[id]) S.data.levels[id] = {a:0,c:0,streak:0,best:0,recent:[],passed:false};
  return S.data.levels[id];
}
export function recent20Rate(st){ if(!st.recent.length) return null; return st.recent.reduce((x,y)=>x+y,0)/st.recent.length; }
export function recordAnswer(levelId, correct, chosen, ms){
  const ok = (correct === chosen);
  const st = levelStat(levelId);
  st.a++; if(ok) st.c++;
  st.streak = ok ? st.streak+1 : 0;
  st.best = Math.max(st.best, st.streak);
  st.recent.push(ok?1:0); if(st.recent.length > PASS_N) st.recent.shift();
  // 反应时间（指板档）：只记答对的题，过关还要求近 20 题中位用时不超过目标
  if(ok && ms > 0){ st.rt = st.rt || []; st.rt.push(Math.round(ms)); if(st.rt.length > PASS_N) st.rt.shift(); }
  const rtLim = levelRtLimit(levelId);
  const rtOk = !rtLim || (medianRT(st) !== null && medianRT(st) <= rtLim);
  if(!st.passed && st.recent.length >= PASS_N && recent20Rate(st) >= PASS_RATE && rtOk){ st.passed = true; st.passedOn = todayStr(); }
  const day = S.data.days[todayStr()] || (S.data.days[todayStr()] = {n:0,c:0});
  day.n++; if(ok) day.c++;
  if(!ok){
    const cf = S.data.conf[levelId.split("-")[0]] || (S.data.conf[levelId.split("-")[0]] = {});
    const kk = correct + ((typeof thConfVerb === "function" && thConfVerb(levelId)) || (isFretLevel(levelId) ? " 认成 " : " 听成 ")) + chosen;
    cf[kk] = (cf[kk]||0) + 1;
  }
  saveData();
  return ok;
}
export function dayStreak(){
  const fmt = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const d = new Date();
  const has = ()=> S.data.days[fmt(d)] && S.data.days[fmt(d)].n > 0;
  if(!has()) d.setDate(d.getDate()-1);  // 今天还没练就从昨天开始数
  let n = 0;
  while(has()){ n++; d.setDate(d.getDate()-1); }
  return n;
}

/* ================================================================
   应用状态与渲染辅助（原 app.js 的 S / esc / pct / setCaption 等）
   ================================================================ */
export const S = {
  screen:"home", modeKey:null, levelIdx:0,
  q:null, answered:false, feedback:null, chosenIdx:-1,
  lastQ:{}, lastDeg:{}, playing:false, droneOn:false,
  ioText:"", ioMsg:"", resetArmed:false,
  data: loadData()
};

export function esc(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
export function pct(r){ return Math.round(r*100) + "%"; }
export function setCaption(t){ const el = document.getElementById("playCaption"); if(el) el.textContent = t; }
export function setDot(i){ const el = document.getElementById("beatDots"); if(!el) return;
  [...el.children].forEach((c,j)=> c.classList.toggle("on", j<=i)); }
export function clearDots(){ const el = document.getElementById("beatDots"); if(el) [...el.children].forEach(c=>c.classList.remove("on")); }
export function setPlaying(b){ S.playing = b; const el = document.getElementById("bigplayBtn"); if(el) el.classList.toggle("playing", b); }

export function chordNameForDegree(key, degKey){
  const d = DEGREES[degKey];
  const pc = ((key.pc + d.semi) % 12 + 12) % 12;
  const suf = {maj:"", min:"m", dom7:"7", maj7:"maj7", min7:"m7"}[d.q] || "";
  return NOTE_NAMES[pc] + suf;
}
export function patternChordNames(key, pat){
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
export function seqToSteps(seq){
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
export function pickAvoid(arr, levelId, keyFn){
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
export const DEG_WEIGHTS = {"5":2.2, "6m":2.2};
export function degCandidates(deg, key, hi){
  const tb = bassTonic(key.pc);
  const inRange = m => m >= 26 && m <= 54;
  if(deg === "1"){
    const c = [tb-12, tb+12].filter(inRange);
    return c.length ? c : [tb+12];
  }
  const p0 = foldBass(tb + nearestSemi(DEGREES[deg].semi));
  return (hi ? [p0-12, p0, p0+12] : [p0]).filter(inRange);
}
export function genDegTarget(level, key){
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
export const VARIANT_DESC = {"8ths":"八分根音", "half":"全音符铺底", "root5":"根五交替"};
export function genQuestion(){
  const mode = MODES[S.modeKey], level = mode.levels[S.levelIdx];
  const kind = level.kind;
  const key = keyObj();
  S.answered = false; S.feedback = null; S.chosenIdx = -1;
  if(isTheoryMode(S.modeKey)){ thGenQuestion(); return; }
  if(isFretMode(S.modeKey)){ genFretQuestion(); return; }
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
export function startQuestion(){
  genQuestion(); render();
  if(!(S.q && S.q.noAutoPlay)) playCurrent(false);
}
export function playCurrent(slow){
  const q = S.q; if(!q || !q.events || !q.events.length) return;
  const bpm = (S.data.settings.bpm || 100) * (slow ? 0.72 : 1);
  const marks = [];
  (q.caps||[]).forEach(c=> marks.push({t:c.t, fn:()=> setCaption(c.text)}));
  (q.dots||[]).forEach(d=> marks.push({t:d.t, fn:()=> setDot(d.i)}));
  AE.play(q.events, {bpm, marks, onEnd:()=>{ setCaption(q.idle); clearDots(); }});
  if(q.caps && q.caps.length) setCaption(q.caps[0].text); else setCaption("播放中…");
}
export function playAdhoc(events, caps, bpm){
  const marks = (caps||[]).map(c=>({t:c.t, fn:()=> setCaption(c.text)}));
  AE.play(events, {bpm: bpm || S.data.settings.bpm || 100, marks, onEnd:()=> setCaption(S.q ? S.q.idle : "")});
}

/* ---------------- 作答与讲解 ---------------- */
export function submitAnswer(i){
  const q = S.q; if(!q || S.answered) return;
  if(q.theory){ thSubmit(i); return; }
  if(q.fret){ fretSubmitOption(i); return; }
  const opt = q.options[i]; if(!opt) return;
  S.chosenIdx = i;
  const correctLabel = q.options.find(o=>o.value===q.answerValue).label;
  const ok = recordAnswer(q.level.id, correctLabel, opt.label);
  S.answered = true;
  S.feedback = buildFeedback(q, opt, ok);
  render();
}
export function buildFeedback(q, chosen, ok){
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
export function runFeedbackAction(act){
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
