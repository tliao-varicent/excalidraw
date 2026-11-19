---
name: excalidraw
description: Draws and iterates on diagrams live in the local Excalidraw app (http://localhost:3729) via the `yarn excalidraw` CLI (default) or the excalidraw MCP tools. Use when the user asks to draw, sketch, diagram, visualize, or redraw something (architecture, flows, sequence, before/after comparisons, a Mermaid or screenshot diagram) in Excalidraw.
---

# Drawing Excalidraw diagrams

Diagrams are JSON files of Excalidraw element skeletons in `diagrams/`, pushed to the open Excalidraw tab over the agent bridge (port 3730).

## Hard rules

- **Do not use python or perl** (or sed, awk, `node -e`, ad-hoc `.mjs` generator scripts) to create or edit diagrams. Write and edit the JSON with the file Write/StrReplace tools only. They need no approval and keep the diagram file as the source of truth.
- **Run the CLI as `yarn excalidraw …`, never `yarn -s excalidraw …`.** The plain form matches the user's command allowlist and runs without approval; `-s` does not.
- One shell command per iteration: draw and snapshot together with `--png` (see below). Do not chain extra commands onto it.
- Never use `clear` or `replace` on a canvas the user drew by hand unless they asked to start over; use `add`/`update` instead.

## Choose the transport

1. **CLI (default):** `yarn excalidraw <command>`.
2. **MCP:** only if `add_elements`/`get_scene`/`export_png` tools from the `excalidraw` server are available in this session, or the user asks for MCP. Same element JSON, same rules. The MCP server and the CLI both bind port 3730, so they can't run at the same time; if the CLI reports the port in use, the MCP server is running, so use MCP.

## Preconditions

- The dev server is running and a tab is open at http://localhost:3729. If the CLI says "No Excalidraw tab connected", start it with `yarn start` (background) and ask the user to open the URL.
- `excalidraw-mcp/dist/cli.js` exists. If not: `yarn --cwd excalidraw-mcp build`.

## Workflow

```
- [ ] 1. Plan layout on a grid (columns, rows, sizes) before writing JSON
- [ ] 2. Write diagrams/<kebab-name>.json with the Write tool
- [ ] 3. yarn excalidraw replace diagrams/<name>.json --png /tmp/<name>.png
- [ ] 4. Read /tmp/<name>.png and critique it (overlap, clipping, cramped text, alignment)
- [ ] 5. Fix with StrReplace on the JSON, then repeat step 3
- [ ] 6. Show the final PNG to the user with ![...](/tmp/<name>.png)
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

## Additional resources

- Element recipes (card, code panel, arrow, side box): [reference.md](reference.md)
- Complete example files (copy one into `diagrams/` as a starting point; `diagrams/` is git-ignored):
  - [examples/simple-flow.json](examples/simple-flow.json): three labeled shapes joined by labeled arrows
  - [examples/before-after-comparison.json](examples/before-after-comparison.json): two-row v1/v2 comparison with code panels
