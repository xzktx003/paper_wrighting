import assert from "node:assert/strict";
import test from "node:test";

import { parseSshConfigContent } from "./ssh-config-parser.js";

test("parseSshConfigContent expands multiple concrete aliases from one Host entry", () => {
  const presets = parseSshConfigContent(
    [
      "Host gpu22 gpu22-lan *.internal",
      "  HostName 10.30.0.22",
      "  Port 2222",
      "  User xuzk",
      "  IdentityFile ~/.ssh/id_gpu",
    ].join("\n"),
    "/home/tester",
  );

  assert.deepEqual(presets, [
    {
      name: "gpu22",
      host: "10.30.0.22",
      port: 2222,
      username: "xuzk",
      identityFile: "/home/tester/.ssh/id_gpu",
      defaultPath: "~/",
    },
    {
      name: "gpu22-lan",
      host: "10.30.0.22",
      port: 2222,
      username: "xuzk",
      identityFile: "/home/tester/.ssh/id_gpu",
      defaultPath: "~/",
    },
  ]);
});

test("parseSshConfigContent falls back to port 22 for invalid SSH config ports", () => {
  const presets = parseSshConfigContent(
    [
      "Host broken-port",
      "  HostName 10.30.0.23",
      "  Port not-a-number",
    ].join("\n"),
  );

  assert.equal(presets[0]?.port, 22);
});

test("parseSshConfigContent rejects partially numeric SSH config ports", () => {
  const presets = parseSshConfigContent(
    [
      "Host partial-port",
      "  HostName 10.30.0.24",
      "  Port 2222abc",
    ].join("\n"),
  );

  assert.equal(presets[0]?.port, 22);
});
