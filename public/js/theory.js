"use strict";
/* 乐理数据与题库（王道/小室/卡农/Axis/悲怆/下行线/丸サ/借用 + 终止式 + 调外侦测） */
/* =====================================================================
   J-Rock 练耳训练器 · 对应《Bassline 学习方法论》第三部分（阶段 0 到 3）
   题库：J-Pop / J-Rock 高频套路（王道、小室、卡农、Axis、悲怆、下行线、丸サ、借用）
   ===================================================================== */

/* ---------------- 基础乐理数据 ---------------- */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const KEYS = [
  {name:"C", pc:0},{name:"D", pc:2},{name:"E", pc:4},{name:"F", pc:5},
  {name:"G", pc:7},{name:"A", pc:9},{name:"B", pc:11}
];
// 级数定义：sd = 相对大调音级半音数, quality 决定和弦结构与标签
const DEGREES = {
  "1" :{semi:0,  q:"maj", label:"1",  color:"亮的家，完全稳定（T）"},
  "2m":{semi:2,  q:"min", label:"2m", color:"柔和的出门，4 的暗版（S）"},
  "3m":{semi:4,  q:"min", label:"3m", color:"半个家，最暧昧的一级（T）"},
  "4" :{semi:5,  q:"maj", label:"4",  color:"出门，变亮变开阔（S）"},
  "5" :{semi:7,  q:"maj", label:"5",  color:"紧张、悬着、想回家（D）"},
  "6m":{semi:9,  q:"min", label:"6m", color:"暗的家，和 1 共享两个音（T）"},
  "b6":{semi:8,  q:"maj", label:"b6", color:"平行小调借来的和弦，冲刺感"},
  "b7":{semi:10, q:"maj", label:"b7", color:"平行小调借来的和弦，rock 味"},
  "3(7)":{semi:4,q:"dom7",label:"3(7)",color:"副属和弦，亮但躁，强行推向 6m"},
  "6(7)":{semi:9,q:"dom7",label:"6(7)",color:"副属和弦，推向 2m"},
  "1(7)":{semi:0,q:"dom7",label:"1(7)",color:"1 加小七度变属七，推向 4"},
  "4m":{semi:5, q:"min", label:"4m", color:"从平行小调借来的一秒哭腔"}
};
const CHORD_SHAPES = {
  maj :[0,4,7],
  min :[0,3,7],
  dom7:[0,4,7,10],
  maj7:[0,4,7,11],
  min7:[0,3,7,10]
};
const QUALITY_INFO = {
  maj :{label:"大三和弦", short:"大", feel:"亮、开阔、落地"},
  min :{label:"小三和弦", short:"小", feel:"暗、收拢、往里收"},
  dom7:{label:"属七和弦", short:"属七", feel:"亮但躁、悬着想解决"},
  maj7:{label:"大七和弦", short:"maj7", feel:"亮但飘、city pop 的空气感"},
  min7:{label:"小七和弦", short:"m7", feel:"暗但松弛、圆滑不刺"}
};

