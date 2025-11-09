# Architecture

This document explains the real-time design, WebSocket protocol, undo/redo model, and performance considerations for the collaborative canvas.

## Data flow

1. User joins a room via `join(roomId, userName)`.
2. Server assigns a `userId` and color, returns `joined`, then immediately sends `sync_state` (op-log and users list), and broadcasts `user_list`.
3. As a user draws:
   - Client sends `stroke_start` (opId, color, width, tool)
   - Client streams batched points with `stroke_points` during drawing
   - At end, client sends `stroke_end` with the full stroke points
4. Server persists the stroke as an op with a monotonic `seq`, then broadcasts `op` to all clients.
5. Undo/Redo:
   - Client sends `undo` or `redo`
   - Server toggles the last active op of that user and broadcasts `op_undone`/`op_redone`
   - Clients replay op-log to rebuild the canvas deterministically

## WebSocket protocol

Client -> Server

- join: `{ roomId, userName }`
- cursor: `{ x, y, tool }`
- stroke_start: `{ opId, color, width, tool }`
- stroke_points: `{ opId, points: [{x,y,t}, ...] }`
- stroke_end: `{ opId, points: [{x,y,t}, ...], color, width, tool }`
- undo: `{}`
- redo: `{}`

Server -> Client

- joined: `{ roomId, userId, color }`
- sync_state: `{ seq, opLog, users }`
- user_list: `[{ userId, userName, color }]`
- cursor: `{ userId, x, y, tool, color }`
- stroke_start: `{ opId, userId, color, width, tool }` (for live feedback)
- stroke_points: `{ opId, userId, points }` (for live feedback)
- op: `{ seq, type:'stroke', opId, userId, color, width, tool, points, active }` (authoritative)
- op_undone: `{ opId }`
- op_redone: `{ opId }`

## Undo/Redo strategy

Server maintains an append-only op-log of stroke operations with an `active` flag. Global undo is modeled as toggling the `active` flag of the latest active operation for that user; redo re-activates the most recently undone op by that user.

Clients redraw from the op-log upon any op change to ensure consistency. This keeps the model simple and deterministic without per-pixel merges.

Tradeoffs:

- Pros: Simple, consistent, and easy to reason about.
- Cons: Replay cost grows with the op-log; mitigate by adding periodic server snapshots and compaction (future work).

## Canvas rendering

- Each stroke is a vector path (list of points). Clients draw using HTML5 Canvas with rounded caps/joins.
- Eraser tool is implemented via `globalCompositeOperation = 'destination-out'` so replay order matters; eraser strokes remove previous pixels.
- Live streaming (`stroke_points`) draws segments as they arrive to give immediate feedback; the final `op` triggers full redraw from op-log to fix any drift.

## Performance decisions

- Batching: Clients send stroke points every ~5 points to reduce message rate.
- Throttling: Cursor messages are throttled to ~25 FPS.
- Redraw: On each op change, clients clear and replay the op-log. For longer sessions add snapshotting (e.g., every N ops) to bound redraw cost.
- Data size: JSON is used for clarity. For scale, consider binary encoding and compression.

## Conflict resolution

- The authoritative server assigns a total order via `seq`. Overlapping strokes are resolved by draw order.
- Eraser operations also follow this order; undo toggles visibility of prior ops for all clients.

## Rooms & presence

- Each room (`RoomState`) tracks users and its own op-log and sequencing.
- On disconnect, users are removed and the `user_list` is updated.

## Extensions & next steps

- Periodic snapshots + compaction to accelerate join and reduce replay cost
- Persist state to a DB, and provide save/load endpoints
- Binary protocol for stroke streaming and deltas
- Per-op layers or CRDT-based model for more granular conflict resolution
- Latency display and FPS metrics