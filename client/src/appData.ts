import {
  MODES,
  FRET_MODE_KEYS,
  TH_MODE_KEYS,
  thLessonRead,
  levelStat,
  recent20Rate,
  dayStreak,
  S,
  type EngineMode,
  type EngineLevel,
} from "./engine/index.js";
import { categoryOf, colorOf, iconOf, type ModeCategory } from "./modeColors";
import type { HomeData, StageItem, WeekItem } from "./views/HomeView";
import type { PracticeItem } from "./views/PracticeView";
import type { LessonItem } from "./views/LessonsView";
import type { ProfileStat } from "./views/ProfileView";

const EAR_KEYS = ["root", "quality", "pattern"];

function allModeKeys(): string[] {
  return [...EAR_KEYS, ...FRET_MODE_KEYS, ...TH_MODE_KEYS];
}

function modeProgressPct(mode: EngineMode): number {
  const levels = mode.levels || [];
  if (!levels.length) return 0;
  const sum = levels.reduce((acc, lv) => acc + (recent20Rate(levelStat(lv.id)) ?? 0), 0);
  return Math.round((sum / levels.length) * 100);
}

function shortDesc(desc: string): string {
  return (desc || "").split(/[，。]/)[0] || desc;
}

function tagFor(key: string, mode: EngineMode): string {
  return `${categoryOf(key)} · ${mode.stage}`;
}

export function getPracticeItems(): PracticeItem[] {
  return allModeKeys()
    .filter((key) => MODES[key])
    .map((key) => {
      const mode = MODES[key];
      return {
        tag: tagFor(key, mode),
        title: mode.name,
        subtitle: shortDesc(mode.desc),
        progress: modeProgressPct(mode),
        color: colorOf(key),
        icon: iconOf(key),
      };
    });
}

export function getLessonItems(): LessonItem[] {
  const items: LessonItem[] = [];
  for (const key of TH_MODE_KEYS) {
    const mode = MODES[key];
    for (const lesson of mode.lessons || []) {
      items.push({
        id: lesson.id,
        title: lesson.title,
        subtitle: lesson.sum,
        done: thLessonRead(lesson.id),
      });
    }
  }
  return items;
}

export function getHomeData(): HomeData {
  const streakDays = dayStreak();

  // 继续练习：练耳/指板/乐理各取一条「优先未过关」的条目，和 Figma 原型的 3 行结构一致
  const categoryOrder: { category: ModeCategory; keys: string[] }[] = [
    { category: "练耳", keys: EAR_KEYS },
    { category: "指板", keys: FRET_MODE_KEYS },
    { category: "乐理", keys: TH_MODE_KEYS },
  ];
  const stages: StageItem[] = categoryOrder
    .map(({ keys }) => {
      for (const key of keys) {
        const mode = MODES[key];
        if (!mode) continue;
        const levels = mode.levels || [];
        const next: EngineLevel | undefined =
          levels.find((lv) => !levelStat(lv.id).passed) || levels[levels.length - 1];
        if (!next) continue;
        return {
          tag: tagFor(key, mode),
          title: mode.name,
          subtitle: (next.goal as string) || (next.name as string),
          progress: Math.round((recent20Rate(levelStat(next.id)) ?? 0) * 100),
          color: colorOf(key),
          icon: iconOf(key),
        };
      }
      return null;
    })
    .filter((x): x is StageItem => x !== null);

  // 本周节奏：从今天往前数 7 天，用当天答题正确率当高度
  const week: WeekItem[] = [];
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const day = S.data.days[key];
    week.push({
      day: dayLabels[d.getDay()],
      value: day && day.n ? Math.round((day.c / day.n) * 100) : 0,
      done: !!(day && day.n > 0),
    });
  }
  const activeDays = week.filter((w) => w.done);
  const weekAccuracyPct = activeDays.length
    ? Math.round(activeDays.reduce((acc, w) => acc + w.value, 0) / activeDays.length)
    : 0;

  const insightText =
    streakDays > 0
      ? `你已经连续练习 ${streakDays} 天，保持这个节奏`
      : "今天开始第一次练习，坚持 7 天就能看到明显进步";

  const heroMode = stages[0];

  return {
    greeting: "晚上好",
    streakDays,
    heroTitle: "听见根音，\n找到律动的锚点",
    heroDesc: heroMode ? `继续「${heroMode.title}」：${heroMode.subtitle}` : "从根音走向听辨开始，建立低音的方向感。",
    heroDurationLabel: "约 12 分钟",
    stages,
    week,
    weekAccuracyPct,
    insightText,
  };
}

export function getProfileStats(): ProfileStat[] {
  const allLevelIds = allModeKeys()
    .filter((key) => MODES[key])
    .flatMap((key) => (MODES[key].levels || []).map((lv) => lv.id));
  let attempts = 0;
  let correct = 0;
  for (const id of allLevelIds) {
    const st = levelStat(id);
    attempts += st.a;
    correct += st.c;
  }
  const totalDays = Object.values(S.data.days).filter((d) => d.n > 0).length;

  return [
    { value: String(dayStreak()), label: "连续天数" },
    { value: String(attempts), label: "累计题数" },
    { value: attempts ? `${Math.round((correct / attempts) * 100)}%` : "—", label: "总正确率" },
    { value: String(totalDays), label: "训练天数" },
  ];
}
