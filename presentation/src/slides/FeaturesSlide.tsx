import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { Icon } from '../components/Icon';
import { presentationData as d } from '../data/presentation';

export const FeaturesSlide = () => (
  <SlideFrame
    className="features"
    label="CORE FEATURES"
    shapes={[{ n: 3, size: 600, bottom: -280, right: -200, rotate: 18, opacity: 0.4, duration: 16 }]}
  >
    <Reveal>
      <p className="eyebrow">Core features</p>
      <h2 className="h-1">Everything in one calm place.</h2>
    </Reveal>

    <div className="features-grid">
      {d.features.map((f, i) => (
        <Reveal key={f.title} delay={0.15 + i * 0.09} y={20} className="card feature">
          <div className={`icon-tile ${i === 0 ? 'dark' : ''}`}><Icon name={f.icon} size={32} /></div>
          <div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.description}</div>
          </div>
        </Reveal>
      ))}
    </div>
  </SlideFrame>
);
