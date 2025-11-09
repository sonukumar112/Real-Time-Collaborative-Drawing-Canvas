// client/canvas.js
// Exposes window.CanvasManager

(function () {
  function throttle(fn, wait) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  class CanvasManager {
    constructor(mainCanvas, cursorCanvas) {
      this.canvas = mainCanvas;
      this.ctx = mainCanvas.getContext('2d');
      this.cursorCanvas = cursorCanvas || null;
      this.cursorCtx = this.cursorCanvas ? this.cursorCanvas.getContext('2d') : null;
      this.tool = 'brush';
      this.color = '#000000';
      this.width = 2;
      this.remoteCursors = new Map(); // userId -> {x,y,color,tool}

      if (this.cursorCanvas) {
        this._resizeOverlay();
        window.addEventListener('resize', () => this._resizeOverlay());
        this._renderCursors = throttle(this._renderCursors.bind(this), 33);
      }
    }

    _resizeOverlay() {
      if (!this.cursorCanvas) return;
      this.cursorCanvas.width = this.canvas.width;
      this.cursorCanvas.height = this.canvas.height;
      this.cursorCanvas.style.position = 'absolute';
      this.cursorCanvas.style.left = this.canvas.offsetLeft + 'px';
      this.cursorCanvas.style.top = this.canvas.offsetTop + 'px';
      this._renderCursors();
    }

    setTool(tool) { this.tool = tool; }
    setColor(color) { this.color = color; }
    setWidth(width) { this.width = width; }

    _applyStyle(ctx, color, width, tool) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
    }

    clear() {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    drawPoints(points, color, width, tool) {
      if (!points || points.length < 2) return;
      const ctx = this.ctx;
      this._applyStyle(ctx, color, width, tool);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    redrawFromOps(ops) {
      this.clear();
      for (const op of ops) {
        if (op.type === 'stroke' && op.active) {
          this.drawPoints(op.points, op.color, op.width, op.tool || 'brush');
        }
      }
    }

    startLocalStroke(point) {
      this.localPoints = [point];
    }

    addLocalPoint(point) {
      if (!this.localPoints) this.localPoints = [];
      this.localPoints.push(point);
      const n = this.localPoints.length;
      if (n >= 2) {
        const seg = this.localPoints.slice(n - 2, n);
        this.drawPoints(seg, this.color, this.width, this.tool);
      }
    }

    endLocalStroke() {
      const pts = this.localPoints || [];
      this.localPoints = [];
      return pts;
    }

    renderCursor(userId, x, y, color, tool) {
      if (!this.cursorCtx) return;
      this.remoteCursors.set(userId, { x, y, color, tool });
      this._renderCursors();
    }

    removeCursor(userId) {
      if (!this.cursorCtx) return;
      this.remoteCursors.delete(userId);
      this._renderCursors();
    }

    _renderCursors() {
      if (!this.cursorCtx) return;
      const ctx = this.cursorCtx;
      ctx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
      for (const [id, c] of this.remoteCursors) {
        ctx.save();
        ctx.fillStyle = c.color || '#000';
        ctx.strokeStyle = '#00000088';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.CanvasManager = CanvasManager;
})();
