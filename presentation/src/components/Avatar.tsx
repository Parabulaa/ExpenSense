import { useEffect, useState } from 'react';
import { asset } from './PrintContext';

const initials = (name: string) =>
  name.replace(/[[\]]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•';

/** Circular profile photo; shows initials until/unless the image loads. */
export const Avatar: React.FC<{ name: string; photo?: string; className?: string }> = ({ name, photo, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { setSrc(null); return; }
    const img = new Image();
    img.onload = () => setSrc(img.src);
    img.onerror = () => setSrc(null);
    img.src = asset(photo);
  }, [photo]);

  return (
    <div className={`avatar-circle ${className}`}>
      {src ? <img src={src} alt={name} /> : <span>{initials(name)}</span>}
    </div>
  );
};
