import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { places, type PlaceId } from '@/data/site';
import { buildCity, type City } from './city';
import { C } from './palette';
import { disposeTree } from './kit';
import { buildRoom, type Room } from './rooms';

export interface EngineEvents {
  onFocus(id: PlaceId | null): void;
  onFade(state: 'out' | 'in'): void;
  onRoomEntered(id: PlaceId): void;
  onRoomExited(): void;
  onPick(key: string): void;
}

export type Quality = 'high' | 'low';

type Pick = { key: string; title: string; action: string; anchor: THREE.Vector3 };
type Tween = { t0: number; dur: number; p0: THREE.Vector3; p1: THREE.Vector3; g0: THREE.Vector3; g1: THREE.Vector3; ease: (k: number) => number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

const CITY_TARGET = new THREE.Vector3(0, 3, 0);
const ROOM_TARGET = new THREE.Vector3(0, 2.4, 0);
const AZ = Math.PI / 4;

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(28, 1, 1, 1400);
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private cityScene = new THREE.Scene();
  private city: City;
  private room: Room | null = null;
  private roomId: PlaceId | null = null;
  private mode: 'city' | 'room' | 'busy' = 'city';
  private cityPose: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  private tween: Tween | null = null;
  private focusId: PlaceId | null = null;
  private hover: Pick | null = null;
  private touchPick: Pick | null = null;
  private hoverDirty = false;
  private pointer = { x: 0, y: 0 };
  private down: { x: number; y: number; t: number } | null = null;
  private spaceDown = false;

  private ray = new THREE.Raycaster();
  private v = new THREE.Vector3();
  private w = 1;
  private h = 1;

  private cityLabels = new Map<PlaceId, HTMLElement>();
  private roomLabels: { el: HTMLElement; pos: THREE.Vector3 }[] = [];
  private bubble: HTMLButtonElement;
  private bubbleTitle: HTMLElement;
  private bubbleAction: HTMLElement;
  private bubblePick: Pick | null = null;
  private ro: ResizeObserver;
  private shift = { x: 0, y: 0 };
  private shiftTo = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private layer: HTMLElement,
    private events: EngineEvents,
    private quality: Quality,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // city scene
    this.cityScene.background = new THREE.Color(C.fog);
    this.cityScene.fog = new THREE.Fog(C.fog, 190, 560);
    this.cityScene.add(new THREE.HemisphereLight(0xfff6de, 0x8c8468, 1.05));
    const sun = new THREE.DirectionalLight(0xfff0d2, 1.6);
    sun.position.set(-45, 80, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 220 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
    this.cityScene.add(sun);
    this.city = buildCity();
    this.cityScene.add(this.city.group);

    // controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;
    this.controls.screenSpacePanning = false;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.applyCityLimits();

    // DOM overlay: labels + the "Enter?" bubble
    for (const p of places) {
      const el = document.createElement('div');
      el.className = 'w-label';
      el.textContent = p.name;
      layer.appendChild(el);
      this.cityLabels.set(p.id, el);
    }
    this.bubble = document.createElement('button');
    this.bubble.type = 'button';
    this.bubble.className = 'w-bubble';
    this.bubbleTitle = document.createElement('strong');
    this.bubbleAction = document.createElement('span');
    this.bubble.append(this.bubbleTitle, this.bubbleAction);
    this.bubble.addEventListener('click', this.onBubbleClick);
    layer.appendChild(this.bubble);

    // listeners
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);

    this.setQuality(quality);
    this.resize();
    // start far away; playIntro() flies in
    const end = this.cityPoseFor();
    this.camera.position.copy(end.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(end.radius * 1.9, 0.55, AZ + 0.9)));
    this.controls.target.copy(end.target);
    this.controls.update();

    this.loop();
  }

  // ---------------------------------------------------------------- public API

  setQuality(q: Quality) {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.renderer.shadowMap.enabled = q === 'high';
    this.renderer.setSize(this.w, this.h, false);
    const touch = (s: THREE.Object3D) =>
      s.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => (mm.needsUpdate = true));
      });
    touch(this.cityScene);
    if (this.room) touch(this.room.scene);
  }

  playIntro() {
    const end = this.cityPoseFor();
    this.startTween(this.camera.position.clone().copy(end.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(end.radius, 0.95, AZ))), end.target, 3.4, easeOut);
  }

  resetView() {
    if (this.mode === 'city') {
      const end = this.cityPoseFor();
      this.startTween(end.target.clone().add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(end.radius, 0.95, AZ))), end.target, 1.2, easeInOut);
    } else if (this.mode === 'room') {
      this.setRoomPose();
    }
  }

  flyTo(id: PlaceId) {
    if (this.mode !== 'city') return;
    const lm = this.city.landmarks.find((l) => l.id === id);
    if (!lm) return;
    this.focusId = id;
    this.events.onFocus(id);
    this.touchPick = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.radius = 80 * clamp(1.15 / (this.w / this.h), 1, 1.7);
    s.phi = clamp(s.phi, 0.85, 1.15);
    this.startTween(lm.focus.clone().add(new THREE.Vector3().setFromSpherical(s)), lm.focus.clone(), 1.4, easeInOut);
  }

  /** Slide the picture (in pixels) so something on screen, like the info card, doesn't cover the room. */
  setShift(x: number, y: number) {
    this.shiftTo = { x, y };
  }

  get focused() {
    return this.focusId;
  }

  enterFocused() {
    if (this.mode === 'city' && this.focusId) void this.enterRoom(this.focusId);
  }

  async enterRoom(id: PlaceId) {
    if (this.disposed || this.mode === 'busy') return;
    const fromCity = this.mode === 'city';
    this.mode = 'busy';
    this.clearBubble();
    this.events.onFade('out');
    await sleep(480);
    if (this.disposed) return;
    if (fromCity) this.cityPose = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.tween = null;
    this.teardownRoom();
    this.room = buildRoom(id);
    this.roomId = id;
    for (const l of this.room.labels) {
      const el = document.createElement('div');
      el.className = 'w-label w-label--item';
      el.textContent = l.text;
      this.layer.appendChild(el);
      this.roomLabels.push({ el, pos: l.position });
    }
    this.cityLabels.forEach((el) => (el.style.display = 'none'));
    this.applyRoomLimits();
    this.setRoomPose();
    this.setQuality(this.quality);
    await sleep(700);
    if (this.disposed) return;
    this.mode = 'room';
    this.events.onFade('in');
    this.events.onRoomEntered(id);
  }

  async exitRoom() {
    if (this.disposed || this.mode !== 'room') return;
    this.mode = 'busy';
    this.clearBubble();
    this.events.onFade('out');
    await sleep(480);
    if (this.disposed) return;
    this.teardownRoom();
    this.applyCityLimits();
    if (this.cityPose) {
      this.camera.position.copy(this.cityPose.pos);
      this.controls.target.copy(this.cityPose.target);
      this.controls.update();
    }
    this.cityLabels.forEach((el) => (el.style.display = ''));
    await sleep(500);
    if (this.disposed) return;
    this.mode = 'city';
    this.events.onFade('in');
    this.events.onRoomExited();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.teardownRoom();
    disposeTree(this.cityScene);
    this.controls.dispose();
    this.renderer.dispose();
    this.layer.replaceChildren();
  }

  // ---------------------------------------------------------------- camera

  private cityPoseFor() {
    const aspect = this.w / this.h;
    return { target: CITY_TARGET.clone(), radius: 125 * clamp(1.25 / aspect, 1, 1.9) };
  }

  private applyCityLimits() {
    const c = this.controls;
    Object.assign(c, {
      minDistance: 24,
      maxDistance: 230,
      minPolarAngle: 0.15,
      maxPolarAngle: 1.5,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      enablePan: true,
    });
    c.mouseButtons.LEFT = this.spaceDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }

  private applyRoomLimits() {
    const c = this.controls;
    Object.assign(c, {
      minDistance: 24,
      maxDistance: 140,
      minPolarAngle: 0.55,
      maxPolarAngle: 1.3,
      minAzimuthAngle: AZ - 0.65,
      maxAzimuthAngle: AZ + 0.65,
      enablePan: false,
    });
    c.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  }

  private setRoomPose() {
    const r = 36 * clamp(1.15 / (this.w / this.h), 1, 2.9);
    this.controls.target.copy(ROOM_TARGET);
    this.camera.position.copy(ROOM_TARGET).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(r, 1.0, AZ)));
    this.controls.update();
  }

  private startTween(p1: THREE.Vector3, g1: THREE.Vector3, dur: number, ease: (k: number) => number) {
    this.tween = { t0: this.clock.elapsedTime, dur, p0: this.camera.position.clone(), p1, g0: this.controls.target.clone(), g1, ease };
    this.controls.enabled = false;
  }

  private stepTween() {
    const tw = this.tween;
    if (!tw) return;
    const k = clamp((this.clock.elapsedTime - tw.t0) / tw.dur, 0, 1);
    const e = tw.ease(k);
    this.camera.position.lerpVectors(tw.p0, tw.p1, e);
    this.controls.target.lerpVectors(tw.g0, tw.g1, e);
    if (k >= 1) {
      this.tween = null;
      if (this.mode !== 'busy') this.controls.enabled = true;
    }
  }

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- picking

  private cityPick(id: PlaceId): Pick {
    const lm = this.city.landmarks.find((l) => l.id === id)!;
    return { key: id, title: 'Enter?', action: 'Click to enter', anchor: lm.top };
  }

  private roomPickFor(key: string): Pick | null {
    const p = this.room?.pickables.find((x) => x.key === key);
    if (!p) return null;
    const pos = p.object.getWorldPosition(new THREE.Vector3());
    pos.y += p.lift;
    return { key: p.key, title: p.title, action: p.action, anchor: pos };
  }

  private raycastAt(clientX: number, clientY: number): Pick | null {
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    if (this.mode === 'city') {
      const hit = this.ray.intersectObjects(this.city.landmarks.map((l) => l.hit), false)[0];
      return hit ? this.cityPick(hit.object.userData.placeId as PlaceId) : null;
    }
    if (this.mode === 'room' && this.room) {
      const map = new Map<THREE.Object3D, string>();
      for (const p of this.room.pickables) map.set(p.object, p.key);
      const hits = this.ray.intersectObjects(this.room.pickables.map((p) => p.object), true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const key = map.get(o);
          if (key) return this.roomPickFor(key);
          o = o.parent;
        }
      }
    }
    return null;
  }

  private activate(p: Pick) {
    if (this.mode === 'city') void this.enterRoom(p.key as PlaceId);
    else if (this.mode === 'room') this.events.onPick(p.key);
  }

  private onBubbleClick = () => {
    if (this.bubblePick) this.activate(this.bubblePick);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (this.tween && this.mode !== 'busy') {
      this.tween = null;
      this.controls.enabled = true;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.hoverDirty = true;
  };

  private onPointerLeave = () => {
    this.hover = null;
    this.hoverDirty = false;
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || e.button !== 0 || this.mode === 'busy') return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 500) return;
    const p = this.raycastAt(e.clientX, e.clientY);
    if (!p) {
      this.touchPick = null;
      return;
    }
    if (e.pointerType === 'mouse') {
      this.activate(p);
    } else if (this.mode === 'city') {
      if (this.focusId === p.key) this.activate(p);
      else this.flyTo(p.key as PlaceId);
    } else if (this.touchPick?.key === p.key) {
      this.activate(p);
    } else {
      this.touchPick = p;
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest('button, a, input, textarea, [role="dialog"]')) return;
    e.preventDefault();
    this.spaceDown = true;
    if (this.mode === 'city') this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    this.spaceDown = false;
    if (this.mode === 'city') this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  };

  // ---------------------------------------------------------------- overlay

  private toScreen(v: THREE.Vector3, out: { x: number; y: number }) {
    this.v.copy(v).project(this.camera);
    out.x = (this.v.x * 0.5 + 0.5) * this.w;
    out.y = (-this.v.y * 0.5 + 0.5) * this.h;
    return this.v.z > -1 && this.v.z < 1;
  }

  private clearBubble() {
    this.hover = null;
    this.touchPick = null;
    this.bubblePick = null;
    this.bubble.dataset.show = 'false';
  }

  private updateOverlay() {
    const s = { x: 0, y: 0 };
    const dist = this.camera.position.distanceTo(this.controls.target);

    if (this.mode === 'city') {
      for (const lm of this.city.landmarks) {
        const el = this.cityLabels.get(lm.id)!;
        const ok = this.toScreen(lm.top, s);
        el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
        el.style.opacity = ok && dist < 175 && this.bubblePick?.key !== lm.id ? '1' : '0';
      }
    } else if (this.mode === 'room') {
      for (const l of this.roomLabels) {
        const ok = this.toScreen(l.pos, s);
        l.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
        l.el.style.opacity = ok ? '1' : '0';
      }
    }

    // choose what the bubble points at
    let target: Pick | null = null;
    if (this.mode === 'city') {
      target = this.hover ?? this.touchPick ?? (this.focusId ? this.cityPick(this.focusId) : null);
    } else if (this.mode === 'room') {
      const fresh = (p: Pick | null) => (p ? this.roomPickFor(p.key) : null);
      target = fresh(this.hover) ?? fresh(this.touchPick);
    }
    if (!target || !this.toScreen(target.anchor, s)) {
      this.bubble.dataset.show = 'false';
      this.bubblePick = null;
      return;
    }
    if (!this.bubblePick || this.bubblePick.key !== target.key || this.bubbleTitle.textContent !== target.title) {
      this.bubbleTitle.textContent = target.title;
      this.bubbleAction.textContent = target.action;
    }
    this.bubblePick = target;
    this.bubble.dataset.show = 'true';
    this.bubble.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  // ---------------------------------------------------------------- loop

  private teardownRoom() {
    if (this.room) this.room.dispose();
    this.room = null;
    this.roomId = null;
    for (const l of this.roomLabels) l.el.remove();
    this.roomLabels = [];
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    this.stepTween();
    this.controls.update(dt);

    if (this.mode === 'city') {
      // keep the camera over the town
      const tg = this.controls.target;
      const cx = clamp(tg.x, -68, 68);
      const cz = clamp(tg.z, -68, 68);
      const cy = clamp(tg.y, 0, 25);
      if (cx !== tg.x || cz !== tg.z || cy !== tg.y) {
        this.camera.position.add(new THREE.Vector3(cx - tg.x, cy - tg.y, cz - tg.z));
        tg.set(cx, cy, cz);
      }
      this.city.update(t, dt);
      // landmarks glow when hovered or focused
      const active = this.hover?.key ?? this.focusId;
      for (const lm of this.city.landmarks) {
        const on = lm.id === active;
        const target = on ? 0.32 + Math.sin(t * 4) * 0.08 : 0.05;
        for (const m of lm.mats) {
          m.emissive.setHex(0xffe14a);
          m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 8);
        }
      }
    } else if (this.room) {
      this.room.update(t, dt);
    }

    const dx = this.shiftTo.x - this.shift.x;
    const dy = this.shiftTo.y - this.shift.y;
    if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
      const k = Math.min(1, dt * 7);
      this.shift.x += dx * k;
      this.shift.y += dy * k;
      this.camera.setViewOffset(this.w, this.h, this.shift.x, this.shift.y, this.w, this.h);
    } else if (dx !== 0 || dy !== 0) {
      this.shift = { ...this.shiftTo };
      if (this.shift.x === 0 && this.shift.y === 0) this.camera.clearViewOffset();
      else this.camera.setViewOffset(this.w, this.h, this.shift.x, this.shift.y, this.w, this.h);
    }

    if (this.hoverDirty && this.mode !== 'busy') {
      this.hoverDirty = false;
      this.hover = this.raycastAt(this.pointer.x, this.pointer.y);
      this.canvas.style.cursor = this.hover ? 'pointer' : '';
    }

    this.updateOverlay();
    this.renderer.render(this.mode === 'city' || !this.room ? this.cityScene : this.room.scene, this.camera);
  };
}
