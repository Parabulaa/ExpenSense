import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useIsPrint } from './PrintContext';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'li';
}

/** Restrained entrance animation. Renders static in print mode or reduced motion. */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, y = 18, className, style, as = 'div' }) => {
  const isPrint = useIsPrint();
  const reduce = useReducedMotion();

  if (isPrint || reduce) {
    const Tag = as;
    return <Tag className={className} style={style}>{children}</Tag>;
  }

  const MotionTag = as === 'li' ? motion.li : motion.div;
  return (
    <MotionTag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 + delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
};
