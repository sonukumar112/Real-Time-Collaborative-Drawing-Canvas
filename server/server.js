// server
const express = require('express');
const http = require('http');
const { v4: uuid } = require('uuid');
const { Server } = require('socket.io');
const { RoomsManager } = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client'));

const rooms = new RoomsManager();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', ({ roomId = 'main', userName = 'guest' }) => {
    const userId = uuid();
    const room = rooms.get(roomId);
    const { color } = room.addUser(socket.id, { userId, userName });

    socket.join(roomId);
    socket.data.userId = userId;
    socket.data.userName = userName;
    socket.data.roomId = roomId;
    socket.data.color = color;

    socket.emit('joined', { roomId, userId, color });
    socket.emit('sync_state', room.getSyncState());
    io.to(roomId).emit('user_list', room.listUsers());
  });

  // Throttled cursor position broadcast (client should throttle)
  socket.on('cursor', ({ x, y, tool }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('cursor', {
      userId: socket.data.userId,
      x,
      y,
      tool,
      color: socket.data.color,
    });
  });

  // Live stroke collaboration: start/points/end
  socket.on('stroke_start', ({ opId, color, width, tool = 'brush' }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('stroke_start', {
      opId,
      userId: socket.data.userId,
      color,
      width,
      tool,
    });
  });

  socket.on('stroke_points', ({ opId, points }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('stroke_points', {
      opId,
      userId: socket.data.userId,
      points,
    });
  });

  socket.on('stroke_end', ({ opId, points, color, width, tool = 'brush' }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    const op = room.addStroke({
      opId,
      userId: socket.data.userId,
      color,
      width,
      points,
      tool,
    });
    io.to(roomId).emit('op', op);
  });

  // Back-compat (old client): relay chunks and persist on finished
  socket.on('stroke_chunk', ({ roomId, opId, points, color, width, tool = 'brush', finished }) => {
    const rId = roomId || socket.data.roomId;
    if (!rId) return;
    if (finished) {
      const room = rooms.get(rId);
      const op = room.addStroke({ opId, userId: socket.data.userId, points, color, width, tool });
      io.to(rId).emit('op', op);
    } else {
      socket.to(rId).emit('stroke_points', { opId, userId: socket.data.userId, points });
    }
  });

  socket.on('undo', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    const undoneOpId = room.undo(socket.data.userId);
    if (undoneOpId) {
      io.to(roomId).emit('op_undone', { opId: undoneOpId });
    }
  });

  socket.on('redo', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    const redoneOpId = room.redo(socket.data.userId);
    if (redoneOpId) {
      io.to(roomId).emit('op_redone', { opId: redoneOpId });
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    room.removeUser(socket.id);
    io.to(roomId).emit('user_list', room.listUsers());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));