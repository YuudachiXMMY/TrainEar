import { useState } from "react";
import { API, S, Samples, doSync, syncStateText, afterLogin } from "../engine/index.js";

type AuthTab = "login" | "code" | "reg";
type AuthStep = "form" | "code";

/* 账号登录/注册页：手写 JSX 重排 legacy renderAuth()/handleAuth()（app.js 717~762、928~976行），
   三个 tab（密码登录/验证码登录/注册）和各分支判断逐字照搬，只是把拼 HTML 换成表单 + 本地 state。
   登录/注册/验证逻辑直接调用已迁移好的 API，不重新实现。触碰鉴权与用户输入，实现后需要跑一次
   security-reviewer。 */
export function AuthScreen({ onBack, onAuthed }: { onBack: () => void; onAuthed: () => void }) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [code, setCode] = useState("");
  const [loginEmail, setLoginEmail] = useState("");

  const [, forceSync] = useState(0);

  function show(text: string, isErr?: boolean) {
    setMsg(text || "");
    setErr(!!isErr);
  }

  function switchTab(t: AuthTab) {
    setTab(t);
    setStep("form");
    show("");
  }

  async function doLogout() {
    setBusy(true);
    await API.logout();
    API.user = null;
    Samples.setList([]);
    S.syncState = null;
    setBusy(false);
    onAuthed();
  }

  async function doSyncNow() {
    setBusy(true);
    await doSync();
    setBusy(false);
    forceSync((n) => n + 1);
  }

  async function doLogin() {
    setBusy(true);
    const r = await API.login(account, password);
    setBusy(false);
    if (r.ok) {
      API.user = r.user ?? null;
      await afterLogin();
      onAuthed();
    } else if (r.needVerify) {
      setTab("reg");
      setStep("code");
      setEmail(r.email || "");
      show(r.error || "", true);
    } else {
      show(r.error || "登录失败", true);
    }
  }

  async function doRegister() {
    setBusy(true);
    const r = await API.register(regUser, regEmail, regPass);
    setBusy(false);
    if (r.ok) {
      setStep("code");
      setEmail(regEmail);
      show(r.hint || "验证码已发送");
    } else {
      show(r.error || "注册失败", true);
    }
  }

  async function doVerify() {
    setBusy(true);
    const r = await API.verify(email, code);
    setBusy(false);
    if (r.ok) {
      API.user = r.user ?? null;
      await afterLogin();
      onAuthed();
    } else {
      show(r.error || "验证失败", true);
    }
  }

  async function doResend() {
    setBusy(true);
    const r = await API.requestCode(email, "verify");
    setBusy(false);
    show(r.ok ? r.hint || "已重发" : r.error || "重发失败", !r.ok);
  }

  async function doSendLoginCode() {
    setBusy(true);
    const r = await API.requestCode(loginEmail, "login");
    setBusy(false);
    if (r.ok) {
      setEmail(loginEmail);
      setStep("code");
      show(r.hint || "验证码已发送");
    } else {
      show(r.error || "发送失败", true);
    }
  }

  async function doResendLogin() {
    setBusy(true);
    const r = await API.requestCode(email, "login");
    setBusy(false);
    show(r.ok ? r.hint || "已重发" : r.error || "重发失败", !r.ok);
  }

  async function doLoginCode() {
    setBusy(true);
    const r = await API.loginCode(email, code);
    setBusy(false);
    if (r.ok) {
      API.user = r.user ?? null;
      await afterLogin();
      onAuthed();
    } else {
      show(r.error || "登录失败", true);
    }
  }

  const user = API.user;

  return (
    <section className="page-view legacy-embed">
      <button className="backbtn" onClick={onBack}>
        ← 返回
      </button>
      <div className="card" style={{ maxWidth: 440, margin: "26px auto" }}>
        {user ? (
          <>
            <h2 style={{ marginBottom: 10 }}>账号</h2>
            <div className="sub small">
              用户名：<b>{user.username}</b>
              <br />
              邮箱：{user.email}
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              云同步：<span style={{ color: "var(--accent)" }}>{syncStateText()}</span>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button disabled={busy} onClick={doSyncNow}>
                立即同步
              </button>
              <button disabled={busy} style={{ color: "var(--bad)" }} onClick={doLogout}>
                退出登录
              </button>
            </div>
            <div className="note-box" style={{ marginTop: 14 }}>
              答题后约 1 秒自动同步；换设备登录同一账号即可续上进度和自定义音源。
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 14, gap: 8 }}>
              <button
                style={{ flex: 1, borderColor: tab === "login" ? "var(--accent)" : undefined, color: tab === "login" ? "var(--ink)" : "var(--ink-3)" }}
                onClick={() => switchTab("login")}
              >
                密码登录
              </button>
              <button
                style={{ flex: 1, borderColor: tab === "code" ? "var(--accent)" : undefined, color: tab === "code" ? "var(--ink)" : "var(--ink-3)" }}
                onClick={() => switchTab("code")}
              >
                验证码登录
              </button>
              <button
                style={{ flex: 1, borderColor: tab === "reg" ? "var(--accent)" : undefined, color: tab === "reg" ? "var(--ink)" : "var(--ink-3)" }}
                onClick={() => switchTab("reg")}
              >
                注册
              </button>
            </div>

            {tab === "login" && (
              <form onSubmit={(e) => { e.preventDefault(); doLogin(); }}>
                <input
                  type="text"
                  placeholder="用户名或邮箱"
                  aria-label="用户名或邮箱"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="密码"
                  aria-label="密码"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy}
                  style={{ width: "100%", background: "var(--accent)", borderColor: "transparent", fontWeight: 600 }}
                >
                  登录
                </button>
              </form>
            )}

            {tab === "reg" && step === "code" && (
              <form onSubmit={(e) => { e.preventDefault(); doVerify(); }}>
                <div className="sub small" style={{ marginBottom: 10 }}>
                  验证码已发往 <b>{email}</b>
                  <br />
                  <span className="muted">本地未配置邮件服务时，验证码打印在运行 npm start 的那个终端里。</span>
                </div>
                <input
                  type="text"
                  placeholder="6 位验证码"
                  aria-label="6 位验证码"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <div className="row">
                  <button type="submit" disabled={busy} style={{ flex: 1, background: "var(--accent)", borderColor: "transparent", fontWeight: 600 }}>
                    完成验证
                  </button>
                  <button type="button" disabled={busy} onClick={doResend}>
                    重发
                  </button>
                </div>
              </form>
            )}
            {tab === "reg" && step === "form" && (
              <form onSubmit={(e) => { e.preventDefault(); doRegister(); }}>
                <input
                  type="text"
                  placeholder="用户名（2 到 24 字符）"
                  aria-label="用户名"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="邮箱"
                  aria-label="邮箱"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="密码（至少 6 位）"
                  aria-label="密码"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy}
                  style={{ width: "100%", background: "var(--accent)", borderColor: "transparent", fontWeight: 600 }}
                >
                  发送验证码并注册
                </button>
              </form>
            )}

            {tab === "code" && step === "code" && (
              <form onSubmit={(e) => { e.preventDefault(); doLoginCode(); }}>
                <div className="sub small" style={{ marginBottom: 10 }}>
                  验证码已发往 <b>{email}</b>
                </div>
                <input
                  type="text"
                  placeholder="6 位验证码"
                  aria-label="6 位验证码"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <div className="row">
                  <button type="submit" disabled={busy} style={{ flex: 1, background: "var(--accent)", borderColor: "transparent", fontWeight: 600 }}>
                    登录
                  </button>
                  <button type="button" disabled={busy} onClick={doResendLogin}>
                    重发
                  </button>
                </div>
              </form>
            )}
            {tab === "code" && step === "form" && (
              <form onSubmit={(e) => { e.preventDefault(); doSendLoginCode(); }}>
                <input
                  type="email"
                  placeholder="注册时用的邮箱"
                  aria-label="注册时用的邮箱"
                  style={{ width: "100%", marginBottom: 10 }}
                  autoComplete="off"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
                <button type="submit" disabled={busy} style={{ width: "100%" }}>
                  发送登录验证码
                </button>
              </form>
            )}

            {msg && (
              <div className="small" role={err ? "alert" : "status"} aria-live="polite" style={{ marginTop: 10, color: err ? "var(--bad)" : "var(--accent)" }}>
                {msg}
              </div>
            )}
            <div className="note-box" style={{ marginTop: 14 }}>
              账号用于跨设备同步进度和保存自定义音源。不登录也能正常练，进度存在本机浏览器里。
            </div>
          </>
        )}
      </div>
    </section>
  );
}
