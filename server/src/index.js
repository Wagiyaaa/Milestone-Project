require("dotenv").config();
const app = require("./app");
const { debugErrors, getStartupFatalErrors, port } = require("./config/runtime");
const { runStartupTasks } = require("./startup/bootstrap");

async function start() {
  const fatalErrors = getStartupFatalErrors();
  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.join(" "));
  }

  await runStartupTasks();

  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("[startup] Failed to start API", err?.message || err);
  if (debugErrors && err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
