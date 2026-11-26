import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import * as Engine from "./engine/index.js";
import { midiFromFilename } from "./screens/SourcesScreen";
import "./index.css";
import "./legacy-compat.css";

// 测试专用出口：e2e.mjs 需要摸到"页面里正在运行的那一份"引擎单例（S/AE/API/Samples/
// BuiltinBass 等），自己另外 import 一次 engine/index.js 会是独立的模块实例、状态对不上。
// `import.meta.env.DEV` 是编译期常量，取决于构建时的 NODE_ENV（不是 --mode）：生产构建
// （`vite build`，部署用的就是这个）NODE_ENV 默认是 production，这整个 if 块连同它对
// Engine/midiFromFilename 的引用会被 dead-code-eliminate 掉，不会出现在产物里；本地
// `vite dev` 或 `npm test`（会先用 NODE_ENV=development 重新构建）才会真的挂上 window。
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 测试桩，不走类型系统
if (import.meta.env.DEV && new URLSearchParams(location.search).has("__test")) {
  (window as any).__ENGINE__ = { ...Engine, midiFromFilename };
}

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
