import assert from "node:assert/strict";
import test from "node:test";

import { resolveServerRuntimeConfig } from "./server-runtime-config.js";

test("uses repo defaults when HOST and SERVER_PORT are unset", () => {
  assert.deepEqual(resolveServerRuntimeConfig({}), {
    host: "0.0.0.0",
    port: 3200,
  });
});

test("keeps explicit HOST and SERVER_PORT values", () => {
  assert.deepEqual(
    resolveServerRuntimeConfig({
      HOST: "127.0.0.1",
      SERVER_PORT: "4300",
    }),
    {
      host: "127.0.0.1",
      port: 4300,
    },
  );
});

test("rejects invalid SERVER_PORT values", () => {
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "0" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "-1" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "3.14" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "abc" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "65536" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ SERVER_PORT: "70000" }),
    /SERVER_PORT must be a positive integer between 1 and 65535/,
  );
});
