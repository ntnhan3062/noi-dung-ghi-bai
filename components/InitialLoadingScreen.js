import React, { useState, useEffect, useRef } from 'react';
import { html } from '../utils/html.js';
import { BookOpen } from 'lucide-react';

/**
 * Màn hình loading ban đầu:
 * - Nền trắng
 * - Ở giữa có logo và bên dưới logo là chữ "Nội dung ghi bài"
 * - Định dạng của logo và chữ đồng nhất 100% với logo trên header
 * - Logo có viền trong chạy từ chính giữa cạnh trên (0%) theo chiều kim đồng hồ quanh viền trong của logo đến 100% theo tiến độ thực tế
 * - Sau khi 100%, đợi 0.2s rồi ẩn viền trong mượt mà (thụt ra ngoài và bị đường viền thường của logo cắt dần rồi biến mất)
 * - Sau đó:
 *   + Logo thu nhỏ lại (scale down) và fade out
 *   + Chữ đặt ranh giới ngay đầu (overflow-hidden) và trượt lên trên biến mất
 *   + Khi cả 2 hiệu ứng chạy được 70% thì nền bắt đầu mờ dần cho đến khi 100% thì ẩn hoàn toàn màn hình loading
 */
export const InitialLoadingScreen = ({ 
  isDataReady = false, 
  currentBg = null,
  bgActive = false,
  onComplete, 
  isLiquid = true, 
  layoutError = false,
  isAppMode = false
}) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'completed' | 'ring-out' | 'exit' | 'fading-bg' | 'done'

  const logoRef = useRef(null);
  const textRef = useRef(null);
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(320);

  const progressTargetRef = useRef(15);
  const currentProgressRef = useRef(0);
  const outroStartedRef = useRef(false);

  // Trạng thái các thành phần cần nạp
  const fontReadyRef = useRef(false);
  const bgReadyRef = useRef(!bgActive || !currentBg);
  const domRenderReadyRef = useRef(false);

  // 1. Tính toán chính xác chu vi của đường viền SVG
  useEffect(() => {
    if (pathRef.current) {
      try {
        const len = pathRef.current.getTotalLength();
        if (len && len > 0) {
          setPathLength(len);
        }
      } catch (e) {}
    }
  }, []);

  // 2. Tính toán tiến trình thực tế dựa trên toàn bộ các thành phần (DOM, Font, Data, Nền, Render)
  const calculateCombinedProgress = () => {
    let p = 15; // Khởi tạo DOM ban đầu

    if (fontReadyRef.current) p += 20; // Nạp font xong: +20%
    if (isDataReady) p += 35; // Nạp dữ liệu bài học / config: +35%
    if (bgReadyRef.current) p += 20; // Nạp hình nền (nếu có): +20%
    if (domRenderReadyRef.current) p += 10; // Render thành phần DOM hoàn tất: +10%

    return Math.min(100, p);
  };

  // 3. Theo dõi nạp hình nền nếu có
  useEffect(() => {
    if (bgActive && currentBg) {
      bgReadyRef.current = false;
      const img = new Image();
      img.src = currentBg;
      img.onload = () => {
        bgReadyRef.current = true;
        progressTargetRef.current = Math.max(progressTargetRef.current, calculateCombinedProgress());
      };
      img.onerror = () => {
        bgReadyRef.current = true;
        progressTargetRef.current = Math.max(progressTargetRef.current, calculateCombinedProgress());
      };
    } else {
      bgReadyRef.current = true;
      progressTargetRef.current = Math.max(progressTargetRef.current, calculateCombinedProgress());
    }
  }, [bgActive, currentBg]);

  // 4. Theo dõi nạp dữ liệu bài học / cấu hình
  useEffect(() => {
    if (isDataReady) {
      progressTargetRef.current = Math.max(progressTargetRef.current, calculateCombinedProgress());
    }
  }, [isDataReady]);

  // 5. Kích hoạt chuỗi hiệu ứng kết thúc loading (Outro sequence)
  const triggerOutro = () => {
    if (outroStartedRef.current) return;
    outroStartedRef.current = true;
    setProgress(100);
    setPhase('completed');

    // Sau 0.2s (200ms): Ẩn viền trong mượt mà (thụt ra ngoài và bị cắt dần)
    setTimeout(() => {
      setPhase('ring-out');
    }, 200);

    // Sau 200ms + 300ms = 500ms: Bắt đầu hiệu ứng Logo thu nhỏ & Chữ trượt lên biến mất
    setTimeout(() => {
      setPhase('exit');
    }, 500);

    // Khi hiệu ứng exit chạy được 70% (70% của 400ms = 280ms -> tại mốc 500ms + 280ms = 780ms):
    // Nền trắng bắt đầu mờ dần
    setTimeout(() => {
      setPhase('fading-bg');
    }, 780);

    // Sau khi cả 2 hiệu ứng và nền đạt 100% (tại 500ms + 400ms = 900ms):
    // Ẩn hoàn toàn màn hình loading và bàn giao giao diện
    setTimeout(() => {
      if (onComplete) onComplete();
      setPhase('done');
    }, 900);
  };

  // 6. Quản lý mức tải và tiến trình tăng mượt mà (% tiến độ)
  useEffect(() => {
    let isMounted = true;
    let animId = null;

    const updateTarget = (val) => {
      if (!isMounted) return;
      progressTargetRef.current = Math.max(progressTargetRef.current, val);
    };

    if (document.readyState === 'complete') {
      updateTarget(calculateCombinedProgress());
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!isMounted) return;
        fontReadyRef.current = true;
        updateTarget(calculateCombinedProgress());
      }).catch(() => {
        fontReadyRef.current = true;
      });
    }

    // Đánh dấu layout DOM pass 1
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isMounted) return;
        domRenderReadyRef.current = true;
        updateTarget(calculateCombinedProgress());
      });
    });

    const stepLoop = () => {
      if (!isMounted) return;

      const target = progressTargetRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        const diff = target - current;
        const step = Math.max(0.8, diff * 0.18);
        const next = Math.min(100, current + step);
        currentProgressRef.current = next;
        setProgress(next);
      }

      if (currentProgressRef.current < 100) {
        animId = requestAnimationFrame(stepLoop);
      } else {
        triggerOutro();
      }
    };

    animId = requestAnimationFrame(stepLoop);

    // Failsafe timer tối đa 2.2s đảm bảo trải nghiệm luôn thông suốt
    const failsafe = setTimeout(() => {
      if (!isMounted) return;
      currentProgressRef.current = 100;
      triggerOutro();
    }, 2200);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      clearTimeout(failsafe);
    };
  }, []);

  if (phase === 'done') {
    return null;
  }

  // Khớp hoàn hảo với đường viền rounded-2xl của header
  const squirclePath = "M 50 5 H 72 A 23 23 0 0 1 95 28 V 72 A 23 23 0 0 1 72 95 H 28 A 23 23 0 0 1 5 72 V 28 A 23 23 0 0 1 28 5 Z";

  const isRingOut = phase === 'ring-out' || phase === 'exit' || phase === 'fading-bg';
  const isExiting = phase === 'exit' || phase === 'fading-bg';
  const isFadingBg = phase === 'fading-bg';

  // Logo thu nhỏ lại (scale down) và fade out
  const logoStyle = {
    transform: isExiting ? 'scale(0.65)' : 'scale(1)',
    opacity: isExiting ? 0 : 1,
    transformOrigin: 'center center',
    transition: isExiting ? 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1), opacity 380ms ease-out' : 'none'
  };

  // Chữ chạy lên (translateY âm) và biến mất qua ranh giới ngay trên đầu
  const textStyle = {
    transform: isExiting ? 'translateY(-100%)' : 'translateY(0%)',
    opacity: isExiting ? 0 : 1,
    transition: isExiting ? 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1), opacity 350ms ease-in' : 'none'
  };

  // Nền mờ dần khi cả 2 hiệu ứng đạt 70% (transition trong 120ms còn lại)
  const bgStyle = {
    opacity: isFadingBg ? 0 : 1,
    transition: isFadingBg ? 'opacity 120ms ease-out' : 'none'
  };

  // Viền trong thụt ra ngoài và bị đường viền thường của logo cắt dần rồi hết
  const innerRingStyle = {
    transform: isRingOut ? 'scale(1.22)' : 'scale(1)',
    opacity: isRingOut ? 0 : 1,
    transition: isRingOut ? 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 300ms ease-out' : 'none',
    transformOrigin: 'center center'
  };

  const strokeOffset = pathLength * (1 - Math.min(100, Math.max(0, progress)) / 100);

  return html`
    <div 
      id="initial-loading-screen" 
      className="fixed inset-0 z-[9999] pointer-events-none select-none flex flex-col items-center justify-center"
      aria-hidden="true"
    >
      <!-- Lớp nền trắng mờ dần khi đạt 70% -->
      <div 
        className="absolute inset-0 bg-white" 
        style=${bgStyle}
      ></div>

      <!-- Khung hiển thị logo và chữ ở trung tâm -->
      <div className="relative z-10 flex flex-col items-center justify-center">
        <!-- Logo container định dạng đồng nhất với header logo container -->
        <div 
          ref=${logoRef}
          id="loading-logo-container"
          className=${`relative w-20 h-20 rounded-2xl border flex items-center justify-center overflow-hidden ${isLiquid ? 'bg-white/20 backdrop-blur-md border-white/50 shadow-glass' : 'bg-white border-slate-200 shadow-sm'}`}
          style=${logoStyle}
        >
          <!-- Lớp hiệu ứng gradient liquid đồng nhất với header -->
          ${isLiquid && html`<div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-100 pointer-events-none"></div>`}

          <!-- SVG Viền trong thể hiện mức load bắt đầu từ chính giữa cạnh trên -->
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
            viewBox="0 0 100 100"
            style=${innerRingStyle}
          >
            <!-- Viền trong chạy theo tiến độ thực tế -->
            <path
              ref=${pathRef}
              d=${squirclePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray=${pathLength}
              strokeDashoffset=${strokeOffset}
            />
          </svg>

          <!-- Icon BookOpen bên trong logo -->
          <${BookOpen} 
            className="relative z-10 text-indigo-600 drop-shadow-sm w-10 h-10" 
            strokeWidth=${2.5} 
          />
        </div>

        <!-- Chữ Nội dung ghi bài bên dưới logo với ranh giới cắt overflow-hidden ngay trên đầu chữ -->
        <div 
          ref=${textRef}
          id="loading-logo-text-wrapper"
          className="mt-4 overflow-hidden flex flex-col items-center justify-center px-4 py-1"
        >
          <div style=${textStyle} className="flex flex-col items-center justify-center">
            <span className=${`font-sans font-bold tracking-tight text-2xl drop-shadow-sm ${isLiquid ? 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900' : 'text-slate-800'}`}>
              ${layoutError ? 'Nội dung bài học' : 'Nội dung ghi bài'}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
};
