# Real-Time Collaborative Drawing Canvas

A vanilla JS + HTML5 Canvas multi-user drawing app with a Node.js + Socket.io backend. Multiple users can draw together in real time, see each other's cursors, and perform global undo/redo.

## Features

- Brush and eraser tools
- Color picker and stroke width control
- Real-time sync with progressive stroke streaming
- Presence: online users list and live cursor indicators
- Global undo and redo (server-authoritative op-log)
- Basic touch support (mobile)

## Quick start

```powershell
# Windows PowerShell
npm install
npm start
```

Then open http://localhost:3000 in two or more browser tabs and draw.

## How to test with multiple users

- Open two tabs to http://localhost:3000
- Draw in one tab; lines appear live in the other
- Try eraser, change color/width, and press Undo/Redo (affects all clients)
- Watch the users list update when refreshing/closing a tab

## Scripts

- start: runs the Express + Socket.io server and serves the static client

## Known limitations

- In-memory state only (no persistence); restarting the server clears the canvas
- Op-log replay is used on clients; for very long sessions snapshots would be ideal
- Live stroke color during streaming uses a temporary approximation; the final authoritative op redraws with correct style
- No authentication; names are random

## Time spent (example)

- Scaffolding and design: 1h
- Server op-log and protocol: 2h
- Client canvas tools and streaming: 3h
- Global undo/redo + cursors + presence: 2h
- Docs & polish: 1h

See ARCHITECTURE.md for detailed protocol, data flow, and undo/redo strategy.