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
  const progressTargetRef = useRef(15);
  const currentProgressRef = useRef(0);
  const animFrameRef = useRef(null);

  // 1. Quản lý mức tải thực tế (% thực tế loading)
  useEffect(() => {
    // Các mốc kiểm tra tài nguyên thực tế
    const updateTarget = (val) => {
      progressTargetRef.current = Math.max(progressTargetRef.current, val);
    };

    // Kiểm tra trạng thái tải document
    if (document.readyState === 'complete') {
      updateTarget(45);
    } else if (document.readyState === 'interactive') {
      updateTarget(30);
    }

    const onWindowLoad = () => updateTarget(65);
    window.addEventListener('load', onWindowLoad);

    // Kiểm tra font chữ đã sẵn sàng
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateTarget(75)).catch(() => {});
    }

    // Thời gian tối thiểu tăng dần tiến độ
    const t1 = setTimeout(() => updateTarget(40), 150);
    const t2 = setTimeout(() => updateTarget(60), 350);
    const t3 = setTimeout(() => updateTarget(85), 600);

    return () => {
      window.removeEventListener('load', onWindowLoad);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Khi dữ liệu ứng dụng (config, classes, v.v.) đã sẵn sàng
  useEffect(() => {
    if (isDataReady) {
      progressTargetRef.current = 100;
    }
  }, [isDataReady]);

  // Vòng lặp làm mượt tiến độ (smooth interpolation)
  useEffect(() => {
    let isMounted = true;

    const tick = () => {
      if (!isMounted) return;

      const target = progressTargetRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        // Tiến dần về target một cách êm ái
        const step = Math.max(0.6, (target - current) * 0.12);
        const next = Math.min(100, current + step);
        currentProgressRef.current = next;
        setProgress(Math.round(next * 10) / 10);
      }

      if (currentProgressRef.current < 100) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Đã đạt 100%
        setPhase('completed');
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 2. Xử lý sau khi đạt 100%:
  // - "sau khi loading 100% đợi 0.2s và ẩn viền trong này đi mượt mà (thục ra ngoài và bị đường viền thường của logo bình thường cắt dần và hết)"
  // - "sau đó 0.5s thì có hiệu ứng di chuyển logo thì thu nhỏ và chạy về vị trí trên header, chữ cũng quay về đúng kích thước và di chuyển về vị trí trên header"
  // - "nền thì mờ và biến mất hoàn toàn ngay khi logo và chữ đã di chuyển được 20% chặn đường."
  useEffect(() => {
    if (phase === 'completed') {
      // Đợi 0.2s sau khi đạt 100%
      const timerRingOut = setTimeout(() => {
        setPhase('ring-out');

        // Sau đó 0.5s (500ms) tính từ lúc bắt đầu ẩn viền trong thì bắt đầu hiệu ứng bay về header
        const timerFly = setTimeout(() => {
          // Đo đạc tọa độ chính xác của logo và chữ trên header
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
            const logoScale = Math.min(1, tlRect.width / (clRect.width || 1));

            const cTextCenterX = ctRect.left + ctRect.width / 2;
            const cTextCenterY = ctRect.top + ctRect.height / 2;
            const tTextCenterX = ttRect.left + ttRect.width / 2;
            const tTextCenterY = ttRect.top + ttRect.height / 2;

            const textDeltaX = tTextCenterX - cTextCenterX;
            const textDeltaY = tTextCenterY - cTextCenterY;
            const textScale = Math.min(1, ttRect.height / (ctRect.height || 1));

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

          // Hiệu ứng bay kéo dài 550ms, kết thúc hoàn toàn
          const timerDone = setTimeout(() => {
            setPhase('done');
            if (onComplete) onComplete();
          }, 550);

          return () => clearTimeout(timerDone);
        }, 500);

        return () => clearTimeout(timerFly);
      }, 200);

      return () => clearTimeout(timerRingOut);
    }
  }, [phase, onComplete]);

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

  // Viền trong thụt/thục ra ngoài và bị đường viền thường của logo cắt dần và hết
  const innerRingStyle = {
    transform: isRingOut ? 'scale(1.22)' : 'scale(1)',
    opacity: isRingOut ? 0 : 1,
    transition: isRingOut ? 'transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms ease-out' : 'none',
    transformOrigin: 'center center'
  };

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
              d=${squirclePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset=${Math.max(0, 100 - progress)}
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
