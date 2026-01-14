import EventEmitter from "events";
import path from "path";
import * as url from "url";
import { evaluate } from "../evaluate.js";
import { register } from "../register.js";
import { dryEval } from "../dry-eval.js";
import { getWallet, getWalletFromArgs } from "../services/wallets.js";
import { address, isAddress } from "../services/address.js";
import * as connectSvc from "../services/connect.js";
import * as mainnetSvc from "../services/mainnet.js";
import { gql } from "../services/gql.js";
import { checkForUpdate, installUpdate } from "../services/version.js";
import { getErrorOrigin, parseError } from "../services/errors.js";
import { getPkg } from "../services/get-pkg.js";
import { monitor } from "../commands/monitor.js";
import { unmonitor } from "../commands/unmonitor.js";
import { load } from "../commands/load.js";
import { loadBlueprint } from "../commands/blueprints.js";
import * as osCommand from "../commands/os.js";
import { readHistory, writeHistory } from "../services/history-service.js";
import { checkLoadArgs } from "../services/loading-files.js";
import { config } from "../config.js";
import {
  shouldShowSplash,
  shouldSuppressVersionBanner,
} from "../services/process-type.js";
import { setEventEmitter } from "../utils/event-bus.js";

export class SessionEngine extends EventEmitter {
  constructor({ argv = {}, renderer = "legacy" } = {}) {
    super();
    this.argv = argv;
    this.renderer = renderer;
    this.services = { ...connectSvc };
    this.processId = null;
    this.variant = null;
    this.wallet = null;
    this.walletAddress = null;
    this.prompt = "aos> ";
    this.history = [];
    this.dryRunMode = false;
    this.liveMonitor = null;
    this.isLegacyMode = false;
    this.luaData = "";
    this.promptHandler = null;
    this.splashEnabled = shouldShowSplash(argv);
    this.suppressVersionBanner = shouldSuppressVersionBanner(argv);
  }

  onEvent(handler) {
    this.on("event", handler);
  }

  emitEvent(type, payload = {}) {
    this.emit("event", { type, ...payload });
  }

  setPromptHandler(handler) {
    this.promptHandler = handler;
  }

  async initialize({ luaData = "" } = {}) {
    this.luaData = luaData;
    this.emitEvent("session.started", { argv: this.argv });
    setEventEmitter((event) => this.emit("event", event));
    globalThis.alerts = {};
    globalThis.prompt = this.prompt;

    this.setupEnvironment();
    await this.setupServices();

    this.wallet = this.argv.wallet
      ? await getWalletFromArgs(this.argv.wallet)
      : await getWallet();
    this.walletAddress = await address(this.wallet);
    this.emitEvent("session.wallet.loaded", {
      address: this.walletAddress,
    });

    await this.registerProcess();

    if ((this.argv.mainnet || !this.argv.legacy) && this.argv.topup) {
      if (this.renderer === "legacy") {
        await mainnetSvc.handleNodeTopup(this.wallet, false);
      } else {
        this.emitEvent("status", {
          level: "info",
          message: "Topup prompts are available in legacy mode.",
        });
      }
    }

    if (this.processId) {
      this.history = readHistory(this.processId);
    }

    await this.handleUpdateCheck();

    return this.getSessionInfo();
  }

  setupEnvironment() {
    if (this.argv.sqlite) {
      process.env.AOS_MODULE = getPkg().aos.sqlite;
    }

    if (this.argv.module) {
      if (this.argv.module.length === 43) {
        process.env.AOS_MODULE = this.argv.module;
      } else {
        process.env.AOS_MODULE_NAME = this.argv.module;
      }
    }

    if (this.argv["gateway-url"]) {
      process.env.GATEWAY_URL = this.argv["gateway-url"];
    }

    if (this.argv["cu-url"]) {
      process.env.CU_URL = this.argv["cu-url"];
    }

    if (this.argv["mu-url"]) {
      process.env.MU_URL = this.argv["mu-url"];
    }

    if (this.argv["authority"]) {
      process.env.AUTHORITY = this.argv["authority"];
    }

    if (this.argv["scheduler"]) {
      process.env.SCHEDULER = this.argv["scheduler"];
    }
  }

