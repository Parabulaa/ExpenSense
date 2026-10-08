import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { asset } from '../components/PrintContext';
import { presentationData as d } from '../data/presentation';

export const ProblemSlide = () => (
  <SlideFrame
    className="problem"
    label="THE PROBLEM"
    shapes={[
      { n: 4, size: 560, top: -160, left: -200, rotate: -10, opacity: 0.45, duration: 14 },
      { n: 5, size: 520, bottom: -220, right: -160, rotate: 15, opacity: 0.45, duration: 17, delay: -6 },
    ]}
  >
    <Reveal y={10}>
      <img className="problem-mascot" src={asset('assets/mascot/Mascot_Confused.png')} alt="Confused ExpenSense mascot" />
    </Reveal>
    <Reveal delay={0.1}>
      <h2 className="h-hero">“{d.problem.question}”</h2>
    </Reveal>
    <Reveal delay={0.2}>
      <p className="body-lg">{d.problem.support}</p>
    </Reveal>
    <div className="chip-row">
      {d.problem.categories.map((c, i) => (
        <Reveal key={c} delay={0.35 + i * 0.1} y={20}>
          <span className="chip"><span className="dot" />{c}</span>
        </Reveal>
      ))}
    </div>
  </SlideFrame>
);