/* ---------------- 套路题库（1.3 词汇表） ---------------- */
// steps: 每步 {deg 显示级数, root 相对主音半音(可为负,控制低音走向), shape, bassSemi 可选(转位低音)}
const PATTERNS = [
  {id:"oudou", name:"王道进行", degText:"4 5 3m 6m", lv:1,
   steps:[{deg:"4",root:5,shape:"maj"},{deg:"5",root:7,shape:"maj"},{deg:"3m",root:4,shape:"min"},{deg:"6m",root:9,shape:"min"}],
   hint:"4 出门、5 拉满张力、不回 1 而落 3m（伪终止变形），再顺三度滑进 6m。明亮和忧伤反复横跳，anime 感的来源。",
   trick:"开头 4 到 5 往上顶，第 3 个和弦突然变暗又不落地，就是王道。"},
  {id:"komuro", name:"小室进行", degText:"6m 4 5 1", lv:1,
   steps:[{deg:"6m",root:-3,shape:"min"},{deg:"4",root:-7,shape:"maj"},{deg:"5",root:-5,shape:"maj"},{deg:"1",root:0,shape:"maj"}],
   hint:"小调开头、大调落地。悲壮推进感，90 年代至今的 J-Rock 主力。",
   trick:"第一拍就是暗的，结尾却结结实实回到亮的 1，落差感就是小室。"},
  {id:"axis", name:"Axis 进行", degText:"1 5 6m 4", lv:1,
   steps:[{deg:"1",root:0,shape:"maj"},{deg:"5",root:7,shape:"maj"},{deg:"6m",root:9,shape:"min"},{deg:"4",root:5,shape:"maj"}],
   hint:"欧美流行万能循环，J-Rock 也大量使用。四个和弦覆盖 T D T S 一整圈，整体明亮。",
   trick:"从亮的 1 出发绕一圈，中途经过暗的 6m 但很快离开。"},
  {id:"canon", name:"卡农进行", degText:"1 5 6m 3m 4 1 4 5", lv:1,
   steps:[{deg:"1",root:0,shape:"maj"},{deg:"5",root:7,shape:"maj",bassSemi:-1},{deg:"6m",root:-3,shape:"min"},{deg:"3m",root:4,shape:"min",bassSemi:-5},
          {deg:"4",root:-7,shape:"maj"},{deg:"1",root:0,shape:"maj",bassSemi:-8},{deg:"4",root:-7,shape:"maj"},{deg:"5",root:-5,shape:"maj"}],
   hint:"低音是一条下楼梯的音阶线（1 7 6 5 4 3 回 4 5），bass 手最能体会「低音线就是进行本体」。8 个和弦一组。",
   trick:"和弦比别的套路多一倍、低音像下楼梯，基本就是卡农。"},
  {id:"kudari", name:"下行线进行", degText:"1 5/7 6m 5", lv:2,
   steps:[{deg:"1",root:0,shape:"maj"},{deg:"5/7",root:7,shape:"maj",bassSemi:-1},{deg:"6m",root:-3,shape:"min"},{deg:"5",root:-5,shape:"maj"}],
   hint:"低音 1 7 6 5 半音加全音一路级进下滑，抒情歌常用。转位 5/7 存在的意义就是这条低音线。",
   trick:"专听低音：一格一格往下走、每步都很近，就是下行线。"},
  {id:"hisou", name:"悲怆循环", degText:"6m 4 1 5", lv:2,
   steps:[{deg:"6m",root:-3,shape:"min"},{deg:"4",root:-7,shape:"maj"},{deg:"1",root:0,shape:"maj"},{deg:"5",root:-5,shape:"maj"}],
   hint:"和 Axis 同一组和弦换起点，从 6m 起整体偏暗，情绪摇滚常用。",
   trick:"和小室一样从暗开头，但第 3 个就早早回 1、结尾悬在 5 上不落地。"},
  {id:"marusa", name:"丸サ进行", degText:"4 3(7) 6m", lv:3,
   steps:[{deg:"4",root:5,shape:"maj7"},{deg:"3(7)",root:4,shape:"dom7"},{deg:"6m",root:-3,shape:"min7"},{deg:"6m",root:-3,shape:"min7"}],
   hint:"「Just the Two of Us 进行」。3 级从小和弦变成属七（副属和弦），city pop、R&B 味的关键。",
   trick:"第 2 个和弦又亮又躁、明显不在调里，然后被推进暗的 6m，就是丸サ。"},
  {id:"b6b7", name:"平行调借用", degText:"b6 b7 1", lv:3,
   steps:[{deg:"b6",root:-4,shape:"maj"},{deg:"b7",root:-2,shape:"maj"},{deg:"1",root:0,shape:"maj"},{deg:"1",root:0,shape:"maj"}],
   hint:"从平行小调借来的冲刺式终止，rock、metal 的段落收尾常客。全大和弦整体半音阶往上撞回 1。",
   trick:"两个调外的大和弦连续往上顶、最后撞在 1 上，冲刺感极强。"}
];