  async setupServices() {
    const useMainnet = !this.argv["legacy"];

    if (this.argv["mainnet"]) {
      if (
        typeof this.argv["mainnet"] !== "string" ||
        this.argv["mainnet"].trim() === ""
      ) {
        this.emitEvent("session.error", {
          message: "The --mainnet flag requires a value, e.g. --mainnet <url>",
        });
        throw new Error(
          "The --mainnet flag requires a value, e.g. --mainnet <url>",
        );
      }
      process.env.AO_URL = this.argv["mainnet"];
      process.env.SCHEDULER =
        process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET;
    } else if (useMainnet) {
      process.env.AO_URL = this.argv["url"] || config.urls.DEFAULT_HB_NODE;
      process.env.SCHEDULER =
        process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET;
    }

    if (useMainnet || this.argv["mainnet"]) {
      this.services = {
        sendMessage: mainnetSvc.sendMessageMainnet,
        spawnProcess: mainnetSvc.spawnProcessMainnet,
        readResult: () => null,
        live: mainnetSvc.liveMainnet,
        printLive: mainnetSvc.printLiveMainnet,
        dryrun: () => null,
        monitorProcess: mainnetSvc.monitorProcessMainnet,
        unmonitorProcess: mainnetSvc.unmonitorProcessMainnet,
      };
      return;
    }

    this.services = { ...connectSvc };
  }

  async registerProcess() {
    const { id, variant } = await register(this.wallet, {
      address,
      isAddress,
      spawnProcess: this.services.spawnProcess,
      gql,
      spawnProcessMainnet: mainnetSvc.spawnProcessMainnet,
      promptUser: this.promptHandler,
    });

    this.processId = id;
    this.variant = variant;

    if (variant === "ao.TN.1") {
      this.services = { ...connectSvc };
      process.env.AO_URL = "undefined";
      this.isLegacyMode = true;
    } else {
      this.isLegacyMode = !!this.argv["legacy"];
    }

    if (!this.isLegacyMode && process.env.AO_URL !== "undefined") {
      process.env.WALLET = JSON.stringify(this.wallet);
      this.services.sendMessage = mainnetSvc.sendMessageMainnet;
      this.services.readResult = mainnetSvc.readResultMainnet;
      this.services.live = mainnetSvc.liveMainnet;
      this.services.printLive = mainnetSvc.printLiveMainnet;
    }

    if (!this.processId) {
      this.emitEvent("session.error", {
        message: "Could not find process ID.",
      });
      throw new Error("Could not find process ID.");
    }

    this.emitEvent("process.registered", {
      processId: this.processId,
      variant: this.variant,
      isLegacyMode: this.isLegacyMode,
    });

    if (this.splashEnabled && !this.suppressVersionBanner) {
      const walletAddress = await address(this.wallet);
      this.emitEvent("splash.requested", {
        walletAddress,
        mainnetUrl:
          this.argv["mainnet"] ||
          (!this.argv["legacy"]
            ? this.argv["url"] || config.urls.DEFAULT_HB_NODE
            : undefined),
        gatewayUrl: this.argv["gateway-url"],
        cuUrl: this.argv["cu-url"],
        muUrl: this.argv["mu-url"],
        authority: this.argv["authority"],
        scheduler:
          (this.argv["scheduler"] ?? config.addresses.SCHEDULER_MAINNET) &&
          !this.argv["legacy"]
            ? (process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET)
            : undefined,
        legacy: this.isLegacyMode,
      });
    }
  }

  async handleUpdateCheck() {
    const update = await checkForUpdate();
    if (!update.available || process.env.DEBUG) {
      return;
    }

    this.emitEvent("update.available", { version: update.version });

    if (this.renderer === "legacy") {
      const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
      await installUpdate(update, path.join(__dirname, "../../"));
    }
  }

  getSessionInfo() {
    return {
      processId: this.processId,
      variant: this.variant,
      isLegacyMode: this.isLegacyMode,
      prompt: this.prompt,
      walletAddress: this.walletAddress,
    };
  }

