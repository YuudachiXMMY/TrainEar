"use strict";
/* 音频引擎：Karplus-Strong 电贝斯/电吉他、合成贝斯、EP 键盘、自定义采样、乐句生成 */

/* ---------------- 内置采样电贝斯 ----------------
   Karoryfer「Black And Blue Basses」(CC0)，dark black 贝斯常规拨奏 mf 层，
   逐半音真采样 + 双 round robin。文件名 = 实际发声 MIDI（原库标记高一个八度已换算）。
   MIDI 48 是原库空档，由 47 就近变调补。 */
const BuiltinBass = {
  base: "samples/bass/",
  notes: (()=>{ const a=[]; for(let m=25;m<=54;m++) if(m!==48) a.push(m); return a; })(),
  rr: 2,
  buffers: {},   // "midi_rr" -> AudioBuffer | "loading" | "failed"
  seq: {},       // midi -> 上次用的 rr（轮换让重复音更真实）
  key(m, r){ return m + "_" + r; },
  nearest(midi){
    let best = null, bd = 1e9;
    for(const n of this.notes){ const d = Math.abs(n - midi); if(d < bd){ bd = d; best = n; } }
    return best;
  },
  async load(root){
    if(location.protocol === "file:") return;   // 离线模式无法 fetch，走 KS 回退
    const ctx = AE.ensure();
    await Promise.all([1,2].map(async r=>{
      const k = this.key(root, r);
      if(this.buffers[k]) return;
      this.buffers[k] = "loading";
      try{
        const resp = await fetch(this.base + k + ".mp3");
        if(!resp.ok) throw new Error(String(resp.status));
        this.buffers[k] = await ctx.decodeAudioData(await resp.arrayBuffer());
      }catch(e){ this.buffers[k] = "failed"; }
    }));
  },
  preloadAll(){ this.notes.forEach(n => this.load(n)); }
};

/* ---------------- 自定义采样音源（同名多条 = 多采样音区，就近变调） ---------------- */
const Samples = {
  list: [],        // [{id, name, role, rootMidi, url}]
  buffers: {},     // id -> AudioBuffer
  setList(l){ this.list = l || []; this.buffers = {}; },
  groups(role){
    const names = [];
    for(const s of this.list){
      if((s.role === "any" || s.role === role) && !names.includes(s.name)) names.push(s.name);
    }
    return names;
  },
  groupSamples(name){ return this.list.filter(s => s.name === name); },
  async preload(name){
    const ctx = AE.ensure();
    await Promise.all(this.groupSamples(name).map(async s => {
      if(this.buffers[s.id]) return;
      try{
        const r = await fetch(s.url, { credentials: "same-origin" });
        if(!r.ok) return;
        const ab = await r.arrayBuffer();
        this.buffers[s.id] = await ctx.decodeAudioData(ab);
      }catch(e){}
    }));
  },
  nearestLoaded(name, midi){
    let best = null, bd = 1e9;
    for(const s of this.groupSamples(name)){
      if(!this.buffers[s.id]) continue;
      const d = Math.abs(s.rootMidi - midi);
      if(d < bd){ bd = d; best = s; }
    }
    return best;
  }
};
/* ================================================================
   音频引擎（Web Audio 合成，无外部采样）
   ================================================================ */
