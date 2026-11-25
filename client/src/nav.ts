import type { IconName } from "./icons";

export type TabId = "home" | "lessons" | "practice" | "profile";

export const NAV_ITEMS: { id: TabId; icon: IconName; label: string }[] = [
  { id: "home", icon: "home", label: "首页" },
  { id: "lessons", icon: "book", label: "课程" },
  { id: "practice", icon: "practice", label: "训练" },
  { id: "profile", icon: "user", label: "我的" },
];
