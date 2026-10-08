import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Printer } from 'lucide-react';
import { slides } from '../slides';
import { PrintContext, asset } from './PrintContext';

const STAGE_W = 1920;
const STAGE_H = 1080;
const IDLE_MS = 2500;

// Small brand images reused across slides; warmed up so transitions never flash.
const PRELOAD = [
  'assets/logo/wordmark.png',
  'assets/logo/logo-mark.png',
  'assets/mascot/Mascot_Confused.png',
  ...[1, 2, 3, 4, 5, 6].map((n) => `assets/shapes/Organic_Shape_0${n}.png`),
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
};

const readHashIndex = () => {
  const n = parseInt(window.location.hash.replace('#', ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= slides.length ? n - 1 : 0;
};

export const Presentation = () => {
  const [index, setIndex] = useState(readHashIndex);
  const [direction, setDirection] = useState(1);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number>();
  const reduceMotion = useReducedMotion();

  // ---- Fit the 1920x1080 stage into the viewport (letterboxed, never distorted)
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    PRELOAD.forEach((p) => { const i = new Image(); i.src = asset(p); });
  }, []);

  // ---- Navigation
  const go = useCallback((target: number) => {
    setIndex((cur) => {
      const next = Math.max(0, Math.min(slides.length - 1, target));
      if (next !== cur) setDirection(next > cur ? 1 : -1);
      return next;
    });
  }, []);
  const next = useCallback(() => setIndex((cur) => { if (cur < slides.length - 1) { setDirection(1); return cur + 1; } return cur; }), []);
  const prev = useCallback(() => setIndex((cur) => { if (cur > 0) { setDirection(-1); return cur - 1; } return cur; }), []);

  useEffect(() => {
    history.replaceState(null, '', `#${index + 1}`);
    // Pause any playing video when leaving a slide.
    document.querySelectorAll<HTMLVideoElement>('.viewport video').forEach((v) => {
      if (!v.closest(`[data-slide="${index}"]`)) v.pause();
    });
  }, [index]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ---- Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;

      // Video focused: Space toggles playback, arrows stay with the video.
      if (target?.tagName === 'VIDEO') {
        const v = target as HTMLVideoElement;
        if (e.key === ' ') { e.preventDefault(); if (v.paused) void v.play(); else v.pause(); }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
        return;
      }
      // Let focused buttons handle Space/Enter themselves.
      if (target?.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break;
        case 'Home': e.preventDefault(); go(0); break;
        case 'End': e.preventDefault(); go(slides.length - 1); break;
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, go, toggleFullscreen]);

  // ---- Controls fade when idle
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  const { Component } = slides[index];

  return (
    <>
      {/* ================= LIVE DECK ================= */}
      <main className="viewport" aria-roledescription="presentation">
        <div className="stage" style={{ ['--stage-scale' as string]: scale }}>
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={index}
              data-slide={index}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', inset: 0 }}
              aria-label={`Slide ${index + 1} of ${slides.length}: ${slides[index].title}`}
              role="group"
            >
              <Component />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <nav className={`progress ${idle ? 'idle' : ''}`} aria-label="Slides">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={i === index ? 'active' : ''}
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}: ${s.title}`}
            aria-current={i === index ? 'step' : undefined}
          />
        ))}
      </nav>

      <div className={`controls ${idle ? 'idle' : ''}`}>
        <button className="ctrl-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen (F)">
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <button className="ctrl-btn" onClick={() => window.print()} aria-label="Export PDF" title="Export PDF">
          <Printer size={18} />
        </button>
        <span className="ctrl-divider" />
        <button className="ctrl-btn" onClick={prev} disabled={index === 0} aria-label="Previous slide">
          <ChevronLeft size={20} />
        </button>
        <span className="ctrl-count" aria-live="polite">
          {String(index + 1).padStart(2, '0')} <span>/ {String(slides.length).padStart(2, '0')}</span>
        </span>
        <button className="ctrl-btn" onClick={next} disabled={index === slides.length - 1} aria-label="Next slide">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ================= PRINT / PDF DECK (hidden on screen) ================= */}
      <PrintContext.Provider value={true}>
        <div className="print-deck" aria-hidden="true">
          {slides.map(({ id, Component: C }) => (
            <div key={id} className="print-page"><C /></div>
          ))}
        </div>
      </PrintContext.Provider>
    </>
  );
};