const AE = {
  ctx:null, master:null, group:null, timers:[], droneGroup:null,
  ensure(){
    if(!this.ctx){
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 6;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      this.master = this.ctx.createGain();
      this.master.gain.value = (S.data.settings.vol ?? 0.8);
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if(this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  setVol(v){ if(this.master) this.master.gain.value = v; },
  midiHz(m){ return 440 * Math.pow(2,(m-69)/12); },

  stopAll(keepDrone){
    if(this.group){ try{ this.group.disconnect(); }catch(e){} this.group = null; }
    this.timers.forEach(clearTimeout); this.timers = [];
    if(!keepDrone) this.stopDrone();
    setPlaying(false);
  },

  /* --- Karplus-Strong 拨弦合成：electric bass 与 clean 电吉他共用 --- */
  ksCache:{}, _shaperCurve:null,
  ks(midi, profile){
    const sr = this.ctx.sampleRate;
    const cacheKey = midi + "|" + profile + "|" + sr;
    if(this.ksCache[cacheKey]) return this.ksCache[cacheKey];
    const f = this.midiHz(midi);
    const L = Math.max(2, Math.round(sr/f));
    const isBass = profile === "bass";
    const N = Math.ceil(sr * (isBass ? 3.0 : 2.2));
    const data = new Float32Array(N);
    // 激励：噪声 → 多次平滑（越平滑越像指弹的暗音头）→ 拨弦位置梳状滤波
    const exc = new Float32Array(L);
    let seed = (midi*2654435761) >>> 0;
    const rnd = ()=>{ seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296*2 - 1; };
    for(let i=0;i<L;i++) exc[i] = rnd();
    const passes = isBass ? 5 : 2;
    for(let p=0;p<passes;p++){ let prev = exc[L-1]; for(let i=0;i<L;i++){ const c = exc[i]; exc[i] = (prev+c)/2; prev = c; } }
    const P = Math.max(1, Math.round(L*0.31));
    for(let i=0;i<L;i++) data[i] = exc[i] - 0.5*exc[(i-P+L)%L];
    // 弦衰减：低音弦余音长，高音弦短
    const t60 = isBass ? Math.min(3.0, Math.max(0.9, 2.6*55/f)) : Math.min(1.8, Math.max(0.55, 1.5*196/f));
    const d = Math.exp(-6.907/(f*t60));   // 每循环一周衰减一次，t60 秒后降到千分之一
    for(let n=L; n<N; n++){
      const j = n-L-1;
      data[n] = d * 0.5 * (data[n-L] + data[j < 0 ? L-1 : j]);
    }
    let mx = 0; for(let i=0;i<N;i++){ const a = Math.abs(data[i]); if(a>mx) mx = a; }
    const g = mx > 0 ? 0.9/mx : 1;
    for(let i=0;i<N;i++) data[i] *= g;
    const buf = this.ctx.createBuffer(1, N, sr);
    buf.getChannelData(0).set(data);
    this.ksCache[cacheKey] = buf;
    return buf;
  },
  shaper(){
    if(!this._shaperCurve){
      const c = new Float32Array(1024);
      for(let i=0;i<1024;i++){ const x = i/511.5 - 1; c[i] = Math.tanh(1.7*x); }
      this._shaperCurve = c;
    }
    const ws = this.ctx.createWaveShaper(); ws.curve = this._shaperCurve; ws.oversample = "2x";
    return ws;
  },

  /* --- 音色：electric bass（KS 拨弦 + 轻微过载 + tone 旋钮） --- */
  bass(dest, t, dur, midi, vel){
    const ctx = this.ctx, f = this.midiHz(midi);
    const src = ctx.createBufferSource(); src.buffer = this.ks(midi, "bass");
    src.playbackRate.value = 1 + (Math.random()*2-1)*0.0012;
    const ws = this.shaper();
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 0.7;
    flt.frequency.value = Math.min(2400, Math.max(650, f*10));
    const g = ctx.createGain();
    const peak = 0.62*vel;
    g.gain.setValueAtTime(peak, t);
    g.gain.setValueAtTime(peak, Math.max(t, t+dur-0.045));
    g.gain.linearRampToValueAtTime(0.0001, t+dur+0.03);
    src.connect(ws); ws.connect(flt); flt.connect(g); g.connect(dest);
    src.start(t); src.stop(t+dur+0.06);
  },

  /* --- 音色：采样电贝斯（真实录音，双 RR 轮换）。未加载完成时返回 false 回退 KS --- */
  smpBass(dest, t, dur, midi, vel){
    const root = BuiltinBass.nearest(midi);
    if(root === null) return false;
    const next = ((BuiltinBass.seq[root] || 0) % BuiltinBass.rr) + 1;
    let buf = BuiltinBass.buffers[BuiltinBass.key(root, next)];
    if(!(buf && buf.duration)) buf = BuiltinBass.buffers[BuiltinBass.key(root, next === 1 ? 2 : 1)];
    if(!(buf && buf.duration)){ BuiltinBass.load(root); return false; }
    BuiltinBass.seq[root] = next;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const rate = Math.pow(2, (midi - root) / 12);
    src.playbackRate.value = rate * (1 + (Math.random()*2 - 1) * 0.0008);
    const g = this.ctx.createGain();
    const peak = 0.62 * vel;   // 与建模贝斯响度对齐
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setValueAtTime(peak, Math.max(t + 0.004, t + dur - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
    src.connect(g); g.connect(dest);
    src.start(t);
    src.stop(t + Math.min(buf.duration / rate + 0.1, dur + 0.25));
    return true;
  },

  /* --- 音色：合成贝斯（减法合成，v1 的音色保留为可选项） --- */
  synthBass(dest, t, dur, midi, vel){
    const ctx = this.ctx, f = this.midiHz(midi);
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
    const g2 = ctx.createGain(); g2.gain.value = 0.6;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 2.5;
    flt.frequency.setValueAtTime(Math.min(2200, f*9), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(90, Math.min(900, f*2.4)), t+0.22);
    const g = ctx.createGain();
    const peak = 0.5*vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t+0.008);
    g.gain.exponentialRampToValueAtTime(peak*0.35, t+0.28);
    g.gain.setValueAtTime(peak*0.35, Math.max(t+0.28, t+dur-0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur+0.05);
    o1.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(dest);
    o1.start(t); o2.start(t); o1.stop(t+dur+0.12); o2.stop(t+dur+0.12);
  },

  /* --- 音色：自定义采样（就近变调）。缓冲未就绪时返回 false 让调用方回退内置音色 --- */
  sample(dest, t, dur, midi, vel, group){
    const s = Samples.nearestLoaded(group, midi);
    if(!s) { Samples.preload(group); return false; }
    const buf = Samples.buffers[s.id];
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const rate = Math.pow(2, (midi - s.rootMidi)/12);
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    const peak = 0.7*vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t+0.005);
    g.gain.setValueAtTime(peak, Math.max(t+0.005, t+dur-0.05));
    g.gain.linearRampToValueAtTime(0.0001, t+dur+0.08);
    src.connect(g); g.connect(dest);
    src.start(t);
    src.stop(t + Math.min(buf.duration/rate + 0.1, dur + 0.2));
    return true;
  },

  /* --- 音色：clean 电吉他拨弦（和弦垫默认音色） --- */
  gtr(dest, t, dur, midi, vel){
    const ctx = this.ctx, f = this.midiHz(midi);
    const src = ctx.createBufferSource(); src.buffer = this.ks(midi, "gtr");
    src.playbackRate.value = 1 + (Math.random()*2-1)*0.0018;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = 0.5;
    flt.frequency.value = Math.min(5200, Math.max(1800, f*8));
    const g = ctx.createGain();
    const peak = 0.34*vel;
    g.gain.setValueAtTime(peak, t);
    g.gain.setValueAtTime(peak, Math.max(t, t+dur-0.06));
    g.gain.linearRampToValueAtTime(0.0001, t+dur+0.12);
    src.connect(flt); flt.connect(g); g.connect(dest);
    src.start(t); src.stop(t+dur+0.15);
  },

  /* --- 音色：电钢琴风和弦音 --- */
  ep(dest, t, dur, midi, vel){
    const ctx = this.ctx, f = this.midiHz(midi);
    const parts = [
      {mult:1,    type:"sine",     g:0.50, dec:null},
      {mult:1.003,type:"triangle", g:0.16, dec:null},
      {mult:2,    type:"sine",     g:0.13, dec:null},
      {mult:4,    type:"sine",     g:0.07, dec:0.30}   // 铃铛质感的敲击瞬态
    ];
    const g = ctx.createGain();
    const peak = 0.34*vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t+0.012);
    g.gain.exponentialRampToValueAtTime(peak*0.45, t+0.8);
    g.gain.setValueAtTime(peak*0.45, Math.max(t+0.8, t+dur-0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur+0.25);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 3400; flt.Q.value = 0.4;
    flt.connect(g); g.connect(dest);
    for(const p of parts){
      const o = ctx.createOscillator(); o.type = p.type; o.frequency.value = f*p.mult;
      const pg = ctx.createGain(); pg.gain.value = p.g;
      if(p.dec){ pg.gain.setValueAtTime(p.g, t); pg.gain.exponentialRampToValueAtTime(0.001, t+p.dec); }
      o.connect(pg); pg.connect(flt);
      o.start(t); o.stop(t+dur+0.3);
    }
  },

  /* --- 音色：热身参考音 --- */
  tone(dest, t, dur, midi, vel){
    const ctx = this.ctx, f = this.midiHz(midi);
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f;
    const g = ctx.createGain(); const peak = 0.30*(vel||1);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(peak, t+0.03);
    g.gain.setValueAtTime(peak, Math.max(t+0.03, t+dur-0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur+0.08);
    o.connect(g); o2.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t+dur+0.15); o2.stop(t+dur+0.15);
  },

  /* --- 播放一段乐谱 events:[{t,dur,midi,voice,vel}] 单位:拍 --- */
  play(events, opts){
    const o = opts || {};
    const ctx = this.ensure();
    this.stopAll(true);
    this.group = ctx.createGain(); this.group.gain.value = 1; this.group.connect(this.master);
    const bpm = o.bpm || S.data.settings.bpm || 100;
    const spb = 60/bpm;
    const t0 = ctx.currentTime + 0.1;
    let end = 0;
    for(const ev of events){
      const t = t0 + ev.t*spb, dur = Math.max(0.05, ev.dur*spb);
      end = Math.max(end, ev.t*spb + dur);
      const vel = ev.vel ?? 1;
      if(ev.voice === "bass"){
        const bv = S.data.settings.bassVoice || "smp-bass";
        if(bv === "smp-bass" && this.smpBass(this.group, t, dur, ev.midi, vel)){}
        else if(bv.startsWith("custom:") && this.sample(this.group, t, dur, ev.midi, vel, bv.slice(7))){}
        else if(bv === "synth-bass") this.synthBass(this.group, t, dur, ev.midi, vel);
        else this.bass(this.group, t, dur, ev.midi, vel);
      }else if(ev.voice === "ep"){
        const cv = S.data.settings.chordVoice || "gtr";
        if(cv.startsWith("custom:") && this.sample(this.group, t, dur, ev.midi, vel*0.55, cv.slice(7))){}
        else if(cv === "ep") this.ep(this.group, t, dur, ev.midi, vel);
        else this.gtr(this.group, t, dur, ev.midi, vel);
      }
      else this.tone(this.group, t, dur, ev.midi, vel);
    }
    const lead = (t0 - ctx.currentTime);
    (o.marks || []).forEach(mk=>{
      this.timers.push(setTimeout(()=>{ mk.fn(); }, Math.max(0,(lead + mk.t*spb)*1000)));
    });
    setPlaying(true);
    this.timers.push(setTimeout(()=>{ setPlaying(false); if(o.onEnd) o.onEnd(); }, (lead+end)*1000 + 350));
  },

  toggleDrone(midiA, midiB){
    if(this.droneGroup){ this.stopDrone(); return false; }
    const ctx = this.ensure();
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.master);
    g.gain.linearRampToValueAtTime(0.10, ctx.currentTime+0.6);
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 650; flt.connect(g);
    [[midiA,"sawtooth",-4],[midiA,"sawtooth",4],[midiB,"sine",0]].forEach(([m,ty,det])=>{
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = this.midiHz(m); o.detune.value = det;
      o.connect(flt); o.start();
      this.droneGroup = this.droneGroup || {nodes:[],g};
      this.droneGroup.nodes.push(o);
    });
    return true;
  },
  stopDrone(){
    if(!this.droneGroup) return;
    try{
      const ctx = this.ctx;
      this.droneGroup.g.gain.cancelScheduledValues(ctx.currentTime);
      this.droneGroup.g.gain.setValueAtTime(this.droneGroup.g.gain.value, ctx.currentTime);
      this.droneGroup.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime+0.25);
      const dg = this.droneGroup;
      setTimeout(()=>{ dg.nodes.forEach(n=>{try{n.stop();}catch(e){}}); try{dg.g.disconnect();}catch(e){} }, 400);
    }catch(e){}
    this.droneGroup = null;
  }
};

/* ================================================================
   记谱工具：调、低音摆位、和弦排列（voice leading）
   ================================================================ */
function keyObj(){
  const st = S.data.settings;
  if(st.random){ return KEYS[Math.floor(Math.random()*KEYS.length)]; }
  return KEYS.find(k=>k.name===st.key) || KEYS[2];
}
function noteName(midi){ return NOTE_NAMES[((midi%12)+12)%12]; }
function noteNameOct(midi){ return NOTE_NAMES[((midi%12)+12)%12] + (Math.floor(midi/12)-1); }
// bass 主音摆在 G1 到 F#2 区间，级数按「就近」原则摆（5、6m 落在主音下方，是最常听到的走向）
function bassTonic(pc){ return 31 + ((pc - 7 + 12) % 12); }
function nearestSemi(semi){ const s = ((semi%12)+12)%12; return s > 6 ? s-12 : s; }
function foldBass(m){ while(m < 25) m += 12; while(m > 48) m -= 12; return m; }
// 一整条低音线：按 offsets（带方向）整体平移进合理音区
function bassLine(pc, offsets){
  const base = bassTonic(pc);
  let notes = offsets.map(o=>base+o);
  for(const sh of [0,12,-12,24]){
    const mn = Math.min(...notes)+sh, mx = Math.max(...notes)+sh;
    if(mn >= 25 && mx <= 48){ notes = notes.map(n=>n+sh); break; }
  }
  return notes.map(foldBass);
}
// 和弦排列：候选转位中选离上一个和弦最近的（平滑连接）
function voicings(rootPc, shape){
  const ivs = CHORD_SHAPES[shape] || CHORD_SHAPES.maj;
  const out = [];
  for(let inv=0; inv<ivs.length; inv++){
    const pcs = ivs.map((v,i)=> (rootPc + ivs[(i+inv)%ivs.length]) % 12);
    let cur = [], last = -1;
    for(const p of pcs){ let n = 48 + p; while(n <= last) n += 12; cur.push(n); last = n; }
    while(Math.min(...cur) < 50) cur = cur.map(n=>n+12);
    while(Math.min(...cur) > 63) cur = cur.map(n=>n-12);
    out.push(cur);
  }
  return out;
}
function voiceLead(prev, rootPc, shape){
  const cands = voicings(rootPc, shape);
  if(!prev) return cands[0];
  let best = cands[0], bestCost = Infinity;
  for(const c of cands){
    let cost = 0;
    for(const n of c){ cost += Math.min(...prev.map(p=>Math.abs(p-n))); }
    if(cost < bestCost){ bestCost = cost; best = c; }
  }
  return best;
}

/* ---- 乐句生成 ---- */
// 根音追踪：定调 1 级 2 拍，停 0.5 拍，目标和弦 2 拍
// bassNote 可选：由出题器指定目标音的具体八度（三八度系统）
function buildRootQuestion(key, degKey, bassNote){
  const d = DEGREES[degKey];
  const tb = bassTonic(key.pc);
  const targetBass = (bassNote !== undefined) ? bassNote : foldBass(tb + nearestSemi(d.semi));
  const ev = [], marks = [];
  const anchorV = voiceLead(null, key.pc, "maj");
  anchorV.forEach((m,i)=> ev.push({t:0+i*0.028, dur:1.9, midi:m, voice:"ep", vel:0.8}));
  ev.push({t:0, dur:0.9, midi:tb, voice:"bass", vel:1});
  ev.push({t:1, dur:0.9, midi:tb, voice:"bass", vel:0.75});
  const tv = voiceLead(anchorV, (key.pc+d.semi)%12, d.q);
  tv.forEach((m,i)=> ev.push({t:2.5+i*0.028, dur:2.2, midi:m, voice:"ep", vel:0.85}));
  ev.push({t:2.5, dur:0.9, midi:targetBass, voice:"bass", vel:1});
  ev.push({t:3.5, dur:1.1, midi:targetBass, voice:"bass", vel:0.8});
  return {events:ev, marks:[
    {t:0,   text:"定调：这是 1 级（" + key.name + " 大调）"},
    {t:2.5, text:"目标和弦：低音落在几级？"}
  ], bassNote:targetBass, tonicNote:tb};
}
// 进行播放（套路 / 根音走向 / 终止式共用）：每和弦 2 拍
// opts: {bassStyle:"8ths"|"half"|"root5", seventh:true} 供套路变奏档使用
function buildProgression(key, steps, loops, opts){
  const o = opts || {};
  let steps2 = steps;
  if(o.seventh){
    steps2 = steps.map(s=>{
      if(s.deg && s.deg[0] === "b") return s;
      const rel = ((s.root % 12) + 12) % 12;
      if(s.shape === "maj") return Object.assign({}, s, {shape: rel === 7 ? "dom7" : "maj7"});
      if(s.shape === "min") return Object.assign({}, s, {shape: "min7"});
      return s;
    });
  }
  const ev = [], dots = [];
  const bl = bassLine(key.pc, steps2.map(s=> (s.bassSemi!==undefined? s.bassSemi : s.root)));
  const fifthOf = m => (m+7 <= 48 ? m+7 : m-5);
  let prevV = null; const vs = [];
  for(const s of steps2){ prevV = voiceLead(prevV, ((key.pc + s.root)%12+12)%12, s.shape); vs.push(prevV); }
  const L = loops || (steps2.length <= 4 ? 2 : 1);
  const n = steps2.length;
  for(let lp=0; lp<n*L; lp++){
    const i = lp % n, base = lp*2;
    const isLast = (lp === n*L-1);
    vs[i].forEach((m,vi)=> ev.push({t:base+vi*0.028, dur:isLast?2.6:1.95, midi:m, voice:"ep", vel:0.72}));
    let style = o.bassStyle || "8ths";
    if(steps2[i].bassSemi !== undefined && style === "root5") style = "8ths"; // 转位低音保持踏住
    if(isLast){
      ev.push({t:base, dur:2.6, midi:bl[i], voice:"bass", vel:1});
    }else if(style === "half"){
      ev.push({t:base, dur:1.9, midi:bl[i], voice:"bass", vel:1});
    }else if(style === "root5"){
      ev.push({t:base, dur:0.92, midi:bl[i], voice:"bass", vel:1});
      ev.push({t:base+1, dur:0.92, midi:fifthOf(bl[i]), voice:"bass", vel:0.8});
    }else{
      [0,0.5,1,1.5].forEach((off,k)=> ev.push({t:base+off, dur:0.42, midi:bl[i], voice:"bass", vel:[1,0.6,0.8,0.6][k]}));
    }
    dots.push({t:base, i:lp, n:n*L});
  }
  return {events:ev, dots, bassLine:bl, total:n*L*2};
}
// 拼接多段进行（A/B 对比听用）
function concatProgs(parts){
  const ev = [], caps = []; let off = 0;
  for(const p of parts){
    p.prog.events.forEach(e=> ev.push(Object.assign({}, e, {t:e.t+off})));
    caps.push({t:off, text:p.cap});
    off += p.prog.total + 1;
  }
  return {events:ev, caps};
}
// 性质听辨
function buildQualityQuestion(level, q){
  const ev = [];
  if(level === 1){
    const root = 38 + Math.floor(Math.random()*11); // D2..C3
    const third = root + (q === "maj" ? 4 : 3);
    ev.push({t:0, dur:0.95, midi:root, voice:"bass", vel:1});
    ev.push({t:1, dur:0.95, midi:third, voice:"bass", vel:0.9});
    ev.push({t:2, dur:1.8, midi:root, voice:"bass", vel:0.95});
    ev.push({t:2, dur:1.8, midi:third, voice:"bass", vel:0.8});
    return {events:ev, root};
  }
  const root = 52 + Math.floor(Math.random()*9); // E3..C4
  const shape = CHORD_SHAPES[q];
  [0,2].forEach(t0=>{
    shape.forEach((iv,i)=> ev.push({t:t0+i*0.03, dur:1.9, midi:root+iv, voice:"ep", vel: t0===0?0.9:0.75}));
    ev.push({t:t0, dur:1.9, midi:root-24, voice:"bass", vel: t0===0?0.9:0.7});
  });
  return {events:ev, root};
}
function qualityCompareEvents(root, qA, qB, level){
  const ev = [];
  const put = (q,t0,vel)=>{
    if(level === 1){
      const third = root + (q==="maj"?4:3);
      ev.push({t:t0, dur:0.8, midi:root, voice:"bass", vel});
      ev.push({t:t0+0.85, dur:0.8, midi:third, voice:"bass", vel});
      ev.push({t:t0+1.7, dur:1.4, midi:root, voice:"bass", vel});
      ev.push({t:t0+1.7, dur:1.4, midi:third, voice:"bass", vel:vel*0.85});
    }else{
      CHORD_SHAPES[q].forEach((iv,i)=> ev.push({t:t0+i*0.03, dur:2.4, midi:root+iv, voice:"ep", vel}));
      ev.push({t:t0, dur:2.4, midi:root-24, voice:"bass", vel});
    }
  };
  put(qA, 0, 0.9); put(qB, 3.6, 0.9);
  return ev;
}

