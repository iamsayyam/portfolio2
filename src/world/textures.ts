import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** A wall of windows: `cols` x `rows` dark panes on a flat colour. */
export function facade(cols: number, rows: number, base: string, win: string) {
  const cell = 24;
  return make(`f:${cols}:${rows}:${base}:${win}`, cols * cell, rows * cell, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, cols * cell, rows * cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(c * cell + 5, r * cell + 4, 14, 16);
        g.fillStyle = win;
        g.fillRect(c * cell + 6, r * cell + 5, 12, 14);
      }
    }
  });
}

/** Windows for round towers; repeats around the cylinder. */
export function roundFacade(base: string, win: string) {
  const t = make(`r:${base}:${win}`, 64, 96, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 96);
    g.fillStyle = win;
    for (let r = 0; r < 3; r++) g.fillRect(22, 10 + r * 30, 20, 14);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(9, 1);
  return t;
}

export function wood() {
  const t = make('wood', 512, 512, (g) => {
    const tones = ['#d8a05e', '#d09851', '#dca967', '#cf9450'];
    for (let r = 0; r < 8; r++) {
      g.fillStyle = tones[r % tones.length];
      g.fillRect(0, r * 64, 512, 64);
      g.fillStyle = 'rgba(120,70,20,0.35)';
      g.fillRect(0, r * 64, 512, 3);
      const off = (r * 173) % 512;
      g.fillRect(off, r * 64, 3, 64);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

export function label(text: string, fg = '#24211d', bg = '#f2d21b') {
  return make(`l:${text}:${fg}:${bg}`, 256, 96, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = fg;
    g.font = '800 46px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 50);
  });
}

/** A fake screen with lines of "code" on it. */
export function screen(seed: number, accent: string) {
  return make(`s:${seed}:${accent}`, 256, 160, (g) => {
    g.fillStyle = '#1f2430';
    g.fillRect(0, 0, 256, 160);
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 3 === 0 ? accent : '#6c7793';
      g.fillRect(16 + rnd() * 24, 14 + i * 15, 40 + rnd() * 150, 6);
    }
  });
}
