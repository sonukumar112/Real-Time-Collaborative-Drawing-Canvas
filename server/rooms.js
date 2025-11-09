// server/rooms.js
const { RoomState } = require('./drawing-state');

class RoomsManager {
  constructor() {
    /** @type {Map<string, RoomState>} */
    this.rooms = new Map();
  }

  get(roomId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new RoomState(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  forEach(cb) {
    this.rooms.forEach(cb);
  }
}

module.exports = { RoomsManager };
