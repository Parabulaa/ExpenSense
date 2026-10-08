import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { asset } from '../components/PrintContext';
import { presentationData as d } from '../data/presentation';

export const ClosingSlide = () => (
  <SlideFrame
    className="closing"
    showBrand={false}
    shapes={[
      { n: 1, size: 700, top: -260, left: -240, rotate: -8, opacity: 0.45, duration: 17 },
      { n: 4, size: 620, bottom: -260, right: -220, rotate: 14, opacity: 0.45, duration: 14, delay: -5 },
    ]}
  >
    <Reveal y={10}>
      <p className="closing-callback">“{d.closing.callback}”</p>
    </Reveal>
    <Reveal delay={0.25}>
      <h2 className="h-hero">{d.closing.answer}</h2>
    </Reveal>
    <Reveal delay={0.55} y={20}>
      <img className="closing-logo" src={asset('assets/logo/wordmark.png')} alt={`${d.projectTitle} — ${d.tagline}`} />
    </Reveal>
    <Reveal delay={0.75}>
      <p className="closing-thanks">Thank you</p>
    </Reveal>
  </SlideFrame>
);
