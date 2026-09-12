import React, { useState, useEffect, useRef } from 'react';
import { html } from '../utils/html.js';
import { BookOpen } from 'lucide-react';

/**
 * Màn hình loading ban đầu:
 * - Nền trắng
 * - Ở giữa có logo và bên dưới logo là chữ "Nội dung ghi bài"
 * - Logo có 1 viền trong chạy từ chính giữa cạnh trên (0%) theo chiều kim đồng hồ quanh viền trong của logo đến 100% theo tiến độ thực tế
 * - Sau khi 100%, đợi 0.2s rồi ẩn viền trong mượt mà (thục ra ngoài và bị đường viền thường của logo cắt dần rồi biến mất)
 * - Sau đó 0.5s, logo thu nhỏ và di chuyển về vị trí trên header, chữ cũng thu nhỏ và di chuyển về vị trí trên header
 * - Nền mờ và biến mất hoàn toàn ngay khi logo và chữ di chuyển được 20% chặng đường
 * - Chỉ hiện khi load ban đầu (truy cập link hoặc tải lại trang)
 */
export const InitialLoadingScreen = ({ isDataReady = false, onComplete, isLiquid = true, layoutError = false }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'completed' | 'ring-out' | 'flying' | 'done'
  const [flyTransform, setFlyTransform] = useState({
    logoDeltaX: 0,
    logoDeltaY: 0,
    logoScale: 1,
    textDeltaX: 0,
    textDeltaY: 0,
    textScale: 1
  });

  const logoRef = useRef(null);
  const textRef = useRef(null);
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(266.5);

  const progressTargetRef = useRef(20);
  const currentProgressRef = useRef(0);

  // Tính toán chính xác chu vi của đường viền SVG
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

  // 1. Quản lý mức tải và tiến trình tăng mượt mà (% tiến độ)
  useEffect(() => {
    let isMounted = true;
    let animId = null;

    const updateTarget = (val) => {
      progressTargetRef.current = Math.max(progressTargetRef.current, val);
    };

    // Kiểm tra trạng thái thực tế của trang
    if (document.readyState === 'complete') {
      updateTarget(60);
    } else if (document.readyState === 'interactive') {
      updateTarget(40);
    }

    const onWindowLoad = () => updateTarget(80);
    window.addEventListener('load', onWindowLoad);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateTarget(85)).catch(() => {});
    }

    // Các mốc tăng dần tiến trình để chạy liên tục và mượt mà
    const t1 = setTimeout(() => updateTarget(45), 60);
    const t2 = setTimeout(() => updateTarget(70), 180);
    const t3 = setTimeout(() => updateTarget(90), 360);
    const t4 = setTimeout(() => updateTarget(100), 600);

    // Vòng lặp animation frame nội suy giá trị tiến độ
    const stepLoop = () => {
      if (!isMounted) return;

      const target = progressTargetRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        const diff = target - current;
        const step = Math.max(0.8, diff * 0.16);
        const next = Math.min(100, current + step);
        currentProgressRef.current = next;
        setProgress(next);
      }

      if (currentProgressRef.current < 100) {
        animId = requestAnimationFrame(stepLoop);
      } else {
        setProgress(100);
        setPhase('completed');
      }
    };

    animId = requestAnimationFrame(stepLoop);

    // Failsafe timer tối đa 1.8s để đảm bảo không bao giờ bị kẹt
    const failsafe = setTimeout(() => {
      if (!isMounted) return;
      currentProgressRef.current = 100;
      setProgress(100);
      setPhase('completed');
    }, 1800);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('load', onWindowLoad);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(failsafe);
    };
  }, []);

  // Khi dữ liệu thực tế từ API đã sẵn sàng
  useEffect(() => {
    if (isDataReady) {
      progressTargetRef.current = 100;
    }
  }, [isDataReady]);

  // 2. Trình tự sau khi đạt 100%:
  // - Đợi 0.2s ẩn viền trong (ring-out)
  // - Sau đó 0.5s logo & chữ thu nhỏ bay về header (flying)
  // - Nền mờ và biến mất hoàn toàn ngay trong 20% chặng đường đầu
  // - Kết thúc hoàn toàn (done)
  useEffect(() => {
    if (phase === 'completed') {
      // Mốc 1: Sau 0.2s bắt đầu ẩn viền trong
      const timerRingOut = setTimeout(() => {
        setPhase('ring-out');
      }, 200);

      // Mốc 2: Sau 0.2s + 0.5s = 0.7s (700ms) bắt đầu hiệu ứng bay về header
      const timerFly = setTimeout(() => {
        const targetLogo = document.getElementById('header-logo-container');
        const targetText = document.getElementById('header-main-label');

        if (targetLogo && targetText && logoRef.current && textRef.current) {
          const tlRect = targetLogo.getBoundingClientRect();
          const ttRect = targetText.getBoundingClientRect();
          const clRect = logoRef.current.getBoundingClientRect();
          const ctRect = textRef.current.getBoundingClientRect();

          const cLogoCenterX = clRect.left + clRect.width / 2;
          const cLogoCenterY = clRect.top + clRect.height / 2;
          const tLogoCenterX = tlRect.left + tlRect.width / 2;
          const tLogoCenterY = tlRect.top + tlRect.height / 2;

          const logoDeltaX = tLogoCenterX - cLogoCenterX;
          const logoDeltaY = tLogoCenterY - cLogoCenterY;
          const logoScale = Math.max(0.2, Math.min(1, tlRect.width / (clRect.width || 1)));

          const cTextCenterX = ctRect.left + ctRect.width / 2;
          const cTextCenterY = ctRect.top + ctRect.height / 2;
          const tTextCenterX = ttRect.left + ttRect.width / 2;
          const tTextCenterY = ttRect.top + ttRect.height / 2;

          const textDeltaX = tTextCenterX - cTextCenterX;
          const textDeltaY = tTextCenterY - cTextCenterY;
          const textScale = Math.max(0.2, Math.min(1, ttRect.height / (ctRect.height || 1)));

          setFlyTransform({
            logoDeltaX,
            logoDeltaY,
            logoScale,
            textDeltaX,
            textDeltaY,
            textScale
          });
        }
        setPhase('flying');
      }, 700);

      // Mốc 3: Sau 700ms + 550ms = 1250ms hoàn tất animation
      const timerDone = setTimeout(() => {
        setPhase('done');
        if (onComplete) onComplete();
      }, 1250);

      return () => {
        clearTimeout(timerRingOut);
        clearTimeout(timerFly);
        clearTimeout(timerDone);
      };
    }
  }, [phase === 'completed', onComplete]);

  if (phase === 'done') {
    return null;
  }

  // Kích thước khung logo ở giữa màn hình
  const W = 84;
  const H = 84;
  const R = 24; // bo tròn góc ngoài
  const inset = 4.5; // khoảng cách viền trong thụt vào
  const innerR = Math.max(2, R - inset); // bán kính bo góc viền trong

  // Đường dẫn SVG bắt đầu từ chính giữa cạnh trên (0%) và quay theo chiều kim đồng hồ quanh viền trong của logo
  const cx = W / 2;
  const topY = inset;
  const rightX = W - inset;
  const bottomY = H - inset;
  const leftX = inset;

  const squirclePath = `M ${cx} ${topY} ` +
    `H ${rightX - innerR} ` +
    `A ${innerR} ${innerR} 0 0 1 ${rightX} ${topY + innerR} ` +
    `V ${bottomY - innerR} ` +
    `A ${innerR} ${innerR} 0 0 1 ${rightX - innerR} ${bottomY} ` +
    `H ${leftX + innerR} ` +
    `A ${innerR} ${innerR} 0 0 1 ${leftX} ${bottomY - innerR} ` +
    `V ${topY + innerR} ` +
    `A ${innerR} ${innerR} 0 0 1 ${leftX + innerR} ${topY} ` +
    `Z`;

  const isFlying = phase === 'flying';
  const isRingOut = phase === 'ring-out' || isFlying;

  // Tính toán hiệu ứng biến đổi
  const logoTransformStyle = isFlying ? {
    transform: `translate3d(${flyTransform.logoDeltaX}px, ${flyTransform.logoDeltaY}px, 0) scale(${flyTransform.logoScale})`,
    transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
  } : {
    transform: 'translate3d(0, 0, 0) scale(1)',
    transition: 'none'
  };

  const textTransformStyle = isFlying ? {
    transform: `translate3d(${flyTransform.textDeltaX}px, ${flyTransform.textDeltaY}px, 0) scale(${flyTransform.textScale})`,
    transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
  } : {
    transform: 'translate3d(0, 0, 0) scale(1)',
    transition: 'none'
  };

  // Nền mờ và biến mất hoàn toàn ngay khi logo và chữ di chuyển được 20% chặng đường (20% của 550ms = 110ms)
  const bgStyle = {
    opacity: isFlying ? 0 : 1,
    transition: isFlying ? 'opacity 110ms ease-out' : 'none'
  };

  // Viền trong thụt ra ngoài và bị đường viền thường của logo cắt dần và hết
  const innerRingStyle = {
    transform: isRingOut ? 'scale(1.22)' : 'scale(1)',
    opacity: isRingOut ? 0 : 1,
    transition: isRingOut ? 'transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms ease-out' : 'none',
    transformOrigin: 'center center'
  };

  const strokeOffset = pathLength * (1 - Math.min(100, Math.max(0, progress)) / 100);

  return html`
    <div 
      id="initial-loading-screen" 
      className="fixed inset-0 z-[9999] pointer-events-none select-none flex flex-col items-center justify-center"
      aria-hidden="true"
    >
      <!-- Lớp nền trắng -->
      <div 
        className="absolute inset-0 bg-white" 
        style=${bgStyle}
      ></div>

      <!-- Khung hiển thị logo và chữ ở trung tâm -->
      <div className="relative z-10 flex flex-col items-center justify-center">
        <!-- Logo container -->
        <div 
          ref=${logoRef}
          id="loading-logo-container"
          className=${`relative w-[84px] h-[84px] rounded-3xl border flex items-center justify-center overflow-hidden ${isLiquid ? 'bg-white/80 backdrop-blur-md border-indigo-200/60 shadow-lg' : 'bg-white border-slate-200 shadow-md'}`}
          style=${logoTransformStyle}
        >
          <!-- SVG Viền trong thể hiện mức load bắt đầu từ chính giữa cạnh trên -->
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 ${W} ${H}"
            style=${innerRingStyle}
          >
            <!-- Viền trong chạy theo tiến độ thực tế -->
            <path
              ref=${pathRef}
              d=${squirclePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray=${pathLength}
              strokeDashoffset=${strokeOffset}
            />
          </svg>

          <!-- Icon BookOpen bên trong logo -->
          <${BookOpen} 
            className="relative z-10 text-indigo-600 drop-shadow-sm w-9 h-9" 
            strokeWidth=${2.5} 
          />
        </div>

        <!-- Chữ Nội dung ghi bài bên dưới logo -->
        <div 
          ref=${textRef}
          id="loading-logo-text"
          className="mt-4 flex flex-col items-center justify-center"
          style=${textTransformStyle}
        >
          <span className=${`font-sans font-bold tracking-tight text-2xl drop-shadow-sm ${isLiquid ? 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-900' : 'text-slate-800'}`}>
            ${layoutError ? 'Nội dung bài học' : 'Nội dung ghi bài'}
          </span>
        </div>
      </div>
    </div>
  `;
};
