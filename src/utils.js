export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

export function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

// Signed shortest rotation from angle a to angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Does a sword arc (origin, facing, range, half-angle) overlap a circle target?
export function arcHit(ox, oy, facing, range, halfAngle, tx, ty, tr) {
  const dx = tx - ox, dy = ty - oy;
  const d = Math.hypot(dx, dy);
  if (d - tr > range) return false;
  if (d <= tr) return true;
  const a = Math.atan2(dy, dx);
  const slack = Math.asin(Math.min(1, tr / d));
  return Math.abs(angleDiff(facing, a)) <= halfAngle + slack;
}

// Push a circle {x,y,r} out of an axis-aligned rect {x,y,w,h}.
export function resolveCircleRect(c, rc) {
  const cx = clamp(c.x, rc.x, rc.x + rc.w);
  const cy = clamp(c.y, rc.y, rc.y + rc.h);
  const dx = c.x - cx, dy = c.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= c.r) return;
  if (d === 0) {
    // centre is inside the rect: eject along the nearest face
    const l = c.x - rc.x, r = rc.x + rc.w - c.x, t = c.y - rc.y, b = rc.y + rc.h - c.y;
    const m = Math.min(l, r, t, b);
    if (m === l) c.x = rc.x - c.r;
    else if (m === r) c.x = rc.x + rc.w + c.r;
    else if (m === t) c.y = rc.y - c.r;
    else c.y = rc.y + rc.h + c.r;
    return;
  }
  const push = (c.r - d) / d;
  c.x += dx * push;
  c.y += dy * push;
}

// Separate two overlapping circles. aWeight = share of the correction applied to a.
export function separate(a, b, aWeight = 0.5) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (d >= min || d === 0) return;
  const nx = dx / d, ny = dy / d, o = min - d;
  a.x -= nx * o * aWeight; a.y -= ny * o * aWeight;
  b.x += nx * o * (1 - aWeight); b.y += ny * o * (1 - aWeight);
}
