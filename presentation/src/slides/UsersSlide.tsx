import { Icon } from '../components/Icon';
import { Reveal } from '../components/Reveal';
import { SlideFrame } from '../components/SlideFrame';
import { presentationData as d } from '../data/presentation';

export const UsersSlide = () => (
  <SlideFrame
    className="users"
    label="TARGET USERS"
    shapes={[{ n: 6, size: 620, bottom: -260, left: -220, rotate: 8, opacity: 0.45, duration: 15 }]}
  >
    <Reveal>
      <p className="eyebrow">Who it's for</p>
      <h2 className="h-1">Built for everyday<br />budgets.</h2>
    </Reveal>

    <div className="users-grid">
      {d.users.map((u, i) => (
        <Reveal key={u.title} delay={0.15 + i * 0.1} y={20} className="card user-card">
          <div className="icon-tile"><Icon name={u.icon} size={34} /></div>
          <div className="user-title">{u.title}</div>
          <div className="user-desc">{u.description}</div>
        </Reveal>
      ))}
    </div>
  </SlideFrame>
);
