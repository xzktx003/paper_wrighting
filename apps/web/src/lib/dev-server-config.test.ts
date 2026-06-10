import assert from "node:assert/strict";
import test from "node:test";

import { resolveWebDevConfig } from "./dev-server-config";

test("uses repo port defaults when env is empty", () => {
  assert.deepEqual(resolveWebDevConfig({}), {
    webPort: 3100,
    serverPort: 3200,
    apiTarget: "http://localhost:3200",
    wsTarget: "ws://localhost:3200",
  });
});

test("uses configured WEB_PORT and SERVER_PORT values", () => {
  assert.deepEqual(
    resolveWebDevConfig({
      WEB_PORT: "5100",
      SERVER_PORT: "5200",
    }),
    {
      webPort: 5100,
      serverPort: 5200,
      apiTarget: "http://localhost:5200",
      wsTarget: "ws://localhost:5200",
    },
  );
});

test("uses explicit backend proxy host and port values", () => {
  assert.deepEqual(
    resolveWebDevConfig({
      WEB_BACKEND_HOST: "127.0.0.1",
      WEB_BACKEND_PORT: "6200",
      SERVER_PORT: "5200",
    }),
    {
      webPort: 3100,
      serverPort: 6200,
      apiTarget: "http://127.0.0.1:6200",
      wsTarget: "ws://127.0.0.1:6200",
    },
  );
});

test("uses PORT as the backend proxy fallback when SERVER_PORT is unset", () => {
  assert.deepEqual(
    resolveWebDevConfig({
      PORT: "5300",
    }),
    {
      webPort: 3100,
      serverPort: 5300,
      apiTarget: "http://localhost:5300",
      wsTarget: "ws://localhost:5300",
    },
  );
});

test("rejects invalid port values", () => {
  assert.throws(
    () => resolveWebDevConfig({ WEB_PORT: "abc" }),
    /WEB_PORT must be a positive integer between 1 and 65535/,
  );

  assert.throws(
    () => resolveWebDevConfig({ WEB_BACKEND_PORT: "abc" }),
    /WEB_BACKEND_PORT must be a positive integer between 1 and 65535/,
  );
});

test("rejects ports above 65535", () => {
  assert.throws(
    () => resolveWebDevConfig({ WEB_PORT: "99999" }),
    /WEB_PORT must be a positive integer between 1 and 65535/,
  );

  assert.throws(
    () => resolveWebDevConfig({ SERVER_PORT: "70000" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
});