/* ---------------- 模式与档位 ---------------- */
const MODES = {
  root:{
    key:"root", stage:"阶段 1", name:"根音追踪", cssColor:"var(--accent)", meterCls:"",
    desc:"先只听一条线：低音落在几级。这比听整个和弦简单一个数量级，是 bass 手的主场。",
    levels:[
      {id:"root-1", kind:"deg", name:"档 1 · 四大金刚", goal:"听辨 1 / 4 / 5 / 6m。易混的 5 和 6m 会加量出现；1 级永远换八度出现，防背音高", pool:["1","4","5","6m"]},
      {id:"root-2", kind:"deg", name:"档 2 · 全顺阶", goal:"加入 2m 和 3m，六个级数全开（5、6m 仍加量）", pool:["1","2m","3m","4","5","6m"]},
      {id:"root-3", kind:"seq", name:"档 3 · 根音走向", goal:"听 4 个和弦，选出完整的根音走向", pool:null},
      {id:"root-4", kind:"cadence", name:"档 4 · 终止式", goal:"5 之后去哪了：正格回 1 / 伪终止落 6m 或 3m / 半终止悬着", pool:null}
    ]
  },
  quality:{
    key:"quality", stage:"阶段 2", name:"性质听辨", cssColor:"var(--accent-quality)", meterCls:"q",
    desc:"大 = 亮，小 = 暗，先把这一对刻进耳朵，再补属七。每天 2 分钟，和阶段 1 并行。",
    levels:[
      {id:"q-1", kind:"quality", name:"档 1 · 三度对比", goal:"根音加大三度 vs 根音加小三度（bass 音色）", pool:["maj","min"]},
      {id:"q-2", kind:"quality", name:"档 2 · 完整三和弦", goal:"大三和弦 vs 小三和弦", pool:["maj","min"]},
      {id:"q-3", kind:"quality", name:"档 3 · 加入属七", goal:"大、小、属七三种颜色，够用很久", pool:["maj","min","dom7"]},
      {id:"q-4", kind:"quality", name:"档 4 · 七和弦家族", goal:"maj7 / m7 / 属七，丸サ和 city pop 的原料", pool:["maj7","min7","dom7"]}
    ]
  },
  pattern:{
    key:"pattern", stage:"阶段 3", name:"套路整体识别", cssColor:"var(--accent-pattern)", meterCls:"p",
    desc:"认单词，不认字母：把王道、小室、Axis、卡农当作整体声音印象来记，3 秒内报出套路名。",
    levels:[
      {id:"p-1", kind:"pattern", name:"档 1 · 四大套路", goal:"王道 / 小室 / Axis / 卡农", lv:1},
      {id:"p-2", kind:"pattern", name:"档 2 · 六套路", goal:"加入悲怆循环、下行线（注意 Axis 换起点的陷阱）", lv:2},
      {id:"p-3", kind:"pattern", name:"档 3 · 全套路", goal:"加入丸サ、平行调借用，词汇表全开", lv:3},
      {id:"p-4", kind:"variant", name:"档 4 · 套路变奏", goal:"随机调加变奏伴奏（根五 / 全音符 / 加七和弦），换件衣服也认得出", lv:3},
      {id:"p-5", kind:"outside", name:"档 5 · 调外和弦侦测", goal:"有没有外人？副属、借用 4m 还是 b6 b7（分析 SOP 第 3 步的听力版）", lv:3}
    ]
  }
};
const PASS_N = 20, PASS_RATE = 0.9; // 近 20 题 90% 过关

/* ---------------- 热身（阶段 0）唱级数材料 ---------------- */
const WARMUP_PATTERNS = [
  {name:"上行音阶", degs:[1,2,3,4,5,6,7,8], why:"唱数字：1 2 3 4 5 6 7 1"},
  {name:"下行音阶", degs:[8,7,6,5,4,3,2,1], why:"下来也要稳"},
  {name:"骨干 1 3 5", degs:[1,3,5,3,1], why:"大三和弦的骨架"},
  {name:"骨干 1 4 1 5 1", degs:[1,4,1,5,1], why:"最常用的功能跳进"},
  {name:"骨干 1 6 1", degs:[1,6,1], why:"1 和 6m 的距离，先唱准再谈听辨"},
  {name:"下探低音 5", degs:[1,-5,1], why:"bass 手最常用的下行跳进：1 往下到低音 5 再回来"}
];
const MAJOR_SCALE = [0,2,4,5,7,9,11];

/* ================================================================
   根音走向（root-3）题库
   ================================================================ */
const SEQ_POOL = [
  {seq:["1","5","6m","4"],  note:"这就是 Axis 进行"},
  {seq:["6m","4","5","1"],  note:"这就是小室进行"},
  {seq:["4","5","3m","6m"], note:"这就是王道进行"},
  {seq:["1","6m","4","5"],  note:"50 年代循环，1 和 6m 同为家、先亮后暗"},
  {seq:["6m","4","1","5"],  note:"这就是悲怆循环"},
  {seq:["1","3m","6m","4"], note:"鲜花的主循环：全程不碰属功能，一直悬着"},
  {seq:["2m","5","1","6m"], note:"2m 5 1 连锁（五度下行）加 6m 回钩"},
  {seq:["1","4","5","4"],   note:"朋克味的 1 4 5 循环"}
];
const SIB = {"1":"6m","6m":"1","4":"2m","2m":"4","3m":"6m"};

