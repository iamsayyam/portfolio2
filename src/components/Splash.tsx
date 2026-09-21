'use client';

import { useEffect, useRef, useState } from 'react';
import { site } from '@/data/site';

/** Night sky, then dawn and the wordmark, then a fade to the city. Click or press a key to skip. */
export default function Splash({ onDone, start }: { onDone: () => void; start: boolean }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const done = useRef(onDone);
  done.current = onDone;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setStage(2);
    window.setTimeout(() => done.current(), 700);
  };

  useEffect(() => {
    if (!start) return;
    const t1 = window.setTimeout(() => setStage(1), 1200);
    const t2 = window.setTimeout(finish, 3600);
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('keydown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return (
    <div
      onClick={finish}
      className="fixed inset-0 z-50 cursor-pointer overflow-hidden transition-opacity duration-700"
      style={{ opacity: stage === 2 ? 0 : 1, pointerEvents: stage === 2 ? 'none' : 'auto' }}
      role="presentation"
    >
      {/* night */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #0b0a24 0%, #241645 70%, #3b2360 100%)' }}>
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="splash-star absolute rounded-full bg-white"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 70}%`,
              width: i % 5 === 0 ? 3 : 2,
              height: i % 5 === 0 ? 3 : 2,
              animationDelay: `${(i % 7) * 0.4}s`,
            }}
          />
        ))}
      </div>
      {/* dawn */}
      <div
        className="absolute inset-0 transition-opacity duration-[1400ms]"
        style={{ opacity: stage >= 1 ? 1 : 0, background: 'linear-gradient(to bottom, #6fb4e6 0%, #a9d4f0 55%, #e9f4fb 100%)' }}
      >
        <span className="splash-cloud absolute -bottom-10 left-[-10%] h-40 w-[60%] rounded-full bg-white/90 blur-2xl" />
        <span className="splash-cloud absolute -bottom-16 right-[-5%] h-48 w-[55%] rounded-full bg-white/90 blur-2xl [animation-delay:-6s]" />
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <p
            className="font-display text-5xl font-bold tracking-tight text-white transition-all duration-1000 [text-shadow:0_2px_28px_rgba(30,60,110,0.4)] sm:text-7xl"
            style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'none' : 'translateY(10px) scale(0.96)' }}
          >
            {site.name}
            <span className="ml-1 inline-block h-3 w-3 rounded-full bg-sun sm:h-4 sm:w-4" aria-hidden="true" />
          </p>
          <p
            className="mt-3 font-display text-sm tracking-[0.3em] text-white/85 transition-opacity delay-500 duration-1000"
            style={{ opacity: stage >= 1 ? 1 : 0 }}
          >
            {site.role.toUpperCase()}
          </p>
        </div>
        {/* the yellow dot that turns into the wordmark */}
        <span
          className="absolute h-3 w-3 rounded-full bg-sun transition-all duration-700"
          style={{ opacity: stage === 0 ? 1 : 0, transform: stage === 0 ? 'scale(1)' : 'scale(6)' }}
        />
      </div>
      <p className="absolute bottom-5 right-6 font-display text-xs text-white/60">Click to skip</p>
    </div>
  );
}
