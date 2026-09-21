import * as THREE from 'three';

/** Small helpers so scene code reads like a list of parts. All shapes sit on y = their base. */

const cache = new Map<number, THREE.MeshLambertMaterial>();
const cached = new Set<THREE.Material>();

export function lam(color: number): THREE.MeshLambertMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    cache.set(color, m);
    cached.add(m);
  }
  return m;
}

/** A material nobody else shares (used where a building needs its own glow). */
export function fresh(color: number, extra: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

export type Mat = number | THREE.Material | THREE.Material[];
const asMat = (m: Mat) => (typeof m === 'number' ? lam(m) : m);

function mesh(g: THREE.BufferGeometry, m: Mat, x: number, y: number, z: number) {
  const o = new THREE.Mesh(g, asMat(m));
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export const box = (w: number, h: number, d: number, m: Mat, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return mesh(g, m, x, y, z);
};

export const cyl = (rt: number, rb: number, h: number, seg: number, m: Mat, x = 0, y = 0, z = 0) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(0, h / 2, 0);
  return mesh(g, m, x, y, z);
};

export const cone = (r: number, h: number, seg: number, m: Mat, x = 0, y = 0, z = 0) => {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  return mesh(g, m, x, y, z);
};

/** Sphere centred on y. */
export const sph = (r: number, m: Mat, x = 0, y = 0, z = 0, seg = 14) =>
  mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m, x, y, z);

/** A pitched roof (ridge runs along z). */
export function gable(w: number, d: number, h: number, m: Mat, x = 0, y = 0, z = 0) {
  const a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [w / 2, 0, d / 2], e = [-w / 2, 0, d / 2];
  const r1 = [0, h, -d / 2], r2 = [0, h, d / 2];
  const tris = [b, r1, r2, b, r2, c, e, r2, r1, e, r1, a, a, r1, b, c, r2, e];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  const mat = typeof m === 'number' ? new THREE.MeshLambertMaterial({ color: m, flatShading: true, side: THREE.DoubleSide }) : asMat(m);
  return mesh(g, mat, x, y, z);
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

/** Free GPU memory for a scene we are done with. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) if (!cached.has(mat)) mat.dispose();
  });
}
