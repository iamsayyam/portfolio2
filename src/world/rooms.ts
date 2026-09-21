import * as THREE from 'three';
import { projects, site, skills, type PlaceId } from '@/data/site';
import { C } from './palette';
import { box, cone, cyl, disposeTree, fresh, group, lam, sph } from './kit';
import { label, screen, wood } from './textures';

export type Pickable = {
  key: string;
  object: THREE.Object3D;
  title: string;
  action: string;
  /** height above the object where its bubble hangs */
  lift: number;
};

export type RoomLabel = { text: string; position: THREE.Vector3 };

export type Room = {
  scene: THREE.Scene;
  pickables: Pickable[];
  labels: RoomLabel[];
  update: (t: number, dt: number) => void;
  dispose: () => void;
};

const S = 8; // half the floor size of the square rooms
const SPOTS = [
  [-4.6, -2.2],
  [-0.4, -4.8],
  [4.3, -3.2],
  [4.6, 1.6],
  [-1.2, 1.4],
] as const;
const ITEM_COLORS = [C.blue, C.coral, C.teal, C.purple, C.yellow];

function windowFrame(w: number, h: number) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.3, C.frame));
  g.add(box(w - 0.5, h - 0.5, 0.34, C.paneGlass, 0, 0.25, 0));
  g.add(box(0.14, h, 0.4, C.frame, 0, 0, 0));
  g.add(box(w, 0.14, 0.4, C.frame, 0, h / 2 - 0.07, 0));
  return g;
}

function frameArt(w: number, h: number, color: number) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.14, C.dark));
  g.add(box(w - 0.3, h - 0.3, 0.18, color, 0, 0.15, 0));
  return g;
}

function floorLamp(x: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.55, 0.55, 0.1, 14, C.dark));
  g.add(cyl(0.06, 0.06, 3.2, 6, C.dark));
  g.add(cyl(0.95, 0.55, 0.9, 16, fresh(C.shade, { emissive: 0xf6c93a, emissiveIntensity: 0.55 }), 0, 2.7, 0));
  return g;
}

function plant(x: number, z: number, flower = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.35, 0.45, 0.6, 8, C.pot));
  g.add(cyl(0.05, 0.05, 0.9, 5, C.greenDark, 0, 0.6, 0));
  if (flower) {
    g.add(sph(0.3, C.pink, 0, 1.65, 0, 8));
  } else {
    for (const [dx, dy, dz] of [[0, 1.5, 0], [0.3, 1.1, 0.1], [-0.3, 1.2, -0.1]] as const) g.add(sph(0.4, C.green, dx, dy, dz, 8));
  }
  return g;
}

function chair() {
  const g = new THREE.Group();
  g.add(box(0.95, 0.28, 0.95, C.dark, 0, 0.95, 0));
  g.add(box(0.95, 1.35, 0.22, C.dark, 0, 1.2, -0.45));
  g.add(cyl(0.08, 0.08, 0.7, 6, C.dark, 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const leg = box(0.7, 0.08, 0.1, C.dark, 0, 0.12, 0);
    leg.rotation.y = (i * Math.PI * 2) / 5;
    g.add(leg);
  }
  return g;
}

function bookshelf() {
  const g = new THREE.Group();
  const colors = [C.coral, C.blue, C.yellow, C.teal, C.purple, C.cream];
  g.add(box(0.12, 4, 1, C.dark, -1.5, 0, 0));
  g.add(box(0.12, 4, 1, C.dark, 1.5, 0, 0));
  for (let r = 0; r < 4; r++) {
    g.add(box(3.1, 0.12, 1, C.dark, 0, 0.3 + r * 1.15, 0));
    if (r < 3) for (let i = 0; i < 7; i++) g.add(box(0.28, 0.7 + (i % 3) * 0.1, 0.6, colors[(i + r) % colors.length], -1.15 + i * 0.38, 0.42 + r * 1.15, 0));
  }
  return g;
}

function door() {
  const g = new THREE.Group();
  g.add(box(0.3, 4.6, 0.3, C.dark, 0, 0, -1.1));
  g.add(box(0.3, 4.6, 0.3, C.dark, 0, 0, 1.1));
  g.add(box(0.3, 0.3, 2.5, C.dark, 0, 4.4, 0));
  g.add(box(0.12, 4.3, 2, C.tan, 0.05, 0, 0));
  g.add(box(0.2, 0.7, 0.14, C.dark, 0.14, 1.9, 0.7));
  const sign = box(0.25, 0.85, 2, C.yellow, 0.1, 4.9, 0);
  g.add(sign);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.68), new THREE.MeshBasicMaterial({ map: label('EXIT  ›') }));
  text.rotation.y = Math.PI / 2;
  text.position.set(0.24, 5.32, 0);
  g.add(text);
  return g;
}

