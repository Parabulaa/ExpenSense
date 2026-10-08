import React from 'react';
import { asset } from './PrintContext';

export interface ShapeSpec {
  /** 1–6, matches assets/shapes/Organic_Shape_0X.png (copied from the app) */
  n: 1 | 2 | 3 | 4 | 5 | 6;
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  rotate?: number;
  opacity?: number;
  duration?: number;
  delay?: number;
}

/** The app's own organic shapes, drifting slowly (disabled in print / reduced motion). */
export const Shapes: React.FC<{ items: ShapeSpec[] }> = ({ items }) => (
  <div className="shapes" aria-hidden="true">
    {items.map((s, i) => (
      <div
        key={i}
        className="shape"
        style={{
          width: s.size,
          height: s.size,
          top: s.top,
          left: s.left,
          right: s.right,
          bottom: s.bottom,
          opacity: s.opacity ?? 0.55,
          ['--rot' as string]: `${s.rotate ?? 0}deg`,
          ['--dur' as string]: `${s.duration ?? 14}s`,
          ['--delay' as string]: `${s.delay ?? 0}s`,
        }}
      >
        <img src={asset(`assets/shapes/Organic_Shape_0${s.n}.png`)} alt="" loading="eager" />
      </div>
    ))}
  </div>
);
