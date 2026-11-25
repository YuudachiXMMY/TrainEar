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

export interface QuizFeedbackAction {
  act: string;
  label: string;
}
export interface QuizFeedback {
  ok: boolean;
  title: string;
  detail: string;
  actions: QuizFeedbackAction[];
}
export interface QuizOption {
  value: string;
  label: string;
  sub?: string | null;
}
export interface QuizQuestion {
  kind?: string;
  theory?: boolean;
  fret?: boolean;
  level: EngineLevel;
  options?: QuizOption[];
  answerValue?: string;
  idle?: string;
  events?: unknown[];
  dots?: { t: number; i: number }[] | null;
  caps?: { t: number; text: string }[] | null;
  noAutoPlay?: boolean;
  prompt?: string;
  sub?: string;
  ctx?: string;
  hint?: string;
  long?: boolean;
  playLabel?: string;
  foot?: string;
  ear?: boolean;
  lesson?: string;
  visual?: (q: QuizQuestion) => string;
  [key: string]: unknown;
}

export interface AppState {
  screen?: string;
  modeKey?: string | null;
  levelIdx?: number;
  q?: QuizQuestion | null;
  answered?: boolean;
  feedback?: QuizFeedback | null;
  chosenIdx?: number;
  playing?: boolean;
  droneOn?: boolean;
  lessonId?: string;
  lessonFromQuiz?: boolean;
  authTab?: string;
  authStep?: string;
  authEmail?: string;
  authMsg?: string;
  authErr?: boolean;
  srcMsg?: string;
  syncState?: string | null;
  data: {
    days: Record<string, { n: number; c: number }>;
    levels: Record<string, LevelStat>;
    lessons: Record<string, string>;
    anchors: Record<string, string>;
    settings: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export const S: AppState;

export interface ApiUser {
  username: string;
  email?: string;
  [key: string]: unknown;
}
export interface ApiResult {
  ok?: boolean;
  error?: string;
  hint?: string;
  needVerify?: boolean;
  email?: string;
  user?: ApiUser;
  samples?: SampleEntry[];
  [key: string]: unknown;
}
export const API: {
  user: ApiUser | null;
  offline: boolean;
  me(): Promise<ApiResult>;
  register(username: string, email: string, password: string): Promise<ApiResult>;
  verify(email: string, code: string): Promise<ApiResult>;
  login(account: string, password: string): Promise<ApiResult>;
  requestCode(email: string, purpose: string): Promise<ApiResult>;
  loginCode(email: string, code: string): Promise<ApiResult>;
  logout(): Promise<ApiResult>;
  getProgress(): Promise<ApiResult & { data?: unknown }>;
  putProgress(data: unknown): Promise<ApiResult>;
  listSamples(): Promise<ApiResult>;
  uploadSample(formData: FormData): Promise<ApiResult>;
  deleteSample(id: number): Promise<ApiResult>;
  [key: string]: unknown;
};

/* ---------------- 渲染钩子 ---------------- */
export function render(): void;
export function setRenderer(fn: (() => void) | null): void;

/* ---------------- 出题 / 判分 / 讲解（state.js，原样迁移自 app.js） ---------------- */
export function startQuestion(): void;
export function genQuestion(): void;
export function submitAnswer(i: number): void;
export function buildFeedback(q: QuizQuestion, chosen: QuizOption, ok: boolean): QuizFeedback;
export function runFeedbackAction(act: string): void;
export function playCurrent(slow?: boolean): void;
export function playAdhoc(events: unknown[], caps?: { t: number; text: string }[], bpm?: number): void;
export function saveData(): void;
export function doSync(): Promise<void>;
export function syncStateText(): string;
export function afterLogin(): Promise<void>;

/* ---------------- 乐理课（th-engine.js） ---------------- */
export interface DatasetLike {
  dataset: Record<string, string | undefined>;
}
export function handleTheoryAct(act: string, btn: DatasetLike): void;
export function thFbAction(act: string): void;
export function thRenderLesson(): string;
export function thMarkRead(id: string): void;

/* ---------------- 指板（fret.js） ---------------- */
export function handleFretAct(act: string, btn: DatasetLike): void;
export function renderFretQuiz(): string;
export function fretAfterRender(): void;
export function isFretMode(k: string): boolean;

/* ---------------- 音频引擎（audio.js） ---------------- */
export interface SampleEntry {
  id: number;
  name: string;
  role: string;
  rootMidi: number;
  [key: string]: unknown;
}
export const AE: {
  ctx: unknown;
  master: unknown;
  group: unknown;
  ensure(): unknown;
  stopAll(keepDrone?: boolean): void;
  setVol(v: number): void;
  play(events: unknown[], opts?: { bpm?: number; marks?: { t: number; fn: () => void }[]; onEnd?: () => void }): void;
  toggleDrone(midiA: number, midiB: number): boolean;
  sample(dest: unknown, t: number, dur: number, midi: number, vel: number, group: string): void;
  [key: string]: unknown;
};
export const Samples: {
  list: SampleEntry[];
  groups(kind: string): string[];
  groupSamples(name: string): SampleEntry[];
  preload(name: string): Promise<void>;
  setList(list: SampleEntry[]): void;
  nearestLoaded(group: string, midi: number): unknown;
  [key: string]: unknown;
};
export const BuiltinBass: {
  notes: number[];
  rr: number;
  buffers: Record<string, unknown>;
  seq: Record<number, number>;
  key(m: number, r: number): string;
  nearest(midi: number): number;
  load(root: number): Promise<void>;
  preloadAll(): void;
  [key: string]: unknown;
};
export function keyObj(): { name: string; pc: number };
export function noteName(midi: number): string;
export function noteNameOct(midi: number): string;

/* ---------------- 乐理数据（theory.js） ---------------- */
export const KEYS: { name: string; pc: number }[];
export const WARMUP_PATTERNS: { name: string; degs: number[]; why: string }[];
export const MAJOR_SCALE: number[];
