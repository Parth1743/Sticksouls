// Keyboard + pointer-locked mouse with per-frame "pressed" edge detection.
// Mouse wheel shows up as the pseudo-keys 'WheelUp' / 'WheelDown'.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDown = new Set();
    this.mousePressed = new Set();
    this.dx = 0; this.dy = 0;   // accumulated mouse movement since last consume

    window.addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouseDown.clear(); });

    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) { this.requestLock(); return; }   // first click only grabs the mouse
      if (!this.mouseDown.has(e.button)) this.mousePressed.add(e.button);
      this.mouseDown.add(e.button);
    });
    document.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button));
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.pressed.add(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    }, { passive: true });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (!this.locked) { this.down.clear(); this.mouseDown.clear(); this.pressed.clear(); this.mousePressed.clear(); }
    });
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  requestLock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});   // browser enforces a cooldown after Esc; ignore
    } catch { /* ignore */ }
  }

  consumeMouseDelta() {
    const d = [this.dx, this.dy];
    this.dx = 0; this.dy = 0;
    return d;
  }

  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  mouseIsDown(b) { return this.mouseDown.has(b); }
  mouseWasPressed(b) { return this.mousePressed.has(b); }
  endFrame() { this.pressed.clear(); this.mousePressed.clear(); }
}
