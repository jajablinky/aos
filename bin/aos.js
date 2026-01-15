#!/usr/bin/env node
import url from "node:url";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const legacyEntry = path.resolve(__dirname, "../src/index.js");
const tuiEntry = path.resolve(__dirname, "../packages/aos-tui/bin/aos-tui.js");

const useLegacy = process.env.AOS_LEGACY === "1" || !process.stdin.isTTY;

if (useLegacy) {
  import(legacyEntry);
} else {
  const child = spawn(process.execPath, [tuiEntry, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}