  async connect({ spinner = null } = {}) {
    this.emitEvent("process.connecting", { processId: this.processId });

    let promptResult = await evaluate(
      `require('.process')._version`,
      this.processId,
      this.wallet,
      {
        sendMessage: this.services.sendMessage,
        readResult: this.services.readResult,
      },
      spinner,
      true,
    );

    let prompt =
      promptResult?.Output?.prompt || promptResult?.Output?.data?.prompt;

    for (let i = 0; i < 50; i++) {
      if (prompt !== undefined) {
        break;
      }

      promptResult = await evaluate(
        `require('.process')._version`,
        this.processId,
        this.wallet,
        {
          sendMessage: this.services.sendMessage,
          readResult: this.services.readResult,
        },
        spinner,
      );

      prompt =
        promptResult?.Output?.prompt || promptResult?.Output?.data?.prompt;
    }

    if (prompt === undefined) {
      this.emitEvent("session.error", {
        message: "Could not connect to process!",
      });
      throw new Error("Could not connect to process!");
    }

    const aosVersion = getPkg().aos.version;
    if (
      promptResult.Output?.data?.output !== aosVersion &&
      promptResult.Output?.data !== aosVersion
    ) {
      if (promptResult.Output?.data !== "dev") {
        this.emitEvent("update.notice", {
          message: "A new AOS update is available. run [.update] to install.",
        });
      }
    }

    this.prompt = prompt;
    this.emitEvent("process.connected", {
      processId: this.processId,
      prompt: this.prompt,
      variant: this.variant,
      isLegacyMode: this.isLegacyMode,
    });

    return this.prompt;
  }

  async handleLoadArgs({ spinner = null } = {}) {
    const loadCode = checkLoadArgs()
      .map((file) => `.load ${file}`)
      .map((line) => load(line)[0])
      .join("\n");

    if (!loadCode) {
      return;
    }

    this.emitEvent("tool.action", {
      name: "load",
      status: "running",
      detail: "Loading startup files",
    });

    await evaluate(
      loadCode,
      this.processId,
      this.wallet,
      {
        sendMessage: this.services.sendMessage,
        readResult: this.services.readResult,
      },
      spinner,
    ).catch((err) => ({
      Output: JSON.stringify({ data: { output: err.message } }),
    }));

    this.emitEvent("tool.action", {
      name: "load",
      status: "success",
      detail: "Loaded startup files",
    });
  }

  async startLiveMonitor({ silent = false } = {}) {
    this.liveMonitor = await this.services.live(this.processId);
    if (this.liveMonitor) {
      this.liveMonitor.start();
    }
    if (!silent) {
      this.emitEvent("status", {
        level: "info",
        message: "=== Starting Live Feed ===",
      });
    }
    return this.liveMonitor;
  }

  stopLiveMonitor({ silent = false } = {}) {
    if (this.liveMonitor) {
      this.liveMonitor.stop();
    }
    if (!silent) {
      this.emitEvent("status", {
        level: "info",
        message: "=== Pausing Live Feed ===",
      });
    }
  }

  async handleInput(command, { spinner = null, loadedModules = [] } = {}) {
    if (!command.trim()) {
      return { status: "empty" };
    }

    this.emitEvent("input.submitted", { command });

    if (command.startsWith(".")) {
      return await this.handleDotCommand(command, { spinner, loadedModules });
    }

    return await this.evaluateCommand(command, { spinner, loadedModules });
  }

  async handleDotCommand(command, { spinner = null, loadedModules = [] } = {}) {
    const trimmed = command.trim();

    if (trimmed === ".help") {
      this.emitEvent("help.requested");
      return { status: "handled" };
    }

    if (trimmed === ".live") {
      await this.startLiveMonitor();
      return { status: "handled" };
    }

    if (trimmed === ".pause") {
      this.stopLiveMonitor();
      return { status: "handled" };
    }

    if (trimmed === ".dryrun") {
      this.dryRunMode = !this.dryRunMode;
      this.emitEvent("status", {
        level: "info",
        message: this.dryRunMode
          ? "Dryrun Mode Engaged"
          : "Dryrun Mode Disengaged",
        dryRunMode: this.dryRunMode,
      });
      return { status: "handled" };
    }

    if (trimmed === ".monitor") {
      try {
        const result = await monitor(this.wallet, this.processId, {
          monitorProcess: this.services.monitorProcess,
        });
        this.emitEvent("status", { level: "success", message: result });
      } catch (error) {
        this.emitEvent("status", {
          level: "error",
          message: "Could not monitor process!",
        });
      }
      return { status: "handled" };
    }

    if (trimmed === ".unmonitor") {
      try {
        const result = await unmonitor(this.wallet, this.processId, {
          unmonitorProcess: this.services.unmonitorProcess,
        });
        this.emitEvent("status", { level: "success", message: result });
      } catch (error) {
        this.emitEvent("status", {
          level: "error",
          message: "Monitor not found!",
        });
      }
      return { status: "handled" };
    }

    if (trimmed === ".exit") {
      this.emitEvent("session.exit");
      return { status: "exit" };
    }

    if (trimmed === ".config") {
      this.emitEvent("config.requested");
      return { status: "handled" };
    }

    if (trimmed === ".pad") {
      this.emitEvent("pad.requested");
      return { status: "handled" };
    }

    if (/^\.load-blueprint/.test(trimmed)) {
      try {
        const newCommand = loadBlueprint(trimmed);
        this.emitEvent("tool.action", {
          name: "load-blueprint",
          status: "running",
          detail: trimmed,
        });
        const result = await this.evaluateCommand(newCommand, {
          spinner,
          loadedModules,
        });
        this.emitEvent("tool.action", {
          name: "load-blueprint",
          status: "success",
          detail: trimmed,
        });
        return result;
      } catch (error) {
        this.emitEvent("tool.action", {
          name: "load-blueprint",
          status: "error",
          detail: error.message,
        });
        return { status: "error", error };
      }
    }

    if (/^\.load/.test(trimmed)) {
      try {
        const [line, modules] = load(trimmed);
        this.emitEvent("tool.action", {
          name: "load",
          status: "running",
          detail: trimmed,
        });
        const result = await this.evaluateCommand(line, {
          spinner,
          loadedModules: modules,
        });
        this.emitEvent("tool.action", {
          name: "load",
          status: "success",
          detail: trimmed,
        });
        return result;
      } catch (error) {
        this.emitEvent("tool.action", {
          name: "load",
          status: "error",
          detail: error.message,
        });
        return { status: "error", error };
      }
    }

    if (trimmed === ".update") {
      const commandToRun = osCommand.update();
      this.emitEvent("tool.action", {
        name: "update",
        status: "running",
        detail: "Updating AOS process",
      });
      const result = await this.evaluateCommand(commandToRun, {
        spinner,
        loadedModules,
      });
      this.emitEvent("tool.action", {
        name: "update",
        status: "success",
        detail: "Update complete",
      });
      return result;
    }

    return { status: "unhandled" };
  }