function orb() {
  const g = new THREE.Group();
  const ball = sph(0.55, fresh(0xfff23a, { emissive: 0xfff23a, emissiveIntensity: 0.9 }), 0, 0.9, 0, 18);
  ball.castShadow = false;
  g.add(ball, cyl(1, 1, 0.05, 28, C.gold));
  return { g, ball };
}

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9caa2, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
  sun.position.set(10, 20, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
}

const woodMat = () => new THREE.MeshLambertMaterial({ map: wood() });

/** A square room with two back walls, like a doll's house with the front cut away. */
function cornerShell(scene: THREE.Scene) {
  scene.add(box(16, 0.5, 16, woodMat(), 0, -0.5, 0));
  for (const back of [true, false]) {
    const w = (x: number, y: number, h: number, c: number, t = 0.4) =>
      back ? box(16.4, h, t, c, 0, y, -S - 0.2) : box(t, h, 16.4, c, -S - 0.2, y, 0);
    scene.add(w(0, 0, 3.6, C.cream), w(0, 3.6, 3.9, C.tan), w(0, 3.45, 0.2, C.gold, 0.5));
  }
  const win = (w: number, h: number, x: number, y: number, back: boolean, z = 0) => {
    const f = windowFrame(w, h);
    if (back) f.position.set(x, y, -S + 0.02);
    else {
      f.rotation.y = Math.PI / 2;
      f.position.set(-S + 0.02, y, z);
    }
    scene.add(f);
  };
  return { win };
}

function decorateCorner(scene: THREE.Scene, orbPos: [number, number]) {
  const ex = door();
  ex.position.set(-S + 0.2, 0, 3.4);
  scene.add(ex);
  scene.add(floorLamp(-6.6, 6.6), floorLamp(6.5, -6.4), plant(-6.8, 6.9, true), plant(6.8, 5.6));
  const o = orb();
  o.g.position.set(orbPos[0], 0, orbPos[1]);
  scene.add(o.g);
  return { exit: ex, orb: o };
}

