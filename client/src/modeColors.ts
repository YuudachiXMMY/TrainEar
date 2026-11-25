import type { IconName } from "./icons";

/* mode.cssColor 在引擎里是 "var(--accent-x)" 这样的 CSS 变量引用字符串，
   卡片视觉需要把它和透明度拼成背景色（如 `${hex}18`），var() 没法这样拼接，
   所以这里维护一份与 client/src/index.css 完全对应的十六进制色表。 */
export const MODE_COLOR_HEX: Record<string, string> = {
  root: "#ff7557",
  quality: "#199e70",
  pattern: "#9085e9",
  board: "#c9a227",
  fret: "#e0703c",
  motif: "#d4568c",
  tb: "#26aebf",
  dh: "#8fbf3f",
  ph: "#c26bd6",
  bl: "#8a9bb0",
};

export type ModeCategory = "练耳" | "指板" | "乐理";

export const MODE_CATEGORY: Record<string, ModeCategory> = {
  root: "练耳",
  quality: "练耳",
  pattern: "练耳",
  board: "指板",
  fret: "指板",
  motif: "指板",
  tb: "乐理",
  dh: "乐理",
  ph: "乐理",
  bl: "乐理",
};

export const MODE_ICON: Record<ModeCategory, IconName> = {
  练耳: "headphones",
  指板: "fretboard",
  乐理: "book",
};

/* 上面三张表都是手动维护的静态登记表，th-*.js 课程是运行时动态注册到引擎里的，
   两边不保证自动同步 —— 遇到未登记的 key 时降级而不是让类型断言掩盖掉 undefined。 */
function warnUnregistered(key: string) {
  if (import.meta.env.DEV) console.warn(`[modeColors] 未登记的 mode key: "${key}"，已使用默认分类/颜色`);
}

export function categoryOf(key: string): ModeCategory {
  const found = MODE_CATEGORY[key];
  if (!found) warnUnregistered(key);
  return found ?? "练耳";
}

export function iconOf(key: string): IconName {
  return MODE_ICON[categoryOf(key)];
}

export function colorOf(key: string): string {
  return MODE_COLOR_HEX[key] ?? "#8a9bb0";
}