  async evaluateCommand(command, { spinner = null, loadedModules = [] } = {}) {
    this.emitEvent("eval.requested", { command, dryRun: this.dryRunMode });

    const evaluator = this.dryRunMode
      ? () =>
          dryEval(
            command,
            this.processId,
            this.wallet,
            { dryrun: this.services.dryrun },
            spinner,
          )
      : () =>
          evaluate(
            command,
            this.processId,
            this.wallet,
            {
              sendMessage: this.services.sendMessage,
              readResult: this.services.readResult,
            },
            spinner,
          );

    const result = await evaluator().catch((err) => ({
      Error: err.message || err,
    }));
    const handled = this.handleEvaluationResult(result, loadedModules);

    this.emitEvent("eval.result", {
      command,
      ...handled,
    });

    if (handled.prompt) {
      this.emitEvent("prompt.updated", { prompt: handled.prompt });
    }

    return handled;
  }

  handleEvaluationResult(result, loadedModules = []) {
    const output = result?.Output;
    const errorPayload = result?.Error || result?.error;

    if (errorPayload) {
      const error = parseError(errorPayload);
      if (error) {
        const errorOrigin = getErrorOrigin(loadedModules, error.lineNumber);
        return {
          ok: false,
          type: "error",
          message: errorPayload,
          error,
          errorOrigin,
        };
      }

      return { ok: false, type: "error", message: errorPayload };
    }

    if (output?.data) {
      let response = "";

      if (Object.prototype.hasOwnProperty.call(output.data, "output")) {
        response = output.data.output;
      } else if (Object.prototype.hasOwnProperty.call(output.data, "prompt")) {
        response = "";
      } else {
        response = output.data;
      }

      const nextPrompt = Object.prototype.hasOwnProperty.call(
        output.data,
        "prompt",
      )
        ? output.data.prompt
        : output.prompt;

      if (nextPrompt) {
        this.prompt = nextPrompt;
      }

      return {
        ok: true,
        type: "success",
        output: response,
        prompt: nextPrompt,
      };
    }

    if (!output) {
      return {
        ok: false,
        type: "error",
        message: "An unknown error occurred.",
      };
    }

    if (typeof output === "string") {
      return { ok: true, type: "success", output };
    }

    return { ok: true, type: "success", output };
  }

  addToHistory(command) {
    this.history.push(command);
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  getHistory() {
    return [...this.history];
  }

  saveHistory() {
    if (this.processId && this.history.length > 0) {
      writeHistory(this.processId, this.history);
    }
  }

  cleanup() {
    if (this.liveMonitor) {
      this.liveMonitor.stop();
    }
    this.saveHistory();
  }
}

export default SessionEngine;
