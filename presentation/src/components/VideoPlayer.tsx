import React, { forwardRef, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { asset, useIsPrint } from './PrintContext';
import { presentationData as d } from '../data/presentation';

/**
 * Live: native <video> (3:4, never stretched, no autoplay).
 * Print/PDF: static poster card, since PDFs can't play video.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, { onAvailability?: (ok: boolean) => void }>(
  ({ onAvailability }, ref) => {
    const isPrint = useIsPrint();
    const [missing, setMissing] = useState(false);
    const [poster, setPoster] = useState<string | undefined>();

    // Only use the poster if the file actually exists (avoids a broken frame).
    useEffect(() => {
      const img = new Image();
      img.onload = () => setPoster(img.src);
      img.src = asset(d.demo.posterPath);
    }, []);

    useEffect(() => onAvailability?.(!missing), [missing, onAvailability]);

    if (isPrint) {
      return (
        <div className="video-frame">
          <div className="video-static">
            {poster && <img className="video-static-poster" src={poster} alt="" />}
            <div className="play-disc"><Play size={48} fill="currentColor" aria-hidden="true" /></div>
            <div className="video-static-title">VIDEO DEMO</div>
            <div className="video-static-sub">Interactive demo available in the web presentation.</div>
            {d.demo.link && <div className="video-static-sub">{d.demo.link}</div>}
          </div>
        </div>
      );
    }

    return (
      <div className="video-frame">
        {missing ? (
          <div className="video-empty" role="note">
            <div className="play-disc"><Play size={48} aria-hidden="true" /></div>
            <div className="video-static-title">DEMO VIDEO</div>
            <div className="video-static-sub">Add <strong>expensense-demo.mp4</strong> to</div>
            <code>/public/assets/video/</code>
          </div>
        ) : (
          <video
            ref={ref}
            src={asset(d.demo.videoPath)}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            aria-label="ExpenSense product demo video"
            onError={() => setMissing(true)}
          />
        )}
      </div>
    );
  },
);
VideoPlayer.displayName = 'VideoPlayer';

export const PlayDemoButton: React.FC<{ onClick: () => void; disabled?: boolean }> = ({ onClick, disabled }) => {
  const isPrint = useIsPrint();
  if (isPrint) return null;
  return (
    <button className="btn-primary" onClick={onClick} disabled={disabled}>
      <Play size={22} fill="currentColor" aria-hidden="true" /> PLAY DEMO
    </button>
  );
};
