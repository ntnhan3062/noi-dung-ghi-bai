
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { html } from '../utils/html.js';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';

export const Breadcrumbs = ({ items, onNavigate, isLiquid, showBackButton = true }) => {
  const navRef = useRef(null);
  const isHoveringRef = useRef(false);
  const hasScrolledRef = useRef(false);
  const lastItemsIdRef = useRef('');
  const [navHeight, setNavHeight] = useState(44);

  const safeItems = Array.isArray(items) ? items : [];
  const currentItemsId = safeItems.map(i => i.id).join('-');

  // Local state danh sách item phục vụ hiệu ứng con trỏ ảo xóa ngược (backspace)
  const [displayItems, setDisplayItems] = useState(() => 
    safeItems.map(i => ({
      id: i.id,
      title: i.title,
      displayTitle: i.title,
      arrowFading: false
    }))
  );

  const [activeDeletingId, setActiveDeletingId] = useState(null);
  const [showCursor, setShowCursor] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [enteringItemIds, setEnteringItemIds] = useState(() => new Set());
  
  const isDeletingRef = useRef(false);
  const targetPathIdRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const prevItemsLengthRef = useRef(safeItems.length);
  const isInitialMountRef = useRef(true);

  const animTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  // Đồng bộ displayItems khi danh sách items từ props thay đổi
  useEffect(() => {
    // Nếu đang trong hoặc ngay sau quá trình xóa bằng backspace
    if (isDeletingRef.current) {
      const isTargetReached = targetPathIdRef.current === '__HOME__'
        ? safeItems.length === 0
        : safeItems.length > 0 && safeItems[safeItems.length - 1].id === targetPathIdRef.current;

      if (!isTargetReached) {
        // safeItems từ props vẫn là danh sách cũ chưa kịp cập nhật, TUYỆT ĐỐI không ghi đè displayItems
        return;
      }
      // Đã tới đích thành công
      isDeletingRef.current = false;
      targetPathIdRef.current = null;
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    }

    if (!isAnimating) {
      setDisplayItems(safeItems.map(i => ({
        id: i.id,
        title: i.title,
        displayTitle: i.title,
        arrowFading: false
      })));
    }
  }, [currentItemsId, isAnimating, safeItems]);

  // Hiệu ứng fade in từ trái sang phải cho '>' và tên mục khi truy cập mục mới
  useEffect(() => {
    if (isDeletingRef.current || isAnimating) {
      prevItemsLengthRef.current = safeItems.length;
      return;
    }

    // Nếu không phải mount lần đầu và số lượng items tăng (người dùng bấm truy cập mục mới)
    if (!isInitialMountRef.current && safeItems.length > prevItemsLengthRef.current) {
      const newItems = safeItems.slice(prevItemsLengthRef.current);
      const newIds = new Set(newItems.map(i => i.id));
      setEnteringItemIds(newIds);

      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setEnteringItemIds(new Set());
        }
      }, 500);

      prevItemsLengthRef.current = safeItems.length;
      return () => clearTimeout(timer);
    }

    isInitialMountRef.current = false;
    prevItemsLengthRef.current = safeItems.length;
  }, [currentItemsId, isAnimating, safeItems]);

  useEffect(() => {
    if (!navRef.current) return;
    const updateNavHeight = () => {
      if (navRef.current) {
        const height = navRef.current.offsetHeight;
        if (height > 0) {
          setNavHeight(height);
        }
      }
    };

    updateNavHeight();
    const observer = new ResizeObserver(updateNavHeight);
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);

  const finishAnimation = useCallback((targetId) => {
    if (!isMountedRef.current) return;
    setIsAnimating(false);
    setActiveDeletingId(null);
    setShowCursor(false);
    onNavigate(targetId, 'left');

    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && isDeletingRef.current) {
        isDeletingRef.current = false;
        targetPathIdRef.current = null;
      }
    }, 1500);
  }, [onNavigate]);

  // Kích hoạt hiệu ứng con trỏ ảo xóa lùi (backspace) từ mục cuối cùng về targetIndex
  const triggerBackspaceAnimation = useCallback((targetIndex, targetId) => {
    if (isAnimating) return;

    try {
      sessionStorage.setItem('nav_dir', 'left');
    } catch {}

    const initialList = safeItems.map(i => ({
      id: i.id,
      title: i.title,
      displayTitle: i.title,
      arrowFading: false
    }));

    if (initialList.length === 0 || initialList.length - 1 <= targetIndex) {
      onNavigate(targetId, 'left');
      return;
    }

    isDeletingRef.current = true;
    targetPathIdRef.current = targetId === null ? '__HOME__' : targetId;
    setEnteringItemIds(new Set());
    setIsAnimating(true);
    setDisplayItems(initialList);

    const deleteItemAtIndex = (list, itemIndex) => {
      if (!isMountedRef.current) return;

      const itemToDelete = list[itemIndex];
      if (!itemToDelete) {
        finishAnimation(targetId);
        return;
      }

      // 1. Hiện con trỏ ảo ở cuối mục đang xóa
      setActiveDeletingId(itemToDelete.id);
      setShowCursor(true);

      const originalTitle = itemToDelete.title || '';
      let charsLeft = originalTitle.length;
      
      // Tốc độ nhịp xóa vừa nhanh vừa rõ: chia làm 6-7 nhịp
      const stepSize = Math.max(1, Math.ceil(originalTitle.length / 7));

      const step = () => {
        if (!isMountedRef.current) return;
        charsLeft = Math.max(0, charsLeft - stepSize);

        setDisplayItems(prevList => 
          prevList.map((it, idx) => {
            if (idx === itemIndex) {
              return { ...it, displayTitle: originalTitle.slice(0, charsLeft) };
            }
            return it;
          })
        );

        // Giữ vùng con trỏ ảo trong tầm nhìn khi cuộn
        if (navRef.current) {
          navRef.current.scrollLeft = navRef.current.scrollWidth;
        }

        if (charsLeft > 0) {
          animTimeoutRef.current = setTimeout(step, 18);
        } else {
          // Khi xóa hết chữ, trỏ ảo chạm vào mũi tên '>'
          // 2. Thu và ẩn con trỏ ảo ngay lập tức
          setShowCursor(false);

          // 3. Mũi tên '>' fade nhẹ về phía trái và biến mất
          animTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;

            setDisplayItems(prevList => 
              prevList.map((it, idx) => {
                if (idx === itemIndex) {
                  return { ...it, arrowFading: true };
                }
                return it;
              })
            );

            // 4. Sau khi mũi tên fade xong (~120ms), gỡ bỏ mục đó
            animTimeoutRef.current = setTimeout(() => {
              if (!isMountedRef.current) return;
              const nextList = list.slice(0, itemIndex);
              setDisplayItems(nextList);

              // 5. Kiểm tra: nếu còn mục cần xóa tiếp (chưa tới targetIndex)
              // thì hiện lại con trỏ ảo để tiếp tục xóa mục trước đó;
              // nếu đã tới targetIndex (còn 1 mục đích thì ngưng)
              if (nextList.length - 1 > targetIndex) {
                deleteItemAtIndex(nextList, nextList.length - 1);
              } else {
                finishAnimation(targetId);
              }
            }, 120);
          }, 30);
        }
      };

      // Bắt đầu nhịp xóa
      animTimeoutRef.current = setTimeout(step, 20);
    };

    deleteItemAtIndex(initialList, initialList.length - 1);
  }, [safeItems, isAnimating, onNavigate, finishAnimation]);

  const handleBack = () => {
    if (isAnimating) return;
    if (safeItems.length > 1) {
      const targetIndex = safeItems.length - 2;
      triggerBackspaceAnimation(targetIndex, safeItems[targetIndex].id);
    } else if (safeItems.length === 1) {
      triggerBackspaceAnimation(-1, null);
    } else {
      onNavigate(null, 'left');
    }
  };

  const handleHomeClick = () => {
    if (isAnimating) return;
    try {
      sessionStorage.setItem('nav_dir', 'left');
    } catch {}
    onNavigate(null, 'left');
  };

  const handleItemClick = (itemId) => {
    if (isAnimating) return;
    const clickedIndex = safeItems.findIndex(i => i.id === itemId);
    if (clickedIndex === -1 || clickedIndex === safeItems.length - 1) {
      return;
    }
    // Chọn trực tiếp đường dẫn khác trang chủ và khác mục hiện tại: chạy hiệu ứng xóa lùi đến mục được chọn
    triggerBackspaceAnimation(clickedIndex, itemId);
  };

  useEffect(() => {
    if (lastItemsIdRef.current !== currentItemsId) {
        hasScrolledRef.current = false;
        lastItemsIdRef.current = currentItemsId;
    }

    const attemptScroll = () => {
        if (hasScrolledRef.current) return;
        if (isHoveringRef.current) return;
        if (navRef.current) {
            navRef.current.scrollTo({
                left: navRef.current.scrollWidth,
                behavior: 'smooth'
            });
            hasScrolledRef.current = true;
        }
    };

    const timer = setTimeout(attemptScroll, 100);
    return () => clearTimeout(timer);
  }, [currentItemsId]);

  const handleMouseEnter = () => { isHoveringRef.current = true; };
  const handleMouseLeave = () => {
    isHoveringRef.current = false;
    if (!hasScrolledRef.current && navRef.current) {
         navRef.current.scrollTo({
            left: navRef.current.scrollWidth,
            behavior: 'smooth'
        });
        hasScrolledRef.current = true;
    }
  };

  useEffect(() => {
    const container = navRef.current;
    if (!container) return;
    const handleWheel = (e) => {
        if (container.scrollWidth > container.clientWidth) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  return html`
    <${React.Fragment}>
      <style key="breadcrumbs-style">
        .breadcrumbs-scroll::-webkit-scrollbar { display: none; }
        .breadcrumbs-scroll { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes bcFadeInLeftSep {
          0% {
            opacity: 0;
            transform: translateX(-14px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bcFadeInLeftItem {
          0% {
            opacity: 0;
            transform: translateX(-16px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .bc-sep-enter {
          animation: bcFadeInLeftSep 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .bc-item-enter {
          animation: bcFadeInLeftItem 240ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
          will-change: transform, opacity;
        }
      </style>
      
      <div className="flex items-center gap-2 max-w-full">
        ${showBackButton && html`
          <button 
            key="back-folder-button"
            onClick=${handleBack}
            disabled=${isAnimating}
            style=${{ 
              width: `${navHeight}px`, 
              height: `${navHeight}px`, 
              minWidth: `${navHeight}px`, 
              minHeight: `${navHeight}px` 
            }}
            className=${`flex-shrink-0 flex items-center justify-center rounded-full text-slate-700 hover:text-indigo-600 shadow-sm transition-all border active:scale-95 aspect-square ${isAnimating ? 'opacity-70 cursor-not-allowed' : ''} ${isLiquid ? 'bg-white/40 backdrop-blur-md border-white/50 shadow-glass hover:bg-white/60 hover:border-indigo-100 hover:text-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50 hover:text-indigo-600'}`}
            title="Quay lại mục trước"
            aria-label="Quay lại mục trước"
          >
            <${ArrowLeft} className="w-5 h-5" />
          </button>
        `}

        <nav 
          key="breadcrumbs-nav"
          ref=${navRef}
          onMouseEnter=${handleMouseEnter}
          onMouseLeave=${handleMouseLeave}
          className=${`breadcrumbs-scroll flex-1 flex items-center space-x-1 text-sm text-slate-600 overflow-x-auto whitespace-nowrap p-1.5 rounded-full max-w-full touch-pan-x border ${isLiquid ? 'bg-white/40 backdrop-blur-md border-white/50 shadow-glass' : 'bg-white border-slate-200 shadow-sm'}`}
        >
          <button 
            key="home-button"
            onClick=${handleHomeClick}
            disabled=${isAnimating}
            className=${`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-indigo-600 shadow-sm transition-all border ${isAnimating ? 'opacity-70 cursor-not-allowed' : ''} ${isLiquid ? 'bg-white/60 border-transparent hover:border-indigo-100 hover:bg-indigo-50' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
            title="Trang chủ"
          >
            <${Home} className="w-4 h-4" />
          </button>
          
          ${displayItems.map((item, index) => {
            const isDeletingCurrent = item.id === activeDeletingId;
            const isCurrentCursorVisible = isDeletingCurrent && showCursor;
            const isLastItem = index === displayItems.length - 1;
            const isEntering = enteringItemIds.has(item.id);

            return html`
              <${React.Fragment} key=${`bc-group-${item.id || index}`}>
                <${ChevronRight} 
                  key=${`sep-${item.id || index}`} 
                  className=${`w-3 h-3 text-slate-400 flex-shrink-0 mx-1 transition-all duration-150 ease-out ${
                    item.arrowFading ? 'opacity-0 -translate-x-2.5 scale-75' : 'opacity-100 translate-x-0 scale-100'
                  } ${isEntering ? 'bc-sep-enter' : ''}`} 
                />
                <button
                  key=${`btn-${item.id || index}`}
                  onClick=${() => handleItemClick(item.id)}
                  disabled=${isAnimating || isLastItem}
                  className=${`flex-shrink-0 inline-flex items-center hover:text-indigo-700 font-bold transition-colors px-3 py-1.5 rounded-full border border-transparent text-slate-600 ${
                    isLastItem ? 'cursor-default text-indigo-700' : 'cursor-pointer'
                  } ${isLiquid ? 'hover:bg-white/60 hover:shadow-sm hover:border-white/50' : 'hover:bg-slate-50 hover:border-slate-100'} ${
                    isEntering ? 'bc-item-enter' : ''
                  }`}
                >
                  <span className="truncate max-w-[260px] md:max-w-[400px]">
                    ${item.displayTitle !== undefined ? item.displayTitle : item.title}
                  </span>
                  ${isCurrentCursorVisible && html`
                    <span 
                      key="virtual-cursor"
                      className="inline-block w-[2.5px] h-3.5 bg-indigo-600 ml-1 rounded-full animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.85)] flex-shrink-0"
                    />
                  `}
                </button>
              </${React.Fragment}>
            `;
          })}
        </nav>
      </div>
    </${React.Fragment}>
  `;
};


