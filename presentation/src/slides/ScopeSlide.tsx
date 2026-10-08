import { CircleCheck, CircleAlert } from 'lucide-react';
import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { presentationData as d } from '../data/presentation';

export const ScopeSlide = () => (
  <SlideFrame
    className="scope"
    label="SCOPE & LIMITATIONS"
    shapes={[{ n: 1, size: 560, top: -220, right: -180, rotate: -25, opacity: 0.4, duration: 16 }]}
  >
    <Reveal>
      <p className="eyebrow">Project boundaries</p>
      <h2 className="h-1">What it covers, and what it doesn't.</h2>
    </Reveal>

    <div className="scope-grid">
      <Reveal delay={0.15} y={20} className="card scope-col">
        <div className="scope-col-head">
          <div className="icon-tile"><CircleCheck size={32} aria-hidden="true" /></div>
          <span className="scope-col-title">Current scope</span>
        </div>
        <ul className="scope-list">
          {d.scope.current.map((s) => (
            <li key={s}><CircleCheck size={26} aria-hidden="true" />{s}</li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.25} y={20} className="card scope-col dark">
        <div className="scope-col-head">
          <div className="icon-tile dark" style={{ background: 'var(--secondary-green)' }}><CircleAlert size={32} aria-hidden="true" /></div>
          <span className="scope-col-title">Current limitations</span>
        </div>
        <ul className="scope-list">
          {d.scope.limitations.map((s) => (
            <li key={s}><CircleAlert size={26} aria-hidden="true" />{s}</li>
          ))}
        </ul>
      </Reveal>
    </div>
  </SlideFrame>
);
