import { expect, test } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

const ONE_BY_ONE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pX6lzUAAAAASUVORK5CYII=";

function setupFixture() {
  const rootDir = mkdtempSync(
    path.join(process.cwd(), "tests/e2e/file-browser-runtime-"),
  );

  mkdirSync(path.join(rootDir, "nested"), { recursive: true });
  writeFileSync(path.join(rootDir, "note.txt"), "hello file browser");
  writeFileSync(path.join(rootDir, ".secret.txt"), "hidden file");
  writeFileSync(path.join(rootDir, "rename-me.txt"), "rename me");
  writeFileSync(path.join(rootDir, "delete-me.txt"), "delete me");
  writeFileSync(
    path.join(rootDir, "photo.png"),
    Buffer.from(ONE_BY_ONE_PNG, "base64"),
  );

  const uploadFilePath = path.join(tmpdir(), `upload-${Date.now()}.txt`);
  writeFileSync(uploadFilePath, "uploaded from playwright");

  return {
    rootDir,
    uploadFilePath,
    folderName: path.basename(rootDir),
  };
}

interface RemoteFixture {
  rootDir: string;
  uploadFilePath: string;
  hostName: string;
  sshdDir: string;
  port: number;
  sshdProcess: ChildProcess;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startRemoteSshFixture(): RemoteFixture {
  const rootDir = mkdtempSync(path.join(tmpdir(), "file-browser-remote-"));
  mkdirSync(path.join(rootDir, "nested"), { recursive: true });
  writeFileSync(path.join(rootDir, "note.txt"), "hello remote file browser");
  writeFileSync(path.join(rootDir, ".secret.txt"), "remote hidden file");
  writeFileSync(path.join(rootDir, "rename-me.txt"), "remote rename me");
  writeFileSync(path.join(rootDir, "delete-me.txt"), "remote delete me");
  writeFileSync(
    path.join(rootDir, "photo.png"),
    Buffer.from(ONE_BY_ONE_PNG, "base64"),
  );

  const uploadFilePath = path.join(tmpdir(), `remote-upload-${Date.now()}.txt`);
  writeFileSync(uploadFilePath, "uploaded to remote ssh fixture");

  const sshdDir = mkdtempSync(path.join(tmpdir(), "file-browser-sshd-"));
  const clientKeyPath = path.join(sshdDir, "client_key");
  const hostKeyPath = path.join(sshdDir, "host_key");
  const authorizedKeysPath = path.join(sshdDir, "authorized_keys");
  const sshdConfigPath = path.join(sshdDir, "sshd_config");
  const sshdLogPath = path.join(sshdDir, "sshd.log");
  const port = 22330 + Math.floor(Math.random() * 1000);

  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-f", clientKeyPath], {
    stdio: "ignore",
  });
  execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-f", hostKeyPath], {
    stdio: "ignore",
  });
  copyFileSync(`${clientKeyPath}.pub`, authorizedKeysPath);

  writeFileSync(
    sshdConfigPath,
    [
      `Port ${port}`,
      "ListenAddress 127.0.0.1",
      `HostKey ${hostKeyPath}`,
      `PidFile ${path.join(sshdDir, "sshd.pid")}`,
      `AuthorizedKeysFile ${authorizedKeysPath}`,
      "PasswordAuthentication no",
      "KbdInteractiveAuthentication no",
      "ChallengeResponseAuthentication no",
      "UsePAM no",
      "PermitRootLogin no",
      `AllowUsers ${process.env.USER ?? "xuzk"}`,
      "StrictModes no",
      "PubkeyAuthentication yes",
      "Subsystem sftp internal-sftp",
      "LogLevel VERBOSE",
    ].join("\n"),
    "utf8",
  );

  const sshdProcess = spawn(
    "/usr/sbin/sshd",
    ["-D", "-f", sshdConfigPath, "-E", sshdLogPath],
    {
      stdio: "ignore",
    },
  );

  const hostName = `playwright-ssh-${Date.now()}`;

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const output = execFileSync(
        "ssh",
        [
          "-o",
          "StrictHostKeyChecking=no",
          "-o",
          "UserKnownHostsFile=/dev/null",
          "-i",
          clientKeyPath,
          "-p",
          String(port),
          `${process.env.USER ?? "xuzk"}@127.0.0.1`,
          "pwd",
        ],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      if (output.trim() === homedir()) {
        return {
          rootDir,
          uploadFilePath,
          hostName,
          sshdDir,
          port,
          sshdProcess,
        };
      }
    } catch {
      // wait for sshd to become ready
    }
  }

  sshdProcess.kill("SIGKILL");
  throw new Error("remote ssh fixture did not become ready");
}

