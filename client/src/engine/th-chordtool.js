"use strict";
/* 和弦工具：给一个根音 + 和弦质量，查这个和弦用到哪些音——优先给级数（1 3 5 ♭7…），
   同时给出选定根音后的字母音名，并把这些音在整条指板（0 到 FRET_MAX 品、当前弦数/调弦）
   上出现的每一个位置都标出来。纯查询用途，不出题、不计分，所以和 th-chords.js 的出题逻辑
   （thCfPickQ 等）分开放，只复用双方都要用的底层：TH_CH 的级数公式、thPc/thNm 的拼写、
   cellsIn/fretTuning 的指板坐标。 */
import { TH_CH, thPc, thNm, thUp, thDegLabel } from "./th-engine.js";
import { cellsIn, fretTuning, FRET_MAX } from "./fret.js";

/* 和弦里每个音：级数号、级数标签（♭7 这种）、相对根音半音数、选定根音后的字母音名
   拼写直接复用 thUp（和 thChordNotes 用的是同一条逻辑，保证字母音名和课程里讲的一致） */
export function thChordToolTones(root, q){
  return TH_CH[q].f.map(([num, semi])=>({
    num, semi, lab:thDegLabel(num, semi), name:thNm(thUp(root, num, semi))
  }));
}

/* 和弦质量选择器分组：三和弦 / 七和弦 / 扩展和弦，和 th-chords.js 里出题池的分组一致，
   这里单独列一份给"查询用"的和弦工具 UI，避免往 th-chords.js 的出题逻辑里加 UI 关心的东西 */
export const THCT_GROUPS = [
  {label:"三和弦", keys:["maj","min","dim","aug","sus2","sus4"]},
  {label:"七和弦", keys:["maj7","dom7","min7","m7b5","dim7"]},
  {label:"扩展和弦", keys:["maj6","min6","mMaj7","dom7sus4","add9","dom9","maj9","min9"]}
];

// 和 th-chords.js 的 thFretFig 配色一致：根音白、三音蓝、五音橙、其余（七/六/九…）绿
function thCtCls(num){ return num === 1 ? "nat" : num === 3 ? "deg-T" : num === 5 ? "deg-D" : "deg-S"; }

/* 这个和弦的每个音在整条指板上出现的所有位置：{"弦-品": {cls, label}} */
export function thChordToolMarks(root, q, opt){
  const tun = (opt && opt.tun) || fretTuning();
  const tones = thChordToolTones(root, q);
  const rootPc = thPc(root);
  const marks = {};
  for(const t of tones){
    const pc = (rootPc + t.semi) % 12;
    for(const c of cellsIn(tun, 0, FRET_MAX, cpc=>cpc === pc)){
      marks[c.s + "-" + c.f] = {cls: thCtCls(t.num), label: t.lab};
    }
  }
  return {tun, tones, marks};
}
