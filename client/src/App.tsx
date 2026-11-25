import { useEffect, useMemo, useReducer, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { NavItem } from "./components/NavItem";
import { SessionSheet, type SessionInfo } from "./components/SessionSheet";
import { HomeView } from "./views/HomeView";
import { PracticeView } from "./views/PracticeView";
import { LessonsView } from "./views/LessonsView";
import { ProfileView } from "./views/ProfileView";
import { NAV_ITEMS, type TabId } from "./nav";
import { getHomeData, getLessonItems, getPracticeItems, getProfileStats } from "./appData";
import { API, S, MODES, AE, setRenderer, startQuestion, handleTheoryAct, saveData } from "./engine/index.js";
import { QuizScreen } from "./screens/QuizScreen";
import { LessonScreen } from "./screens/LessonScreen";
import { WarmupScreen } from "./screens/WarmupScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { SourcesScreen } from "./screens/SourcesScreen";

type Overlay = "quiz" | "lesson" | "warmup" | "auth" | "sources" | null;

export default function App() {
  const [tab, setTab] = useState<TabId>("home");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);

  // 唯一的重渲染入口：引擎里残留的 render() 调用（fret.js/th-engine.js 的事件处理、
  // state.js 的 submitAnswer/startQuestion 等）都会触发这个计数器 +1，级联刷新整棵树。
  // 子屏幕不需要自己维护数据版本号，直接读全局可变对象 S 的最新值即可。
  const [dataVersion, bumpDataVersion] = useReducer((v: number) => v + 1, 0);
  useEffect(() => {
    setRenderer(() => bumpDataVersion());
    return () => setRenderer(null);
  }, []);

  const homeData = useMemo(() => getHomeData(), [dataVersion]);
  const lessonItems = useMemo(() => getLessonItems(), [dataVersion]);
  const practiceItems = useMemo(() => getPracticeItems(), [dataVersion]);
  const profileStats = useMemo(() => getProfileStats(), [dataVersion]);

  // 首页 hero / 继续学习列表、训练 Tab 卡片：先弹"开始训练确认层"，用户点"进入训练"才真正出题。
  function startSession(modeKey: string, levelIdx: number) {
    const mode = MODES[modeKey];
    const level = mode?.levels?.[levelIdx];
    if (!mode || !level) return;
    setSession({
      modeKey,
      levelIdx,
      title: (level.name as string) || mode.name,
      durationLabel: "约 8 分钟",
      countLabel: "10 组练习",
      difficultyLabel: "难度自适应",
    });
  }

  function closeSessionSheet() {
    setSession(null);
  }

  function confirmSession() {
    if (!session) return;
    S.modeKey = session.modeKey;
    S.levelIdx = session.levelIdx;
    S.screen = "quiz";
    S.data.last = { mode: session.modeKey, i: session.levelIdx };
    saveData();
    AE.ensure();
    startQuestion();
    setSession(null);
    setOverlay("quiz");
  }

  // 课程 Tab：讲解页直接进，不经过"开始训练"确认层（和旧版 nav-th-lesson 行为一致）。
  function openLesson(id: string) {
    handleTheoryAct("th-open-lesson", { dataset: { id } });
    setOverlay("lesson");
  }

  function closeOverlay() {
    AE.stopAll();
    S.screen = "home";
    setOverlay(null);
    bumpDataVersion();
  }

  function onAuthed() {
    setOverlay(null);
    bumpDataVersion();
  }

  const showShell = overlay === null;

  return (
    <div className="app-shell">
      {showShell && <AppHeader onAvatarClick={() => setTab("profile")} />}
      {showShell && (
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
      )}
      <main>
        {overlay === "quiz" && (
          <QuizScreen
            onBack={() => {
              setOverlay(null);
              bumpDataVersion();
            }}
            onOpenLesson={() => {
              // QuizScreen 点"回看讲解"时已经自己调过 handleTheoryAct("th-lesson", ...)
              // （会设 S.lessonId/S.lessonFromQuiz/S.screen 并触发 render），这里只需要
              // 切换 overlay，不要再调 openLesson() 重复触发一次 th-open-lesson。
              setOverlay("lesson");
            }}
          />
        )}
        {overlay === "lesson" && <LessonScreen onBack={closeOverlay} onEnterQuiz={() => setOverlay("quiz")} />}
        {overlay === "warmup" && <WarmupScreen onBack={closeOverlay} />}
        {overlay === "auth" && <AuthScreen onBack={closeOverlay} onAuthed={onAuthed} />}
        {overlay === "sources" && (
          <SourcesScreen
            onBack={closeOverlay}
            onGoAuth={() => {
              AE.stopAll();
              setOverlay("auth");
            }}
          />
        )}

        {overlay === null && tab === "home" && (
          <HomeView data={homeData} onStart={startSession} onViewAll={() => setTab("practice")} />
        )}
        {overlay === null && tab === "lessons" && <LessonsView lessons={lessonItems} onOpen={openLesson} />}
        {overlay === null && tab === "practice" && (
          <PracticeView items={practiceItems} onStart={startSession} onOpenWarmup={() => setOverlay("warmup")} />
        )}
        {overlay === null && tab === "profile" && (
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
            onOpenSetting={(id) => {
              if (id === "account") {
                AE.stopAll();
                setOverlay("auth");
              } else if (id === "sources") {
                AE.stopAll();
                setOverlay("sources");
              }
              // "调弦与指板"/"声音与节拍器"：旧版是首页练耳设置折叠面板里的内嵌设置项，
              // 不在本次"未覆盖页面换皮"六屏范围内，留作后续步骤的 TODO。
            }}
          />
        )}
      </main>
      {showShell && (
        <nav className="bottom-nav">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.id} {...item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>
      )}
      {session && <SessionSheet session={session} onClose={closeSessionSheet} onConfirm={confirmSession} />}
    </div>
  );
}
