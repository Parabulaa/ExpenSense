import { useCallback, useRef, useState } from 'react';
import { SlideFrame } from '../components/SlideFrame';
import { Reveal } from '../components/Reveal';
import { VideoPlayer, PlayDemoButton } from '../components/VideoPlayer';

export const DemoSlide = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [available, setAvailable] = useState(true);
  const onAvailability = useCallback((ok: boolean) => setAvailable(ok), []);

  const play = () => {
    const v = videoRef.current;
    if (!v) return;
    v.focus(); // so Space now controls the video, not the slides
    void v.play();
  };

  return (
    <SlideFrame
      className="demo"
      label="LIVE DEMO"
      shapes={[
        { n: 6, size: 640, top: -260, left: -240, rotate: 12, opacity: 0.4, duration: 16 },
        { n: 2, size: 520, bottom: -240, right: -200, rotate: -20, opacity: 0.35, duration: 13, delay: -4 },
      ]}
    >
      <div className="demo-copy">
        <Reveal>
          <p className="eyebrow">Live product demo</p>
          <h2 className="h-1">See ExpenSense<br />in action.</h2>
          <p className="body-lg">From a paper receipt to a saved, categorized expense, and what it means for your budget.</p>
        </Reveal>
        <Reveal delay={0.2}>
          <PlayDemoButton onClick={play} disabled={!available} />
        </Reveal>
      </div>

      <Reveal delay={0.1} y={24}>
        <VideoPlayer ref={videoRef} onAvailability={onAvailability} />
      </Reveal>
    </SlideFrame>
  );
};
