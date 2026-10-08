import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { asset } from '../components/PrintContext';
import { presentationData as d } from '../data/presentation';

export const CoverSlide = () => (
  <SlideFrame
    className="cover"
    showBrand={false}
    shapes={[
      { n: 1, size: 760, top: -230, right: -220, rotate: 12, opacity: 0.5, duration: 16 },
      { n: 3, size: 620, bottom: -260, left: -180, rotate: -18, opacity: 0.45, duration: 13, delay: -4 },
    ]}
  >
    <Reveal y={10}>
      {/* Official wordmark (includes the tagline) */}
      <img className="cover-logo" src={asset('assets/logo/wordmark.png')} alt={`${d.projectTitle} — ${d.tagline}`} />
    </Reveal>
    <Reveal delay={0.15}>
      <div className="cover-rule" />
      <p className="cover-sub">{d.subtitle}</p>
    </Reveal>
  </SlideFrame>
);
