import * as pty from "node-pty";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { createRequire } from "node:module";

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

const require = createRequire(import.meta.url);
const nodeBinary = process.env.NODE_BINARY || process.execPath;

const ensureSpawnHelperExecutable = () => {
  try {
    const entry = require.resolve("node-pty");
    const moduleRoot = path.resolve(path.dirname(entry), "..");
    const helperPath = path.join(
      moduleRoot,
      "prebuilds",
      `${process.platform}-${process.arch}`,
      "spawn-helper",
    );

    if (!fs.existsSync(helperPath)) return;
    const stats = fs.statSync(helperPath);
    if ((stats.mode & 0o111) === 0) {
      fs.chmodSync(helperPath, 0o755);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[pty-bridge] Helper chmod failed: ${detail}\n`);
  }
};

const spawnPty = (binary) =>
  pty.spawn(binary, [legacyEntry, ...args], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: "1",
    },
  });

let ptyProcess;

try {
  ensureSpawnHelperExecutable();
  ptyProcess = spawnPty(nodeBinary);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `[pty-bridge] Failed to spawn ${nodeBinary}: ${detail}\n`,
  );
  if (nodeBinary === process.execPath) {
    throw error;
  }
  ensureSpawnHelperExecutable();
  ptyProcess = spawnPty(process.execPath);
}

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
