import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { html } from '../utils/html.js';

const LoadingProgressContext = createContext();

export const LoadingProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isOutro, setIsOutro] = useState(false);

  const outroTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);

  const startProgress = useCallback((initial = 25) => {
    if (outroTimerRef.current) {
      clearTimeout(outroTimerRef.current);
      outroTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const startVal = Math.max(10, initial);
    currentProgressRef.current = Math.min(startVal, currentProgressRef.current > 0 && currentProgressRef.current < 100 ? currentProgressRef.current : startVal);
    targetProgressRef.current = Math.max(startVal, targetProgressRef.current);
    setProgress(currentProgressRef.current);
    setIsVisible(true);
    setIsOutro(false);
  }, []);

  const updateProgress = useCallback((val) => {
    const target = Math.min(100, Math.max(0, val));
    targetProgressRef.current = Math.max(targetProgressRef.current, target);
    setIsVisible(true);
    if (target < 100) {
      setIsOutro(false);
      if (outroTimerRef.current) {
        clearTimeout(outroTimerRef.current);
        outroTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, []);

  const completeProgress = useCallback(() => {
    targetProgressRef.current = 100;
    setIsVisible(true);
  }, []);

  const resetProgress = useCallback(() => {
    if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    currentProgressRef.current = 0;
    targetProgressRef.current = 0;
    setProgress(0);
    setIsVisible(false);
    setIsOutro(false);
  }, []);

  // Smooth progress animation loop
  useEffect(() => {
    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      const target = targetProgressRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        const diff = target - current;
        const step = Math.max(0.75, diff * 0.22);
        const next = Math.min(100, current + step);
        currentProgressRef.current = next;
        setProgress(next);
      } else if (current > target && target === 0) {
        currentProgressRef.current = 0;
        setProgress(0);
      }

      if (currentProgressRef.current >= 100 && !isOutro && isVisible && !outroTimerRef.current) {
        // Khi đạt 100%, ẩn viền trong ngay lập tức với hiệu ứng scale mượt mà
        outroTimerRef.current = setTimeout(() => {
          setIsOutro(true);
          hideTimerRef.current = setTimeout(() => {
            setIsVisible(false);
            setIsOutro(false);
            currentProgressRef.current = 0;
            targetProgressRef.current = 0;
            setProgress(0);
            outroTimerRef.current = null;
            hideTimerRef.current = null;
          }, 300);
        }, 50);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (outroTimerRef.current) clearTimeout(outroTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isOutro, isVisible]);

  return html`
    <${LoadingProgressContext.Provider} value=${{
      progress,
      isVisible,
      isOutro,
      startProgress,
      updateProgress,
      completeProgress,
      resetProgress
    }}>
      ${children}
    </${LoadingProgressContext.Provider}>
  `;
};

export const useLoadingProgress = () => {
  const context = useContext(LoadingProgressContext);
  return context || {
    progress: 0,
    isVisible: false,
    isOutro: false,
    startProgress: () => {},
    updateProgress: () => {},
    completeProgress: () => {},
    resetProgress: () => {}
  };
};
