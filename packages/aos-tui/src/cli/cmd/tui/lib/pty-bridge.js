import * as pty from "node-pty";
import process from "node:process";
import path from "node:path";

const [, , legacyEntry, ...args] = process.argv;

if (!legacyEntry) {
  console.error("[pty-bridge] Missing legacy entry path.");
  process.exit(1);
}

const cols = process.stdout.columns ?? 120;
const rows = process.stdout.rows ?? 40;

const send = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};

const ptyProcess = pty.spawn(process.execPath, [legacyEntry, ...args], {
  name: "xterm-256color",
  cols,
  rows,
  cwd: process.cwd(),
  env: {
    ...process.env,
    FORCE_COLOR: "1",
  },
});

ptyProcess.onData((data) => send({ type: "data", data }));
ptyProcess.onExit((event) => send({ type: "exit", code: event.exitCode }));

let stdinBuffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk;
  const lines = stdinBuffer.split("\n");
  stdinBuffer = lines.pop() ?? "";

  lines.forEach((line) => {
    if (!line.trim()) return;
    try {
      const command = JSON.parse(line);
      if (command.type === "input") {
        ptyProcess.write(command.data);
      }
      if (command.type === "line") {
        ptyProcess.write(`${command.data}\n`);
      }
      if (command.type === "resize") {
        ptyProcess.resize(command.cols ?? cols, command.rows ?? rows);
      }
      if (command.type === "eof") {
        ptyProcess.write("\u0004");
      }
      if (command.type === "dispose") {
        ptyProcess.kill();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      send({ type: "error", message: `command parse error: ${detail}` });
    }
  });
});

process.on("SIGTERM", () => {
  ptyProcess.kill();
});

process.on("SIGINT", () => {
  ptyProcess.kill();
});
