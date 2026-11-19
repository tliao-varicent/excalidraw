import { randomUUID } from "node:crypto";

import { WebSocketServer, WebSocket } from "ws";

export const BRIDGE_PORT = Number(process.env.EXCALIDRAW_BRIDGE_PORT || 3730);
const REQUEST_TIMEOUT_MS = 15000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export type Bridge = {
  send: (op: string, payload?: unknown) => Promise<any>;
  waitForBrowser: (timeoutMs: number) => Promise<void>;
  close: () => Promise<void>;
};

export const startBridge = (port = BRIDGE_PORT): Promise<Bridge> =>
  new Promise((resolveStart, rejectStart) => {
    const pending = new Map<string, Pending>();
    const connectionWaiters = new Set<() => void>();
    // insertion order doubles as connection order for tie-breaking
    const tabs = new Map<WebSocket, { lastActiveAt: number }>();

    const wss = new WebSocketServer({ host: "127.0.0.1", port });

    const activeTab = () => {
      let best: WebSocket | null = null;
      let bestAt = -1;
      for (const [socket, { lastActiveAt }] of tabs) {
        if (socket.readyState === WebSocket.OPEN && lastActiveAt >= bestAt) {
          best = socket;
          bestAt = lastActiveAt;
        }
      }
      return best;
    };

    wss.on("connection", (socket) => {
      tabs.set(socket, { lastActiveAt: 0 });
      connectionWaiters.forEach((notify) => notify());
      connectionWaiters.clear();
      socket.on("message", (raw) => {
        let msg: {
          id?: string;
          type?: string;
          lastActiveAt?: number;
          ok?: boolean;
          result?: unknown;
          error?: string;
        };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === "activity") {
          tabs.set(socket, { lastActiveAt: msg.lastActiveAt ?? 0 });
          return;
        }
        const entry = msg.id && pending.get(msg.id);
        if (!entry) {
          return;
        }
        pending.delete(msg.id!);
        clearTimeout(entry.timer);
        if (msg.ok) {
          entry.resolve(msg.result);
        } else {
          entry.reject(new Error(msg.error || "Browser bridge error"));
        }
      });
      socket.on("close", () => {
        tabs.delete(socket);
      });
    });

    const isConnected = () => activeTab() !== null;

    const bridge: Bridge = {
      send: (op, payload = {}) =>
        new Promise((resolve, reject) => {
          const browser = activeTab();
          if (!browser) {
            reject(
              new Error(
                `No Excalidraw tab connected on ws://localhost:${port}. Open the local app (yarn start, http://localhost:3729) and retry.`,
              ),
            );
            return;
          }
          const id = randomUUID();
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(
              new Error(`Timed out waiting for browser response to "${op}"`),
            );
          }, REQUEST_TIMEOUT_MS);
          pending.set(id, { resolve, reject, timer });
          browser.send(JSON.stringify({ id, op, payload }));
        }),
      waitForBrowser: (timeoutMs) =>
        new Promise((resolve, reject) => {
          if (isConnected()) {
            resolve();
            return;
          }
          const timer = setTimeout(() => {
            connectionWaiters.delete(notify);
            reject(
              new Error(
                `No Excalidraw tab connected within ${timeoutMs}ms. Open http://localhost:3729 and retry.`,
              ),
            );
          }, timeoutMs);
          const notify = () => {
            clearTimeout(timer);
            resolve();
          };
          connectionWaiters.add(notify);
        }),
      close: () =>
        new Promise((resolve) => {
          tabs.forEach((_, socket) => socket.close());
          wss.close(() => resolve());
        }),
    };

    wss.once("listening", () => resolveStart(bridge));
    wss.once("error", rejectStart);
  });