/* ---------------- 终止式（root-4）题库 ---------------- */
const CADENCE_POOL = [
  {cat:"auth", opt:"正格终止：5 → 1", label:"正格终止（5 回 1）",
   seqs:[["1","4","5","1"],["1","2m","5","1"],["6m","4","5","1"]],
   why:"结结实实回家，最强的解决。"},
  {cat:"dec6", opt:"伪终止：5 → 6m", label:"伪终止（5 落 6m）",
   seqs:[["1","4","5","6m"],["1","2m","5","6m"]],
   why:"以为要到家了，结果进了另一扇门。J-Pop 的忧伤感大量来自这一手。"},
  {cat:"dec3", opt:"伪终止：5 → 3m", label:"伪终止变形（5 落 3m）",
   seqs:[["1","4","5","3m"],["1","2m","5","3m"]],
   why:"落在半个家 3m 上，暗但不落地。王道进行 4 5 3m 6m 的招牌动作就是它。"},
  {cat:"half", opt:"半终止：停在 5", label:"半终止（停在 5）",
   seqs:[["1","6m","4","5"],["1","6m","2m","5"]],
   why:"悬在 5 上不解决，像副歌前的深呼吸，逼着你等那个 1。"}
];

/* ---------------- 调外和弦侦测（p-5）题库 ---------------- */
const OUTSIDE_CATS = [
  {value:"none",   label:"全调内，没有外人"},
  {value:"secdom", label:"有副属和弦", sub:"该小的级数变大/属七"},
  {value:"iv",     label:"借用 4m", sub:"4 突然变小，一秒哭腔"},
  {value:"b67",    label:"借用 b6 b7", sub:"带 b 的级数往上撞"}
];
const OUTSIDE_POOL = [
  {cat:"none", seq:["1","4","5","1"],    twin:null, outsider:null, why:"四个和弦都在调内，规规矩矩。"},
  {cat:"none", seq:["1","6m","2m","5"],  twin:null, outsider:null, why:"全顺阶，一个外人都没有。"},
  {cat:"none", seq:["4","5","3m","6m"],  twin:null, outsider:null, why:"这是王道进行，听着戏剧化但全在调内。"},
  {cat:"secdom", seq:["1","3(7)","6m","4"], twin:["1","3m","6m","4"], outsider:"3(7)",
   why:"调内 3 级本该是小和弦，突然变成属七：这是硬要推去 6m 的副属和弦（丸サ也用它）。"},
  {cat:"secdom", seq:["1","6(7)","2m","5"], twin:["1","6m","2m","5"], outsider:"6(7)",
   why:"6 级从小和弦变成属七，副属推向 2m。"},
  {cat:"secdom", seq:["1","1(7)","4","1"], twin:["1","1","4","1"], outsider:"1(7)",
   why:"1 自己加上小七度变成属七，产生「要去 4」的推力。"},
  {cat:"iv", seq:["1","4","4m","1"], twin:["1","4","4","1"], outsider:"4m",
   why:"4 走到一半突然变成 4m：从平行小调借来的「一秒变哭腔」，J-Pop 用滥了的经典手法。"},
  {cat:"iv", seq:["6m","4","4m","1"], twin:["6m","4","4","1"], outsider:"4m",
   why:"先暗后哭：4 变 4m 再落回 1，抒情副歌收尾常客。"},
  {cat:"b67", seq:["1","b6","b7","1"], twin:["1","4","5","1"], outsider:"b6 b7",
   why:"出现带 b 的级数就是借用：b6 b7 连续往上顶、撞回 1 的冲刺式终止，rock 和 metal 的段落收尾常客。"},
  {cat:"b67", seq:["6m","b6","b7","1"], twin:["6m","4","5","1"], outsider:"b6 b7",
   why:"从 6m 出发借 b6 b7 冲回 1，比正格终止猛得多。"}
];
const OUTSIDE_RULE = {
  secdom:"识别规则：调内本该是小和弦的级数（2、3、6）突然变成大和弦或属七，就是副属。",
  iv:"识别规则：4 突然变成 4m，或出现带 b 的级数，就是从平行小调借来的。",
  b67:"识别规则：出现带 b 的级数（b3、b6、b7）就是借用和弦。",
  none:"先问自己：每个和弦都还在 1 2m 3m 4 5 6m 里吗？"
};
function seqDistractors(seq){
  const out = [], used = new Set([seq.join(">")]);
  const push = s=>{ const k = s.join(">"); if(!used.has(k)){ used.add(k); out.push(s); } };
  const swap = (i,j)=>{ const s = seq.slice(); [s[i],s[j]] = [s[j],s[i]]; return s; };
  push(swap(1,2)); push(swap(2,3)); push(swap(0,1));
  for(let i=0; i<seq.length && out.length<3; i++){
    if(SIB[seq[i]]){ const s = seq.slice(); s[i] = SIB[seq[i]]; push(s); }
  }
  return out.slice(0,3);
}

