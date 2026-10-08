import type { FC } from 'react';
import { ClosingSlide } from './ClosingSlide';
import { CoverSlide } from './CoverSlide';
import { DemoSlide } from './DemoSlide';
import { FeaturesSlide } from './FeaturesSlide';
import { PresentedBySlide } from './PresentedBySlide';
import { ProblemSlide } from './ProblemSlide';
import { ScopeSlide } from './ScopeSlide';
import { SolutionSlide } from './SolutionSlide';
import { UsersSlide } from './UsersSlide';

/** Slide order (≈10 minutes including the demo video). Reorder here. */
export const slides: { id: string; title: string; Component: FC }[] = [
  { id: 'cover', title: 'Cover', Component: CoverSlide },
  { id: 'developed-by', title: 'Developed by', Component: PresentedBySlide },
  { id: 'demo', title: 'Live Demo', Component: DemoSlide },
  { id: 'problem', title: 'The Problem', Component: ProblemSlide },
  { id: 'users', title: 'Target Users', Component: UsersSlide },
  { id: 'scope', title: 'Scope & Limitations', Component: ScopeSlide },
  { id: 'solution', title: 'Our Solution', Component: SolutionSlide },
  { id: 'features', title: 'Core Features', Component: FeaturesSlide },
  { id: 'closing', title: 'Closing', Component: ClosingSlide },
];
