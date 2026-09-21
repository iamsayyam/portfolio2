import * as THREE from 'three';
import type { PlaceId } from '@/data/site';
import { C } from './palette';
import { box, cone, cyl, fresh, gable, group, lam, sph } from './kit';
import { mulberry32 } from './rng';
import { facade, roundFacade } from './textures';

export type Landmark = {
  id: PlaceId;
  group: THREE.Group;
  /** where the name label and "Enter?" bubble hang */
  top: THREE.Vector3;
  /** where the camera looks when we fly here */
  focus: THREE.Vector3;
  mats: THREE.MeshLambertMaterial[];
  hit: THREE.Mesh;
};

export type City = {
  group: THREE.Group;
  landmarks: Landmark[];
  update: (t: number, dt: number) => void;
};

const BASE = 0.25; // top of the block pads
const PITCH = 24; // distance between street centres
const ROAD_W = 5;
const EXTENT = 72;
const ROAD_AT = [-2 * PITCH, -PITCH, 0, PITCH, 2 * PITCH];
const BLOCK_AT = [-60, -36, -12, 12, 36, 60];

const YELLOW_BASE = '#f0d31c';
const WIN = '#2a2825';

/** A tower with rows of windows on its four sides. */
function tower(w: number, h: number, d: number, base: string, roofColor: number, ownMats = false) {
  const rows = Math.max(2, Math.round(h / 2.1));
  const tz = facade(Math.max(2, Math.round(w / 1.7)), rows, base, WIN);
  const tx = facade(Math.max(2, Math.round(d / 1.7)), rows, base, WIN);
  const side = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t });
  const top = ownMats ? fresh(roofColor) : lam(roofColor);
  const mats = [side(tx), side(tx), top, top, side(tz), side(tz)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  return body;
}

function house(rand: () => number) {
  const w = 3.4 + rand() * 1.2;
  const d = 3 + rand() * 0.8;
  const h = 2 + rand() * 0.5;
  const g = new THREE.Group();
  g.add(box(w, h, d, C.wallLight));
  g.add(gable(w + 0.5, d + 0.5, 1.7, C.roofDark, 0, h, 0));
  g.add(box(0.7, 1.3, 0.12, C.dark, -w * 0.18, 0, d / 2));
  g.add(box(0.7, 0.7, 0.12, C.dark, w * 0.22, h * 0.35, d / 2));
  g.add(box(0.4, 0.9, 0.4, C.roof, w * 0.25, h + 0.8, -d * 0.15)); // chimney
  g.rotation.y = Math.floor(rand() * 4) * (Math.PI / 2);
  return g;
}

function turbine(x: number, z: number, phase: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.18, 0.3, 9, 6, C.white));
  g.add(box(0.5, 0.5, 1.2, C.white, 0, 8.8, 0));
  const rotor = new THREE.Group();
  rotor.position.set(0, 9.05, 0.7);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI * 2) / 3;
    const b = box(0.28, 4.4, 0.07, C.white, 0, 0, 0);
    arm.add(b);
    rotor.add(arm);
  }
  rotor.rotation.z = phase;
  g.add(rotor);
  return { g, rotor };
}

