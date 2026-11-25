import { useMemo, useReducer, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { NavItem } from "./components/NavItem";
import { SessionSheet, type SessionInfo } from "./components/SessionSheet";
import { HomeView } from "./views/HomeView";
import { PracticeView } from "./views/PracticeView";
import { LessonsView } from "./views/LessonsView";
import { ProfileView } from "./views/ProfileView";
import { NAV_ITEMS, type TabId } from "./nav";
import { getHomeData, getLessonItems, getPracticeItems, getProfileStats } from "./appData";
import { API } from "./engine/index.js";

export default function App() {
  const [tab, setTab] = useState<TabId>("home");
  const [session, setSession] = useState<SessionInfo | null>(null);

  // 真正写入 S.data 的操作（答题记分、标记课程已读）会在步骤7接入；
  // 接入后应在那些操作完成时调用 bumpDataVersion()，而不是用和数据无关的
  // UI 状态（比如当前 Tab）去"猜测性"触发重算，否则会出现数据陈旧的问题。
  const [dataVersion, bumpDataVersion] = useReducer((v: number) => v + 1, 0);
  const homeData = useMemo(() => getHomeData(), [dataVersion]);
  const lessonItems = useMemo(() => getLessonItems(), [dataVersion]);
  const practiceItems = useMemo(() => getPracticeItems(), [dataVersion]);
  const profileStats = useMemo(() => getProfileStats(), [dataVersion]);

  // TODO(步骤7): 真正进入答题/讲解页目前还没接上(那是"未覆盖页面换皮"的工作)，
  // 这里先只做"确认弹层"的交互闭环，和步骤8的验收范围一致。
  function startSession(title: string) {
    setSession({
      title,
      durationLabel: "约 8 分钟",
      countLabel: "10 组练习",
      difficultyLabel: "难度自适应",
    });
  }

  function closeSession() {
    setSession(null);
    bumpDataVersion();
  }

  return (
    <div className="app-shell">
      <AppHeader onAvatarClick={() => setTab("profile")} />
      <aside className="sidebar">
        <div className="brand side-brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
            <span />
          </div>
          <span>BASSLINE</span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.id} {...item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>
      </aside>
      <main>
        {tab === "home" && (
          <HomeView data={homeData} onStart={startSession} onViewAll={() => setTab("practice")} />
        )}
        {tab === "lessons" && (
          <LessonsView
            lessons={lessonItems}
            onOpen={(id) => startSession(lessonItems.find((l) => l.id === id)?.title ?? id)}
          />
        )}
        {tab === "practice" && <PracticeView items={practiceItems} onStart={startSession} />}
        {tab === "profile" && (
          <ProfileView
            name={API.user?.username ?? "访客"}
            subtitle={API.user ? "已登录 · 进度云同步中" : "未登录 · 进度仅保存在本机"}
            stats={profileStats}
            settings={[
              { id: "account", label: "账号与云同步" },
              { id: "fretboard", label: "调弦与指板" },
              { id: "sources", label: "自定义音源" },
              { id: "sound", label: "声音与节拍器" },
            ]}
            onOpenSetting={() => {}} // TODO(步骤7/9): 接入账号/音源/指板设置页后替换
          />
        )}
      </main>
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.id} {...item} active={tab === item.id} onClick={() => setTab(item.id)} />
        ))}
      </nav>
      {session && <SessionSheet session={session} onClose={closeSession} onConfirm={closeSession} />}
    </div>
  );
}
