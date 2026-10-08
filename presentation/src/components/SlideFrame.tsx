import React from 'react';
import { Shapes, type ShapeSpec } from './Shapes';
import { asset } from './PrintContext';

interface SlideFrameProps {
  children: React.ReactNode;
  className?: string;
  shapes?: ShapeSpec[];
  /** Small brand + section label at top; off for cover/closing. */
  label?: string;
  showBrand?: boolean;
}

/** Fixed 1920x1080 slide canvas with brand header and organic background. */
export const SlideFrame: React.FC<SlideFrameProps> = ({ children, className = '', shapes = [], label, showBrand = true }) => (
  <section className="slide">
    <Shapes items={shapes} />
    {showBrand && (
      <div className="slide-brand">
        <img src={asset('assets/logo/logo-mark.png')} alt="" />
        <span>Expen<span className="sense">Sense</span></span>
      </div>
    )}
    {label && <div className="slide-number">{label}</div>}
    <div className={`slide-inner ${className}`}>{children}</div>
  </section>
);
