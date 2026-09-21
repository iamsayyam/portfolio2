'use client';

import { useEffect, useState } from 'react';
import PageView from './PageView';
import World from './World';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Experience() {
  const [mode, setMode] = useState<'world' | 'classic'>('world');
  const [ready, setReady] = useState(false);
  const [canExplore, setCanExplore] = useState(true);
  const [returned, setReturned] = useState(false);

  // Visitors who ask for less motion, or whose browser can't do 3D, start on the plain page.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = hasWebGL();
    setCanExplore(gl);
    if (reduce || !gl) setMode('classic');
    setReady(true);
  }, []);

  // The 3D world fills the screen, so the page behind it must not scroll.
  useEffect(() => {
    document.documentElement.style.overflow = mode === 'world' ? 'hidden' : '';
    if (mode === 'classic') window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [mode]);

  return (
    <>
      {mode === 'world' && ready && <World onClassic={() => { setReturned(true); setMode('classic'); }} skipSplash={returned} />}
      {mode === 'world' && !ready && <div data-world className="fixed inset-0 bg-[#241645]" />}
      <PageView active={mode === 'classic'} hydrated={ready} canExplore={canExplore} onExplore={() => setMode('world')} />
    </>
  );
}
