import { loadEnv } from "./config/env";
import { initSentry } from "./lib/sentry";
import { buildApp } from "./app";

initSentry(loadEnv());
const app = buildApp();

app
  .listen({ port: app.config.PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