export function buildCity(): City {
  const root = new THREE.Group();
  const rand = mulberry32(42);
  const landmarks: Landmark[] = [];
  const trees: { x: number; z: number; s: number }[] = [];
  const rotors: THREE.Object3D[] = [];
  const puffs: { mesh: THREE.Mesh; phase: number }[] = [];
  const cars: { mesh: THREE.Object3D; axis: 'x' | 'z'; line: number; dir: 1 | -1; speed: number; pos: number }[] = [];

  // ---- ground and streets
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), lam(C.sand));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  for (const r of ROAD_AT) {
    root.add(box(420, 0.12, ROAD_W, C.road, 0, 0, r));
    root.add(box(ROAD_W, 0.12, 420, C.road, r, 0, 0));
  }
  // dashed centre lines
  const dashes: number[] = [];
  for (let t = -EXTENT - 40; t <= EXTENT + 40; t += 4.5) {
    if (ROAD_AT.some((r) => Math.abs(t - r) < ROAD_W / 2 + 0.9)) continue;
    dashes.push(t);
  }
  const dashGeo = new THREE.BoxGeometry(1.7, 0.04, 0.2);
  const dashMat = lam(C.roadLine);
  const dm = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length * ROAD_AT.length * 2);
  const o = new THREE.Object3D();
  let n = 0;
  for (const r of ROAD_AT) {
    for (const t of dashes) {
      o.rotation.set(0, 0, 0);
      o.position.set(t, 0.14, r);
      o.updateMatrix();
      dm.setMatrixAt(n++, o.matrix);
      o.rotation.set(0, Math.PI / 2, 0);
      o.position.set(r, 0.14, t);
      o.updateMatrix();
      dm.setMatrixAt(n++, o.matrix);
    }
  }
  dm.count = n;
  dm.receiveShadow = true;
  root.add(dm);

  // ---- yellow landmarks (one per place)
  function registerLandmark(id: PlaceId, g: THREE.Group, cx: number, cz: number, topY: number, focusY: number, hitSize: [number, number]) {
    g.position.set(cx, BASE, cz);
    const mats: THREE.MeshLambertMaterial[] = [];
    g.traverse((c) => {
      const m = (c as THREE.Mesh).material;
      const list = Array.isArray(m) ? m : m ? [m] : [];
      for (const mm of list) if (mm instanceof THREE.MeshLambertMaterial && !mats.includes(mm)) mats.push(mm);
    });
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(hitSize[0], topY + 1, hitSize[1]),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(cx, BASE + (topY + 1) / 2, cz);
    hit.userData.placeId = id;
    root.add(g, hit);
    landmarks.push({
      id,
      group: g,
      top: new THREE.Vector3(cx, BASE + topY + 1.4, cz),
      focus: new THREE.Vector3(cx, focusY, cz),
      mats,
      hit,
    });
  }

  const gold = () => fresh(C.gold);
  const goldDark = () => fresh(C.goldDark);
  const yellow = () => fresh(C.yellow);

  // Projects: a stepped tower
  {
    const g = new THREE.Group();
    const tiers = [
      { w: 8, h: 7 },
      { w: 6.6, h: 5 },
      { w: 5.2, h: 4 },
    ];
    let y = 0;
    for (const t of tiers) {
      const b = tower(t.w, t.h, t.w, YELLOW_BASE, C.gold, true);
      b.position.y = y + t.h / 2;
      g.add(b);
      g.add(box(t.w + 0.5, 0.4, t.w + 0.5, goldDark(), 0, y + t.h, 0));
      y += t.h + 0.4;
    }
    g.add(box(2.4, 1.2, 2.4, gold(), 0, y, 0));
    g.add(cyl(0.08, 0.08, 3, 5, goldDark(), 0, y + 1.2, 0));
    g.add(box(1.4, 1.9, 0.15, fresh(C.dark), 0, 0, 4.05));
    registerLandmark('projects', g, -12, -12, y + 1.6, 10, [9, 9]);
  }

  // About: a round tiered tower
  {
    const g = new THREE.Group();
    const radii = [4.3, 3.7, 3.1];
    let y = 0;
    const tex = roundFacade(YELLOW_BASE, WIN);
    for (const r of radii) {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 3.8, 28),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      body.position.y = y + 1.9;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      g.add(cyl(r + 0.55, r + 0.55, 0.4, 28, goldDark(), 0, y + 3.8, 0));
      y += 4.2;
    }
    g.add(cyl(1.6, 2.4, 1.3, 20, gold(), 0, y, 0));
    g.add(box(1.5, 2, 0.4, fresh(C.dark), 0, 0, radii[0]));
    registerLandmark('about', g, -12, 12, y + 1.4, 7, [9.5, 9.5]);
  }

  // Skills: a block with a roof garden
  {
    const g = new THREE.Group();
    g.add(tower(8, 11, 7, YELLOW_BASE, C.gold, true));
    g.add(box(8.6, 0.4, 7.6, goldDark(), 0, 11, 0));
    g.add(box(7.2, 0.5, 6.2, fresh(C.green), 0, 11.4, 0));
    for (const [tx, tz] of [[-2.2, -1.4], [1.8, 1.2], [2.4, -1.8]] as const) {
      g.add(cone(0.9, 2.2, 6, fresh(C.greenDark), tx, 11.9, tz));
    }
    const annex = tower(4, 4.5, 4, YELLOW_BASE, C.gold, true);
    annex.position.set(6.4, 2.25, 1.5);
    g.add(annex);
    g.add(box(1.5, 2, 0.15, fresh(C.dark), -1, 0, 3.55));
    registerLandmark('skills', g, 12, -12, 13.6, 7, [13, 9]);
  }

  // Contact: a low building with a gate and a dish
  {
    const g = new THREE.Group();
    g.add(tower(10, 5.5, 7, YELLOW_BASE, C.gold, true));
    g.add(box(10.6, 0.4, 7.6, goldDark(), 0, 5.5, 0));
    g.add(box(4.2, 0.35, 2.6, gold(), 0, 3.2, 4.6)); // awning
    g.add(box(0.3, 3.2, 0.3, goldDark(), -1.8, 0, 5.7));
    g.add(box(0.3, 3.2, 0.3, goldDark(), 1.8, 0, 5.7));
    g.add(box(1.7, 2.3, 0.15, fresh(C.dark), 0, 0, 3.55));
    g.add(cyl(0.14, 0.14, 2.2, 5, goldDark(), 3, 5.9, -1));
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: C.white, side: THREE.DoubleSide }),
    );
    dish.rotation.x = -1.0;
    dish.position.set(3, 8.2, -1);
    dish.castShadow = true;
    g.add(dish);
    registerLandmark('contact', g, 12, 12, 8.5, 5, [11.5, 10]);
  }

  // ---- everything else, block by block
  const special = new Set(['-12,-12', '-12,12', '12,-12', '12,12', '-36,-12', '36,-12', '36,12']);

  for (const cx of BLOCK_AT) {
    for (const cz of BLOCK_AT) {
      const key = `${cx},${cz}`;
      root.add(box(19, BASE, 19, C.pad, cx, 0, cz));
      if (special.has(key) && !['-36,-12', '36,-12', '36,12'].includes(key)) continue;

      const ring = Math.max(Math.abs(cx), Math.abs(cz));
      const dist = Math.hypot(cx, cz);

      if (key === '-36,-12') {
        // factory
        root.add(box(10, 4.5, 8, C.wall, cx - 1.5, BASE, cz + 3));
        for (let i = 0; i < 3; i++) root.add(gable(3.4, 8.4, 1.6, C.roofDark, cx - 4.7 + i * 3.4, BASE + 4.5, cz + 3));
        root.add(box(5, 7, 5, C.wallLight, cx + 3.5, BASE, cz - 4));
        const chim = cyl(0.8, 1.1, 15, 10, C.wallLight, cx - 3.5, BASE, cz - 4.5);
        root.add(chim);
        root.add(cyl(0.92, 0.92, 0.8, 10, C.gold, cx - 3.5, BASE + 14.2, cz - 4.5));
        root.add(cyl(2.4, 2.4, 4.2, 14, C.roof, cx + 5.2, BASE, cz + 4.5));
        for (let i = 0; i < 5; i++) {
          const puff = new THREE.Mesh(
            new THREE.SphereGeometry(1.1, 8, 6),
            new THREE.MeshLambertMaterial({ color: 0xe9e4d6, transparent: true, opacity: 0.6, depthWrite: false }),
          );
          puff.position.set(cx - 3.5, BASE + 15.5, cz - 4.5);
          root.add(puff);
          puffs.push({ mesh: puff, phase: i / 5 });
        }
        continue;
      }
      if (key === '36,-12') {
        // pond and bridge
        root.add(cyl(7, 7.4, 0.25, 24, C.pad, cx, BASE, cz));
        const water = cyl(6.3, 6.3, 0.2, 24, C.water, cx, BASE + 0.1, cz);
        root.add(water);
        const heights = [0.2, 0.7, 1.05, 0.7, 0.2];
        heights.forEach((hh, i) => {
          root.add(box(1.9, 0.3, 2.6, 0x7a5836, cx - 3.8 + i * 1.9, BASE + hh, cz - 0.3));
        });
        for (const s of [-1.1, 1.1]) for (let i = 0; i < 5; i++) root.add(box(0.1, 0.5, 0.1, 0x5c4229, cx - 3.8 + i * 1.9, BASE + heights[i] + 0.3, cz - 0.3 + s));
        for (let i = 0; i < 6; i++) root.add(cone(0.2, 1.4, 4, C.greenDark, cx + 2 + rand() * 3, BASE, cz + 2 + rand() * 3));
        continue;
      }
      if (key === '36,12') {
        // solar panels
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 4; j++) {
            const px = cx - 5.2 + j * 3.5;
            const pz = cz - 5.5 + i * 5.2;
            root.add(box(0.14, 0.9, 0.14, C.roofDark, px, BASE, pz));
            const p = box(3, 0.14, 1.9, 0x34477a, px, BASE + 0.85, pz);
            p.rotation.x = -0.45;
            root.add(p);
          }
        }
        continue;
      }

      const outer = ring >= 60;
      for (const ox of [-4.75, 4.75]) {
        for (const oz of [-4.75, 4.75]) {
          const x = cx + ox + (rand() - 0.5) * 0.8;
          const z = cz + oz + (rand() - 0.5) * 0.8;
          const roll = rand();
          if (!outer && roll < 0.55) {
            const near = 1 - Math.min(1, dist / 90);
            const h = 5 + rand() * 6 + near * 9;
            const w = 4.6 + rand() * 1.8;
            const d = 4.6 + rand() * 1.8;
            const tone = ['#b9b29c', '#c6bfa9', '#aaa38f'][Math.floor(rand() * 3)];
            const t = tower(w, h, d, tone, C.roof);
            t.position.set(x, BASE + h / 2, z);
            root.add(t);
            root.add(box(w + 0.5, 0.45, d + 0.5, C.roofDark, x, BASE + h, z));
            root.add(box(w * 0.35, 0.9, d * 0.35, C.roof, x + w * 0.1, BASE + h + 0.45, z));
          } else if (roll < 0.85) {
            const h = house(rand);
            h.position.set(x, BASE, z);
            root.add(h);
          } else {
            for (let i = 0; i < 4; i++) trees.push({ x: x + (rand() - 0.5) * 5, z: z + (rand() - 0.5) * 5, s: 0.8 + rand() * 0.6 });
          }
        }
      }
      // street trees along the block edge
      for (let i = -3; i <= 3; i++) {
        if (rand() < 0.55) trees.push({ x: cx + i * 2.8, z: cz + (rand() < 0.5 ? 8.7 : -8.7), s: 0.75 + rand() * 0.4 });
        if (rand() < 0.4) trees.push({ x: cx + (rand() < 0.5 ? 8.7 : -8.7), z: cz + i * 2.8, s: 0.75 + rand() * 0.4 });
      }
    }
  }

  // trees, drawn as two instanced meshes
  {
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 3, 6).translate(0, 2.6, 0), lam(0xffffff), trees.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 5).translate(0, 0.6, 0), lam(C.trunk), trees.length);
    foliage.castShadow = true;
    trunk.castShadow = true;
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      o.rotation.set(0, rand() * 6, 0);
      o.position.set(t.x, BASE, t.z);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      foliage.setMatrixAt(i, o.matrix);
      trunk.setMatrixAt(i, o.matrix);
      foliage.setColorAt(i, col.setHex(rand() < 0.5 ? C.green : C.greenDark));
    });
    o.scale.setScalar(1);
    root.add(foliage, trunk);
  }

  // wind turbines on the edge of town
  for (const [x, z, p] of [[-66, -30, 0], [-66, 6, 1.2], [66, -60, 2.1], [66, 24, 0.7], [-20, 68, 1.7], [30, -68, 2.6]] as const) {
    const t = turbine(x, z, p);
    root.add(t.g);
    rotors.push(t.rotor);
  }

  // hills fading into the haze
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.3;
    const r = 170 + rand() * 60;
    const hill = sph(28 + rand() * 20, C.wall, Math.cos(a) * r, -6, Math.sin(a) * r, 10);
    hill.scale.y = 0.45;
    hill.castShadow = false;
    root.add(hill);
  }

  // traffic
  const carColors = [C.yellow, C.coral, C.blue, C.white, C.teal, 0x8d8a7d];
  for (let i = 0; i < 16; i++) {
    const axis = rand() < 0.5 ? 'x' : 'z';
    const line = ROAD_AT[Math.floor(rand() * ROAD_AT.length)];
    const dir = rand() < 0.5 ? 1 : -1;
    const car = group(box(2, 0.7, 1, carColors[i % carColors.length], 0, 0.15, 0), box(1, 0.55, 0.9, C.dark, -0.1, 0.8, 0));
    root.add(car);
    cars.push({ mesh: car, axis, line, dir, speed: 4 + rand() * 4, pos: (rand() - 0.5) * 2 * EXTENT });
  }

  const tmp = new THREE.Vector3();
  function update(t: number, dt: number) {
    for (const c of cars) {
      c.pos += c.dir * c.speed * dt;
      if (c.pos > EXTENT + 10) c.pos = -EXTENT - 10;
      if (c.pos < -EXTENT - 10) c.pos = EXTENT + 10;
      const lane = c.dir * 1.15;
      if (c.axis === 'x') {
        c.mesh.position.set(c.pos, 0.12, c.line + lane);
        c.mesh.rotation.y = c.dir === 1 ? 0 : Math.PI;
      } else {
        c.mesh.position.set(c.line - lane, 0.12, c.pos);
        c.mesh.rotation.y = c.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    for (const r of rotors) r.rotation.z += dt * 1.1;
    for (const p of puffs) {
      const k = (t * 0.12 + p.phase) % 1;
      p.mesh.position.y = BASE + 15.5 + k * 9;
      p.mesh.position.x = -36 - 3.5 + k * 3;
      p.mesh.scale.setScalar(0.6 + k * 1.6);
      (p.mesh.material as THREE.MeshLambertMaterial).opacity = 0.6 * (1 - k);
    }
    void tmp;
  }

  return { group: root, landmarks, update };
}
