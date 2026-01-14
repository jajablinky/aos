import "./services/proxy.js";
import "./services/dev.js";
import minimist from "minimist";
import process from "node:process";
import { help } from "./services/help.js";
import { version } from "./services/version.js";
import { blueprints } from "./services/blueprints.js";
import { list } from "./services/list.js";
import { getWallet, getWalletFromArgs } from "./services/wallets.js";
import { address } from "./services/address.js";
import { gql } from "./services/gql.js";
import { chalk } from "./utils/colors.js";
import * as connectSvc from "./services/connect.js";
import * as mainnetSvc from "./services/mainnet.js";
import { config } from "./config.js";
import { SessionEngine } from "./core/session-engine.js";
import {
  runLegacyInteractive,
  runLegacyNonInteractive,
} from "./renderers/legacy-repl.js";
import runTui from "./tui/run.js";

const argv = minimist(process.argv.slice(2));
let luaData = "";

if (!process.stdin.isTTY) {
  process.stdin.on("data", (chunk) => {
    luaData += chunk;
  });
}

if (argv._[0] === "tui") {
  argv._ = argv._.slice(1);
  argv.tui = true;
}

if (argv["get-blueprints"]) {
  blueprints(argv["get-blueprints"]);
  process.exit(0);
}

if (argv.help) {
  help();
  process.exit(0);
}

if (argv.version) {
  version();
  process.exit(0);
}

if (argv.list) {
  const jwk = argv.wallet
    ? await getWalletFromArgs(argv.wallet)
    : await getWallet();
  await list(jwk, { address, gql });
  process.exit(0);
}

const watchMode = argv.watch && argv.watch.length === 43;

if (watchMode) {
  let live = connectSvc.live;

  if (!argv.legacy) {
    process.env.AO_URL = argv.url || config.urls.DEFAULT_HB_NODE;
    process.env.SCHEDULER =
      process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET;
    live = mainnetSvc.liveMainnet;
  }

  if (argv.mainnet) {
    process.env.AO_URL = argv.mainnet;
    process.env.SCHEDULER =
      process.env.SCHEDULER ?? config.addresses.SCHEDULER_MAINNET;
    live = mainnetSvc.liveMainnet;
  }

  live(argv.watch, true).then((res) => {
    process.stdout.write(
      "\n" +
        "\u001b[0G" +
        chalk.green("Watching: ") +
        chalk.blue(argv.watch) +
        "\n",
    );
    return res;
  });
} else {
  const nonInteractive = argv.run || (luaData.length > 0 && argv.load);
  const useLegacy = argv.legacy || nonInteractive;

  if (nonInteractive) {
    const engine = new SessionEngine({ argv, renderer: "legacy" });
    try {
      await engine.initialize({ luaData });
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }

    if (argv.run) {
      if (!argv._.length) {
        console.error(
          chalk.red("The --run flag requires a process name or address."),
        );
        process.exit(1);
      }

      const result = await runLegacyNonInteractive({
        engine,
        command: argv.run,
        dryRunMode: argv["dry-run"] || argv.dryrun,
      });
      process.exit(result?.ok ? 0 : 1);
    }

    if (luaData.length > 0 && argv.load) {
      const result = await runLegacyNonInteractive({
        engine,
        command: luaData,
        dryRunMode: argv["dry-run"] || argv.dryrun,
        spinnerText: "[Connecting To Process...]",
      });
      process.exit(result?.ok ? 0 : 1);
    }

    process.exit(0);
  }

  if (useLegacy) {
    const engine = new SessionEngine({ argv, renderer: "legacy" });
    await runLegacyInteractive({ engine });
    process.exit(0);
  }

  const engine = new SessionEngine({ argv, renderer: "tui" });
  runTui({ engine, luaData });
}