export function buildRoom(id: PlaceId): Room {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6eef2);
  lights(scene);
  const pickables: Pickable[] = [];
  const labels: RoomLabel[] = [];
  const spinners: { o: THREE.Object3D; speed: number }[] = [];
  let bob: THREE.Object3D | null = null;
  let orbBall: THREE.Object3D | null = null;

  const pick = (key: string, object: THREE.Object3D, title: string, action: string, lift: number) =>
    pickables.push({ key, object, title, action, lift });

  if (id === 'about') {
    const R = 8.2;
    scene.add(cyl(R, R, 0.5, 48, woodMat(), 0, -0.5, 0));
    const arc = (h: number, y: number, color: number, r = R) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 48, 1, true, Math.PI * 0.65, Math.PI * 1.2),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
      );
      m.position.y = y + h / 2;
      m.receiveShadow = true;
      scene.add(m);
    };
    arc(3.6, 0, C.cream);
    arc(3.9, 3.6, C.tan);
    arc(0.2, 3.45, C.gold, R - 0.02);

    const onWall = (a: number, y: number, r = R - 0.25) => {
      const p = new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
      return { p, ry: a + Math.PI };
    };
    const place = (o: THREE.Object3D, a: number, y: number, r?: number) => {
      const w = onWall(a, y, r);
      o.position.copy(w.p);
      o.rotation.y = w.ry;
      scene.add(o);
    };

    // meeting table and eight chairs
    scene.add(cyl(3.2, 3.2, 0.2, 40, C.cream, 0, 1.75, 0), cyl(0.5, 0.7, 1.75, 12, C.tan), cyl(1.6, 1.6, 0.14, 24, C.tan));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const c = chair();
      c.position.set(Math.sin(a) * 4.1, 0, Math.cos(a) * 4.1);
      c.rotation.y = a + Math.PI;
      scene.add(c);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), lam(C.dark));
    gem.position.set(0, 2.5, 0);
    gem.castShadow = true;
    scene.add(gem);
    spinners.push({ o: gem, speed: 0.8 });

    place(bookshelf(), Math.PI * 1.02, 0);
    const win1 = windowFrame(3, 3.8);
    place(win1, Math.PI * 1.22, 3.4);
    const board = group(box(5, 2.8, 0.2, C.gold), box(4.5, 2.4, 0.26, C.dark, 0, 0.2, 0));
    place(board, Math.PI * 1.5, 3.4);
    const clock = cyl(0.8, 0.8, 0.12, 24, C.white);
    clock.rotation.x = Math.PI / 2;
    const clockG = group(clock);
    place(clockG, Math.PI * 1.13, 6.6, R - 0.3);
    const b1 = group(box(1.6, 2.3, 0.1, C.yellow), box(1.0, 0.7, 0.14, C.coral, 0.1, 1.3, 0));
    const b2 = group(box(1.6, 2.3, 0.1, C.purple), box(1.0, 0.7, 0.14, C.yellow, -0.1, 0.5, 0));
    place(b1, Math.PI * 1.32, 3.7);
    place(b2, Math.PI * 1.4, 3.7);

    const ang = Math.PI * 1.72;
    const ex = door();
    ex.position.set(Math.sin(ang) * (R - 0.1), 0, Math.cos(ang) * (R - 0.1));
    ex.rotation.y = ang + Math.PI - Math.PI / 2;
    scene.add(ex);
    pick('exit', ex, 'Exit', 'Back to the city', 6.4);

    scene.add(floorLamp(-6.6, -2.4), floorLamp(3.2, -6.4), plant(1, -6.6), plant(6.4, -1, true));
    const o = orb();
    o.g.position.set(-3.6, 0, 6);
    scene.add(o.g);
    orbBall = o.ball;
  } else {
    const shell = cornerShell(scene);
    const dec = decorateCorner(scene, id === 'contact' ? [-5.2, 5.6] : [-3.4, 5.4]);
    pick('exit', dec.exit, 'Exit', 'Back to the city', 6.4);
    orbBall = dec.orb.ball;

    if (id === 'projects') {
      shell.win(3.2, 3.8, -2.2, 3.4, true);
      shell.win(3.2, 3.8, 5.6, 3.4, true);
      shell.win(2.6, 3.8, 0, 3.4, false, -3.4);
      const art = frameArt(1.5, 1.9, C.yellow);
      art.position.set(-6.4, 3.8, -S + 0.05);
      scene.add(art);
      const art2 = frameArt(1.8, 1.4, C.teal);
      art2.position.set(1.8, 4.6, -S + 0.05);
      scene.add(art2);
      projects.slice(0, SPOTS.length).forEach((p, i) => {
        const [x, z] = SPOTS[i];
        const unit = new THREE.Group();
        unit.position.set(x, 0, z);
        unit.add(cyl(1.5, 1.5, 1.1, 22, 0xbdb8a6), cyl(1.6, 1.6, 0.15, 22, C.gold, 0, 1.1, 0));
        const geo = [new THREE.TorusKnotGeometry(0.62, 0.22, 64, 8), new THREE.IcosahedronGeometry(0.95, 0), new THREE.OctahedronGeometry(1.0)][i % 3];
        const item = new THREE.Mesh(geo, fresh(ITEM_COLORS[i % ITEM_COLORS.length]));
        item.position.set(0, 2.5, 0);
        item.castShadow = true;
        unit.add(item);
        scene.add(unit);
        spinners.push({ o: item, speed: 0.6 + i * 0.15 });
        pick(`project:${i}`, unit, p.title, 'Click to open', 4.6);
        labels.push({ text: p.title, position: new THREE.Vector3(x, 3.5, z) });
      });
      bob = null;
    }

    if (id === 'skills') {
      shell.win(3.2, 3.8, -4.4, 3.4, true);
      shell.win(3.2, 3.8, 0.4, 3.4, true);
      const rug = cyl(3.6, 3.6, 0.04, 32, 0xe2c65a, 0.6, 0.02, 1.6);
      scene.add(rug);
      const shelf = bookshelf();
      shelf.position.set(5.4, 0, -S + 0.7);
      scene.add(shelf);
      skills.slice(0, SPOTS.length).forEach((g, i) => {
        const [x, z] = SPOTS[i];
        const st = new THREE.Group();
        st.position.set(x, 0, z);
        st.rotation.y = Math.PI / 4;
        st.add(box(3.4, 0.18, 1.7, 0xd9c9a0, 0, 1.55, 0));
        for (const [lx, lz] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]] as const) st.add(box(0.14, 1.55, 0.14, C.dark, lx, 0, lz));
        st.add(box(1.7, 1.15, 0.1, C.dark, 0, 1.95, -0.3));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshBasicMaterial({ map: screen(i + 1, ['#f2d21b', '#ff8a5c', '#5cd6c0', '#b58cff', '#7fb0ff'][i % 5]) }));
        scr.position.set(0, 2.5, -0.24);
        scr.rotation.y = Math.PI;
        scr.position.z = -0.24;
        st.add(scr);
        g.items.slice(0, 7).forEach((_, k) => st.add(box(0.34, 0.34, 0.34, ITEM_COLORS[(k + i) % ITEM_COLORS.length], -1.3 + k * 0.42, 1.73, 0.5)));
        scene.add(st);
        pick(`skill:${i}`, st, g.group, 'Click to see more', 5.2);
        labels.push({ text: g.group, position: new THREE.Vector3(x, 4.2, z) });
      });
    }

    if (id === 'contact') {
      shell.win(3.2, 3.8, -5.2, 3.4, true);
      shell.win(2.6, 3.8, 0, 3.4, false, -3.6);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), new THREE.MeshBasicMaterial({ map: label('SAY HELLO') }));
      sign.position.set(0.8, 5.2, -S + 0.06);
      scene.add(sign);
      // reception desk
      scene.add(box(7.4, 1.3, 1.9, C.cream, 0.4, 0, -5.3), box(7.8, 0.16, 2.2, C.gold, 0.4, 1.3, -5.3));
      // three link cubes on the desk
      site.socials.slice(0, 3).forEach((s, i) => {
        const x = -2.4 + i * 2.5;
        const cube = box(0.95, 0.95, 0.95, ITEM_COLORS[i], x, 1.46, -5.2);
        cube.rotation.y = 0.4;
        scene.add(cube);
        pick(`social:${i}`, cube, s.label, 'Click to open', 3.4);
        labels.push({ text: s.label, position: new THREE.Vector3(x, i === 1 ? 3.6 : 2.9, -5.2) });
      });
      // mailbox
      const mb = new THREE.Group();
      mb.position.set(5.2, 0, -3.6);
      mb.rotation.y = -0.3;
      mb.add(box(1.9, 2.7, 1.5, C.yellow), box(1.3, 0.14, 0.1, C.dark, 0, 1.9, 0.76), box(0.14, 0.8, 0.14, C.coral, 1.05, 1.9, 0));
      mb.add(cyl(0.05, 0.05, 0.001, 4, C.dark));
      scene.add(mb);
      pick('mail', mb, 'Email me', 'Click to write an email', 5.2);
      labels.push({ text: 'Email', position: new THREE.Vector3(5.2, 3.9, -3.6) });
      // envelope floating over the desk
      const env = group(box(1.8, 0.08, 1.2, C.white), box(0.6, 0.1, 0.6, C.coral, 0, 0.02, 0.15));
      env.position.set(0.4, 3.4, -2.6);
      scene.add(env);
      bob = env;
      // sofa
      const sofa = new THREE.Group();
      sofa.position.set(-6.6, 0, -0.4);
      sofa.rotation.y = Math.PI / 2;
      sofa.add(box(4.2, 0.7, 1.7, C.coral), box(4.2, 1.5, 0.5, C.coral, 0, 0, -0.85), box(0.5, 1.1, 1.7, 0xc84a26, -2.1, 0, 0), box(0.5, 1.1, 1.7, 0xc84a26, 2.1, 0, 0));
      scene.add(sofa, cyl(1.0, 1.0, 0.7, 18, C.tan, -3.6, 0, -0.4));
    }
  }

  const tmp = new THREE.Vector3();
  const update = (t: number, dt: number) => {
    for (const s of spinners) s.o.rotation.y += dt * s.speed;
    if (bob) {
      bob.position.y = 3.4 + Math.sin(t * 1.6) * 0.25;
      bob.rotation.y += dt * 0.6;
    }
    if (orbBall) {
      const k = 1 + Math.sin(t * 2.4) * 0.06;
      orbBall.scale.setScalar(k);
    }
    void tmp;
  };

  return { scene, pickables, labels, update, dispose: () => disposeTree(scene) };
}
