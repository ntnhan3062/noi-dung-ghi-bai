
import React, { useEffect, useRef, useState } from 'react';
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

  const handleBack = () => {
    try {
      sessionStorage.setItem('nav_dir', 'left');
    } catch {}
    if (safeItems.length > 1) {
      onNavigate(safeItems[safeItems.length - 2].id, 'left');
    } else {
      onNavigate(null, 'left');
    }
  };

  const handleHomeClick = () => {
    try {
      sessionStorage.setItem('nav_dir', 'left');
    } catch {}
    onNavigate(null, 'left');
  };

  const handleItemClick = (itemId) => {
    try {
      sessionStorage.setItem('nav_dir', 'left');
    } catch {}
    onNavigate(itemId, 'left');
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
      </style>
      
      <div className="flex items-center gap-2 max-w-full">
        ${showBackButton && html`
          <button 
            key="back-folder-button"
            onClick=${handleBack}
            style=${{ 
              width: `${navHeight}px`, 
              height: `${navHeight}px`, 
              minWidth: `${navHeight}px`, 
              minHeight: `${navHeight}px` 
            }}
            className=${`flex-shrink-0 flex items-center justify-center rounded-full text-slate-700 hover:text-indigo-600 shadow-sm transition-all border active:scale-95 aspect-square ${isLiquid ? 'bg-white/40 backdrop-blur-md border-white/50 shadow-glass hover:bg-white/60 hover:border-indigo-100 hover:text-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50 hover:text-indigo-600'}`}
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
            className=${`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-indigo-600 shadow-sm transition-all border ${isLiquid ? 'bg-white/60 border-transparent hover:border-indigo-100 hover:bg-indigo-50' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
            title="Trang chủ"
          >
            <${Home} className="w-4 h-4" />
          </button>
          
          ${safeItems.map((item, index) => html`
            <${React.Fragment} key=${`bc-group-${item.id || index}`}>
              <${ChevronRight} key=${`sep-${item.id || index}`} className="w-3 h-3 text-slate-400 flex-shrink-0 mx-1" />
              <button
                key=${`btn-${item.id || index}`}
                onClick=${() => handleItemClick(item.id)}
                className=${`flex-shrink-0 hover:text-indigo-700 font-bold transition-colors px-3 py-1.5 rounded-full border border-transparent text-slate-600 ${isLiquid ? 'hover:bg-white/60 hover:shadow-sm hover:border-white/50' : 'hover:bg-slate-50 hover:border-slate-100'}`}
              >
                ${item.title}
              </button>
            </${React.Fragment}>
          `)}
        </nav>
      </div>
    </${React.Fragment}>
  `;
};


