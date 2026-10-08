import { Avatar } from '../components/Avatar';
import { Reveal } from '../components/Reveal';
import { SlideFrame } from '../components/SlideFrame';
import { presentationData as d } from '../data/presentation';

export const PresentedBySlide = () => {
  const { lead, team } = d.presentedBy;
  return (
    <SlideFrame
      className="presented"
      label="DEVELOPED BY"
      shapes={[{ n: 2, size: 640, top: -220, right: -200, rotate: 20, opacity: 0.45, duration: 15 }]}
    >
      <Reveal>
        <p className="eyebrow">The team</p>
        <h2 className="h-1">Developed by</h2>
      </Reveal>

      {/* Lead — featured, big photo */}
      <Reveal delay={0.12} y={20} className="lead-card">
        <Avatar name={lead.name} photo={lead.photo} className="lead-avatar" />
        <div>
          <div className="lead-name">{lead.name}</div>
          <div className="lead-role">{lead.role}</div>
        </div>
      </Reveal>

      {/* Co-developers & QA — big photos */}
      <div className="team-grid team-grid-3">
        {team.map((m, i) => (
          <Reveal key={i} delay={0.28 + i * 0.1} y={20} className="card member member-center">
            <Avatar name={m.name} photo={m.photo} className="member-avatar" />
            <div>
              <div className="member-name">{m.name}</div>
              <div className="member-role">{m.role}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </SlideFrame>
  );
};
