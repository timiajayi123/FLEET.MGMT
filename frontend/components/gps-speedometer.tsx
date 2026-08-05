'use client';

import type { CSSProperties } from 'react';

type GpsSpeedometerProps = {
  speedMetresPerSecond?: number;
  recordedAt?: string;
  className?: string;
};

export function GpsSpeedometer({
  speedMetresPerSecond,
  recordedAt,
  className = '',
}: GpsSpeedometerProps) {
  const hasSpeed =
    typeof speedMetresPerSecond === 'number' && Number.isFinite(speedMetresPerSecond);
  const speed = hasSpeed ? Math.max(0, Math.round(speedMetresPerSecond * 3.6)) : null;
  const angle = -180 + (Math.min(180, speed ?? 0) / 180) * 180;
  const state =
    speed === null
      ? 'Waiting for GPS'
      : speed < 3
        ? 'Stopped'
        : speed < 80
          ? 'Moving'
          : 'High speed';
  const stateClass =
    speed === null ? 'waiting' : speed < 3 ? 'stopped' : speed < 80 ? 'moving' : 'fast';

  return (
    <div
      className={`speed-card actual-speedometer ${className}`.trim()}
      role="meter"
      aria-label={
        hasSpeed ? `Current speed ${speed} kilometres per hour` : 'Current speed unavailable'
      }
      aria-valuemin={0}
      aria-valuemax={180}
      aria-valuenow={speed ?? undefined}
    >
      <div className="speedometer">
        <div
          className="speedometer-face"
          style={{ '--speed-angle': `${angle}deg` } as CSSProperties}
        >
          <span className="speed-mark mark-0">0</span>
          <span className="speed-mark mark-60">60</span>
          <span className="speed-mark mark-120">120</span>
          <span className="speed-mark mark-180">180</span>
          <i className="speed-needle" />
          <i className="speed-hub" />
          <div className="speed-readout">
            <strong>{speed ?? '—'}</strong>
            <small>km/h</small>
          </div>
        </div>
        <span className="speed-caption">CURRENT GPS SPEED</span>
      </div>
      <div className={`speed-state ${stateClass}`}>{state}</div>
      <p>
        {hasSpeed
          ? `Updated ${recordedAt ? new Date(recordedAt).toLocaleTimeString() : 'from the latest location'}`
          : 'Speed will appear when a live GPS reading is received.'}
      </p>
    </div>
  );
}
