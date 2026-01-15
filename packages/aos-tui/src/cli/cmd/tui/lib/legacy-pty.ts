import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type LegacyPtyEvents = {
  data: (data: string) => void;
  exit: (code: number | undefined) => void;
  error: (message: string) => void;
};

type BridgeMessage =
  | { type: "data"; data: string }
  | { type: "exit"; code: number | undefined }
  | { type: "error"; message: string };

type BridgeCommand =
  | { type: "input"; data: string }
  | { type: "line"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "eof" }
  | { type: "dispose" };

export class LegacyPty extends EventEmitter {
  private readonly child;
  private buffer = "";

  constructor(args: string[]) {
    super();

    const entryDir = path.dirname(fileURLToPath(import.meta.url));
    const rootDir = path.resolve(entryDir, "../../../../../..");
    const legacyEntry = path.resolve(rootDir, "src/index.js");
    const bridgeEntry = path.resolve(entryDir, "./pty-bridge.js");

    const nodeCandidates = [
      process.env.NODE_BINARY,
      process.env.NVM_BIN ? path.join(process.env.NVM_BIN, "node") : undefined,
      process.execPath,
      "node",
    ].filter(Boolean) as string[];

    const resolvedNode =
      nodeCandidates.find((candidate) =>
        candidate === "node" ? true : fs.existsSync(candidate),
      ) ?? "node";

    const nodeDir = path.dirname(resolvedNode);

    this.child = spawn(resolvedNode, [bridgeEntry, legacyEntry, ...args], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_BINARY: resolvedNode,
        PATH: [nodeDir, process.env.PATH].filter(Boolean).join(path.delimiter),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");

    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk) =>
      this.emit("error", `bridge stderr: ${chunk}`),
    );

    this.child.on("exit", (code) => this.emit("exit", code ?? 0));
  }

  override on<Event extends keyof LegacyPtyEvents>(
    event: Event,
    listener: LegacyPtyEvents[Event],
  ): this {
    return super.on(event, listener);
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    lines.forEach((line) => {
      if (!line.trim()) return;
      try {
        const message = JSON.parse(line) as BridgeMessage;
        if (message.type === "data") {
          this.emit("data", message.data);
          return;
        }
        if (message.type === "exit") {
          this.emit("exit", message.code);
          return;
        }
        if (message.type === "error") {
          this.emit("error", message.message);
          return;
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.emit("error", `bridge parse error: ${detail}`);
      }
    });
  }

  private send(command: BridgeCommand): void {
    this.child.stdin.write(`${JSON.stringify(command)}\n`);
  }

  write(data: string): void {
    this.send({ type: "input", data });
  }

  writeLine(line: string): void {
    this.send({ type: "line", data: line });
  }

  resize(cols: number, rows: number): void {
    this.send({ type: "resize", cols, rows });
  }

  sendCtrlD(): void {
    this.send({ type: "eof" });
  }

  dispose(): void {
    this.send({ type: "dispose" });
    this.child.kill();
  }
}
