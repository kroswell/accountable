import { spawn } from "node:child_process";
const apiPort = process.env.ACCOUNTABLE_API_PORT ?? "8000";
const webPort = process.env.ACCOUNTABLE_WEB_PORT ?? "5173";
const command = (executable, args) => process.platform === "win32"
  ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", [executable, ...args].join(" ")], { stdio: "inherit" })
  : spawn(executable, args, { stdio: "inherit" });
const children = [
  command("uv", ["run", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", apiPort]),
  command(process.platform === "win32" ? "npm.cmd" : "npm", ["--workspace", "frontend", "run", "dev", "--", "--host", "127.0.0.1", "--port", webPort]),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach((child) => child.kill()); process.exit(code); }
process.on("SIGINT", () => stop()); process.on("SIGTERM", () => stop());
children.forEach((child) => child.on("exit", (code) => { if (code && !stopping) stop(code); }));
console.log(`API: http://127.0.0.1:${apiPort}/api/health`);
console.log(`Web: http://127.0.0.1:${webPort}`);
