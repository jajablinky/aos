import { render } from "@opentui/solid";
import SessionRoute from "./routes/session/index.js";

const args = process.argv.slice(2);

process.on("uncaughtException", (error) => {
  console.error("[aos-tui] Uncaught exception", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[aos-tui] Unhandled rejection", error);
});

try {
  await render(() => <SessionRoute args={args} />, {
    exitOnCtrlC: true,
  });
} catch (error) {
  console.error("[aos-tui] Failed to render", error);
  process.exitCode = 1;
}
