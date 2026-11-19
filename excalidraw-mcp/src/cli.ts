#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startBridge } from "./bridge.js";

import type { Bridge } from "./bridge.js";

const APP_URL = process.env.EXCALIDRAW_APP_URL || "http://localhost:3729";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// existing tabs reconnect every 500ms, so this only waits on open tabs
const CONNECT_TIMEOUT_MS = 5000;
const SERVER_START_TIMEOUT_MS = 60000;
const BROWSER_OPEN_TIMEOUT_MS = 30000;
const SETTLE_MS = 700;

const USAGE = `Usage: excalidraw <command> [args]   (or yarn excalidraw inside the repo)

Talks to the open Excalidraw tab (http://localhost:3729) over the agent bridge.

Commands:
  add <file.json|->       add skeleton elements (JSON array or {"elements": [...]})
  replace <file.json|->   clear the canvas, then add
  update <file.json|->    update elements by id ([{"id": "...", ...props}])
  delete <id...>          delete elements (and their bound labels)
  clear                   remove all elements
  scene                   print a summary of the current elements
  png [out.png]           save a PNG of the canvas (default: excalidraw.png)

Options:
  --png <out.png>         after add/replace/update/delete/clear, save a PNG from the same tab

Starts the dev server and opens a browser tab when needed.
Set EXCALIDRAW_NO_AUTOSTART=1 to disable.`;

const log = (message: string) => console.error(`[excalidraw] ${message}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isServerUp = async () => {
  try {
    return (await fetch(APP_URL)).ok;
  } catch {
    return false;
  }
};

const ensureServer = async () => {
  if (await isServerUp()) {
    return;
  }
  log(`starting dev server in ${REPO_ROOT}`);
  spawn("yarn", ["start"], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: "ignore",
  }).unref();
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(1000);
    if (await isServerUp()) {
      return;
    }
  }
  throw new Error(`Dev server did not come up at ${APP_URL}`);
};

const openBrowser = () => {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [APP_URL]]
      : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", APP_URL]]
      : ["xdg-open", [APP_URL]];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
};

const connect = async (bridge: Bridge) => {
  if (process.env.EXCALIDRAW_NO_AUTOSTART) {
    await bridge.waitForBrowser(CONNECT_TIMEOUT_MS);
    return;
  }
  await ensureServer();
  try {
    await bridge.waitForBrowser(CONNECT_TIMEOUT_MS);
  } catch {
    log(`no tab connected, opening ${APP_URL}`);
    openBrowser();
    await bridge.waitForBrowser(BROWSER_OPEN_TIMEOUT_MS);
  }
};

const readElements = (source: string | undefined) => {
  if (!source) {
    throw new Error("Missing <file.json> (or - for stdin)");
  }
  const parsed = JSON.parse(readFileSync(source === "-" ? 0 : source, "utf8"));
  return Array.isArray(parsed) ? parsed : parsed.elements;
};

const savePng = async (bridge: Bridge, out: string) => {
  const { dataURL } = await bridge.send("export_png");
  writeFileSync(out, Buffer.from(String(dataURL).split(",")[1], "base64"));
  console.log(`saved ${out}`);
};

const main = async () => {
  const argv = process.argv.slice(2);
  const pngFlag = argv.indexOf("--png");
  const pngOut = pngFlag === -1 ? null : argv[pngFlag + 1] || "excalidraw.png";
  if (pngFlag !== -1) {
    argv.splice(pngFlag, 2);
  }
  const [command, ...args] = argv;
  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    return;
  }

  const bridge = await startBridge();
  try {
    await connect(bridge);
    // let every open tab reconnect and report activity before picking one
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    const print = (value: unknown) =>
      console.log(JSON.stringify(value, null, 2));

    switch (command) {
      case "add":
        print(
          await bridge.send("add_elements", {
            elements: readElements(args[0]),
          }),
        );
        break;
      case "replace": {
        const elements = readElements(args[0]);
        await bridge.send("clear_canvas");
        print(await bridge.send("add_elements", { elements }));
        break;
      }
      case "update":
        print(
          await bridge.send("update_elements", {
            elements: readElements(args[0]),
          }),
        );
        break;
      case "delete":
        print(await bridge.send("delete_elements", { ids: args }));
        break;
      case "clear":
        print(await bridge.send("clear_canvas"));
        break;
      case "scene":
        print(await bridge.send("get_scene"));
        break;
      case "png":
        await savePng(bridge, args[0] || "excalidraw.png");
        break;
      default:
        throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
    }
    if (pngOut && command !== "png") {
      await savePng(bridge, pngOut);
    }
  } finally {
    await bridge.close();
  }
};

main().catch((error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port 3730 is in use (is the excalidraw MCP server running?). Stop it or set EXCALIDRAW_BRIDGE_PORT."
      : error.message,
  );
  process.exit(1);
});
