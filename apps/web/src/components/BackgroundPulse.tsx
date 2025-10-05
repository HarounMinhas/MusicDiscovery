import React, { useEffect, useRef } from 'react';

const DEFAULT_DURATION = 1100;
const DEFAULT_PADDING = 12;

export default function BackgroundPulse(): JSX.Element {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number>();
  const lastMoveRef = useRef<number>(performance.now());

  useEffect(() => {
    const stage = stageRef.current;
    const dot = dotRef.current;
    if (!stage || !dot) {
      return;
    }

    const rootStyles = getComputedStyle(document.documentElement);
    const duration = parseFloat(rootStyles.getPropertyValue('--background-pulse-duration')) || DEFAULT_DURATION;

    const movePadding = parseFloat(
      rootStyles.getPropertyValue('--background-pulse-move-padding') || String(DEFAULT_PADDING)
    );
    const clampedPadding = Number.isFinite(movePadding) ? Math.min(Math.max(movePadding, 0), 40) : DEFAULT_PADDING;

    setPosition(0.5, 0.5);
    lastMoveRef.current = performance.now();

    const tick = (now: number) => {
      if (now - lastMoveRef.current >= duration) {
        moveToRandomSpot();
        lastMoveRef.current = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    function moveToRandomSpot() {
      const paddingRatio = clampedPadding / 100;
      const minX = paddingRatio;
      const maxX = 1 - paddingRatio;
      const minY = paddingRatio;
      const maxY = 1 - paddingRatio;

      const x = randomInRange(minX, maxX);
      const y = randomInRange(minY, maxY);
      setPosition(x, y);
    }

    function setPosition(xNorm: number, yNorm: number) {
      const rect = stage.getBoundingClientRect();
      const dotWidth = dot.offsetWidth || 0;
      const dotHeight = dot.offsetHeight || 0;
      const x = xNorm * rect.width - dotWidth / 2;
      const y = yNorm * rect.height - dotHeight / 2;
      dot.style.setProperty('--pulse-tx', `${x}px`);
      dot.style.setProperty('--pulse-ty', `${y}px`);
    }

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <div className="background-pulse" ref={stageRef} aria-hidden="true">
      <div className="background-pulse__dot" ref={dotRef} />
    </div>
  );
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