async function openRemoteFixture(
  page: Parameters<typeof test>[0]["page"],
  fixture: RemoteFixture,
) {
  const drawer = page.getByTestId("file-browser-drawer");
  await page.route("**/api/ssh-hosts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        hosts: [
          {
            name: fixture.hostName,
            host: "127.0.0.1",
            port: fixture.port,
            username: process.env.USER ?? "xuzk",
            identityFile: path.join(fixture.sshdDir, "client_key"),
            defaultPath: fixture.rootDir,
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("file-browser-toggle").click();
  await expect(drawer).toBeVisible();

  await drawer.getByTestId("file-browser-host-toggle").click();
  await page
    .locator(".host-dropdown-item", { hasText: fixture.hostName })
    .click();
  await expect(drawer.getByTestId("file-entry-note.txt")).toBeVisible({
    timeout: 15_000,
  });
}

async function openFixtureDirectory(
  page: Parameters<typeof test>[0]["page"],
  folderName: string,
) {
  await page.goto("/");
  await page.getByTestId("file-browser-toggle").click();
  const drawer = page.getByTestId("file-browser-drawer");
  await expect(drawer).toBeVisible();

  await drawer.getByTestId("file-entry-tests").dblclick();
  await drawer.getByTestId("file-entry-e2e").dblclick();
  await drawer.getByTestId(`file-entry-${folderName}`).dblclick();
  await expect(drawer.getByTestId("file-entry-note.txt")).toBeVisible();
}

test("file browser supports real local browsing, edit, upload, download, and delete flows", async ({
  page,
}) => {
  const fixture = setupFixture();

  try {
    const drawer = page.getByTestId("file-browser-drawer");
    await openFixtureDirectory(page, fixture.folderName);

    await expect(drawer.getByTestId("file-entry-.secret.txt")).toHaveCount(0);
    await drawer.getByLabel("显示隐藏文件").check();
    await drawer.getByRole("button", { name: "刷新" }).click();
    await expect(drawer.getByTestId("file-entry-.secret.txt")).toBeVisible();

    await drawer.getByRole("button", { name: "新建" }).click();
    const createDialog = page.locator(".file-browser-dialog").first();
    await createDialog.locator("input").fill("created-folder");
    await createDialog.getByRole("button", { name: "创建" }).click();
    await expect(drawer.getByTestId("file-entry-created-folder")).toBeVisible();

    await drawer
      .getByTestId("file-entry-rename-me.txt")
      .click({ button: "right" });
    await page.getByRole("button", { name: "重命名" }).click();
    const renameDialog = page.locator(".file-browser-dialog").first();
    await renameDialog.locator("input").fill("renamed.txt");
    await renameDialog.getByRole("button", { name: "保存" }).click();
    await expect(drawer.getByTestId("file-entry-renamed.txt")).toBeVisible();

    await drawer
      .getByTestId("file-entry-note.txt")
      .getByRole("checkbox")
      .check();
    await expect(drawer.locator(".file-browser-preview-text")).toContainText(
      "hello file browser",
    );

    await drawer.getByTestId("file-entry-note.txt").dblclick();
    const editor = drawer.locator(".file-browser-editor");
    await expect(editor).toBeVisible();
    await editor.fill("hello file browser\nedited by playwright");
    await drawer.getByRole("button", { name: "保存" }).click();
    await drawer
      .getByTestId("file-entry-note.txt")
      .getByRole("checkbox")
      .check();
    await expect(drawer.locator(".file-browser-preview-text")).toContainText(
      "edited by playwright",
    );

    await drawer
      .getByTestId("file-entry-note.txt")
      .getByRole("checkbox")
      .uncheck();
    await drawer
      .getByTestId("file-entry-photo.png")
      .getByRole("checkbox")
      .check();
    await expect(drawer.locator(".file-browser-preview-image")).toBeVisible();

    await drawer
      .locator('input[type="file"]')
      .setInputFiles(fixture.uploadFilePath);
    await expect(
      drawer.getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`),
    ).toBeVisible();

    await drawer
      .getByTestId("file-entry-photo.png")
      .getByRole("checkbox")
      .uncheck();
    await drawer
      .getByTestId("file-entry-renamed.txt")
      .getByRole("checkbox")
      .check();
    const downloadPromise = page.waitForEvent("download");
    await drawer.getByRole("button", { name: "下载" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("renamed.txt");

    await drawer
      .getByTestId("file-entry-delete-me.txt")
      .getByRole("checkbox")
      .check();
    await drawer
      .getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`)
      .getByRole("checkbox")
      .check();
    page.once("dialog", (dialog) => dialog.accept());
    await drawer.getByRole("button", { name: "删除" }).click();
    await expect(drawer.getByTestId("file-entry-delete-me.txt")).toHaveCount(0);
    await expect(
      drawer.getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`),
    ).toHaveCount(0);
  } finally {
    rmSync(fixture.rootDir, { recursive: true, force: true });
    rmSync(fixture.uploadFilePath, { force: true });
  }
});

test("file browser uses a top-bar toggle, keeps edit flow, supports both splitters, and resets local root to home semantics", async ({
  page,
}) => {
  await page.goto("/");

  const topBar = page.locator(".top-bar");
  const topToggle = topBar.getByTestId("file-browser-toggle");
  await expect(topToggle).toBeVisible();
  await topToggle.click();

  const drawer = page.getByTestId("file-browser-drawer");
  await expect(drawer).toBeVisible();

  await expect(
    drawer.locator(".file-browser-breadcrumb").first(),
  ).toContainText("data01");
  await expect(drawer.locator(".file-browser-breadcrumb").nth(1)).toContainText(
    "home",
  );

  const mainSplitter = page.getByTestId("file-browser-main-splitter");
  const drawerBefore = await drawer.boundingBox();
  await mainSplitter.hover();
  await page.mouse.down();
  await page.mouse.move(
    (drawerBefore?.x ?? 0) + (drawerBefore?.width ?? 0) + 120,
    300,
  );
  await page.mouse.up();
  const drawerAfter = await drawer.boundingBox();
  expect((drawerAfter?.width ?? 0) > (drawerBefore?.width ?? 0)).toBeTruthy();

  const previewSplitter = drawer.getByTestId("file-browser-preview-splitter");
  const previewBefore = await drawer
    .locator(".file-browser-preview")
    .boundingBox();
  const splitterBox = await previewSplitter.boundingBox();
  await page.mouse.move(
    (splitterBox?.x ?? 0) + (splitterBox?.width ?? 0) / 2,
    (splitterBox?.y ?? 0) + 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    (splitterBox?.x ?? 0) + (splitterBox?.width ?? 0) / 2,
    (splitterBox?.y ?? 0) - 80,
  );
  await page.mouse.up();
  const previewAfter = await drawer
    .locator(".file-browser-preview")
    .boundingBox();
  expect(
    (previewAfter?.height ?? 0) > (previewBefore?.height ?? 0),
  ).toBeTruthy();

  await drawer.getByTestId("file-entry-docs").dblclick();
  await drawer.getByTestId("file-entry-readme-assets").dblclick();
  await drawer
    .getByTestId("file-entry-board-overview.png")
    .getByRole("checkbox")
    .check();
  await expect(drawer.locator(".file-browser-preview-image")).toBeVisible();

  await drawer.getByTestId("file-entry-board-overview.png").dblclick();
  await expect(drawer.locator(".file-browser-editor")).toHaveCount(0);

  await page.reload();
  await topBar.getByTestId("file-browser-toggle").click();
  const reloadedDrawer = page.getByTestId("file-browser-drawer");
  await expect(reloadedDrawer).toBeVisible();
  await expect(
    reloadedDrawer.locator(".file-browser-breadcrumb").first(),
  ).toContainText("data01");
  await expect(
    reloadedDrawer.locator(".file-browser-breadcrumb").nth(1),
  ).toContainText("home");
});

test("file browser supports real SSH/SFTP browsing, edit, chmod, upload, download, and delete flows", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const fixture = startRemoteSshFixture();

  try {
    const drawer = page.getByTestId("file-browser-drawer");
    await openRemoteFixture(page, fixture);

    await expect(drawer.getByTestId("file-entry-.secret.txt")).toHaveCount(0);
    await drawer.getByLabel("显示隐藏文件").check();
    await drawer.getByRole("button", { name: "刷新" }).click();
    await expect(drawer.getByTestId("file-entry-.secret.txt")).toBeVisible();

    await drawer
      .getByTestId("file-entry-note.txt")
      .getByRole("checkbox")
      .check();
    await expect(drawer.locator(".file-browser-preview-text")).toContainText(
      "hello remote file browser",
    );

    await drawer.getByTestId("file-entry-note.txt").dblclick();
    const editor = drawer.locator(".file-browser-editor");
    await expect(editor).toBeVisible();
    await editor.fill("hello remote file browser\nedited over ssh");
    await drawer.getByRole("button", { name: "保存" }).click();
    await drawer
      .getByTestId("file-entry-note.txt")
      .getByRole("checkbox")
      .check();
    await expect(drawer.locator(".file-browser-preview-text")).toContainText(
      "edited over ssh",
    );

    await drawer
      .getByTestId("file-entry-rename-me.txt")
      .click({ button: "right" });
    await page.getByRole("button", { name: "重命名" }).click();
    const renameDialog = page.locator(".file-browser-dialog").first();
    await renameDialog.locator("input").fill("renamed-remote.txt");
    await renameDialog.getByRole("button", { name: "保存" }).click();
    await expect(
      drawer.getByTestId("file-entry-renamed-remote.txt"),
    ).toBeVisible();

    await drawer
      .getByTestId("file-entry-renamed-remote.txt")
      .getByRole("checkbox")
      .check();
    await drawer.getByRole("button", { name: "chmod" }).click();
    const chmodDialog = page.locator(".file-browser-dialog").first();
    await chmodDialog
      .locator(".file-browser-chmod-group")
      .nth(1)
      .getByLabel("r")
      .uncheck();
    await chmodDialog
      .locator(".file-browser-chmod-group")
      .nth(1)
      .getByLabel("w")
      .uncheck();
    await chmodDialog
      .locator(".file-browser-chmod-group")
      .nth(2)
      .getByLabel("r")
      .uncheck();
    await chmodDialog.getByRole("button", { name: /应用 600/ }).click();
    await expect(
      drawer.getByTestId("file-entry-renamed-remote.txt"),
    ).toContainText("-rw-------");

    await drawer
      .locator('input[type="file"]')
      .setInputFiles(fixture.uploadFilePath);
    await expect(
      drawer.getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`),
    ).toBeVisible();

    await drawer
      .getByTestId("file-entry-renamed-remote.txt")
      .getByRole("checkbox")
      .check();
    await expect(drawer.getByRole("button", { name: "下载" })).toBeEnabled();
    const downloadResponse = await request.post("/api/fs/download", {
      data: {
        path: path.join(fixture.rootDir, "renamed-remote.txt"),
        sshTarget: {
          host: "127.0.0.1",
          port: fixture.port,
          username: process.env.USER ?? "xuzk",
          identityFile: path.join(fixture.sshdDir, "client_key"),
        },
      },
    });
    expect(downloadResponse.ok()).toBeTruthy();
    await expect(await downloadResponse.body()).toBeTruthy();

    await drawer
      .getByTestId("file-entry-delete-me.txt")
      .getByRole("checkbox")
      .check();
    await drawer
      .getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`)
      .getByRole("checkbox")
      .check();
    page.once("dialog", (dialog) => dialog.accept());
    await drawer.getByRole("button", { name: "删除" }).click();
    await expect(drawer.getByTestId("file-entry-delete-me.txt")).toHaveCount(0);
    await expect(
      drawer.getByTestId(`file-entry-${path.basename(fixture.uploadFilePath)}`),
    ).toHaveCount(0);
  } finally {
    fixture.sshdProcess.kill("SIGKILL");
    await wait(100);
    rmSync(fixture.rootDir, { recursive: true, force: true });
    rmSync(fixture.uploadFilePath, { force: true });
    rmSync(fixture.sshdDir, { recursive: true, force: true });
  }
});
