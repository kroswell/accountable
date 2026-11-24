import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const apiPort = process.env.ACCOUNTABLE_API_PORT ?? "8000";
const webPort = process.env.ACCOUNTABLE_WEB_PORT ?? "5173";
const frontendDir = fileURLToPath(new URL("../frontend/", import.meta.url));
const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const children = [
  spawn("uv", ["run", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", apiPort], { stdio: "inherit" }),
  spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", webPort], { cwd: frontendDir, stdio: "inherit" }),
];
let stopping = false;
let exitCode = 0;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  if (children.every((child) => child.exitCode !== null)) process.exitCode = exitCode;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach((child) => child.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
  else if (children.every((item) => item.exitCode !== null)) process.exitCode = exitCode;
}));
console.log(`API: http://127.0.0.1:${apiPort}/api/health`);
console.log(`Web: http://127.0.0.1:${webPort}`);
