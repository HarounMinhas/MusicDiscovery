import React, { useEffect, useRef } from 'react';

const DEFAULT_DURATION = 20000;
const DEFAULT_PADDING = 18;

export default function BackgroundPulse(): JSX.Element {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number>();
  const lastMoveRef = useRef<number>(performance.now());
  const targetRef = useRef({ x: 0.48, y: 0.38 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const applyWithStage = (x: number, y: number) => applyCenter(stage, x, y);

    const rootStyles = getComputedStyle(document.documentElement);
    const duration = parseFloat(rootStyles.getPropertyValue('--background-pulse-duration')) || DEFAULT_DURATION;

    const movePaddingRaw = parseFloat(
      rootStyles.getPropertyValue('--background-pulse-move-padding') || String(DEFAULT_PADDING)
    );
    const clampedPadding = Number.isFinite(movePaddingRaw)
      ? Math.min(Math.max(movePaddingRaw, 0), 45)
      : DEFAULT_PADDING;

    applyWithStage(targetRef.current.x, targetRef.current.y);
    lastMoveRef.current = performance.now();

    const tick = (now: number) => {
      if (now - lastMoveRef.current >= duration) {
        moveToRandomSpot();
        lastMoveRef.current = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    const handleResize = () => {
      applyWithStage(targetRef.current.x, targetRef.current.y);
    };

    window.addEventListener('resize', handleResize);

    function moveToRandomSpot() {
      const paddingRatio = clampedPadding / 100;
      const minX = paddingRatio;
      const maxX = 1 - paddingRatio;
      const minY = paddingRatio;
      const maxY = 1 - paddingRatio;

      const x = randomInRange(minX, maxX);
      const y = randomInRange(minY, maxY);
      targetRef.current = { x, y };
      applyWithStage(x, y);
    }

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="background-pulse" ref={stageRef} aria-hidden="true">
      <div className="background-pulse__orb" />
    </div>
  );
}

function applyCenter(stage: HTMLDivElement, xNorm: number, yNorm: number) {
  const rect = stage.getBoundingClientRect();
  const { width, height } = rect;
  if (width === 0 || height === 0) {
    stage.style.setProperty('--pulse-offset-x', '0px');
    stage.style.setProperty('--pulse-offset-y', '0px');
    return;
  }
  const offsetX = xNorm * width - width / 2;
  const offsetY = yNorm * height - height / 2;
  stage.style.setProperty('--pulse-offset-x', `${offsetX.toFixed(2)}px`);
  stage.style.setProperty('--pulse-offset-y', `${offsetY.toFixed(2)}px`);
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
