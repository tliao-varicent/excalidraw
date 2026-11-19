import { Excalidraw } from "@excalidraw/excalidraw";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { handleAgentBridgeRequest } from "../components/AgentBridge";

const { h } = window;

const send = (
  request: Parameters<typeof handleAgentBridgeRequest>[1],
): Promise<any> =>
  act(() =>
    handleAgentBridgeRequest(h.app.api as ExcalidrawImperativeAPI, request),
  );

const addDiagram = () =>
  send({
    id: "1",
    op: "add_elements",
    payload: {
      elements: [
        {
          id: "web",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 200,
          height: 80,
          label: { text: "Web" },
        },
        { id: "db", type: "ellipse", x: 320, y: 0, width: 200, height: 80 },
        {
          id: "link",
          type: "arrow",
          x: 200,
          y: 40,
          start: { id: "web" },
          end: { id: "db" },
        },
      ],
    },
  });

describe("AgentBridge", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("adds skeleton elements with stable ids and arrow bindings", async () => {
    const { created } = await addDiagram();

    expect(created.map((el: { id: string }) => el.id)).toEqual(
      expect.arrayContaining(["web", "db", "link"]),
    );
    const arrow = h.elements.find((el) => el.id === "link");
    expect(arrow).toMatchObject({
      startBinding: { elementId: "web" },
      endBinding: { elementId: "db" },
    });
  });

  it("records changes in undo history", async () => {
    await addDiagram();

    expect(h.history.isUndoStackEmpty).toBe(false);
  });

  it("updates elements by id and reports missing ids", async () => {
    await addDiagram();

    const result = await send({
      id: "2",
      op: "update_elements",
      payload: {
        elements: [
          { id: "db", strokeColor: "#2f9e44" },
          { id: "nope", x: 10 },
        ],
      },
    });

    expect(result).toEqual({ updated: 1, missing: ["nope"] });
    expect(h.elements.find((el) => el.id === "db")?.strokeColor).toBe(
      "#2f9e44",
    );
  });

  it("deletes elements together with their bound labels", async () => {
    await addDiagram();

    await send({ id: "3", op: "delete_elements", payload: { ids: ["web"] } });

    const { elements } = await send({ id: "4", op: "get_scene" });
    expect(elements.map((el: { id: string }) => el.id)).toEqual(
      expect.not.arrayContaining(["web"]),
    );
    expect(elements.some((el: { text?: string }) => el.text === "Web")).toBe(
      false,
    );
  });

  it("clears the canvas", async () => {
    await addDiagram();

    await send({ id: "5", op: "clear_canvas" });

    const { elements } = await send({ id: "6", op: "get_scene" });
    expect(elements).toEqual([]);
  });

  it("rejects unknown ops", async () => {
    await expect(
      send({ id: "7", op: "nope" } as unknown as Parameters<
        typeof handleAgentBridgeRequest
      >[1]),
    ).rejects.toThrow('Unknown op "nope"');
  });
});
