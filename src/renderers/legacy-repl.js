import readline from "readline";
import ora from "ora";
import { chalk } from "../utils/colors.js";
import { printWithFormat } from "../utils/print.js";
import { printWithoutDisruption } from "../utils/terminal.js";
import { replHelp } from "../services/help.js";
import { splash } from "../services/splash.js";
import { pad } from "../commands/pad.js";
import { outputError } from "../services/errors.js";

function formatStatusMessage({ level, message }) {
  if (level === "error") {
    return chalk.red(message);
  }

  if (level === "success") {
    return chalk.green(message);
  }

  return message;
}

function createLegacyEventHandler({ getRl, setPrompt }) {
  return (event) => {
    const rl = getRl ? getRl() : null;

    switch (event.type) {
      case "splash.requested":
        splash(event);
        return;

      case "process.registered": {
        const variantDisplay = event.variant
          ? ` ${chalk.gray(`${event.variant}`)}`
          : "";
        printWithFormat(
          `Your AOS Process: ${chalk.green(event.processId)}${variantDisplay}`,
        );
        return;
      }

      case "help.requested":
        replHelp();
        return;

      case "config.requested":
        printWithFormat(chalk.gray("Config is available in the TUI renderer."));
        return;

      case "status":
        printWithFormat(formatStatusMessage(event));
        if (typeof event.dryRunMode === "boolean") {
          setPrompt({ dryRunMode: event.dryRunMode });
        }
        return;

      case "update.notice":
        printWithFormat(chalk.green(event.message));
        return;

      case "eval.result":
        if (!event.ok) {
          if (event.error && event.errorOrigin) {
            outputError(event.command, event.error, event.errorOrigin);
          } else {
            printWithFormat(chalk.red(event.message));
          }
          return;
        }

        if (event.output !== undefined) {
          printWithFormat(event.output);
        }
        return;

      case "message.received":
        if (rl) {
          printWithoutDisruption(event.data, rl, false);
        } else {
          printWithFormat(event.data);
        }
        if (event.prompt) {
          setPrompt({ prompt: event.prompt });
        }
        return;

      case "prompt.updated":
        if (event.prompt) {
          setPrompt({ prompt: event.prompt });
        }
        return;

      default:
        return;
    }
  };
}

function resolvePrompt({ prompt, dryRunMode }) {
  return dryRunMode ? `${chalk.red("*")}${prompt}` : prompt;
}

