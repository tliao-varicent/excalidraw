import { readFileSync, writeFileSync } from "node:fs";

import { startBridge } from "./bridge.js";

import type { Bridge } from "./bridge.js";

const CONNECT_TIMEOUT_MS = 5000;
const SETTLE_MS = 700;

const USAGE = `Usage: yarn excalidraw <command> [args]

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
  --png <out.png>         after add/replace/update/delete/clear, save a PNG from the same tab`;

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
    await bridge.waitForBrowser(CONNECT_TIMEOUT_MS);
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
