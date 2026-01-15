import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type { InputRenderable, KeyEvent } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { LegacyPty } from "../../lib/legacy-pty.js";
import { stripAnsi } from "../../lib/ansi.js";
import TranscriptView from "../../components/TranscriptView.js";
import QueueStatusBar from "../../components/QueueStatusBar.js";
import PromptInput from "../../components/PromptInput.js";
import CommandPalette from "../../dialogs/CommandPalette.js";
import EditorDialog from "../../dialogs/EditorDialog.js";
import HelpDialog from "../../dialogs/HelpDialog.js";
import ConfirmExitDialog from "../../dialogs/ConfirmExitDialog.js";
import type { TranscriptEntry } from "./types.js";

const promptRegex = /[^\s>]+>\s?$/;

type SessionRouteProps = {
  args: string[];
};

export default function SessionRoute(props: SessionRouteProps) {
  const [transcript, setTranscript] = createSignal<TranscriptEntry[]>([]);
  const [queue, setQueue] = createSignal<string[]>([]);
  const [activeLine, setActiveLine] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<"normal" | "editor">("normal");
  const [connectedLabel, setConnectedLabel] = createSignal("Launching...");
  const [lastActivity, setLastActivity] = createSignal(Date.now());
  const [inputValue, setInputValue] = createSignal("");
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorText, setEditorText] = createSignal("");
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [confirmExitOpen, setConfirmExitOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [tick, setTick] = createSignal(0);
  const [bootLog, setBootLog] = createSignal("Waiting for PTY output...");

  let pty: LegacyPty | null = null;
  let buffer = "";
  let entryId = 0;
  let inputElement: InputRenderable | undefined;

  const setInputRef = (node: InputRenderable) => {
    inputElement = node;
  };

  const terminalDimensions = useTerminalDimensions();

  const activityLabel = createMemo(() => {
    tick();
    const delta = Math.max(Date.now() - lastActivity(), 0);
    if (delta < 1000) return "Streaming";
    return `Idle ${Math.round(delta / 1000)}s`;
  });

  const inputFocused = createMemo(
    () => !paletteOpen() && !editorOpen() && !helpOpen() && !confirmExitOpen(),
  );

  const appendEntry = (
    content: string,
    kind: TranscriptEntry["kind"],
  ): void => {
    entryId += 1;
    setTranscript((entries: TranscriptEntry[]) =>
      [...entries, { id: entryId, content, kind }].slice(-2000),
    );
  };

  const detectPrompt = (line: string): boolean => {
    const clean = stripAnsi(line).trimEnd();
    return promptRegex.test(clean);
  };

  const detectProcess = (line: string): void => {
    const clean = stripAnsi(line);
    const match = clean.match(/Your AOS Process:\s+([A-Za-z0-9_-]+)/);
    if (match?.[1]) {
      setConnectedLabel(match[1]);
    }
  };

  const classifyLine = (line: string): TranscriptEntry["kind"] => {
    const clean = stripAnsi(line).trim();
    if (clean.startsWith(">")) return "input";
    if (
      clean.includes("Connecting") ||
      clean.includes("Dispatching") ||
      clean.includes("Signing") ||
      clean.includes("Watching") ||
      clean.includes("Exiting")
    ) {
      return "status";
    }
    return "output";
  };

  const handlePtyData = (chunk: string): void => {
    setLastActivity(Date.now());
    const preview = stripAnsi(chunk).replace(/\s+/g, " ").trim();
    if (preview) {
      setBootLog(`PTY: ${preview.slice(0, 120)}`);
    }
    const normalized = chunk.replace(/\r/g, "\n");
    buffer += normalized;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    lines.forEach((line) => {
      detectProcess(line);
      const kind = classifyLine(line);
      appendEntry(line, kind);
      if (detectPrompt(line)) {
        markReady();
      }
    });
  };

  const flushQueue = (): void => {
    if (busy() || !pty) return;
    const items = queue();
    if (!items.length) return;
    const [next, ...rest] = items;
    setQueue(rest);
    setActiveLine(next);
    setBusy(true);
    pty.writeLine(next);
  };

  const enqueueLine = (line: string): void => {
    if (!line.trim()) return;
    setQueue((items: string[]) => [...items, line]);
    flushQueue();
  };

  const markReady = (): void => {
    if (!busy()) return;
    setBusy(false);
    setActiveLine(null);
    flushQueue();
  };

  const openEditor = (): void => {
    if (!pty) return;
    setEditorOpen(true);
    setMode("editor");
    pty.writeLine(".editor");
  };

  const submitEditor = (): void => {
    if (!pty) return;
    const content = editorText();
    if (content.length > 0) {
      pty.write(content.endsWith("\n") ? content : `${content}\n`);
    }
    pty.writeLine(".done");
    setEditorText("");
    setEditorOpen(false);
    setMode("normal");
  };

  const cancelEditor = (): void => {
    if (!pty) return;
    pty.writeLine(".cancel");
    setEditorText("");
    setEditorOpen(false);
    setMode("normal");
  };

  useKeyboard((key: KeyEvent) => {
    if (editorOpen()) {
      if (key.name === "escape") {
        key.preventDefault?.();
        cancelEditor();
      }
      if (key.name === "return" && key.ctrl) {
        key.preventDefault?.();
        submitEditor();
      }
      return;
    }

    if (paletteOpen() || helpOpen()) {
      if (key.name === "escape") {
        key.preventDefault?.();
        setPaletteOpen(false);
        setHelpOpen(false);
      }
      return;
    }

    if (confirmExitOpen()) {
      if (key.name === "escape") {
        key.preventDefault?.();
        setConfirmExitOpen(false);
      }
      if (key.name === "return") {
        key.preventDefault?.();
        pty?.writeLine(".exit");
        setConfirmExitOpen(false);
      }
      return;
    }

    if (key.name === "p" && key.ctrl) {
      key.preventDefault?.();
      setPaletteOpen(true);
      return;
    }

    if (key.name === "e" && key.ctrl) {
      key.preventDefault?.();
      openEditor();
      return;
    }

    if (key.name === "h" && key.ctrl) {
      key.preventDefault?.();
      setHelpOpen(true);
      return;
    }

    if (key.name === "c" && key.ctrl) {
      key.preventDefault?.();
      setConfirmExitOpen(true);
      return;
    }

    if (key.name === "d" && key.ctrl) {
      key.preventDefault?.();
      pty?.sendCtrlD();
    }
  });

  onMount(() => {
    appendEntry("Starting legacy console...", "status");
    try {
      pty = new LegacyPty(props.args);
      pty.on("data", handlePtyData);
      pty.on("exit", (code) => {
        appendEntry(`Legacy console exited (${code ?? 0}).`, "status");
        setBootLog(`PTY exit: ${code ?? 0}`);
      });
      pty.on("error", (message) => {
        appendEntry(`PTY error: ${message}`, "status");
        setBootLog(`PTY error: ${message}`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEntry(`Failed to spawn PTY: ${message}`, "status");
      setBootLog(`PTY spawn error: ${message}`);
    }

    const interval = setInterval(
      () => setTick((value: number) => value + 1),
      1000,
    );
    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    if (inputFocused() && inputElement) {
      inputElement.focus();
    }
  });

  createEffect(() => {
    const dimensions = terminalDimensions();
    if (pty && dimensions.width && dimensions.height) {
      pty.resize(dimensions.width, dimensions.height);
    }
  });

  onCleanup(() => {
    pty?.dispose();
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor="transparent"
    >
      <TranscriptView entries={transcript()} />
      <QueueStatusBar
        connectedLabel={connectedLabel()}
        mode={mode()}
        activityLabel={activityLabel()}
        activeLine={activeLine()}
        queue={queue()}
      />
      <PromptInput
        value={inputValue()}
        focused={inputFocused()}
        onChange={(value: string) => setInputValue(value)}
        onSubmit={(value) => {
          const trimmed = value.trim();
          if (trimmed === ".editor") {
            setInputValue("");
            openEditor();
            return;
          }
          enqueueLine(value);
          setInputValue("");
        }}
        inputRef={setInputRef}
      />
      <box flexShrink={0} paddingLeft={1} paddingRight={1} paddingBottom={1}>
        <text content={`Boot: ${bootLog()}`} style={{ fg: "#64748B" }} />
      </box>
      <CommandPalette
        visible={paletteOpen()}
        onClose={() => setPaletteOpen(false)}
        onSelect={(command) => {
          if (command === ".editor") {
            openEditor();
          } else {
            setInputValue(command);
          }
        }}
      />
      <EditorDialog
        visible={editorOpen()}
        content={editorText()}
        onChange={setEditorText}
        onSubmit={submitEditor}
        onCancel={cancelEditor}
      />
      <HelpDialog visible={helpOpen()} />
      <ConfirmExitDialog visible={confirmExitOpen()} />
    </box>
  );
}
