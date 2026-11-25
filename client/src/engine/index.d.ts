/* 这批 .js 引擎文件是从旧版原生 JS 原样迁移过来的（不改算法，只加 import/export），
   没有类型声明。这里只给 React 侧实际用到的符号补一层轻量类型，不追求覆盖引擎全部 API，
   也不改 .js 文件本身的实现。 */

export interface EngineLevel {
  id: string;
  name?: string;
  goal?: string;
  [key: string]: unknown;
}

export interface EngineLesson {
  id: string;
  title: string;
  sum: string;
  [key: string]: unknown;
}

export interface EngineMode {
  key: string;
  name: string;
  stage: string;
  desc: string;
  cssColor?: string;
  levels?: EngineLevel[];
  lessons?: EngineLesson[];
  [key: string]: unknown;
}

export const MODES: Record<string, EngineMode>;
export const FRET_MODE_KEYS: string[];
export const TH_MODE_KEYS: string[];
export const TH_LESSONS: Record<string, EngineLesson>;
export function thLessonRead(id: string): boolean;

export interface LevelStat {
  a: number;
  c: number;
  streak: number;
  best: number;
  recent: number[];
  passed: boolean;
  rt?: number[];
}
export function levelStat(id: string): LevelStat;
export function recent20Rate(st: LevelStat): number | null;
export function dayStreak(): number;

export interface AppState {
  data: {
    days: Record<string, { n: number; c: number }>;
    levels: Record<string, LevelStat>;
    lessons: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export const S: AppState;

export interface ApiUser {
  username: string;
  [key: string]: unknown;
}
export const API: { user: ApiUser | null; offline: boolean; [key: string]: unknown };
