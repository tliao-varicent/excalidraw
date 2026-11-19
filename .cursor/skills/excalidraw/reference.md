# Element recipes

A diagram file is a JSON array (or `{"elements": [...]}`) of Excalidraw element skeletons. Any extra Excalidraw element prop passes through.

## Title and subtitle

```json
{ "id": "title", "type": "text", "x": 0, "y": -170, "text": "Async job payload: v1 → v2",
  "fontSize": 36, "fontFamily": 6, "strokeColor": "#1e1e1e" },
{ "id": "subtitle", "type": "text", "x": 0, "y": -118, "text": "One-line takeaway",
  "fontSize": 18, "fontFamily": 6, "strokeColor": "#868e96" }
```

## Card with title

```json
{ "id": "v1-caller", "type": "rectangle", "x": 0, "y": 0, "width": 520, "height": 280,
  "strokeColor": "#1971c2", "backgroundColor": "#e7f5ff",
  "roughness": 0, "strokeWidth": 2, "fillStyle": "solid", "roundness": { "type": 3 } },
{ "id": "v1-caller-title", "type": "text", "x": 24, "y": 18, "text": "Caller",
  "fontSize": 20, "fontFamily": 6, "strokeColor": "#1971c2" }
```

Card height = 60 (title area) + panel height + 24.

## Code panel (rect + separate padded text)

```json
{ "id": "v1-caller-code", "type": "rectangle", "x": 20, "y": 60, "width": 480, "height": 196,
  "strokeColor": "#343a40", "backgroundColor": "#212529",
  "roughness": 0, "strokeWidth": 1, "fillStyle": "solid", "roundness": { "type": 3 } },
{ "id": "v1-caller-code-text", "type": "text", "x": 42, "y": 78,
  "text": "{\n  fileId\n  isFlagAOn: true\n}",
  "fontFamily": 3, "fontSize": 16, "strokeColor": "#f1f3f5", "roughness": 0 }
```

Text sits at panel x+22, y+18. In JSON strings, line breaks are `\n` and two-space indents are kept literally.

## Centered label in a shape (short text only)

```json
{ "id": "split", "type": "rectangle", "x": 40, "y": 720, "width": 200, "height": 80,
  "strokeColor": "#e8590c", "backgroundColor": "#fff4e6",
  "roughness": 0, "strokeWidth": 2, "fillStyle": "solid", "roundness": { "type": 3 },
  "label": { "text": "Split.io\ntreatments", "fontSize": 18, "fontFamily": 6, "strokeColor": "#d9480f" } }
```

## Arrows

Flow arrow between cards (x/y at the source's right edge, mid-height):

```json
{ "id": "v1-a1", "type": "arrow", "x": 520, "y": 140, "points": [[0, 0], [120, 0]],
  "start": { "id": "v1-caller" }, "end": { "id": "v1-payload" },
  "strokeColor": "#495057", "roughness": 0, "strokeWidth": 2 }
```

Two-way vertical link:

```json
{ "id": "v2-split-link", "type": "arrow", "x": 140, "y": 720, "points": [[0, 0], [0, -60]],
  "startArrowhead": "arrow", "endArrowhead": "arrow",
  "start": { "id": "split" }, "end": { "id": "v2-caller-code" },
  "strokeColor": "#e8590c", "roughness": 0, "strokeWidth": 2 }
```

Optional arrow label: `"label": { "text": "publishes", "fontSize": 14, "fontFamily": 6, "strokeColor": "#868e96" }`.

## Update example (`yarn excalidraw update changes.json`)

```json
[{ "id": "v1-caller", "backgroundColor": "#d0ebff" }, { "id": "v1-a1", "strokeStyle": "dashed" }]
```

`update` changes raw props without re-laying out bound text. For geometry or text changes, edit the diagram file and `replace`.
