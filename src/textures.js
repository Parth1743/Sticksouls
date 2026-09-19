import * as THREE from 'three';

// Procedural canvas textures, so the game needs no image downloads. Cached by key.
const cache = new Map();

function make(key, size, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b));

function speckle(g, size, count, alpha, light = false) {
  for (let k = 0; k < count; k++) {
    const a = Math.random() * alpha;
    g.fillStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(Math.random() * size, Math.random() * size, ri(1, 3), ri(1, 3));
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
const shade = (hex, k) => { const [r, g, b] = hexToRgb(hex); return rgb(r * k, g * k, b * k); };

export const T = {
  // Large uneven stone slabs with cracks and a little moss. Tiles every 4 m.
  stone() {
    return make('stone', 1024, (g, s) => {
      g.fillStyle = '#0b0b0e'; g.fillRect(0, 0, s, s);
      const n = 4, cell = s / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const v = rnd(40, 58);
          g.fillStyle = rgb(v, v - 1, v + 4);
          const x = i * cell + rnd(3, 9), y = j * cell + rnd(3, 9);
          g.fillRect(x, y, cell - rnd(8, 18), cell - rnd(8, 18));
          // cracks
          g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
          for (let c = 0; c < 2; c++) {
            g.beginPath();
            let cx = x + rnd(20, cell - 40), cy = y + rnd(20, cell - 40);
            g.moveTo(cx, cy);
            for (let k = 0; k < 4; k++) { cx += rnd(-40, 40); cy += rnd(-40, 40); g.lineTo(cx, cy); }
            g.stroke();
          }
          // worn highlight
          g.fillStyle = 'rgba(255,255,255,0.04)';
          g.fillRect(x + 6, y + 6, cell * 0.5, cell * 0.3);
        }
      }
      // moss
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(50,70,35,${rnd(0.12, 0.3)})`;
        g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, rnd(20, 70), rnd(12, 40), Math.random() * 3, 0, Math.PI * 2); g.fill();
      }
      speckle(g, s, 30000, 0.35);
      speckle(g, s, 6000, 0.08, true);
    });
  },

  // Dark stone brick courses. Tiles every 2 m.
  brick() {
    return make('brick', 512, (g, s) => {
      g.fillStyle = '#15151a'; g.fillRect(0, 0, s, s);
      const rows = 8, bh = s / rows, bw = s / 4;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let b = -1; b < 5; b++) {
          const v = rnd(58, 78);
          g.fillStyle = rgb(v, v - 4, v - 6);
          g.fillRect(b * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.fillRect(b * bw + off + 3, r * bh + 3, bw - 6, 3);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(b * bw + off + 3, (r + 1) * bh - 7, bw - 6, 4);
        }
      }
      speckle(g, s, 12000, 0.35);
      speckle(g, s, 2500, 0.07, true);
    });
  },

  // Wooden planks with grain.
  wood() {
    return make('wood', 256, (g, s) => {
      g.fillStyle = '#4a2f1a'; g.fillRect(0, 0, s, s);
      const planks = 4, ph = s / planks;
      for (let p = 0; p < planks; p++) {
        const v = rnd(0.85, 1.15);
        g.fillStyle = rgb(82 * v, 52 * v, 30 * v);
        g.fillRect(0, p * ph + 2, s, ph - 4);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
        for (let k = 0; k < 9; k++) {
          const y = p * ph + rnd(4, ph - 4);
          g.beginPath(); g.moveTo(0, y);
          for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + k) * 2);
          g.stroke();
        }
      }
      speckle(g, s, 3000, 0.25);
    });
  },

  // Woven cloth in a base colour.
  cloth(hex) {
    return make('cloth' + hex, 128, (g, s) => {
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 2) {
        g.fillStyle = x % 4 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
        g.fillRect(x, 0, 1, s);
      }
      for (let y = 0; y < s; y += 2) {
        g.fillStyle = y % 4 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.04)';
        g.fillRect(0, y, s, 1);
      }
      speckle(g, s, 800, 0.2);
    });
  },

  // Torn, grimy cloth for hollows.
  ragged(hex) {
    return make('ragged' + hex, 128, (g, s) => {
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(0,0,0,${rnd(0.15, 0.45)})`;
        g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, rnd(6, 22), rnd(4, 14), Math.random() * 3, 0, Math.PI * 2); g.fill();
      }
      for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, s, 1); }
      speckle(g, s, 1500, 0.3);
    });
  },

  // Riveted armour plates.
  plate(hex) {
    return make('plate' + hex, 256, (g, s) => {
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      const n = 2, cell = s / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = i * cell, y = j * cell;
          const grad = g.createLinearGradient(x, y, x + cell, y + cell);
          grad.addColorStop(0, 'rgba(255,255,255,0.14)'); grad.addColorStop(1, 'rgba(0,0,0,0.25)');
          g.fillStyle = grad; g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
          g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, cell - 6, cell - 6);
          // rivets
          for (const [rx, ry] of [[12, 12], [cell - 12, 12], [12, cell - 12], [cell - 12, cell - 12]]) {
            g.fillStyle = shade(hex, 1.5); g.beginPath(); g.arc(x + rx, y + ry, 4, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + rx + 1, y + ry + 1, 2, 0, Math.PI * 2); g.fill();
          }
        }
      }
      speckle(g, s, 2500, 0.2);
      speckle(g, s, 800, 0.1, true);
    });
  },

  // Chainmail-ish dotted metal.
  chain(hex) {
    return make('chain' + hex, 64, (g, s) => {
      g.fillStyle = shade(hex, 0.6); g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 6) {
        for (let x = 0; x < s; x += 6) {
          const ox = (y / 6) % 2 ? 3 : 0;
          g.fillStyle = shade(hex, 1.1); g.beginPath(); g.arc(x + ox + 3, y + 3, 2.4, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x + ox + 3, y + 3, 1.1, 0, Math.PI * 2); g.fill();
        }
      }
    });
  },
};

// Clone a repeating texture with a repeat count fitted to a face of w x h metres.
export function fitted(tex, w, h, metresPerTile) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(0.25, w / metresPerTile), Math.max(0.25, h / metresPerTile));
  return t;
}
