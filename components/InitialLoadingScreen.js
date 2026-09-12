import React, { useState, useEffect, useRef } from 'react';
import { html } from '../utils/html.js';
import { BookOpen } from 'lucide-react';
import { apiService } from '../services/apiService.js';

/**
 * Màn hình Loading ban đầu tự chủ động nạp toàn bộ tài nguyên còn lại và tính toán tiến độ:
 * 1. Khởi động tức thì với 1 màn hình loading duy nhất.
 * 2. Tự động điều phối (bootstrap) các tác vụ nền:
 *    - Nạp Font & Typography: +15% (đạt 15%)
 *    - Nạp Cấu hình hệ thống (apiService.getFullConfig): +25% (đạt 40%)
 *    - Nạp Cây thư mục & Bài học (apiService.getAllNodes): +35% (đạt 75%)
 *    - Nạp trước Hình nền (nếu bật chế độ nền): +15% (đạt 90%)
 *    - Chuẩn bị DOM & KaTeX layout: +10% (đạt 100%)
 * 3. Tiến độ chạy từ 0% đến 100% trên viền tròn logo từ giữa đỉnh theo chiều kim đồng hồ.
 * 4. Khi đạt 100%, chờ 0.2s rồi chạy hiệu ứng Outro:
 *    - Viền trong thụt ra ngoài (scale 1.22) và mờ dần biến mất
 *    - Logo thu nhỏ (scale 0.65) và fade out
 *    - Chữ trượt lên trên biến mất qua ranh giới cắt overflow-hidden ngay trên đầu
 *    - Khi cả 2 hiệu ứng chạy được 70% thì nền trắng mờ dần đến 100% thì ẩn hoàn toàn và bàn giao dữ liệu cho App
 */
export const InitialLoadingScreen = ({ 
  onBootstrapData,
  onComplete, 
  isContentReady = false,
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

  const progressTargetRef = useRef(5);
  const currentProgressRef = useRef(0);
  const outroStartedRef = useRef(false);
  const bootstrapCompletedPayloadRef = useRef(null);
  const isContentReadyRef = useRef(isContentReady);

  useEffect(() => {
    if (isContentReady) {
      isContentReadyRef.current = true;
    }
  }, [isContentReady]);

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

  // 2. Kích hoạt chuỗi hiệu ứng kết thúc loading (Outro sequence)
  const triggerOutro = () => {
    if (outroStartedRef.current) return;
    outroStartedRef.current = true;
    setProgress(100);
    setPhase('completed');

    // Chuyển giao dữ liệu đã nạp sẵn cho App
    if (onBootstrapData && bootstrapCompletedPayloadRef.current) {
      onBootstrapData(bootstrapCompletedPayloadRef.current);
    }

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

  // 3. Quản lý bootstrap sequence tự động gợi nạp tất cả phần còn lại và tính tiến độ
  useEffect(() => {
    let isMounted = true;
    let animId = null;

    const updateTarget = (val) => {
      if (!isMounted) return;
      progressTargetRef.current = Math.max(progressTargetRef.current, Math.min(100, val));
    };

    // Tiến trình tăng mượt mà (% tiến độ)
    const stepLoop = () => {
      if (!isMounted) return;

      const target = progressTargetRef.current;
      const current = currentProgressRef.current;

      if (current < target) {
        const diff = target - current;
        const step = Math.max(0.6, diff * 0.15);
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

    // Quy trình nạp từng phần tài nguyên (Bootstrap Pipeline)
    const runBootstrap = async () => {
      let fullConfig = null;
      let allNodes = [];
      let selectedBg = null;

      // Bước 1: Khởi tạo DOM & Font (+15% -> 15%)
      try {
        if (document.fonts && document.fonts.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise(res => setTimeout(res, 400))
          ]);
        }
      } catch (e) {}
      updateTarget(15);

      // Bước 2: Nạp Cấu hình hệ thống (+20% -> 35%)
      try {
        fullConfig = await Promise.race([
          apiService.getFullConfig(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Config timeout')), 4000))
        ]);
        if (fullConfig && isAppMode) {
          localStorage.setItem('cached_full_config', JSON.stringify(fullConfig));
        }
      } catch (e) {
        console.warn("Bootstrap: config fetched from fallback/cache", e);
        try {
          const cached = localStorage.getItem('cached_full_config');
          if (cached) fullConfig = JSON.parse(cached);
        } catch {}
      }
      if (!fullConfig) {
        fullConfig = { 
          classes: [], 
          background: { images: [], active: false }, 
          ui: { style: 'liquid', backButton: { enabled: true, view: true, edit: true, app: true }, zoom: { enabled: true, view: true, edit: true, app: false } } 
        };
      }
      updateTarget(35);

      // Bước 3: Nạp Dữ liệu bài học & danh mục (+20% -> 55%)
      try {
        const authPass = sessionStorage.getItem('auth_pass');
        allNodes = await Promise.race([
          apiService.getAllNodes(authPass),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Nodes timeout')), 5000))
        ]);
        if (Array.isArray(allNodes)) {
          try {
            localStorage.setItem('cached_nodes', JSON.stringify(allNodes));
          } catch {}
        }
      } catch (e) {
        console.warn("Bootstrap: nodes fetched from fallback/cache", e);
        try {
          const cached = localStorage.getItem('cached_nodes');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) allNodes = parsed;
          }
        } catch {}
      }
      updateTarget(55);

      // Bước 4: Nạp trước hình nền 100% nếu có (+20% -> 75%)
      const bgActive = !!(fullConfig?.background && fullConfig?.background?.active);
      const bgImages = (fullConfig?.background && Array.isArray(fullConfig?.background?.images)) ? fullConfig.background.images : [];
      if (bgActive && bgImages.length > 0) {
        selectedBg = bgImages[Math.floor(Math.random() * bgImages.length)];
        if (selectedBg) {
          await new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = selectedBg;
          });
        }
      }
      updateTarget(75);

      // Bàn giao dữ liệu cho App ngay lập tức để render nền và layout
      bootstrapCompletedPayloadRef.current = {
        fullConfig,
        allNodes,
        currentBg: selectedBg
      };
      if (onBootstrapData) {
        onBootstrapData(bootstrapCompletedPayloadRef.current);
      }

      // Bước 5: Chờ Explorer GET bài học/thư mục và render 100% (+20% -> 95%)
      await new Promise(resolve => {
        let checkCount = 0;
        const interval = setInterval(() => {
          checkCount++;
          if (!isMounted || isContentReadyRef.current || checkCount >= 60) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      updateTarget(95);

      // Bước 6: Chuẩn bị DOM layout & KaTeX layout stabilization (+5% -> 100%)
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      updateTarget(100);
    };

    runBootstrap();

    // Safety timer tối đa 7.5s đảm bảo không bị kẹt vô tận
    const failsafe = setTimeout(() => {
      if (!isMounted) return;
      currentProgressRef.current = 100;
      triggerOutro();
    }, 7500);

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
