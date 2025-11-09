// client/websocket.js
// Exposes window.SocketClient

(function () {
  class SocketClient {
    constructor() {
      this.socket = io();
      this.userId = null;
      this.color = '#000';
      this.roomId = 'main';
      this.handlers = {};

      this.socket.on('joined', (data) => {
        this.userId = data.userId;
        this.color = data.color;
        this.roomId = data.roomId;
        this._emit('joined', data);
      });
      this.socket.on('sync_state', (state) => this._emit('sync_state', state));
      this.socket.on('user_list', (users) => this._emit('user_list', users));
      this.socket.on('cursor', (payload) => this._emit('cursor', payload));
      this.socket.on('stroke_start', (payload) => this._emit('stroke_start', payload));
      this.socket.on('stroke_points', (payload) => this._emit('stroke_points', payload));
      this.socket.on('op', (op) => this._emit('op', op));
      this.socket.on('op_undone', (data) => this._emit('op_undone', data));
      this.socket.on('op_redone', (data) => this._emit('op_redone', data));
    }

    on(event, handler) {
      this.handlers[event] = handler;
    }

    _emit(event, payload) {
      if (this.handlers[event]) this.handlers[event](payload);
    }

    join(roomId, userName) {
      this.roomId = roomId || 'main';
      this.socket.emit('join', { roomId: this.roomId, userName });
    }

    sendCursor(x, y, tool) {
      this.socket.emit('cursor', { x, y, tool });
    }

    strokeStart(opId, color, width, tool) {
      this.socket.emit('stroke_start', { opId, color, width, tool });
    }
    strokePoints(opId, points) {
      this.socket.emit('stroke_points', { opId, points });
    }
    strokeEnd(opId, points, color, width, tool) {
      this.socket.emit('stroke_end', { opId, points, color, width, tool });
    }

    undo() { this.socket.emit('undo'); }
    redo() { this.socket.emit('redo'); }
  }

  window.SocketClient = SocketClient;
})();
