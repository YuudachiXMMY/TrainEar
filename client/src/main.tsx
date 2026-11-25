import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import * as Engine from "./engine/index.js";
import { midiFromFilename } from "./screens/SourcesScreen";
import "./index.css";
import "./legacy-compat.css";

// 测试专用出口：e2e.mjs 需要摸到"页面里正在运行的那一份"引擎单例（S/AE/API/Samples/
// BuiltinBass 等），自己另外 import 一次 engine/index.js 会是独立的模块实例、状态对不上。
// 只有 URL 带 ?__test=1 时才挂到 window 上，不带这个参数的正常使用完全不受影响。
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 测试桩，不走类型系统
if (new URLSearchParams(location.search).has("__test")) {
  (window as any).__ENGINE__ = { ...Engine, midiFromFilename };
}

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
