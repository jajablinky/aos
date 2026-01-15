#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import process from "node:process";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const entry = path.resolve(__dirname, "../src/cli/cmd/tui/index.tsx");
const packageRoot = path.resolve(__dirname, "..");
const defaultBun = path.join(os.homedir(), ".bun", "bin", "bun");
const bunBinary =
  process.env.BUN || (fs.existsSync(defaultBun) ? defaultBun : "bun");
const bunDir = path.dirname(bunBinary);

const child = spawn(
  bunBinary,
  ["--jsx-import-source", "@opentui/solid", entry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_BINARY: process.execPath,
      PATH: [bunDir, process.env.PATH].filter(Boolean).join(path.delimiter),
    },
    cwd: packageRoot,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
