'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { places, projects, site, type PlaceId } from '@/data/site';
import { Engine, type Quality } from '@/world/engine';
import PlaceContent from './PlaceContent';
import Splash from './Splash';

type Props = { onClassic: () => void; skipSplash?: boolean };

const pillBtn = 'rounded-full px-4 py-2 font-display text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95';

export default function World({ onClassic, skipSplash = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);

  const [splash, setSplash] = useState(!skipSplash);
  const [room, setRoom] = useState<PlaceId | null>(null);
  const [focus, setFocus] = useState<PlaceId | null>(null);
  const [visited, setVisited] = useState<PlaceId[]>([]);
  const [fade, setFade] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [quality, setQuality] = useState<Quality>('high');
  const [coarse, setCoarse] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [built, setBuilt] = useState(false);
  const roomRef = useRef<PlaceId | null>(null);
  roomRef.current = room;

  // Open a link or action attached to something in a room.
  const onPick = useCallback((key: string) => {
    const [kind, idx] = key.split(':');
    if (key === 'exit') void engine.current?.exitRoom();
    else if (kind === 'project' || kind === 'skill' || kind === 'social') {
      setActiveKey(key);
      setCardOpen(true);
      const i = Number(idx);
      if (kind === 'project' && projects[i]?.href && projects[i].href !== '#') window.open(projects[i].href, '_blank', 'noopener,noreferrer');
      if (kind === 'social') {
        const s = site.socials[i];
        if (s) window.open(s.href, '_blank', 'noopener,noreferrer');
      }
    } else if (key === 'mail') {
      window.location.href = `mailto:${site.email}`;
    }
  }, []);

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    setCoarse(isCoarse);
    const q: Quality = isCoarse ? 'low' : 'high';
    setQuality(q);
    const timer = isCoarse ? window.setTimeout(() => setControlsOpen(false), 9000) : 0;
    let eng: Engine | null = null;
    let raf2 = 0;
    // Let the splash paint first; building the city takes a moment.
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        try {
          eng = new Engine(
            canvasRef.current!,
            layerRef.current!,
            {
              onFocus: setFocus,
              onFade: (s) => setFade(s === 'out'),
              onRoomEntered: (id) => {
                setRoom(id);
                setVisited((v) => (v.includes(id) ? v : [...v, id]));
                setCardOpen(true);
                setActiveKey(null);
              },
              onRoomExited: () => {
                setRoom(null);
                setActiveKey(null);
              },
              onPick,
            },
            q,
          );
        } catch {
          onClassic();
          return;
        }
        engine.current = eng;
        setBuilt(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timer) window.clearTimeout(timer);
      eng?.dispose();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!splash && built) engine.current?.playIntro();
  }, [splash, built]);

  // Slide the room over so the info card doesn't cover it.
  useEffect(() => {
    if (!built) return;
    const wide = window.innerWidth >= 900;
    const open = !!room && cardOpen;
    engine.current?.setShift(open && wide ? 170 : 0, open && !wide ? window.innerHeight * 0.16 : 0);
  }, [room, cardOpen, built]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, a, input, textarea');
      if (e.key === 'Escape') {
        if (menu) setMenu(false);
        else if (roomRef.current) {
          if (cardOpen) setCardOpen(false);
          else void engine.current?.exitRoom();
        }
      } else if (e.key === 'Enter' && !onControl && !roomRef.current) {
        engine.current?.enterFocused();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, cardOpen]);

  const goTo = (id: PlaceId) => {
    const e = engine.current;
    if (!e) return;
    if (room) {
      if (id === room) setCardOpen((o) => !o);
      else void e.enterRoom(id);
    } else if (e.focused === id) void e.enterRoom(id);
    else e.flyTo(id);
  };

  const active = room ?? focus;
  const place = places.find((p) => p.id === room);
  const next = places.find((p) => !visited.includes(p.id));

  return (
    <div className="fixed inset-0 overflow-hidden bg-sand text-ink" data-world>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none outline-none" aria-label="Interactive 3D city. Use the buttons at the bottom to visit each place." />
      <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" />

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 pt-4 sm:px-7 sm:pt-6">
        <p className="font-display text-xl font-bold tracking-tight [text-shadow:0_0_14px_rgba(255,255,255,0.75),0_1px_0_rgba(255,255,255,0.6)] sm:text-2xl">
          {site.name}
          <span className="ml-0.5 inline-block h-2 w-2 rounded-full bg-sun ring-1 ring-ink/15" aria-hidden="true" />
        </p>
        <div className="pointer-events-auto flex items-center gap-2">
          {room && (
            <button type="button" onClick={() => void engine.current?.exitRoom()} className={`${pillBtn} bg-pill text-ink shadow-sm`}>
              Back to City
            </button>
          )}
          <button
            type="button"
            onClick={() => (room === 'contact' ? undefined : void engine.current?.enterRoom('contact'))}
            className={`${pillBtn} bg-sun text-ink shadow-sm ${room ? 'hidden sm:inline-flex' : ''}`}
          >
            Say hello
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-label="Settings"
              aria-expanded={menu}
              className="grid h-10 w-10 place-items-center rounded-full bg-pill text-ink shadow-sm transition-transform hover:scale-105"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 5h8M14 5h2M2 13h2M8 13h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="6" cy="13" r="2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            {menu && (
              <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl bg-charcoal p-2 text-white shadow-xl" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-display text-sm hover:bg-white/10"
                  onClick={() => {
                    const q: Quality = quality === 'high' ? 'low' : 'high';
                    setQuality(q);
                    engine.current?.setQuality(q);
                  }}
                >
                  Graphics
                  <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-semibold text-ink">{quality === 'high' ? 'High' : 'Low'}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-xl px-3 py-2.5 text-left font-display text-sm hover:bg-white/10"
                  onClick={() => {
                    engine.current?.resetView();
                    setMenu(false);
                  }}
                >
                  Reset camera
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-xl px-3 py-2.5 text-left font-display text-sm hover:bg-white/10"
                  onClick={onClassic}
                >
                  Classic site
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* bottom-left: controls help and classic link */}
      {!room && (
        <div className="absolute bottom-[76px] left-3 z-10 flex flex-col items-start gap-2 sm:bottom-4 sm:left-5">
          {controlsOpen && (
            <div className="w-[214px] rounded-lg border-l-[3px] border-sun bg-charcoal/95 px-3.5 py-3 font-display text-white shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-[0.12em] text-sun">CONTROLS</p>
                <button type="button" onClick={() => setControlsOpen(false)} aria-label="Hide controls" className="-mr-1 grid h-5 w-5 place-items-center text-white/60 hover:text-white">
                  ×
                </button>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {coarse ? (
                  <>
                    <dt className="font-semibold">Drag</dt>
                    <dd className="text-white/70">Rotate view</dd>
                    <dt className="font-semibold">Pinch</dt>
                    <dd className="text-white/70">Zoom</dd>
                    <dt className="font-semibold">2 fingers</dt>
                    <dd className="text-white/70">Pan</dd>
                  </>
                ) : (
                  <>
                    <dt><kbd className="rounded bg-sun px-1.5 py-0.5 text-[11px] font-semibold text-ink">Space</kbd> <span className="font-semibold">+ drag</span></dt>
                    <dd className="text-white/70">Pan</dd>
                    <dt className="font-semibold">Drag</dt>
                    <dd className="text-white/70">Rotate view</dd>
                    <dt className="font-semibold">Mouse wheel</dt>
                    <dd className="text-white/70">Zoom</dd>
                  </>
                )}
              </dl>
            </div>
          )}
          <button
            type="button"
            onClick={onClassic}
            className="rounded-full bg-pill px-4 py-2 font-display text-[13px] font-medium text-ink shadow-sm transition-transform hover:scale-[1.03]"
          >
            ← Classic site
          </button>
        </div>
      )}

      {/* bottom-right: what to do next */}
      {!room && (
        <div className="absolute bottom-4 right-5 z-10 hidden items-center gap-3 rounded-full bg-charcoal/95 py-2 pl-4 pr-5 font-display text-white shadow-lg lg:flex">
          <span className="text-[11px] font-bold tracking-[0.12em] text-sun">
            ROOMS {visited.length}/{places.length}
          </span>
          <span className="text-[13px]">{next ? `Visit the ${next.name} building` : 'You have seen everything'}</span>
        </div>
      )}

      {/* bottom nav */}
      <nav
        aria-label="Places"
        className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-full bg-pill/95 p-1.5 shadow-lg backdrop-blur-sm"
      >
        {places.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => goTo(p.id)}
            aria-current={active === p.id ? 'location' : undefined}
            className={`rounded-full px-3 py-2 font-display text-[13px] font-semibold transition-colors max-[359px]:px-2.5 sm:px-5 sm:text-sm ${
              active === p.id ? 'bg-sun text-ink' : 'text-ink/80 hover:bg-black/5'
            }`}
          >
            {p.name}
            {visited.includes(p.id) && <span className="sr-only"> (visited)</span>}
          </button>
        ))}
      </nav>

      {/* room card */}
      {room && place && cardOpen && (
        <section
          aria-labelledby="room-title"
          className="rise absolute inset-x-3 bottom-[76px] z-20 max-h-[46vh] overflow-y-auto rounded-2xl border-l-[3px] border-sun bg-charcoal/95 p-5 text-white shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:max-h-[60vh]"
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sun font-display text-base font-bold text-ink" aria-hidden="true">
                {site.name.charAt(0)}
              </span>
              <div>
                <h2 id="room-title" className="font-display text-lg font-semibold leading-tight">
                  {place.title}
                </h2>
                <p className="font-display text-xs text-white/55">{place.name}</p>
              </div>
            </div>
            <button type="button" onClick={() => setCardOpen(false)} aria-label="Close details" className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
              ×
            </button>
          </div>
          <PlaceContent id={room} tone="dark" activeKey={activeKey} compact />
        </section>
      )}
      {room && !cardOpen && (
        <button
          type="button"
          onClick={() => setCardOpen(true)}
          className={`${pillBtn} absolute bottom-[76px] right-4 z-20 bg-charcoal/95 text-white shadow-lg sm:bottom-24 sm:right-5`}
        >
          Show details
        </button>
      )}

      {/* room transition */}
      <div
        className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-black transition-opacity duration-[450ms]"
        style={{ opacity: fade ? 1 : 0, pointerEvents: fade ? 'auto' : 'none' }}
        aria-hidden="true"
      >
        <span className="loading-dot h-3 w-3 rounded-full bg-sun" />
      </div>

      {splash && <Splash start={built} onDone={() => setSplash(false)} />}
    </div>
  );
}
