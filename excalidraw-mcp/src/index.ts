import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { BRIDGE_PORT, startBridge } from "./bridge.js";

const bridge = await startBridge();
const send = bridge.send;

const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const run = async (op: string, payload?: unknown) => {
  try {
    return textResult(await send(op, payload));
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: (error as Error).message }],
    };
  }
};

const skeletonElement = z
  .object({
    type: z.enum([
      "rectangle",
      "ellipse",
      "diamond",
      "arrow",
      "line",
      "text",
      "frame",
    ]),
    id: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    text: z.string().optional(),
    label: z.object({ text: z.string() }).passthrough().optional(),
    start: z.record(z.string(), z.any()).optional(),
    end: z.record(z.string(), z.any()).optional(),
    points: z.array(z.tuple([z.number(), z.number()])).optional(),
    strokeColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    fillStyle: z.string().optional(),
    strokeWidth: z.number().optional(),
    strokeStyle: z.string().optional(),
    roundness: z.any().optional(),
    fontSize: z.number().optional(),
    children: z.array(z.string()).optional(),
    name: z.string().optional(),
  })
  .passthrough();

const server = new McpServer({ name: "excalidraw", version: "0.1.0" });

server.registerTool(
  "add_elements",
  {
    description:
      "Add elements to the live Excalidraw canvas using ExcalidrawElementSkeleton objects. Shapes accept `label: {text}`; arrows accept `start`/`end` as `{id}` of an existing/new element (or `{type, text}` to create one) for bindings. Give elements explicit `id`s so you can reference them later. Returns the ids created.",
    inputSchema: { elements: z.array(skeletonElement) },
  },
  ({ elements }) => run("add_elements", { elements }),
);

server.registerTool(
  "update_elements",
  {
    description:
      "Update existing elements by id. Each entry is `{id, ...props}` with raw Excalidraw element props (x, y, width, height, strokeColor, backgroundColor, text, ...).",
    inputSchema: {
      elements: z.array(z.object({ id: z.string() }).passthrough()),
    },
  },
  ({ elements }) => run("update_elements", { elements }),
);

server.registerTool(
  "delete_elements",
  {
    description:
      "Delete elements by id (bound labels are deleted with their container).",
    inputSchema: { ids: z.array(z.string()) },
  },
  ({ ids }) => run("delete_elements", { ids }),
);

server.registerTool(
  "clear_canvas",
  { description: "Remove all elements from the canvas.", inputSchema: {} },
  () => run("clear_canvas"),
);

server.registerTool(
  "get_scene",
  {
    description:
      "Return a compact summary of every element on the canvas (id, type, position, size, text, bindings).",
    inputSchema: {},
  },
  () => run("get_scene"),
);

server.registerTool(
  "export_png",
  {
    description: "Render the current canvas to a PNG so you can see it.",
    inputSchema: {},
  },
  async () => {
    try {
      const { dataURL } = await send("export_png");
      const base64 = String(dataURL).split(",")[1];
      return {
        content: [
          { type: "image" as const, data: base64, mimeType: "image/png" },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: (error as Error).message }],
      };
    }
  },
);

await server.connect(new StdioServerTransport());
console.error(
  `[excalidraw-mcp] ready, bridge on ws://127.0.0.1:${BRIDGE_PORT}`,
);
