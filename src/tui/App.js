import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageFeed from "./components/MessageFeed.js";
import InputBar from "./components/InputBar.js";
import StatusBar from "./components/StatusBar.js";
import PermissionModal from "./components/PermissionModal.js";
import ConfigModal from "./components/ConfigModal.js";
import ChoiceModal from "./components/ChoiceModal.js";
import ClaudeHeader from "./components/ClaudeHeader.js";
import { getReplHelpLines } from "../services/help.js";
import { getPkg } from "../services/get-pkg.js";

const h = React.createElement;
const permissionOptions = ["Allow once", "Always allow", "Deny"];
const configTabs = ["General", "Display", "Network"];

const toPlainLines = (lines) =>
  lines
    .filter((line) => line !== "newline" && line !== "divider")
    .map((line) =>
      typeof line === "string"
        ? line.replace(/\x1b\[[0-9;]*m/g, "")
        : String(line),
    )
    .join("\n");

const formatSplash = (data) => {
  const lines = [
    "Welcome to AOS",
    `Network: ${data.legacy ? "Legacynet" : "Mainnet"}`,
  ];

  if (data.walletAddress) lines.push(`Wallet: ${data.walletAddress}`);
  if (data.mainnetUrl) lines.push(`Node: ${data.mainnetUrl}`);
  if (data.gatewayUrl) lines.push(`Gateway: ${data.gatewayUrl}`);
  if (data.cuUrl) lines.push(`CU: ${data.cuUrl}`);
  if (data.muUrl) lines.push(`MU: ${data.muUrl}`);
  if (data.authority) lines.push(`Authority: ${data.authority}`);
  if (data.scheduler) lines.push(`Scheduler: ${data.scheduler}`);

  return lines.join("\n");
};

export default function App({ engine, luaData }) {
  const { exit } = useApp();
  const pkg = getPkg();
  const [blocks, setBlocks] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [prompt, setPrompt] = useState(engine.prompt);
  const [processId, setProcessId] = useState(null);
  const [variant, setVariant] = useState(null);
  const [isLegacyMode, setIsLegacyMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dryRunMode, setDryRunMode] = useState(engine.dryRunMode);
  const [showTools, setShowTools] = useState(true);
  const [showPermission, setShowPermission] = useState(false);
  const [permissionIndex, setPermissionIndex] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [configTab, setConfigTab] = useState(configTabs[0]);
  const [choicePrompt, setChoicePrompt] = useState(null);
  const [choiceIndex, setChoiceIndex] = useState(0);

  const addBlock = useCallback((block) => {
    setBlocks((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, ...block },
    ]);
  }, []);

  useEffect(() => {
    process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H");
    let isActive = true;

    const handler = (event) => {
      if (!isActive) return;

      switch (event.type) {
        case "session.started":
          addBlock({ role: "system", content: "Starting AOS session…" });
          return;

        case "session.error":
          addBlock({ role: "error", content: event.message });
          return;

        case "session.wallet.loaded":
          addBlock({
            role: "tool",
            title: "wallet",
            content: `Wallet ${event.address}`,
          });
          return;

        case "splash.requested":
          addBlock({ role: "system", content: formatSplash(event) });
          return;

        case "process.registered":
          setProcessId(event.processId);
          setVariant(event.variant || null);
          setIsLegacyMode(!!event.isLegacyMode);
          addBlock({
            role: "tool",
            title: "process",
            content: `Process ${event.processId}`,
          });
          return;

        case "process.connecting":
          addBlock({
            role: "tool",
            title: "connect",
            content: `Connecting to ${event.processId}`,
          });
          return;

        case "process.connected":
          setIsConnected(true);
          setPrompt(event.prompt);
          addBlock({
            role: "system",
            content: `Connected to ${event.processId}`,
          });
          return;

        case "update.notice":
          addBlock({ role: "tool", title: "update", content: event.message });
          return;

        case "update.available":
          addBlock({
            role: "tool",
            title: "update",
            content: `Client update ${event.version} available`,
          });
          return;

        case "tool.action":
          addBlock({
            role: "tool",
            title: event.name,
            content: `${event.status}: ${event.detail}`,
          });
          return;

        case "status":
          addBlock({
            role: "tool",
            title: event.level,
            content: event.message,
          });
          if (typeof event.dryRunMode === "boolean") {
            setDryRunMode(event.dryRunMode);
          }
          return;

        case "input.submitted":
          addBlock({ role: "user", content: event.command });
          return;

        case "eval.requested":
          addBlock({ role: "tool", title: "eval", content: event.command });
          return;

        case "eval.result":
          if (!event.ok) {
            addBlock({
              role: "error",
              content: event.message || "Evaluation failed.",
            });
            return;
          }
          if (event.output !== undefined && event.output !== "") {
            addBlock({ role: "assistant", content: event.output });
          }
          return;

        case "message.received":
          addBlock({ role: "assistant", content: event.data });
          if (event.prompt) setPrompt(event.prompt);
          return;

        case "prompt.updated":
          if (event.prompt) setPrompt(event.prompt);
          return;

        case "help.requested":
          addBlock({
            role: "tool",
            title: "help",
            content: toPlainLines(getReplHelpLines()),
          });
          return;

        case "config.requested":
          setShowConfig(true);
          return;

        case "session.exit":
          engine.cleanup();
          exit();
          return;

        default:
          return;
      }
    };

    engine.onEvent(handler);
    engine.setPromptHandler(
      ({ message, choices }) =>
        new Promise((resolve) => {
          setChoiceIndex(0);
          setChoicePrompt({ message, choices, resolve });
        }),
    );

    const start = async () => {
      try {
        await engine.initialize({ luaData });
        setHistory(engine.getHistory());
        setPrompt(engine.prompt);
        addBlock({
          role: "system",
          content:
            "Shortcuts: Ctrl+O verbose, Ctrl+P permission, .config settings",
        });
        await engine.connect();
        await engine.handleLoadArgs();
        await engine.startLiveMonitor({ silent: true });
      } catch (error) {
        addBlock({ role: "error", content: error.message });
      }
    };

    start();

    return () => {
      isActive = false;
      engine.removeListener("event", handler);
      process.stdout.write("\x1b[?1049l");
    };
  }, [addBlock, engine, exit, luaData]);

  const submitInput = useCallback(async () => {
    const command = input.trim();
    if (!command) return;

    setInput("");
    setHistory((prev) => [...prev.slice(-99), command]);
    setHistoryIndex(-1);
    engine.addToHistory(command);

    await engine.handleInput(command);
  }, [engine, input]);

  useInput((inputChar, key) => {
    if (choicePrompt) {
      if (key.upArrow) {
        setChoiceIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setChoiceIndex((prev) =>
          Math.min(choicePrompt.choices.length - 1, prev + 1),
        );
        return;
      }
      if (key.return) {
        const selected = choicePrompt.choices[choiceIndex];
        choicePrompt.resolve(selected?.value ?? null);
        setChoicePrompt(null);
        return;
      }
      if (key.escape) {
        choicePrompt.resolve(null);
        setChoicePrompt(null);
        return;
      }
      return;
    }

    if (showPermission) {
      if (key.tab) {
        setPermissionIndex((prev) => (prev + 1) % permissionOptions.length);
        return;
      }
      if (key.return) {
        addBlock({
          role: "tool",
          title: "permission",
          content: `Selected ${permissionOptions[permissionIndex]}`,
        });
        setShowPermission(false);
        return;
      }
      if (key.escape) {
        setShowPermission(false);
        return;
      }
      return;
    }

    if (showConfig) {
      if (key.tab) {
        const currentIndex = configTabs.indexOf(configTab);
        const nextIndex = (currentIndex + 1) % configTabs.length;
        setConfigTab(configTabs[nextIndex]);
        return;
      }
      if (key.escape) {
        setShowConfig(false);
        return;
      }
      return;
    }

    if (key.ctrl && inputChar === "c") {
      engine.cleanup();
      exit();
      return;
    }

    if (key.ctrl && inputChar === "o") {
      setShowTools((prev) => !prev);
      return;
    }

    if (key.ctrl && inputChar === "p") {
      setShowPermission(true);
      return;
    }

    if (key.upArrow) {
      if (history.length === 0) return;
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setInput(history[history.length - 1 - nextIndex]);
      return;
    }

    if (key.downArrow) {
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInput("");
        return;
      }
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      setInput(history[history.length - 1 - nextIndex]);
      return;
    }

    if (key.return) {
      submitInput();
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (inputChar) {
      setInput((prev) => prev + inputChar);
    }
  });

  const modal = useMemo(() => {
    if (choicePrompt) {
      return h(ChoiceModal, {
        message: choicePrompt.message,
        choices: choicePrompt.choices,
        selectedIndex: choiceIndex,
      });
    }

    if (showPermission) {
      return h(PermissionModal, { selectedIndex: permissionIndex });
    }

    if (showConfig) {
      return h(ConfigModal, { selectedTab: configTab });
    }

    return null;
  }, [
    choiceIndex,
    choicePrompt,
    configTab,
    permissionIndex,
    showConfig,
    showPermission,
  ]);

  return h(
    Box,
    { flexDirection: "column", height: "100%" },
    h(ClaudeHeader, {
      version: pkg.version,
      processId,
      isLegacyMode,
      variant,
    }),
    h(
      Box,
      { flexDirection: "column", flexGrow: 1 },
      h(MessageFeed, { blocks, showTools }),
      modal ? h(Box, { marginTop: 1, alignItems: "center" }, modal) : null,
    ),
    h(Box, { paddingX: 1, paddingY: 0 }, h(InputBar, { prompt, value: input })),
    h(StatusBar, { processId, isConnected, dryRunMode, showTools, prompt }),
  );
}
