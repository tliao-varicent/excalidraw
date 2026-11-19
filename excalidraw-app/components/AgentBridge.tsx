import { useEffect, useRef } from "react";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  exportScene,
  getNonDeletedElements,
  newElementWith,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export type AgentBridgeRequest = { id: string } & (
  | { op: "add_elements"; payload: { elements: ExcalidrawElementSkeleton[] } }
  | {
      op: "update_elements";
      payload: {
        elements: ({ id: string } & Partial<ExcalidrawElement>)[];
      };
    }
  | { op: "delete_elements"; payload: { ids: string[] } }
  | { op: "clear_canvas" | "get_scene" | "export_png"; payload?: undefined }
);

export type AgentBridgeResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

const RECONNECT_MS = 500;

const summarize = (elements: readonly ExcalidrawElement[]) =>
  getNonDeletedElements(elements).map((el) => ({
    id: el.id,
    type: el.type,
    x: Math.round(el.x),
    y: Math.round(el.y),
    width: Math.round(el.width),
    height: Math.round(el.height),
    ...("text" in el ? { text: el.text } : {}),
    ...("containerId" in el && el.containerId
      ? { containerId: el.containerId }
      : {}),
    ...(el.boundElements?.length
      ? { boundElements: el.boundElements.map((b) => b.id) }
      : {}),
    ...("startBinding" in el && el.startBinding
      ? { start: el.startBinding.elementId }
      : {}),
    ...("endBinding" in el && el.endBinding
      ? { end: el.endBinding.elementId }
      : {}),
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
  }));

export const handleAgentBridgeRequest = async (
  api: ExcalidrawImperativeAPI,
  request: AgentBridgeRequest,
) => {
  const current = api.getSceneElementsIncludingDeleted();

  switch (request.op) {
    case "add_elements": {
      const created = convertToExcalidrawElements(request.payload.elements, {
        regenerateIds: false,
      });
      api.updateScene({
        elements: [...current, ...created],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      api.setViewport({
        target: getNonDeletedElements(api.getSceneElements()),
        fit: "scale-down",
        animation: true,
      });
      return { created: created.map((el) => ({ id: el.id, type: el.type })) };
    }
    case "update_elements": {
      const updates = new Map(
        request.payload.elements.map(({ id, ...props }) => [id, props]),
      );
      const missing = [...updates.keys()].filter(
        (id) => !current.some((el) => el.id === id),
      );
      api.updateScene({
        elements: current.map((el) => {
          const props = updates.get(el.id);
          return props ? newElementWith(el, props as Partial<typeof el>) : el;
        }),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return { updated: updates.size - missing.length, missing };
    }
    case "delete_elements": {
      const ids = new Set(request.payload.ids);
      api.updateScene({
        elements: current.map((el) =>
          ids.has(el.id) ||
          ("containerId" in el && el.containerId && ids.has(el.containerId))
            ? newElementWith(el, { isDeleted: true })
            : el,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return { deleted: [...ids] };
    }
    case "clear_canvas": {
      api.updateScene({
        elements: current.map((el) => newElementWith(el, { isDeleted: true })),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      return { cleared: true };
    }
    case "get_scene":
      return { elements: summarize(current) };
    case "export_png": {
      const blob = await exportScene({
        type: "png",
        data: {
          elements: getNonDeletedElements(current),
          appState: api.getAppState(),
          files: api.getFiles(),
        },
      });
      return { dataURL: await getDataURL(blob) };
    }
    default:
      throw new Error(`Unknown op "${(request as { op: string }).op}"`);
  }
};

const AgentBridge = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ownerWindow = nodeRef.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    const port = import.meta.env.VITE_APP_AGENT_BRIDGE_PORT || "3730";
    let socket: WebSocket | null = null;
    let timer: number | undefined;
    let disposed = false;

    let lastActiveAt = ownerWindow.document.hasFocus() ? Date.now() : 0;

    const respond = (response: AgentBridgeResponse) =>
      socket?.send(JSON.stringify(response));

    const reportActivity = () => {
      if (socket?.readyState === ownerWindow.WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "activity", lastActiveAt }));
      }
    };

    const markActive = () => {
      lastActiveAt = Date.now();
      reportActivity();
    };

    const onVisibilityChange = () => {
      if (ownerWindow.document.visibilityState === "visible") {
        markActive();
      }
    };

    ownerWindow.addEventListener("focus", markActive);
    ownerWindow.addEventListener("pointerdown", markActive);
    ownerWindow.document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );

    const connect = () => {
      socket = new ownerWindow.WebSocket(`ws://localhost:${port}`);
      socket.onopen = reportActivity;
      socket.onmessage = async (event) => {
        const request: AgentBridgeRequest = JSON.parse(event.data);
        try {
          const result = await handleAgentBridgeRequest(excalidrawAPI, request);
          respond({ id: request.id, ok: true, result });
        } catch (error) {
          respond({
            id: request.id,
            ok: false,
            error: (error as Error).message,
          });
        }
      };
      socket.onclose = () => {
        if (!disposed) {
          timer = ownerWindow.setTimeout(connect, RECONNECT_MS);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      ownerWindow.removeEventListener("focus", markActive);
      ownerWindow.removeEventListener("pointerdown", markActive);
      ownerWindow.document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      ownerWindow.clearTimeout(timer);
      socket?.close();
    };
  }, [excalidrawAPI]);

  return <span ref={nodeRef} hidden />;
};

export default AgentBridge;
