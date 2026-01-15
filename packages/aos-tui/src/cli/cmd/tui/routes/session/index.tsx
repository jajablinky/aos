import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  ScrollBoxRenderable,
  Selection,
} from "@opentui/core";
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
let sharedPty: LegacyPty | null = null;
let sharedPtyArgsKey = "";

type SessionRouteProps = {
  args: string[];
  renderer: CliRenderer;
};

export default function SessionRoute(props: SessionRouteProps) {
  const [transcript, setTranscript] = createSignal<TranscriptEntry[]>([]);
  const [queue, setQueue] = createSignal<string[]>([]);
  const [activeLine, setActiveLine] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<"normal" | "editor">("normal");
  const [connectedLabel, setConnectedLabel] = createSignal("Launching...");
  const [lastActivity, setLastActivity] = createSignal(Date.now());
  const [inputValue, setInputValue] = createSignal("");
  const [homeMode, setHomeMode] = createSignal(true);
  const [paletteOpen, setPaletteOpen] = createSignal(false);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorText, setEditorText] = createSignal("");
  const [helpOpen, setHelpOpen] = createSignal(false);
  const [confirmExitOpen, setConfirmExitOpen] = createSignal(false);
  const [copyToast, setCopyToast] = createSignal("Copied selection");
  const [copyToastVisible, setCopyToastVisible] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [tick, setTick] = createSignal(0);
  const [bootLog, setBootLog] = createSignal(
    "Waiting for first message to start...",
  );

  let pty: LegacyPty | null = null;
  let exitHandler: ((code: number | undefined) => void) | null = null;
  let errorHandler: ((message: string) => void) | null = null;
  let buffer = "";
  let entryId = 0;
  let inputElement: InputRenderable | undefined;
  let transcriptElement: ScrollBoxRenderable | undefined;
  let copyToastTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastCopiedText = "";
  let stdoutInterceptionDisabled = false;

  const setInputRef = (node: InputRenderable) => {
    inputElement = node;
  };

  const setTranscriptRef = (node: ScrollBoxRenderable) => {
    transcriptElement = node;
  };

  const terminalDimensions = useTerminalDimensions();

  const activityLabel = createMemo(() => {
    tick();
    const delta = Math.max(Date.now() - lastActivity(), 0);
    if (delta < 1000) return "Streaming";
    return `Idle ${Math.round(delta / 1000)}s`;
  });

  const inputFocused = createMemo(
    () =>
      homeMode() ||
      (!paletteOpen() && !editorOpen() && !helpOpen() && !confirmExitOpen()),
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

    const carriageParts = chunk.split("\r");
    const tail = carriageParts.pop() ?? "";
    if (carriageParts.length > 0) {
      buffer = "";
      carriageParts.forEach((part) => {
        if (!part.includes("\n")) return;
        const segmentLines = part.split("\n");
        segmentLines.forEach((segmentLine) => {
          if (!segmentLine.trim()) return;
          detectProcess(segmentLine);
          const kind = classifyLine(segmentLine);
          appendEntry(segmentLine, kind);
          if (detectPrompt(segmentLine)) {
            markReady();
          }
        });
      });
    }

    buffer += tail;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    lines.forEach((line) => {
      if (!line.trim()) return;
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

  const ensurePty = (): void => {
    if (pty) return;
    setBootLog("Spawning PTY...");
    try {
      const argsKey = props.args.join("\u0000");
      if (!sharedPty || sharedPtyArgsKey !== argsKey) {
        sharedPty?.dispose();
        sharedPty = new LegacyPty(props.args);
        sharedPtyArgsKey = argsKey;
      }
      pty = sharedPty;
      pty.on("data", handlePtyData);

      exitHandler = (code) => {
        appendEntry(`Legacy console exited (${code ?? 0}).`, "status");
        setBootLog(`PTY exit: ${code ?? 0}`);
      };
      errorHandler = (message) => {
        appendEntry(`PTY error: ${message}`, "status");
        setBootLog(`PTY error: ${message}`);
      };

      pty.on("exit", exitHandler);
      pty.on("error", errorHandler);
      flushQueue();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEntry(`Failed to spawn PTY: ${message}`, "status");
      setBootLog(`PTY spawn error: ${message}`);
    }
  };

  const enqueueLine = (line: string): void => {
    if (!line.trim()) return;
    setQueue((items: string[]) => [...items, line]);
    if (!pty) {
      ensurePty();
    }
    flushQueue();
  };

  const submitHome = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    enqueueLine(trimmed);
    setInputValue("");
    setHomeMode(false);
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

  const showCopyToast = (message: string): void => {
    setCopyToast(message);
    setCopyToastVisible(true);
    if (copyToastTimeout) {
      clearTimeout(copyToastTimeout);
    }
    copyToastTimeout = setTimeout(() => {
      setCopyToastVisible(false);
      copyToastTimeout = null;
    }, 1400);
  };

  const copyToClipboard = (text: string): void => {
    if (!text.trim()) return;
    if (!stdoutInterceptionDisabled) {
      props.renderer.disableStdoutInterception();
      stdoutInterceptionDisabled = true;
    }
    const encoded = Buffer.from(text, "utf8").toString("base64");
    process.stdout.write(`\u001b]52;c;${encoded}\u001b\\`);
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
    if (homeMode()) {
      return;
    }

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

    if (key.name === "pageup") {
      key.preventDefault?.();
      transcriptElement?.scrollBy(-1, "viewport");
      return;
    }

    if (key.name === "pagedown") {
      key.preventDefault?.();
      transcriptElement?.scrollBy(1, "viewport");
      return;
    }

    if (key.name === "home") {
      key.preventDefault?.();
      const transcript = transcriptElement;
      if (!transcript) return;
      transcript.scrollTo({
        x: transcript.scrollLeft,
        y: 0,
      });
      return;
    }

    if (key.name === "end") {
      key.preventDefault?.();
      const transcript = transcriptElement;
      if (!transcript) return;
      transcript.scrollTo({
        x: transcript.scrollLeft,
        y: transcript.scrollHeight,
      });
      return;
    }

    if (key.name === "m" && key.ctrl) {
      key.preventDefault?.();
      props.renderer.useMouse = !props.renderer.useMouse;
      appendEntry(
        `Mouse scrolling ${props.renderer.useMouse ? "enabled" : "disabled"}.`,
        "status",
      );
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
    const handleSelection = (selection: Selection) => {
      if (!selection.isActive || selection.isSelecting) return;
      const text = selection.getSelectedText();
      if (!text || text === lastCopiedText) return;
      lastCopiedText = text;
      copyToClipboard(text);
      showCopyToast(`Copied ${text.length} chars`);
    };

    if (!stdoutInterceptionDisabled) {
      props.renderer.disableStdoutInterception();
      stdoutInterceptionDisabled = true;
    }

    props.renderer.on("selection", handleSelection);

    const interval = setInterval(
      () => setTick((value: number) => value + 1),
      1000,
    );

    onCleanup(() => {
      props.renderer.off("selection", handleSelection);
      if (copyToastTimeout) {
        clearTimeout(copyToastTimeout);
      }
      clearInterval(interval);
    });
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
    if (pty) {
      pty.off("data", handlePtyData);
      if (exitHandler) {
        pty.off("exit", exitHandler);
      }
      if (errorHandler) {
        pty.off("error", errorHandler);
      }
      pty.dispose();
    }
    if (pty && pty === sharedPty) {
      sharedPty = null;
      sharedPtyArgsKey = "";
    }
  });

  return (
    <box width="100%" height="100%">
      {homeMode() ? (
        <box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          width="100%"
          height="100%"
        >
          <text content="AOS" style={{ fg: "#E2E8F0" }} />
          <box paddingTop={1} width="60%">
            <box
              border
              borderStyle="single"
              borderColor="#334155"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              paddingBottom={1}
              width="100%"
            >
              <input
                ref={setInputRef}
                value={inputValue()}
                placeholder="Send a command to aos"
                focused={inputFocused()}
                onInput={setInputValue}
                onSubmit={submitHome}
                style={{
                  textColor: "#E2E8F0",
                  focusedTextColor: "#F8FAFC",
                  backgroundColor: "transparent",
                  focusedBackgroundColor: "transparent",
                  placeholderColor: "#64748B",
                  cursorColor: "#38BDF8",
                }}
              />
            </box>
          </box>
          <box paddingTop={1}>
            <text content="Press Enter to start" style={{ fg: "#64748B" }} />
          </box>
        </box>
      ) : (
        <box
          flexDirection="column"
          width="100%"
          height="100%"
          backgroundColor="#000"
        >
          <TranscriptView entries={transcript()} scrollRef={setTranscriptRef} />
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
          <box
            flexShrink={0}
            paddingLeft={1}
            paddingRight={1}
            paddingBottom={1}
          >
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
          {/* <EditorDialog
            visible={editorOpen()}
            content={editorText()}
            onChange={setEditorText}
            onSubmit={submitEditor}
            onCancel={cancelEditor}
          />
          <HelpDialog visible={helpOpen()} />
          <ConfirmExitDialog visible={confirmExitOpen()} /> */}
          {copyToastVisible() ? (
            <box
              position="absolute"
              top={1}
              right={2}
              border
              borderStyle="single"
              borderColor="#38BDF8"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={0}
              paddingBottom={0}
              zIndex={40}
            >
              <text content={copyToast()} style={{ fg: "#38BDF8" }} />
            </box>
          ) : null}
        </box>
      )}
    </box>
  );
}
