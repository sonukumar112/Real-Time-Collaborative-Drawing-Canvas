// client/main.js

(function () {
  const canvasEl = document.getElementById('canvas');
  const cursorLayer = document.getElementById('cursorLayer');
  const cm = new window.CanvasManager(canvasEl, cursorLayer);
  const sc = new window.SocketClient();

  const toolBrushBtn = document.getElementById('tool-brush');
  const toolEraserBtn = document.getElementById('tool-eraser');
  const colorInput = document.getElementById('color');
  const widthInput = document.getElementById('width');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const meSpan = document.getElementById('me');
  const usersDiv = document.getElementById('users');

  // state
  let opLog = [];
  let drawing = false;
  let currentOpId = null;
  let bufferPoints = [];
  let lastSentIdx = 0;
  let userName = `user-${Math.random().toString(36).slice(2, 6)}`;

  // helpers
  function setActiveTool(tool) {
    cm.setTool(tool);
    toolBrushBtn.classList.toggle('active', tool === 'brush');
    toolEraserBtn.classList.toggle('active', tool === 'eraser');
  }

  function updateUsersList(users) {
    usersDiv.innerHTML = '';
    users.forEach((u) => {
      const el = document.createElement('div');
      el.className = 'user';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = u.color;
      el.appendChild(dot);
      el.appendChild(document.createTextNode(`${u.userName}`));
      usersDiv.appendChild(el);
    });
  }

  function throttle(fn, wait) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) { last = now; fn.apply(this, args); }
    };
  }

  // socket events
  sc.on('joined', ({ userId, color }) => {
    meSpan.textContent = `You: ${userName}`;
    colorInput.value = color;
    cm.setColor(color);
  });

  sc.on('sync_state', (state) => {
    opLog = state.opLog || [];
    cm.redrawFromOps(opLog);
    updateUsersList(state.users || []);
  });

  sc.on('user_list', updateUsersList);

  sc.on('cursor', ({ userId, x, y, color, tool }) => {
    cm.renderCursor(userId, x, y, color, tool);
  });

  // Track remote stroke styles between start and end for live drawing
  const liveStyles = new Map(); // opId -> { color, width, tool }

  sc.on('stroke_start', ({ opId, color, width, tool }) => {
    liveStyles.set(opId, { color, width, tool });
  });

  // Remote live points
  sc.on('stroke_points', ({ opId, points }) => {
    const style = liveStyles.get(opId) || { color: '#000', width: 2, tool: 'brush' };
    cm.drawPoints(points, style.color, style.width, style.tool);
  });

  // Authoritative op persisted on server
  sc.on('op', (op) => {
    // If op already exists (replay), replace; else push
    const idx = opLog.findIndex((o) => o.opId === op.opId);
    if (idx >= 0) opLog[idx] = op; else opLog.push(op);
    cm.redrawFromOps(opLog);
    // Clean up live style once authoritative op is received
    if (liveStyles.has(op.opId)) liveStyles.delete(op.opId);
  });

  sc.on('op_undone', ({ opId }) => {
    const op = opLog.find((o) => o.opId === opId);
    if (op) op.active = false;
    cm.redrawFromOps(opLog);
  });

  sc.on('op_redone', ({ opId }) => {
    const op = opLog.find((o) => o.opId === opId);
    if (op) op.active = true;
    cm.redrawFromOps(opLog);
  });

  // join room
  sc.join('main', userName);

  // UI handlers
  toolBrushBtn.addEventListener('click', () => setActiveTool('brush'));
  toolEraserBtn.addEventListener('click', () => setActiveTool('eraser'));
  colorInput.addEventListener('input', (e) => {
    cm.setColor(e.target.value);
  });
  widthInput.addEventListener('input', (e) => {
    cm.setWidth(parseInt(e.target.value, 10) || 1);
  });
  undoBtn.addEventListener('click', () => sc.undo());
  redoBtn.addEventListener('click', () => sc.redo());

  // Drawing handlers
  function getPoint(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: Date.now() };
  }

  canvasEl.addEventListener('mousedown', (e) => {
    drawing = true;
    currentOpId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const p = getPoint(e);
    bufferPoints = [p];
    lastSentIdx = 0;
    cm.startLocalStroke(p);
    sc.strokeStart(currentOpId, cm.color, cm.width, cm.tool);
  });

  const sendCursorThrottled = throttle((pt) => sc.sendCursor(pt.x, pt.y, cm.tool), 40);

  canvasEl.addEventListener('mousemove', (e) => {
    const p = getPoint(e);
    sendCursorThrottled(p);
    if (!drawing) return;
    bufferPoints.push(p);
    cm.addLocalPoint(p);
    if (bufferPoints.length - lastSentIdx >= 5) {
      const chunk = bufferPoints.slice(lastSentIdx);
      lastSentIdx = bufferPoints.length;
      sc.strokePoints(currentOpId, chunk);
    }
  });

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    const points = cm.endLocalStroke();
    sc.strokeEnd(currentOpId, points, cm.color, cm.width, cm.tool);
    currentOpId = null;
    bufferPoints = [];
  }

  canvasEl.addEventListener('mouseup', endStroke);
  canvasEl.addEventListener('mouseleave', endStroke);

  // touch support (bonus)
  canvasEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const p = { x: t.clientX - rect.left, y: t.clientY - rect.top, t: Date.now() };
    drawing = true;
    currentOpId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    bufferPoints = [p];
    lastSentIdx = 0;
    cm.startLocalStroke(p);
    sc.strokeStart(currentOpId, cm.color, cm.width, cm.tool);
    e.preventDefault();
  }, { passive: false });

  canvasEl.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const rect = canvasEl.getBoundingClientRect();
    const p = { x: t.clientX - rect.left, y: t.clientY - rect.top, t: Date.now() };
    sendCursorThrottled(p);
    if (!drawing) return;
    bufferPoints.push(p);
    cm.addLocalPoint(p);
    if (bufferPoints.length - lastSentIdx >= 5) {
      const chunk = bufferPoints.slice(lastSentIdx);
      lastSentIdx = bufferPoints.length;
      sc.strokePoints(currentOpId, chunk);
    }
    e.preventDefault();
  }, { passive: false });

  canvasEl.addEventListener('touchend', (e) => { endStroke(); e.preventDefault(); }, { passive: false });

  // defaults
  setActiveTool('brush');
  cm.setColor(colorInput.value);
  cm.setWidth(parseInt(widthInput.value, 10));
})();
