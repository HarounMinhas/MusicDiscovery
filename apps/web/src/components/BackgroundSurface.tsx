import React, { useEffect } from 'react';

import BackgroundPulse from './BackgroundPulse';
import type { BackgroundMode } from './BackgroundToggle';

interface BackgroundSurfaceProps {
  mode: BackgroundMode;
  children: React.ReactNode;
}

export default function BackgroundSurface({ mode, children }: BackgroundSurfaceProps) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const { body, documentElement } = document;
    body.dataset.background = mode;
    documentElement.dataset.background = mode;

    return () => {
      delete body.dataset.background;
      delete documentElement.dataset.background;
    };
  }, [mode]);

  return (
    <div className="app">
      {mode === 'animated' ? <BackgroundPulse /> : null}
      {children}
    </div>
  );
}
