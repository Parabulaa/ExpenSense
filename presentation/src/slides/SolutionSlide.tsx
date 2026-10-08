import React from 'react';
import { ChevronRight } from 'lucide-react';
import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { Icon } from '../components/Icon';
import { asset } from '../components/PrintContext';
import { presentationData as d } from '../data/presentation';

export const SolutionSlide = () => (
  <SlideFrame
    className="solution"
    label="OUR SOLUTION"
    shapes={[
      { n: 2, size: 600, top: -240, right: -160, rotate: 10, opacity: 0.45, duration: 15 },
      { n: 5, size: 460, bottom: -240, left: -160, rotate: -12, opacity: 0.35, duration: 12, delay: -3 },
    ]}
  >
    <div className="solution-top">
      <Reveal y={10}>
        <img className="solution-mark" src={asset('assets/logo/logo-mark.png')} alt="ExpenSense logo mark" />
      </Reveal>
      <Reveal delay={0.1}>
        <p className="eyebrow">Our solution</p>
        <h2 className="h-1">Meet Expen<span className="accent">Sense</span>.</h2>
        <p className="body-lg">A smarter way to capture, organize, and understand everyday expenses.</p>
      </Reveal>
    </div>

    <div className="flow">
      {d.workflow.map((w, i) => (
        <React.Fragment key={w.step}>
          <Reveal delay={0.25 + i * 0.1} y={20} className="card flow-step">
            <div className={`icon-tile ${i === 1 ? 'dark' : ''}`}><Icon name={w.icon} size={32} /></div>
            <span className="flow-num">STEP {String(i + 1).padStart(2, '0')}</span>
            <span className="flow-title">{w.step}</span>
            <span className="flow-desc">{w.description}</span>
          </Reveal>
          {i < d.workflow.length - 1 && (
            <div className="flow-link" aria-hidden="true"><ChevronRight size={30} /></div>
          )}
        </React.Fragment>
      ))}
    </div>

    <Reveal delay={0.8}>
      <p className="flow-note">No receipt? Expenses can also be entered manually.</p>
    </Reveal>
  </SlideFrame>
);
