---
name: excalidraw
description: Draws and iterates on diagrams live in the local Excalidraw app (http://localhost:3729) via the global `excalidraw` CLI (default) or the excalidraw MCP tools. Use when the user asks to draw, sketch, diagram, visualize, or redraw something (architecture, flows, sequence, before/after comparisons, a Mermaid or screenshot diagram) in Excalidraw.
---

# Drawing Excalidraw diagrams

Works from any repository. Diagrams are JSON files of Excalidraw element skeletons in `.excalidraw-tmp/` at the root of the currently open project, pushed to the open Excalidraw tab over the agent bridge (port 3730). The app itself lives in `/Users/tliao/dev/excalidraw`.

## Hard rules

- **Do not use python or perl** (or sed, awk, `node -e`, ad-hoc `.mjs` generator scripts) to create or edit diagrams. Write and edit the JSON with the file Write/StrReplace tools only. They need no approval and keep the diagram file as the source of truth.
- **Run the CLI as plain `excalidraw …`** (no wrappers, no `npx`, no `yarn -s`). That form matches the user's command allowlist and runs without approval.
- Keep diagram JSON and PNGs in `<project root>/.excalidraw-tmp/` and nowhere else in the project. They must never be committed: in a git repo, make sure `.git/info/exclude` contains a `.excalidraw-tmp/` line (add it with the file tools if missing). This ignores the folder locally without touching the project's `.gitignore`.
- **Finish writing the JSON file before running the CLI.** Never issue the Write and the `excalidraw` command in the same parallel batch: the command can run first and fail with "file not found".
- One shell command per iteration: in PNG review mode, draw and snapshot together with `--png` (see below). Do not chain extra commands onto it.
- Never use `clear` or `replace` on a canvas the user drew by hand unless they asked to start over; use `add`/`update` instead.

## Choose the transport

1. **CLI (default):** `excalidraw <command>`.
2. **MCP:** only if `add_elements`/`get_scene`/`export_png` tools from the `excalidraw` server are available in this session, or the user asks for MCP. Same element JSON, same rules. The MCP server and the CLI both bind port 3730, so they can't run at the same time; if the CLI reports the port in use, the MCP server is running, so use MCP.

## Choose the viewing mode

The diagram always renders live in the user's Excalidraw tab. The mode only decides how the agent checks its own work. Use what the user asked for; otherwise use the default. Don't ask.

| Mode | Triggered by | How to review |
|---|---|---|
| **PNG review** (default) | nothing said | `--png .excalidraw-tmp/<name>.png` on each draw, read the PNG, show the final one |
| **Live only** | "no snapshots", "no png", "I'll check it myself" | draw without `--png`; after each draw tell the user to look at the tab and wait for their feedback. Plan the layout carefully, since there is no self-review |
| **Cursor browser** | "in Cursor", "use the browser", "show it in the browser panel" | open http://localhost:3729 with the `cursor-ide-browser` tools, draw without `--png`, then check it with `browser_take_screenshot`. If those tools are unavailable or blocked, say so and fall back to PNG review |

In Cursor browser mode the Cursor tab becomes the most recently used tab, so drawings go there rather than to the user's normal browser. Mention this once.

## Preconditions

- None to do by hand: the CLI starts the dev server (`yarn start` in the app repo) if http://localhost:3729 is down, and opens the URL in the default browser if no tab connects within 5s. The first run can take up to a minute; use a long enough shell timeout and don't start the server yourself.
- If `excalidraw` is not found: `yarn --cwd /Users/tliao/dev/excalidraw/excalidraw-mcp build && npm link --prefix /Users/tliao/dev/excalidraw/excalidraw-mcp` is the fix; ask the user before running it.
- If it still reports no tab connected, ask the user to open http://localhost:3729.

## Workflow

```
- [ ] 1. Plan layout on a grid (columns, rows, sizes) before writing JSON
- [ ] 2. Ensure .excalidraw-tmp/ is listed in .git/info/exclude (git repos only)
- [ ] 3. Write .excalidraw-tmp/<kebab-name>.json with the Write tool, and wait for it to finish
- [ ] 4. excalidraw replace .excalidraw-tmp/<name>.json --png .excalidraw-tmp/<name>.png
- [ ] 5. Review in the chosen viewing mode (default: read the PNG) and critique it (overlap, clipping, cramped text, alignment)
- [ ] 6. Fix with StrReplace on the JSON, then repeat step 4
- [ ] 7. Show the final PNG to the user with ![...](<absolute path to the PNG>)
```

CLI commands (all accept `--png <out.png>`, which exports from the same tab in the same connection):

| Command | Use |
|---|---|
| `add <file.json>` | add elements to what's there |
| `replace <file.json>` | clear, then add (the normal redraw loop) |
| `update <file.json>` | `[{"id": "...", ...props}]` raw prop changes |
| `delete <id...>` | delete elements (and bound labels) |
| `scene` | JSON summary of current elements |
| `png <out.png>` | snapshot only |

Always use `--png` on the drawing command rather than a separate `png` run: with several tabs open, separate runs can reach different tabs. If output lands in the wrong tab, ask the user to click the intended tab (the bridge targets the most recently focused or clicked one).

## Design rules (what made the polished version look right)

- **Polish:** `"roughness": 0`, `"fillStyle": "solid"`, `"roundness": {"type": 3}`, `strokeWidth` 2 for cards, 1 for inner panels.
- **Fonts:** `fontFamily` 6 (Nunito) for titles and labels, 3 (Cascadia, monospace) for code, 5 (Excalifont) only when a hand-drawn look is requested.
- **Color by role, consistently** (stroke / background): blue `#1971c2`/`#e7f5ff`, green `#2f9e44`/`#ebfbee`, purple `#9c36b5`/`#f8f0fc`, orange `#e8590c`/`#fff4e6`, neutral text `#495057`, muted `#868e96`.
- **Structure:** a title (36px) and a one-line muted subtitle (18px) at the top, a heading per row (22px), and cards with a colored title (20px) inside.
- **Code blocks:** dark panel rect (`#212529` bg, `#343a40` stroke) plus a **separate** text element at panel x+22, y+18, 16px, `#f1f3f5`. Do not use a bound `label` for code or left-aligned multi-line text: bound labels get only 5px padding and hug the corner.
- **Sizing at 16px:** line height ≈ 20px, monospace char ≈ 9.6px. Panel height = lines × 20 + 36, panel width ≥ longest line × 9.6 + 44. Make every panel in a row the same height.
- **Grid:** 120px gaps between columns, about 80px between rows (plus 46px for the row heading). Align card tops within a row.
- **Arrows:** bind with `start: {id}` / `end: {id}`, created in the **same** `add`/`replace` batch as both endpoints. Use `startArrowhead` + `endArrowhead` `"arrow"` for two-way links. Short labels at 14px muted.
- **IDs:** explicit, readable ids on every element (`v1-caller`, `v1-caller-code`, `v1-caller-code-text`, `v1-a1`) so later `update`/`delete` calls can target them.
- **Bound labels get generated IDs.** A shape's `label` becomes its own text element with a random id (the CLI output lists these as extra created elements); this is expected. Target the parent shape instead: `delete` on the shape removes its label, and label text changes go through editing the JSON and `replace`. If a piece of text must be addressable on its own, make it a separate `text` element with an explicit id.

## Additional resources

- Element recipes (card, code panel, arrow, side box): [reference.md](reference.md)
- Complete example files (copy one into `.excalidraw-tmp/` as a starting point):
  - [examples/simple-flow.json](examples/simple-flow.json): three labeled shapes joined by labeled arrows
  - [examples/before-after-comparison.json](examples/before-after-comparison.json): two-row v1/v2 comparison with code panels
