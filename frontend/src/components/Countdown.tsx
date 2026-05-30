import { useState, useEffect } from 'react';

interface CountdownProps {
  deadline: number;
  urgentAt?: number; // saniye kaldığında kırmızıya döner
}

export default function Countdown({ deadline, urgentAt = 30 }: CountdownProps) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formatted = mins > 0
    ? `${mins}:${secs.toString().padStart(2, '0')}`
    : `${secs}s`;

  const isUrgent = remaining <= urgentAt;

  return (
    <div className={`phase-timer ${isUrgent ? 'urgent' : ''}`} style={{ color: isUrgent ? '#e74c3c' : undefined }}>
      ⏱ {formatted}
    </div>
  );
}
