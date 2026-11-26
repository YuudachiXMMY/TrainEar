"use strict";
/* 引擎统一入口：按模块依赖顺序（theory → audio → api → state → fret → drills → th-engine →
   th-basics → th-harmony → th-advanced → th-bassline → th-chords）依次 import，保证
   MODES.fret / MODES.board / MODES.motif / TH_MODE_KEYS 等"加载时注册"的副作用顺序不变。
   th-basics/th-harmony/th-advanced/th-bassline/th-chords 本身不导出新符号，只通过
   thRegisterCourse 把课程注册进 th-engine.js 的 TH_MODE_KEYS / MODES / TH_LESSONS，
   所以这里只需要 import 触发副作用，不需要 re-export。 */

export * from "./theory.js";
export * from "./audio.js";
export * from "./api.js";
export * from "./state.js";
export * from "./fret.js";
export * from "./drills.js";
export * from "./th-engine.js";
export { TH_ROOTS12 } from "./th-basics.js";
import "./th-harmony.js";
import "./th-advanced.js";
import "./th-bassline.js";
import "./th-chords.js";
