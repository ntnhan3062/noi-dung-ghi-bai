import React, { useEffect, useRef, useState } from 'react';
import { html } from '../utils/html.js';
import { useLoadingProgress } from '../context/LoadingProgressContext.js';

export const HeaderLogoProgressRing = ({ isAppMode = false }) => {
  const { progress, isVisible, isOutro } = useLoadingProgress();
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(316.5);

  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len && len > 0) setPathLength(len);
      } catch (e) {}
    }
  }, []);

  if (!isVisible && !isOutro) return null;

  const strokeOffset = pathLength * (1 - Math.min(100, Math.max(0, progress)) / 100);

  const ringStyle = {
    transform: isOutro ? 'scale(1.22)' : 'scale(1)',
    opacity: isOutro ? 0 : 1,
    transition: isOutro ? 'transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms ease-out' : 'none',
    transformOrigin: 'center center'
  };

  // Squircle path with viewBox="0 0 100 100" matching rounded-2xl
  // Top center -> Top Right Arc -> Bottom Right Arc -> Bottom Left Arc -> Top Left Arc -> Top Center
  const squirclePath = "M 50 5 H 72 A 23 23 0 0 1 95 28 V 72 A 23 23 0 0 1 72 95 H 28 A 23 23 0 0 1 5 72 V 28 A 23 23 0 0 1 28 5 Z";

  return html`
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
      viewBox="0 0 100 100"
      style=${ringStyle}
    >
      <path
        ref=${pathRef}
        d=${squirclePath}
        fill="none"
        stroke="#4f46e5"
        strokeWidth=${isAppMode ? "5.5" : "4.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray=${pathLength}
        strokeDashoffset=${strokeOffset}
      />
    </svg>
  `;
};
