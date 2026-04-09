require("dotenv").config();
const http = require("http");
const https = require("https");
const app = require("./app");
const {
  debugErrors,
  getStartupFatalErrors,
  httpsEnabled,
  httpsPort,
  port,
} = require("./config/runtime");
const { runStartupTasks } = require("./startup/bootstrap");
const { ensureHttpsCredentials } = require("./startup/https");

async function start() {
  const fatalErrors = getStartupFatalErrors();
  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.join(" "));
  }

  await runStartupTasks();

  if (httpsEnabled) {
    const credentials = await ensureHttpsCredentials();
    https.createServer(credentials, app).listen(httpsPort, () => {
      console.log(`API running on https://localhost:${httpsPort}`);
      console.log(`[https] Certificate: ${credentials.certPath}`);
      console.log(`[https] Key: ${credentials.keyPath}`);
      if (credentials.generated) {
        console.log("[https] Generated a self-signed certificate for local use.");
      }
    });
    return;
  }

  http.createServer(app).listen(port, () => {
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
