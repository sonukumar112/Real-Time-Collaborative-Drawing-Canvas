// server/drawing-state.js
// Central room state: users, op-log (strokes), sequencing, undo/redo stacks

const PALETTE = [
  '#e74c3c',
  '#8e44ad',
  '#3498db',
  '#16a085',
  '#27ae60',
  '#f39c12',
  '#d35400',
  '#2c3e50',
  '#1abc9c',
  '#c0392b',
];

class RoomState {
  constructor(roomId) {
    this.roomId = roomId;
    this.seq = 0;
    /** @type {Array<{seq:number,type:'stroke',opId:string,userId:string,color:string,width:number,points:Array<{x:number,y:number,t?:number}>,active:boolean}>} */
    this.opLog = [];
    /** socketId -> { userId, userName, color } */
    this.users = new Map();
    /** userId -> string[] (stack of opIds) */
    this.undoneByUser = new Map();
    this._nextColorIdx = 0;
  }

  assignColor() {
    const color = PALETTE[this._nextColorIdx % PALETTE.length];
    this._nextColorIdx += 1;
    return color;
  }

  addUser(socketId, { userId, userName }) {
    const color = this.assignColor();
    this.users.set(socketId, { userId, userName, color });
    if (!this.undoneByUser.has(userId)) this.undoneByUser.set(userId, []);
    return { userId, userName, color };
  }

  removeUser(socketId) {
    this.users.delete(socketId);
  }

  listUsers() {
    return Array.from(this.users.values());
  }

  addStroke({ opId, userId, color, width, points, tool = 'brush' }) {
    this.seq += 1;
    const op = {
      seq: this.seq,
      type: 'stroke',
      opId,
      userId,
      color,
      width,
      tool,
      points,
      active: true,
    };
    this.opLog.push(op);
    return op;
  }

  undo(userId) {
    for (let i = this.opLog.length - 1; i >= 0; i -= 1) {
      const op = this.opLog[i];
      if (op.userId === userId && op.active) {
        op.active = false;
        const stack = this.undoneByUser.get(userId) || [];
        stack.push(op.opId);
        this.undoneByUser.set(userId, stack);
        return op.opId;
      }
    }
    return null;
  }

  redo(userId) {
    const stack = this.undoneByUser.get(userId) || [];
    const opId = stack.pop();
    if (!opId) return null;
    const op = this.opLog.find((o) => o.opId === opId);
    if (op) {
      op.active = true;
      return op.opId;
    }
    return null;
  }

  getSyncState() {
    return {
      seq: this.seq,
      opLog: this.opLog,
      users: this.listUsers(),
    };
  }
}

module.exports = { RoomState };