export async function runLegacyInteractive({ engine }) {
  let editorMode = false;
  let editorData = "";
  let dryRunMode = engine.dryRunMode;
  let currentPrompt = engine.prompt;
  const state = { rl: null };

  const spinner = ora({
    spinner: "dots",
    suffixText: "",
    discardStdin: false,
  });

  const setPrompt = ({ prompt, dryRunMode: newDryRunMode } = {}) => {
    if (typeof newDryRunMode === "boolean") {
      dryRunMode = newDryRunMode;
    }
    if (prompt) {
      currentPrompt = prompt;
    }
    if (state.rl) {
      state.rl.setPrompt(resolvePrompt({ prompt: currentPrompt, dryRunMode }));
    }
  };

  const handler = createLegacyEventHandler({
    getRl: () => state.rl,
    setPrompt,
  });
  engine.onEvent(handler);

  try {
    await engine.initialize();
  } catch (error) {
    printWithFormat(chalk.red(error.message));
    return;
  }

  spinner.start();
  spinner.suffixText = chalk.gray("[Connecting To Process...]");
  await engine.connect({ spinner });
  spinner.stop();

  spinner.start();
  spinner.suffixText = chalk.gray("[Signing Message and Sequencing...]");
  await engine.handleLoadArgs({ spinner });
  spinner.stop();

  await engine.startLiveMonitor({ silent: true });

  currentPrompt = engine.prompt;
  const history = engine.getHistory();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    history,
    historySize: 100,
    prompt: resolvePrompt({ prompt: currentPrompt, dryRunMode }),
  });

  state.rl = rl;
  globalThis.rl = rl;
  globalThis.setPrompt = (promptValue) => setPrompt({ prompt: promptValue });

  rl.on("history", (e) => {
    history.concat(e);
  });

  rl.input.on("keypress", (char, key) => {
    if (editorMode && key && key.name === "backspace") {
      const currentLine = rl.line;
      if (currentLine === "" && editorData.length > 0) {
        const lines = editorData.split("\n");
        lines.pop();
        const lastLine = lines.pop() || "";
        editorData = lines.join("\n") + (lines.length > 0 ? "\n" : "");

        readline.moveCursor(process.stdout, 0, -1);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        rl.line = lastLine;
        rl.cursor = lastLine.length;
        rl._refreshLine();
      }
    }
  });

  rl.setPrompt(resolvePrompt({ prompt: currentPrompt, dryRunMode }));
  if (!editorMode) rl.prompt(true);

  rl.on("line", async (line) => {
    if (!editorMode && line.trim() === "") {
      printWithFormat();
      rl.prompt(true);
      return;
    }

    if (!editorMode) {
      const terminalWidth = process.stdout.columns || 80;
      const promptLength = rl.getPrompt().replace(/\x1b\[[0-9;]*m/g, "").length;
      const totalLength = promptLength + line.length;
      const linesUsed = Math.ceil(totalLength / terminalWidth);

      for (let i = 0; i < linesUsed; i++) {
        process.stdout.write("\x1b[1A\r\x1b[K");
      }

      printWithFormat(chalk.gray("> ") + chalk.green(line));
    }

    if (!editorMode && line === ".editor") {
      printWithFormat(
        `<editor mode> use '.done' to submit or '.cancel' to cancel`,
        { lineOnly: true },
      );
      editorMode = true;
      rl.setPrompt("");
      rl.prompt(true);
      return;
    }

    if (editorMode && line === ".done") {
      line = editorData;
      editorData = "";
      editorMode = false;
      printWithFormat("");
      rl.setPrompt(resolvePrompt({ prompt: currentPrompt, dryRunMode }));
    }

    if (editorMode && line === ".delete") {
      const lines = editorData.split("\n");
      lines.pop();
      lines.pop();
      editorData = lines.join("\n") + "\n";
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      return;
    }

    if (editorMode && line === ".print") {
      printWithFormat(editorData);
      editorData = "";
      editorMode = false;
      rl.setPrompt(resolvePrompt({ prompt: currentPrompt, dryRunMode }));
      rl.prompt(true);
      return;
    }

    if (editorMode && line === ".cancel") {
      editorData = "";
      editorMode = false;
      rl.setPrompt(resolvePrompt({ prompt: currentPrompt, dryRunMode }));
      rl.prompt(true);
      return;
    }

    if (editorMode) {
      editorData += line + "\n";
      rl.prompt(true);
      return;
    }

    if (line === ".pad") {
      rl.pause();
      pad(engine.processId, async (err, content) => {
        if (!err) {
          spinner.start();
          spinner.suffixText = chalk.gray("[Dispatching Message...]");
          await engine.evaluateCommand(content, { spinner });
          spinner.stop();
        }
        rl.resume();
        rl.prompt(true);
      });
      return;
    }

    if (line === ".exit") {
      engine.cleanup();
      printWithFormat(chalk.gray("Exiting..."));
      rl.close();
      process.exit(0);
      return;
    }

    engine.addToHistory(line);

    spinner.start();
    spinner.suffixText = chalk.gray("[Dispatching Message...]");

    const result = await engine.handleInput(line, { spinner });

    spinner.stop();

    if (result?.status === "exit") {
      engine.cleanup();
      rl.close();
      process.exit(0);
    }

    rl.prompt(true);
  });

  process.on("SIGINT", function () {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    engine.cleanup();
    process.exit(0);
  });
}

export async function runLegacyNonInteractive({
  engine,
  command,
  dryRunMode = false,
  spinnerText = "[Dispatching Message...]",
}) {
  const spinner = ora({ spinner: "dots", suffixText: "" });
  engine.dryRunMode = dryRunMode;
  const handler = createLegacyEventHandler({
    getRl: () => null,
    setPrompt: () => {},
  });
  engine.onEvent(handler);

  spinner.start();
  spinner.suffixText = chalk.gray(spinnerText);
  const result = await engine.evaluateCommand(command, { spinner });
  spinner.stop();

  return result;
}
