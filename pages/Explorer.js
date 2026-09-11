
import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { html } from '../utils/html.js';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Minus, ArrowLeft, LayoutGrid, List as ListIcon, Loader2, Save, X, KeyRound, CornerDownRight, ClipboardList, ArrowUpDown, LogOut, Mic, MicOff, Globe, Wand2, Settings } from 'lucide-react';
import { apiService } from '../services/apiService.js';
import { NodeType, ALLOWED_CHILDREN, NODE_LABELS } from '../types.js';
import { NodeItem } from '../components/NodeItem.js';
import { EditorModal } from '../components/EditorModal.js';
import { ChangePasswordModal } from '../components/ChangePasswordModal.js';
import { useBreadcrumbs } from '../context/BreadcrumbContext.js';
import { useClasses } from '../context/ClassContext.js';
import { StatusPage } from '../components/StatusPage.js';
import Sortable from 'sortablejs';

export const normalizeMathSpans = (html) => {
  if (!html) return '';
  if (typeof document === 'undefined') return html;
  
  // 1. Create a temporary element to safely unwrap existing math-tex spans
  const div = document.createElement('div');
  div.innerHTML = html;
  const mathSpans = Array.from(div.querySelectorAll('span.math-tex'));
  mathSpans.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }
  });
  
  let content = div.innerHTML;
  
  // 2. Extract all HTML tags to protect them from being split by regex
  const tags = [];
  content = content.replace(/<[^>]+>/g, (match) => {
    const id = `___TAG_${tags.length}___`;
    tags.push({ id, content: match });
    return id;
  });
  
  // 3. Protect escaped dollars (\$ should not be treated as math delimiter)
  content = content.replace(/\\(\$)/g, '___ESC_DOL___');
  
  // 4. Identify Math Formulas and wrap them in placeholders with display/inline classes
  const mathPlaceholders = [];
  
  // Handle Display Math ($$ ... $$ and \[ ... \]) - Match non-greedily
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (match, p1) => {
    const id = `___MATH_DISP_${mathPlaceholders.length}___`;
    mathPlaceholders.push({ id, content: `<span class="math-tex math-display">$$${p1}$$</span>` });
    return id;
  });
  content = content.replace(/\\\[([\s\S]+?)\\\]/g, (match, p1) => {
    const id = `___MATH_DISP_${mathPlaceholders.length}___`;
    mathPlaceholders.push({ id, content: `<span class="math-tex math-display">\\[${p1}\\]</span>` });
    return id;
  });
  
  // Handle Inline Math ($ ... $ and \( ... \))
  // We match $...$ where the content doesn't contain another $
  content = content.replace(/\$([^\$]+?)\$/g, (match, p1) => {
    const id = `___MATH_INL_${mathPlaceholders.length}___`;
    mathPlaceholders.push({ id, content: `<span class="math-tex math-inline">$${p1}$</span>` });
    return id;
  });
  content = content.replace(/\\\(([\s\S]+?)\\\)/g, (match, p1) => {
    const id = `___MATH_INL_${mathPlaceholders.length}___`;
    mathPlaceholders.push({ id, content: `<span class="math-tex math-inline">\\(${p1}\\)</span>` });
    return id;
  });
  
  // 5. Restore escaped dollars
  content = content.replace(/___ESC_DOL___/g, '\\$');
  
  // 6. Restore Math Placeholders
  mathPlaceholders.forEach(({ id, content: mathHtml }) => {
    content = content.replace(id, mathHtml);
  });
  
  // 7. Restore HTML Tags
  tags.forEach(({ id, content: tagHtml }) => {
    content = content.replace(id, tagHtml);
  });
  
  return content;
};

export const hasLatexMath = (content) => {
  if (!content || typeof content !== 'string') return false;
  if (content.includes('math-tex') || content.includes('katex')) return true;
  if (/\$\$[\s\S]+?\$\$/.test(content)) return true;
  if (/\\\[[\s\S]+?\\\]/.test(content)) return true;
  if (/\\\([\s\S]+?\\\)/.test(content)) return true;
  if (/\$([^\$\s][^\$]*?)\$/.test(content)) {
    const matches = content.match(/\$([^\$\s][^\$]*?)\$/g);
    if (matches && matches.some(m => !/^\$\s*\d+([.,]\d+)?\s*\$$/.test(m))) {
      return true;
    }
  }
  if (/\\[a-zA-Z]+/.test(content) && /\\(frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|theta|lambda|pi|sigma|omega|partial|infty|leq|geq|neq|approx|times|div|pm|mp|cdot|circ|bullet|rightarrow|leftarrow|Rightarrow|Leftarrow|to|vec|hat|bar|text|mathbf|mathrm|sin|cos|tan|cot|ln|log)/.test(content)) {
    return true;
  }
  return false;
};

// Tạo nội dung skeleton giữ chỗ chính xác từng vị trí chữ, cỡ chữ, chiều cao dòng
export const generateLessonSkeletonHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof document === 'undefined') return '';

  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    const wrapTextNode = (textNode) => {
      const text = textNode.textContent;
      if (!text || text.length === 0) return;

      // Giữ nguyên khoảng trắng thuần túy giữa các thẻ
      if (/^\s*$/.test(text)) return;

      // Tách khoảng trắng đầu/cuối để giữ nguyên khoảng cách từ tự nhiên giữa các phần tử
      const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const leadingSpace = match ? match[1] : '';
      const coreText = match ? match[2] : text;
      const trailingSpace = match ? match[3] : '';

      const parent = textNode.parentNode;
      if (!parent) return;

      const fragment = document.createDocumentFragment();
      if (leadingSpace) {
        fragment.appendChild(document.createTextNode(leadingSpace));
      }

      if (coreText) {
        const span = document.createElement('span');
        span.className = 'inline rounded-md bg-slate-200/85 text-transparent select-none animate-pulse';
        span.style.webkitBoxDecorationBreak = 'clone';
        span.style.boxDecorationBreak = 'clone';
        span.style.userSelect = 'none';
        span.style.color = 'transparent';
        span.style.textShadow = 'none';
        span.textContent = coreText;
        fragment.appendChild(span);
      }

      if (trailingSpace) {
        fragment.appendChild(document.createTextNode(trailingSpace));
      }

      parent.replaceChild(fragment, textNode);
    };

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        wrapTextNode(node);
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // 1. Công thức toán học (display hoặc inline)
        if (node.classList.contains('math-tex') || node.classList.contains('katex')) {
          const isDisplay = node.classList.contains('math-display') || node.classList.contains('katex-display');
          const span = document.createElement('span');
          if (isDisplay) {
            span.className = 'block h-12 w-3/5 max-w-md mx-auto bg-slate-200/85 rounded-2xl animate-pulse my-4';
          } else {
            span.className = 'inline-block h-5 min-w-[2.5rem] w-[4rem] bg-slate-200/85 rounded-md align-middle mx-1 animate-pulse';
          }
          node.parentNode.replaceChild(span, node);
          return;
        }

        // 2. Hình ảnh
        if (tagName === 'img') {
          const div = document.createElement('div');
          div.className = 'rounded-2xl bg-slate-200/85 animate-pulse my-4 w-full max-w-md h-48';
          node.parentNode.replaceChild(div, node);
          return;
        }

        // 3. Iframe / Video
        if (tagName === 'iframe' || tagName === 'video') {
          const div = document.createElement('div');
          div.className = 'rounded-2xl bg-slate-200/85 animate-pulse my-4 w-full max-w-lg h-56';
          node.parentNode.replaceChild(div, node);
          return;
        }

        // 4. Giữ nguyên ngắt dòng br và đường kẻ hr
        if (tagName === 'br') return;
        if (tagName === 'hr') {
          node.className = (node.className || '') + ' opacity-30';
          return;
        }

        // 5. Đệ quy duyệt các phần tử con
        const children = Array.from(node.childNodes);
        children.forEach(child => processNode(child));
      }
    };

    Array.from(tempDiv.childNodes).forEach(child => processNode(child));
    return tempDiv.innerHTML;
  } catch (err) {
    console.error('Error generating lesson skeleton:', err);
    return rawHtml;
  }
};

export const Explorer = ({ mode, isAppMode, uiConfig }) => {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { updateBreadcrumbs, setBreadcrumbsVisible } = useBreadcrumbs();
  const { selectedClassId } = useClasses();
  
  const [allNodes, setAllNodes] = useState(() => {
    try {
      if (isAppMode) {
        const cached = localStorage.getItem('cached_nodes');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {
      return [];
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    try {
      if (isAppMode) {
        const cached = localStorage.getItem('cached_nodes');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      }
    } catch {
      return true;
    }
    return true;
  });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewFontSize, setViewFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('user_view_font_size');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 8 && val <= 74) return val;
      }
    } catch {}
    return 18;
  });
  const [isMathRendered, setIsMathRendered] = useState(false);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const [isMultiLine, setIsMultiLine] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE');
  const [editingNode, setEditingNode] = useState(undefined);
  const [targetType, setTargetType] = useState(NodeType.SUBJECT);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [autoFormat, setAutoFormat] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState('vi-VN');
  const [movingNode, setMovingNode] = useState(null);
  const [isSorting, setIsSorting] = useState(false);
  const [error, setError] = useState(null);

  const marqueeTitleRef = useRef(null);
  const marqueeTitleContainerRef = useRef(null);
  const lastInitializedLessonId = useRef(null);
  const tempContentRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const shouldListenRef = useRef(false);
  const sortableListRef = useRef(null);
  const sortableInstance = useRef(null);
  const isFetchingRef = useRef(false);
  const lessonContentRef = useRef(null);
  const titleRef = useRef(null);
  const lastRenderedContentRef = useRef(null);
  const lastRenderedNodeIdRef = useRef(null);
  const autoFullscreenTriggeredRef = useRef(false);
  const userExitedAutoFullscreenRef = useRef(false);
  const isManualFullscreenRef = useRef(false);
  const isSystemTogglingFullscreenRef = useRef(false);

  const selectNoneStyle = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none'
  };

  const currentNode = useMemo(() => allNodes.find(n => n.id === nodeId), [allNodes, nodeId]);

  // Kiểm tra bài học hiện tại có công thức toán học (LaTeX) hay không
  const hasMath = useMemo(() => {
    if (currentNode?.type !== NodeType.LESSON) return false;
    return hasLatexMath(currentNode?.content);
  }, [currentNode?.id, currentNode?.content, currentNode?.type]);

  // Đảm bảo trạng thái render công thức được đặt lại trước khi trình duyệt vẽ frame nếu bài có LaTeX
  useLayoutEffect(() => {
    if (currentNode?.type === NodeType.LESSON) {
      if (hasMath && !isEditingContent) {
        if (lastRenderedNodeIdRef.current !== currentNode?.id || lastRenderedContentRef.current !== currentNode?.content) {
          setIsMathRendered(false);
        }
      } else {
        setIsMathRendered(true);
      }
    } else {
      setIsMathRendered(true);
    }
  }, [currentNode?.id, currentNode?.content, hasMath, isEditingContent, currentNode?.type]);

  useLayoutEffect(() => {
    const checkTitle = () => {
      if (marqueeTitleRef.current) {
        const height = marqueeTitleRef.current.offsetHeight;
        // Line height is ~32px-40px. If height > 50, it's multi-line.
        setIsMultiLine(height > 50);
      }
    };
    checkTitle();
    // Small timeout to ensure rendering is stable
    const timer = setTimeout(checkTitle, 100);
    window.addEventListener('resize', checkTitle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkTitle);
    };
  }, [currentNode?.title]);
  const isLiquid = uiConfig?.style === 'liquid';

  const children = useMemo(() => {
    let filtered = allNodes.filter(n => {
      const pId = (n.parentId === undefined || n.parentId === '' || n.parentId === null || n.parentId === 'null') ? null : n.parentId;
      const targetId = (nodeId === undefined || nodeId === '' || nodeId === null || nodeId === 'null') ? null : nodeId;
      return String(pId) === String(targetId);
    });
    
    // Only filter by class at the root level (subjects)
    if (!nodeId && selectedClassId) {
      filtered = filtered.filter(n => !n.classId || n.classId === selectedClassId);
    }
    
    return filtered.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [allNodes, nodeId, selectedClassId]);

  const calculatedBreadcrumbs = useMemo(() => {
    const path = [];
    let curr = currentNode;
    while (curr) {
      path.unshift({ id: curr.id, title: curr.title });
      curr = allNodes.find(n => n.id === curr?.parentId);
    }
    return path;
  }, [currentNode, allNodes]);

  // Check Zoom availability: Must be LESSON type, and enabled in config
  const isZoomEnabledForMode = currentNode?.type === NodeType.LESSON && (uiConfig?.zoom ? (
      (uiConfig.zoom.enabled !== false) && (
        (isAppMode && uiConfig.zoom.app) ||
        (mode === 'edit' && uiConfig.zoom.edit) ||
        (mode === 'view' && !isAppMode && uiConfig.zoom.view)
      )
  ) : false);

  const canShowZoom = isZoomEnabledForMode && (!hasMath || isMathRendered);

  useEffect(() => { if (!loading) updateBreadcrumbs(calculatedBreadcrumbs); }, [loading, calculatedBreadcrumbs, updateBreadcrumbs]);

  useEffect(() => {
    setBreadcrumbsVisible(!isEditingContent);
    return () => setBreadcrumbsVisible(true);
  }, [isEditingContent, setBreadcrumbsVisible]);

  const fetchData = async (isBackground = false) => {
    if (isFetchingRef.current) return;
    const shouldDelay = isAppMode && nodeId && !isBackground;
    const startTime = Date.now();
    
    const hasCache = Array.isArray(allNodes) && allNodes.length > 0;
    const isSilentlyFetching = isBackground || hasCache;

    if (!isSilentlyFetching) {
      setLoading(true);
    } else if (hasCache) {
      setSyncing(true);
    }

    isFetchingRef.current = true;
    try {
      const currentPass = mode === 'edit' ? sessionStorage.getItem('auth_pass') : null;
      const data = await apiService.getAllNodes(currentPass);
      if (Array.isArray(data)) {
        if (!isSorting && !isEditingContent) {
          setAllNodes(data);
          if (isAppMode) {
            try {
              localStorage.setItem('cached_nodes', JSON.stringify(data));
              // Log tin dài đặc biệt để tránh bị trùng lặp hay nhầm lẫn với các cảnh báo khác từ thư viện
              console.log("==========================================================================================");
              console.log("KODULAR_APP_OFFLINE_CACHE_SYSTEM_STATUS_SUCCESS_NODES_DATA_SYNCHRONIZED_AND_FULLY_STORED_IN_LOCALSTORAGE_CACHE_READY_FOR_OFFLINE_MODE_OPERATION");
              console.log("==========================================================================================");
            } catch (e) {
              console.error(e);
            }
          }
        }
        const nodeExists = !nodeId || data.some(n => n.id === nodeId);
        if (!nodeExists) {
          setError('not-found');
        } else {
          setError(null);
        }
      } else {
        throw new Error('LOAD_FAILED');
      }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        sessionStorage.removeItem('auth_pass');
        window.location.reload(); 
        return;
      }
      const hasCache = Array.isArray(allNodes) && allNodes.length > 0;
      if (!isAppMode || !hasCache) {
        setError(err.message === 'LOAD_FAILED' ? 'load-failed' : 'source-error');
        console.error("Failed to load data", err);
      } else {
        console.warn("Soft handling fetch failure to keep offline/cached view active:", err);
      }
    } finally {
      isFetchingRef.current = false;
      setSyncing(false);
      if (!isSilentlyFetching) {
        if (shouldDelay) {
            const elapsed = Date.now() - startTime;
            const MIN_LOAD_TIME = 1000;
            if (elapsed < MIN_LOAD_TIME) await new Promise(resolve => setTimeout(resolve, MIN_LOAD_TIME - elapsed));
        }
        setLoading(false);
      }
    }
  };

  useEffect(() => { 
    if (!loading && nodeId && !currentNode) {
      setError('not-found');
    } else if (!loading) {
      setError(null);
    }
  }, [loading, nodeId, currentNode]);

  useEffect(() => { 
    fetchData(); 
    setIsMathRendered(false); // Reset math rendered state on node change
  }, [nodeId]);

  useEffect(() => {
    if (isEditingContent) return;
    if (currentNode?.type !== NodeType.LESSON) return;
    
    // Nếu bài học không có công thức toán học thì hoàn tất ngay lập tức
    if (!hasMath) {
      setIsMathRendered(true);
      lastRenderedNodeIdRef.current = currentNode?.id;
      lastRenderedContentRef.current = currentNode?.content;
      return;
    }

    let isMounted = true;
    let isRendering = false;

    // Safety timeout: Sau tối đa 3.5s, nếu vì mạng hay KaTeX script bị chậm thì vẫn mở nội dung bài học
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsMathRendered(true);
      }
    }, 3500);

    const markRenderComplete = () => {
      if (!isMounted) return;
      lastRenderedNodeIdRef.current = currentNode?.id;
      lastRenderedContentRef.current = currentNode?.content;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (isMounted) {
            setIsMathRendered(true);
            clearTimeout(safetyTimeout);
          }
        });
      });
    };

    const renderMath = () => {
      if (isRendering || !isMounted) return;
      
      const contentElement = lessonContentRef.current || document.querySelector('.lesson-content');
      if (!contentElement) {
        return;
      }

      const hasKatex = typeof katex !== 'undefined' || !!window.katex;
      const hasRender = typeof renderMathInElement !== 'undefined' || !!window.renderMathInElement;

      if (hasKatex && hasRender) {
        isRendering = true;
        const renderFunc = window.renderMathInElement || renderMathInElement;
        console.log('KaTeX: Rendering content in element');
        try {
          renderFunc(contentElement, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\(', right: '\\)', display: false},
              {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false,
            trust: true
          });
          
          // JavaScript Hiding Logic: Force hide HTML and show MathML
          const htmlParts = contentElement.querySelectorAll('.katex-html');
          htmlParts.forEach(el => {
            el.style.setProperty('display', 'none', 'important');
          });
          const mathMLParts = contentElement.querySelectorAll('.katex-mathml');
          mathMLParts.forEach(el => {
            el.style.setProperty('display', 'inline-block', 'important');
            el.style.setProperty('position', 'static', 'important');
            el.style.setProperty('clip', 'auto', 'important');
            el.style.setProperty('width', 'auto', 'important');
            el.style.setProperty('height', 'auto', 'important');
            el.style.setProperty('overflow', 'visible', 'important');
          });

          // Show rendered math-tex elements
          const mathTexElements = contentElement.querySelectorAll('.math-tex');
          mathTexElements.forEach(el => {
            el.classList.add('is-rendered');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
          });

          markRenderComplete();
          console.log('KaTeX: Render successful and HTML hidden via JS.');
        } catch (err) {
          console.error('KaTeX: Render error:', err);
          markRenderComplete(); // Show content even on error
        } finally {
          // Release lock after a short delay to ensure DOM is stable
          setTimeout(() => { isRendering = false; }, 100);
        }
      } else {
        console.warn('KaTeX: SDK components missing. hasKatex:', hasKatex, 'hasRender:', hasRender);
        // Retry after a short delay if components are missing
        setTimeout(() => {
          if (isMounted) renderMath();
        }, 150);
      }
    };

    // Initial render
    renderMath();

    // Observe changes to the content element
    let observer = null;
    const contentElement = lessonContentRef.current || document.querySelector('.lesson-content');
    
    // Debounce function to prevent rapid re-renders
    let renderTimeout = null;
    const debouncedRender = () => {
      if (renderTimeout) clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => {
        if (isMounted) renderMath();
      }, 300);
    };

    if (contentElement) {
      observer = new MutationObserver((mutations) => {
        // Check if any mutation is NOT from KaTeX
        const isExternalMutation = (mutations || []).some(mutation => {
          if (!mutation) return false;
          // If nodes were added, check if they are KaTeX
          if (mutation.addedNodes && mutation.addedNodes.length > 0) {
            const allAddedAreKatex = Array.from(mutation.addedNodes).every(node => 
              (node && node.classList && (node.classList.contains('katex') || node.classList.contains('katex-html'))) ||
              (node && node.querySelector && node.querySelector('.katex'))
            );
            if (allAddedAreKatex) return false;
          }

          // Ignore if the change is inside a KaTeX element
          let target = mutation.target;
          while (target && target !== contentElement) {
            if (target.classList && (target.classList.contains('katex') || target.classList.contains('katex-html'))) {
              return false;
            }
            target = target.parentElement;
          }
          return true;
        });

        if (isExternalMutation) {
          console.log('KaTeX: External content change detected, debouncing render...');
          debouncedRender();
        }
      });

      observer.observe(contentElement, { 
        childList: true, 
        subtree: true, 
        characterData: true 
      });
    }

    // Also retry a few times in case KaTeX script loads late or content is slow
    let retryCount = 0;
    const retryInterval = setInterval(() => {
      const hasKatex = typeof katex !== 'undefined' || !!window.katex;
      const hasRender = typeof renderMathInElement !== 'undefined' || !!window.renderMathInElement;
      
      if (hasKatex && hasRender) {
        renderMath();
        // If we found it and rendered, we can stop the interval if content is already there
        const el = lessonContentRef.current || document.querySelector('.lesson-content');
        if (el && el.querySelector('.katex')) {
          console.log('KaTeX: Found rendered content, stopping interval.');
          clearInterval(retryInterval);
        }
      } else if (retryCount === 5) {
        // Sequential re-injection
        console.log('KaTeX: Attempting sequential re-injection from jsDelivr...');
        const s1 = document.createElement('script');
        s1.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
        s1.onload = () => {
          console.log('KaTeX: Core loaded, now loading auto-render...');
          const s2 = document.createElement('script');
          s2.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
          s2.onload = () => {
            console.log('KaTeX: All scripts re-injected successfully.');
            renderMath();
          };
          document.head.appendChild(s2);
        };
        document.head.appendChild(s1);
      }
      
      if (retryCount > 20) { // Try for 10 seconds
        clearInterval(retryInterval);
      }
      retryCount++;
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      if (observer) observer.disconnect();
      clearInterval(retryInterval);
    };
  }, [currentNode?.id, currentNode?.content, isEditingContent, viewFontSize, nodeId, hasMath]);

  // Đồng bộ kích thước font chữ cho nội dung bài học (.lesson-content) khi có bật hiển thị Zoom
  useEffect(() => {
    if (lessonContentRef.current) {
      if (isZoomEnabledForMode) {
        lessonContentRef.current.style.setProperty('--lesson-font-size', `${viewFontSize}pt`);
        lessonContentRef.current.style.setProperty('--lesson-scale', `${viewFontSize / 18}`);
        lessonContentRef.current.style.setProperty('zoom', `${viewFontSize / 18}`);
        lessonContentRef.current.style.setProperty('font-size', `${viewFontSize}pt`);
      } else {
        lessonContentRef.current.style.removeProperty('--lesson-font-size');
        lessonContentRef.current.style.removeProperty('--lesson-scale');
        lessonContentRef.current.style.removeProperty('zoom');
        lessonContentRef.current.style.removeProperty('font-size');
      }
    }
  }, [viewFontSize, currentNode?.id, currentNode?.content, isEditingContent, isZoomEnabledForMode]);

  useEffect(() => {
    if (currentNode?.type === NodeType.LESSON && currentNode?.id) {
        if (lastInitializedLessonId.current !== currentNode.id) {
            lastInitializedLessonId.current = currentNode.id;
            let initialSize = 18;
            try {
              const saved = localStorage.getItem('user_view_font_size');
              if (saved) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 8 && parsed <= 74) initialSize = parsed;
              }
            } catch {}
            setViewFontSize(initialSize);
        }
    } else if (!currentNode) {
      lastInitializedLessonId.current = null;
    }
  }, [currentNode?.id, currentNode?.type]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isSorting && !isEditingContent) fetchData(true);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [mode, isSorting, isEditingContent]);

  useEffect(() => {
    const handleOnlineEvent = () => {
      if (isAppMode && !isSorting && !isEditingContent) {
        fetchData(true);
      }
    };
    window.addEventListener('app-network-online', handleOnlineEvent);
    return () => window.removeEventListener('app-network-online', handleOnlineEvent);
  }, [isAppMode, isSorting, isEditingContent]);

  useEffect(() => {
    if (isSorting && sortableListRef.current) {
      sortableInstance.current = Sortable.create(sortableListRef.current, {
        animation: 150, handle: '.drag-handle', ghostClass: 'bg-indigo-50/50', dragClass: 'opacity-50',
        onEnd: () => {
          const newOrderIds = Array.from(sortableListRef.current.children).map(el => el.getAttribute('data-id'));
          const orderMap = new Map(newOrderIds.map((id, index) => [id, index]));
          setAllNodes(prev => prev.map(n => {
            if (orderMap.has(n.id)) return { ...n, orderIndex: orderMap.get(n.id) };
            return n;
          }));
        }
      });
    } else {
      if (sortableInstance.current) {
        sortableInstance.current.destroy();
        sortableInstance.current = null;
      }
    }
  }, [isSorting, nodeId]);

  useEffect(() => {
    if (isEditingContent) {
      const initTinyMCE = () => {
        if (window.tinymce && window.tinymce.get('editor-container')) {
           tempContentRef.current = window.tinymce.get('editor-container').getContent();
           window.tinymce.get('editor-container').remove();
        }
        window.tinymce.init({
          selector: '#editor-container',
          plugins: 'preview importcss searchreplace autolink autosave save directionality code visualblocks visualchars fullscreen image link media template codesample table charmap pagebreak nonbreaking anchor insertdatetime advlist lists wordcount help charmap quickbars emoticons',
          menubar: 'file edit view insert format tools table help',
          toolbar: 'fullscreen | undo redo | bold italic underline strikethrough | math | fontfamily fontsize blocks custom_lineheight | alignleft aligncenter alignright alignjustify | outdent indent | numlist bullist | forecolor backcolor removeformat | pagebreak | charmap emoticons | preview save print | insertfile image media template link anchor codesample | ltr rtl',
          font_size_formats: '8pt 9pt 10pt 11pt 12pt 13pt 14pt 15pt 16pt 17pt 18pt 20pt 22pt 24pt 26pt 28pt 32pt 36pt 40pt 48pt 60pt 72pt',
          toolbar_sticky: false,
          autosave_interval: '30s',
          height: '100%', 
          min_height: 600,
          content_css: [
            'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,700;1,400&family=Tinos:wght@400;700&family=Arimo:wght@400;700&display=swap'
          ],
          font_family_formats: 
            'Be Vietnam Pro=Be Vietnam Pro, sans-serif; ' +
            'Arimo (Arial)=Arimo, Arial, helvetica, sans-serif; ' +
            'Times New Roman=times new roman, times, serif; ' +
            'Tinos=Tinos, serif; ' +
            'Andale Mono=andale mono,times; ' +
            'Arial=arial,helvetica,sans-serif; ' +
            'Arial Black=arial black,avant garde; ' +
            'Book Antiqua=book antiqua,palatino; ' +
            'Comic Sans MS=comic sans ms,sans-serif; ' +
            'Courier New=courier new,courier; ' +
            'Georgia=georgia,palatino; ' +
            'Helvetica=helvetica; ' +
            'Impact=impact,chicago; ' +
            'Symbol=symbol; ' +
            'Tahoma=tahoma,arial,helvetica,sans-serif; ' +
            'Terminal=terminal,monaco; ' +
            'Trebuchet MS=trebuchet ms,geneva; ' +
            'Verdana=verdana,geneva; ' +
            'Webdings=webdings; ' +
            'Wingdings=wingdings,zapf dingbats',
          content_style: 'body { margin: 1.5rem; background-color: #ffffff; } @keyframes math-skeleton-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } .math-tex:not(.is-rendered):not(:has(.katex)) { display: inline-block !important; vertical-align: -0.15em; width: 3.75rem; height: 1.15em; margin: 0 0.25rem; border-radius: 4px; background: linear-gradient(90deg, #e2e8f0 20%, #f1f5f9 40%, #e2e8f0 60%); background-size: 200% 100%; animation: math-skeleton-shimmer 1.5s ease-in-out infinite; color: transparent !important; } .math-tex.is-rendered { opacity: 1; visibility: visible; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; } .math-tex.is-rendered::-webkit-scrollbar { width: 0; height: 0; background-color: rgba(0,0,0,0); } .katex-html { display: none !important; } .katex-mathml { display: inline-block !important; } .katex-display { display: block !important; width: 100% !important; overflow-x: auto !important; scrollbar-width: none !important; -ms-overflow-style: none !important; } .katex-display::-webkit-scrollbar { width: 0; height: 0; background-color: rgba(0,0,0,0); } #voice-interim { color: #94a3b8; background-color: #f1f5f9; padding: 0 2px; border-radius: 2px; }',
          branding: false,
          promotion: false,
          formats: {
            math_tex: { inline: 'span', classes: ['math-tex', 'not-prose'] },
            custom_lineheight: {
              selector: 'p,h1,h2,h3,h4,h5,h6,div,li,td,th,blockquote,pre',
              styles: { 'line-height': '%value' }
            }
          },
          color_map: [
            'e03e2d', 'Đỏ mặc định',
            '000000', 'Đen',
            '2dc26b', 'Xanh lá',
            'f1c40f', 'Vàng',
            'e67e22', 'Cam',
            '3498db', 'Xanh dương',
            '9b59b6', 'Tím',
            '7e8c8d', 'Xám',
            'ffffff', 'Trắng'
          ],
          text_patterns: autoFormat ? [
            {start: '*', end: '*', format: 'italic'},
            {start: '**', end: '**', format: 'bold'},
            {start: '#', format: 'h1'},
            {start: '##', format: 'h2'},
            {start: '###', format: 'h3'},
            {start: '1. ', cmd: 'InsertOrderedList'},
            {start: '- ', cmd: 'InsertUnorderedList'}
          ] : [],
          setup: (editor) => {
            // Function to hide KaTeX HTML inside editor
            const hideEditorKatexHTML = () => {
              const body = editor.getBody();
              if (!body) return;
              body.querySelectorAll('.katex-html').forEach(el => {
                el.style.setProperty('display', 'none', 'important');
              });
              body.querySelectorAll('.katex-mathml').forEach(el => {
                el.style.setProperty('display', 'inline-block', 'important');
                el.style.setProperty('position', 'static', 'important');
                el.style.setProperty('clip', 'auto', 'important');
                el.style.setProperty('width', 'auto', 'important');
                el.style.setProperty('height', 'auto', 'important');
                el.style.setProperty('overflow', 'visible', 'important');
              });
              
              // Show rendered math-tex elements in editor
              body.querySelectorAll('.math-tex').forEach(el => {
                el.classList.add('is-rendered');
                el.style.setProperty('opacity', '1', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
              });
            };

            editor.on('init NodeChange SetContent keyup', () => {
              hideEditorKatexHTML();
            });

            editor.ui.registry.addIcon('math', '<svg width="24" height="24" viewBox="0 0 24 24"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="serif" font-weight="bold" font-size="18" fill="currentColor">Σ</text></svg>');
            
            editor.ui.registry.addButton('math', {
              icon: 'math',
              tooltip: 'Nhập công thức toán học',
              onAction: () => {
                editor.windowManager.open({
                  title: 'Nhập công thức Toán học',
                  body: {
                    type: 'panel',
                    items: [
                      {
                        type: 'textarea',
                        name: 'latex',
                        label: 'Nhập mã LaTeX'
                      },
                      {
                        type: 'htmlpanel',
                        html: '<p style="font-size: 12px; color: #666;">Gợi ý: \\frac{a}{b} cho phân số, \\sqrt{x} cho căn bậc hai, x^{2} cho số mũ. </br><a href="https://latex.codecogs.com/eqneditor/editor.php" target="_blank" style="color: #4f46e5; text-decoration: underline;">Mở trình soạn thảo trực quan</a></p>'
                      }
                    ]
                  },
                  buttons: [
                    {
                      type: 'cancel',
                      text: 'Hủy'
                    },
                    {
                      type: 'submit',
                      text: 'Chèn',
                      primary: true
                    }
                  ],
                  onSubmit: (api) => {
                    const data = api.getData();
                    if (data.latex) {
                      editor.insertContent(`<span class="math-tex not-prose">$${data.latex}$</span>`);
                    }
                    api.close();
                  }
                });
              }
            });

            // Auto-wrap $...$ in span.math-tex
            editor.on('keyup', (e) => {
              if (e.key === '$') {
                const range = editor.selection.getRng();
                const container = range.startContainer;
                
                if (container.nodeType === 3) { // Text node
                  const text = container.data;
                  const offset = range.startOffset;
                  const textBefore = text.substring(0, offset);
                  
                  // Find the last '$' before the one just typed
                  const lastDollarIndex = textBefore.lastIndexOf('$', offset - 2);
                  
                  if (lastDollarIndex !== -1) {
                    // Check if the content between dollars is already wrapped
                    // We check the parent of the text node
                    let parent = container.parentNode;
                    let isAlreadyWrapped = false;
                    
                    if (parent && parent.classList && parent.classList.contains('math-tex')) {
                      isAlreadyWrapped = true;
                    }
                    
                    if (!isAlreadyWrapped) {
                      const newRange = editor.getDoc().createRange();
                      newRange.setStart(container, lastDollarIndex);
                      newRange.setEnd(container, offset);
                      editor.selection.setRng(newRange);
                      editor.formatter.apply('math_tex');
                      
                      // Move cursor to after the wrapped span
                      editor.selection.collapse(false);
                    }
                  }
                }
              }
            });

            // Removed auto-convert $...$ and $$...$$ to \(...\) and \[...\]
            // to keep raw LaTeX in the editor as requested.

            // Hàm áp dụng giãn dòng
            const applyLineHeight = (ed, val) => {
              if (!val) return;
              ed.undoManager.transact(() => {
                ed.formatter.apply('custom_lineheight', { value: val });
                const selectedNode = ed.selection.getNode();
                if (selectedNode) {
                  const block = ed.dom.getParent(selectedNode, ed.dom.isBlock) || selectedNode;
                  if (block && block !== ed.getBody()) {
                    ed.dom.setStyle(block, 'line-height', val);
                  }
                }
              });
              ed.nodeChanged();
            };

            editor.ui.registry.addIcon('custom-line-height', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6h11M10 12h11M10 18h11M4 5v14M2 7l2-2 2 2M2 17l2 2 2-2"/></svg>');

            editor.ui.registry.addMenuButton('custom_lineheight', {
              icon: 'custom-line-height',
              tooltip: 'Giãn dòng',
              fetch: (callback) => {
                const items = [
                  { type: 'menuitem', text: '1', onAction: () => applyLineHeight(editor, '1') },
                  { type: 'menuitem', text: '1.1', onAction: () => applyLineHeight(editor, '1.1') },
                  { type: 'menuitem', text: '1.2', onAction: () => applyLineHeight(editor, '1.2') },
                  { type: 'menuitem', text: '1.3', onAction: () => applyLineHeight(editor, '1.3') },
                  { type: 'menuitem', text: '1.4', onAction: () => applyLineHeight(editor, '1.4') },
                  { type: 'menuitem', text: '1.5', onAction: () => applyLineHeight(editor, '1.5') },
                  { type: 'menuitem', text: '2', onAction: () => applyLineHeight(editor, '2') },
                  {
                    type: 'menuitem',
                    text: 'Tuỳ chỉnh',
                    onAction: () => {
                      editor.windowManager.open({
                        title: 'Giãn dòng',
                        body: {
                          type: 'panel',
                          items: [
                            {
                              type: 'input',
                              name: 'lineheight',
                              placeholder: 'Nhập mức giãn dòng'
                            }
                          ]
                        },
                        buttons: [
                          {
                            type: 'submit',
                            text: 'Áp dụng',
                            primary: true
                          }
                        ],
                        onSubmit: (api) => {
                          const data = api.getData();
                          if (data.lineheight && data.lineheight.trim()) {
                            applyLineHeight(editor, data.lineheight.trim());
                          }
                          api.close();
                        }
                      });
                    }
                  }
                ];
                callback(items);
              }
            });

            // Lắng nghe sự kiện Fullscreen của TinyMCE
            editor.on('FullscreenStateChanged', (e) => {
              if (e.state) {
                if (!isSystemTogglingFullscreenRef.current) {
                  isManualFullscreenRef.current = true;
                }
              } else {
                if (autoFullscreenTriggeredRef.current) {
                  autoFullscreenTriggeredRef.current = false;
                  userExitedAutoFullscreenRef.current = true;
                }
                if (isManualFullscreenRef.current) {
                  isManualFullscreenRef.current = false;
                }
              }
            });

            editor.on('init', () => {
              const contentToLoad = tempContentRef.current !== null ? tempContentRef.current : (currentNode && currentNode.content);
              if (contentToLoad) editor.setContent(contentToLoad);
              setEditorReady(true);
              tempContentRef.current = null;

              // Chặn zoom trình duyệt trong iframe TinyMCE
              const win = editor.getWin();
              if (win) {
                win.addEventListener('keydown', (e) => {
                  if (e.ctrlKey || e.metaKey) {
                    if (['+', '-', '=', '_', '0'].includes(e.key) || 
                        ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(e.code)) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }
                }, { capture: true, passive: false });
                win.addEventListener('wheel', (e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }, { capture: true, passive: false });
              }
            });
            editor.on('change keyup', () => { tempContentRef.current = editor.getContent(); });
          }
        });
      };
      setTimeout(initTinyMCE, 100);
    } else {
      if (window.tinymce && window.tinymce.get('editor-container')) window.tinymce.get('editor-container').remove();
      setEditorReady(false);
      tempContentRef.current = null;
    }
    return () => {
      shouldListenRef.current = false;
      if (window.tinymce && window.tinymce.get('editor-container')) {
        tempContentRef.current = window.tinymce.get('editor-container').getContent();
        window.tinymce.get('editor-container').remove();
      }
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [isEditingContent, autoFormat]);

  // Tự động bật Fullscreen khi cuộn làm khuất thanh công cụ TinyMCE
  useEffect(() => {
    if (!isEditingContent) {
      autoFullscreenTriggeredRef.current = false;
      userExitedAutoFullscreenRef.current = false;
      isManualFullscreenRef.current = false;
      return;
    }

    const handleScroll = () => {
      if (!window.tinymce) return;
      const editor = window.tinymce.get('editor-container');
      if (!editor || !editor.getContainer()) return;

      const container = editor.getContainer();
      const headerEl = container.querySelector('.tox-editor-header') || container;
      const rect = headerEl.getBoundingClientRect();
      const isFullscreen = editor.plugins && editor.plugins.fullscreen ? editor.plugins.fullscreen.isFullscreen() : false;

      if (isFullscreen) return;
      if (isManualFullscreenRef.current) return;

      if (userExitedAutoFullscreenRef.current) {
        // Chỉ tự Fullscreen nữa nếu đã cuộn ngược lên để thấy HOÀN TOÀN thanh công cụ và cuộn xuống tiếp
        if (rect.top >= 60 && rect.bottom <= window.innerHeight) {
          userExitedAutoFullscreenRef.current = false;
          autoFullscreenTriggeredRef.current = false;
        }
        return;
      }

      // Khi cuộn lên mà thanh công cụ không thấy nữa
      if (rect.bottom <= 60) {
        if (!autoFullscreenTriggeredRef.current) {
          autoFullscreenTriggeredRef.current = true;
          isSystemTogglingFullscreenRef.current = true;
          editor.execCommand('mceFullScreen');
          setTimeout(() => {
            isSystemTogglingFullscreenRef.current = false;
          }, 150);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isEditingContent]);

  const processSmartText = (text, editor) => {
     if (!text) return '';
    let processed = text.trim();
    const replacements = [
        { key: /(xuống dòng)/gi, val: '<br/>' }, 
        { key: /(chấm hết)/gi, val: '.' },
        { key: /(gạch đầu dòng)/gi, val: '-' },
        { key: /(chấm phẩy)/gi, val: ';' },
        { key: /( hai chấm)/gi, val: ':' },
        { key: /(chấm hỏi)/gi, val: '?' },
        { key: /(chấm than)/gi, val: '!' },
        { key: /(phần trăm)/gi, val: '%' },
        { key: /(mở ngoặc đơn)/gi, val: '(' },
        { key: /(đóng ngoặc đơn)/gi, val: ')' },
        { key: /(mở ngoặc kép)/gi, val: '"' },
        { key: /(đóng ngoặc kép)/gi, val: '"' },
        { key: /(mũi tên phải)/gi, val: '→' },
        { key: /(mũi tên trái)/gi, val: '←' },
        { key: /(suy ra)/gi, val: '⇒' },
        { key: /(chấm)/gi, val: '. ' }, 
        { key: /( phẩy)/gi, val: ',' },
        { key: /(cộng)/gi, val: '+' },
        { key: /(trừ)/gi, val: '-' }
    ];
    replacements.forEach(({key, val}) => { processed = processed.replace(key, val); });
    const properNouns = ["Việt Nam", "Hà Nội", "Hồ Chí Minh", "Sài Gòn", "Đà Nẵng", "Cần Thơ", "Hải Phòng", "Huế", "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
    properNouns.forEach(word => { processed = processed.replace(new RegExp(`\\b${word}\\b`, 'gi'), word); });
    processed = processed.replace(/\s+([.,;?!%)\]}])/g, '$1');
    const rng = editor.selection.getRng();
    let needsCap = false;
    if (rng.startOffset === 0) {
        const node = editor.selection.getNode();
        if (node.nodeName === 'LI' || (node.innerText && node.innerText.trim().length === 0)) needsCap = true;
    } else {
        const textContent = rng.startContainer.textContent || "";
        const prevContext = textContent.slice(Math.max(0, rng.startOffset - 3), rng.startOffset).trim();
        const prevChar = textContent.charAt(rng.startOffset - 1);
        if (['.', '!', '?', '\n'].includes(prevChar) || prevContext.endsWith('.') || prevContext.endsWith('!') || prevContext.endsWith('?')) needsCap = true;
        if (prevChar === '-' || prevContext.endsWith('-')) needsCap = true;
    }
    if (needsCap && processed && processed.length > 0 && !processed.startsWith('<br')) processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    processed = processed.replace(/([.?!])\s*([a-zà-ỹ])/g, (match, p1, p2) => p1 + ' ' + p2.toUpperCase());
    return processed;
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      shouldListenRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { alert("Trình duyệt không hỗ trợ nhập liệu bằng giọng nói."); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      shouldListenRef.current = true;
      const resetSilenceTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            shouldListenRef.current = false;
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
        }, 30000);
      };
      recognition.onstart = () => { setIsListening(true); resetSilenceTimer(); };
      recognition.onend = () => {
        if (shouldListenRef.current) { try { recognition.start(); } catch (e) { setIsListening(false); shouldListenRef.current = false; } return; }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        setIsListening(false);
        const editor = window.tinymce.get('editor-container');
        if (editor) { const existingInterim = editor.dom.select('span#voice-interim')[0]; if (existingInterim) editor.dom.remove(existingInterim); }
      };
      recognition.onerror = (event) => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { shouldListenRef.current = false; setIsListening(false); } };
      recognition.onresult = (event) => {
        resetSilenceTimer();
        const editor = window.tinymce.get('editor-container');
        if (!editor) return;
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < (event.results ? event.results.length : 0); ++i) {
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript; else interimChunk += event.results[i][0].transcript;
        }
        if (finalChunk) {
            const existingInterim = editor.dom.select('span#voice-interim')[0];
            if (existingInterim) editor.dom.remove(existingInterim);
            const smartText = processSmartText(finalChunk, editor);
            const suffix = smartText.endsWith(' ') || smartText.endsWith('<br/>') ? '' : ' ';
            editor.execCommand('mceInsertContent', false, smartText + suffix);
        }
        if (interimChunk) {
            const existingInterim = editor.dom.select('span#voice-interim')[0];
            if (existingInterim) existingInterim.innerText = interimChunk;
            else editor.execCommand('mceInsertContent', false, `<span id="voice-interim">${interimChunk}</span>`);
        } else {
            const existingInterim = editor.dom.select('span#voice-interim')[0];
            if (existingInterim) editor.dom.remove(existingInterim);
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleNavigate = (id, targetNodeParam = null) => {
    if (isSorting) return;
    try {
      sessionStorage.setItem('nav_dir', 'right');
      const targetNode = (targetNodeParam && typeof targetNodeParam === 'object' && typeof targetNodeParam.type === 'string') 
        ? targetNodeParam 
        : (Array.isArray(allNodes) ? allNodes.find(n => n.id === id) : null);
      if (id && targetNode && typeof targetNode.type === 'string') {
        sessionStorage.setItem(`node_type_${id}`, targetNode.type);
      }
    } catch {}
    const prefix = mode === 'edit' ? '/edit' : '/view';
    let path = id ? `${prefix}/${id}` : prefix;
    if (location.search) path += location.search;
    navigate(path);
  };

  const handleCreate = (type) => {
    setModalMode('CREATE');
    setTargetType(type);
    setEditingNode({ parentId: nodeId || null, orderIndex: (children && children.length > 0) ? Math.max(...children.map(c => c.orderIndex || 0)) + 1 : 0 });
    setIsModalOpen(true);
  };
  const handleEditTitle = (node) => { setModalMode('UPDATE'); setTargetType(node.type); setEditingNode(node); setIsModalOpen(true); };
  const toggleContentEditor = () => setIsEditingContent(true);

  const displayLessonContent = useMemo(() => {
    if (!currentNode?.content) return '';
    return normalizeMathSpans(currentNode.content);
  }, [currentNode?.id, currentNode?.content]);

  const skeletonLessonContent = useMemo(() => {
    if (!displayLessonContent) return '';
    return generateLessonSkeletonHtml(displayLessonContent);
  }, [displayLessonContent]);

  const handleSaveContent = async () => {
    const editor = window.tinymce.get('editor-container');
    if (editor) {
      setSaving(true);
      const existingInterim = editor.dom.select('span#voice-interim')[0];
      if (existingInterim) editor.dom.remove(existingInterim);
      
      // Get raw content and normalize math spans
      let newContent = editor.getContent();
      newContent = normalizeMathSpans(newContent);
      
      try {
        const updatedNode = { ...currentNode, content: newContent };
        setAllNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
        await apiService.saveNode(updatedNode);
        setIsEditingContent(false);
        await fetchData(true); 
      } catch (e) { alert("Lỗi khi lưu nội dung!"); } finally { setSaving(false); }
    }
  };
  const handleDelete = async (node) => { if (window.confirm(`Bạn có chắc muốn xóa "${node.title}"?`)) { await apiService.deleteNode(node.id); fetchData(true); } };
  const handleSaveModal = async (data) => { await apiService.saveNode(data); fetchData(true); };
  const handleChangePassword = async (newPass) => { const success = await apiService.changePassword(newPass); if (success) sessionStorage.setItem('auth_pass', newPass); return success; };
  const handleLogout = () => { sessionStorage.removeItem('auth_pass'); navigate('/view'); };
  const handleSaveOrder = async () => {
    setSaving(true);
    const updates = children.map((node) => ({ id: node.id, parentId: node.parentId, orderIndex: node.orderIndex }));
    await apiService.batchUpdateNodes(updates);
    setSaving(false); setIsSorting(false); await fetchData(true); 
  };
  const handleStartMove = (node) => setMovingNode(node);
  const handleCancelMove = () => setMovingNode(null);
  const handlePasteNode = async () => {
    if (!movingNode) return;
    if (movingNode.id === nodeId) { alert("Không thể di chuyển thư mục vào chính nó."); return; }
    setLoading(true);
    const maxOrder = (children && children.length > 0) ? Math.max(...children.map(c => c.orderIndex || 0)) : -1;
    const updates = [{ id: movingNode.id, parentId: nodeId || null, orderIndex: maxOrder + 1 }];
    await apiService.batchUpdateNodes(updates);
    setMovingNode(null); await fetchData(true); setLoading(false);
  };
  const increaseFontSize = () => {
    setViewFontSize(prev => {
      const next = Math.min(prev + 2, 74);
      try { localStorage.setItem('user_view_font_size', String(next)); } catch {}
      return next;
    });
  };
  const decreaseFontSize = () => {
    setViewFontSize(prev => {
      const next = Math.max(prev - 2, 8);
      try { localStorage.setItem('user_view_font_size', String(next)); } catch {}
      return next;
    });
  };
  const resetFontSize = () => {
    setViewFontSize(18);
    try { localStorage.setItem('user_view_font_size', '18'); } catch {}
  };
  const allowedChildTypes = ALLOWED_CHILDREN[currentNode ? currentNode.type : NodeType.ROOT] || [];

  const renderCategorySkeleton = () => {
    const headerAppClasses = isAppMode 
      ? (!nodeId 
          ? `p-3 rounded-full text-center items-center justify-center` 
          : `p-6 border-l-[4px] border-l-indigo-500 rounded-tl-none rounded-bl-none rounded-tr-[35px] rounded-br-[35px] text-left items-start justify-start`)
      : '';

    return html`
      <div>
        <header key="category-skeleton-header" className=${`mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 ${isAppMode ? `mt-6 border ${headerAppClasses} ${isLiquid ? 'bg-white/40 backdrop-blur-sm border-white/20 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}` : 'px-2'}`}>
          <div key="category-skeleton-title-container" className=${isAppMode ? 'w-full flex items-center justify-between' : 'flex items-end justify-between w-full'}>
            <div>
              ${!isAppMode && html`
                <h2 key="category-skeleton-label" className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <span className="inline-block h-4 w-20 bg-slate-200/80 rounded-full animate-pulse align-middle"></span>
                </h2>
              `}
              <h1 key="category-skeleton-title" className=${`${isAppMode ? 'text-xl md:text-2xl' : 'text-3xl md:text-5xl'} font-sans font-bold leading-tight`}>
                <span className=${`inline-block ${isAppMode ? 'h-7 md:h-8 w-44 md:w-60' : 'h-8 md:h-12 w-60 md:w-80'} bg-slate-200/80 rounded-2xl animate-pulse align-middle`}></span>
              </h1>
            </div>
          </div>
        </header>

        <div key="category-skeleton-list" className="grid grid-cols-1 gap-4">
          ${[0, 1, 2].map((idx) => {
            const titleWidth = idx === 0 
              ? (isAppMode ? 'w-48' : 'w-48 md:w-64') 
              : (idx === 1 ? (isAppMode ? 'w-36' : 'w-40 md:w-52') : (isAppMode ? 'w-52' : 'w-56 md:w-72'));

            return html`
              <div 
                key=${`category-skeleton-item-${idx}`}
                className=${`flex items-center justify-between ${
                  isAppMode 
                    ? `rounded-xl py-5 px-5 border ${isLiquid ? 'bg-white/40 backdrop-blur-sm border-white/20' : 'bg-white border-slate-200 shadow-sm'}` 
                    : `relative rounded-3xl p-6 border overflow-hidden ${isLiquid ? 'backdrop-blur-md bg-white/40 border-white/60 shadow-glass' : 'bg-white border-slate-200 shadow-sm'}`
                }`}
              >
                <div className="relative flex items-center gap-5 flex-1 overflow-hidden z-10">
                  <div className=${`flex-shrink-0 animate-pulse ${
                    isAppMode 
                      ? 'w-6 h-6 rounded-lg bg-indigo-100/70' 
                      : 'p-4 rounded-2xl shadow-inner bg-indigo-100/50 border border-indigo-200/50 w-[58px] h-[58px]'
                  }`}></div>
                  
                  <div className="min-w-0 flex-1 space-y-2">
                    ${!isAppMode && html`
                      <div>
                        <span className="inline-block h-3 w-16 bg-slate-200/70 rounded-full animate-pulse align-middle"></span>
                      </div>
                    `}
                    
                    <h3 className=${`font-sans font-bold ${isAppMode ? 'text-base md:text-lg' : 'text-lg md:text-xl'} leading-tight`}>
                      <span className=${`inline-block h-[1.25em] bg-slate-200/80 rounded-lg animate-pulse align-middle ${titleWidth}`}></span>
                    </h3>
                  </div>
                </div>

                ${!isAppMode && html`
                  <div className="w-10 h-10 rounded-full bg-slate-100/60 flex items-center justify-center animate-pulse ml-2 flex-shrink-0">
                    <div className="w-4 h-4 bg-slate-200/60 rounded-full"></div>
                  </div>
                `}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  };

  const renderLessonSkeleton = () => {
    const containerStyle = isLiquid 
      ? 'bg-white/50 backdrop-blur-xl rounded-[2.5rem] shadow-glass border border-white/50 ring-1 ring-white/60'
      : 'bg-white rounded-3xl shadow-sm border border-slate-200';
    
    const headerStyle = isLiquid
      ? 'border-b border-white/30 bg-white/40 backdrop-blur-md sticky top-0'
      : 'border-b border-slate-100 bg-white sticky top-0';

    return html`
      <div key="lesson-skeleton-wrapper" className="w-full">
        <div className=${`${containerStyle} overflow-hidden min-h-[700px] flex flex-col relative`}>
          <div className=${`px-6 md:px-12 py-6 md:py-8 flex justify-between items-start z-20 ${headerStyle}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                ${!isAppMode && html`
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-400 uppercase tracking-widest animate-pulse">
                    ${NODE_LABELS[NodeType.LESSON]}
                  </span>
                `}
              </div>
              <h1 className="text-2xl md:text-4xl font-serif font-bold leading-tight">
                <span className="inline-block h-[1.2em] w-48 md:w-80 bg-slate-200/80 rounded-2xl animate-pulse align-middle"></span>
              </h1>
            </div>
          </div>

          <div className=${`relative flex flex-col min-h-[500px] ${isLiquid ? 'bg-white/30' : 'bg-white'}`}>
            <div className="px-6 md:px-12 pt-6 md:pt-8 pb-8 md:pb-12 space-y-5 w-full">
              <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
              <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
              <div className="h-5 bg-slate-200/80 rounded-md w-1/2 animate-pulse"></div>
              <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
              <div className="h-5 bg-slate-200/80 rounded-md w-2/3 animate-pulse"></div>
              <div className="h-5 bg-slate-200/80 rounded-md w-4/5 animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="mt-8 px-4">
          <div className="h-10 w-28 bg-slate-200/80 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    `;
  };

  const renderMainContent = () => {
    if (error) {
      return html`<${StatusPage} type=${error} />`;
    }

    const checkIsLesson = () => {
      if (!nodeId) return false;
      if (currentNode) return currentNode.type === NodeType.LESSON;
      if (Array.isArray(allNodes) && allNodes.length > 0) {
        const found = allNodes.find(n => n.id === nodeId);
        if (found) return found.type === NodeType.LESSON;
      }
      try {
        const sessionType = sessionStorage.getItem(`node_type_${nodeId}`);
        if (sessionType) return sessionType === NodeType.LESSON;
      } catch {}
      try {
        const cached = localStorage.getItem('cached_nodes');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const node = parsed.find(n => n.id === nodeId);
            if (node) return node.type === NodeType.LESSON;
          }
        }
      } catch {}
      return false;
    };

    if (loading && (!Array.isArray(allNodes) || allNodes.length === 0 || (!currentNode && nodeId))) {
      return checkIsLesson() ? renderLessonSkeleton() : renderCategorySkeleton();
    }

    if (currentNode?.type === NodeType.LESSON) {
        // NON-LIQUID STYLES: Solid white, reduced shadow, no transparency
        const containerStyle = isLiquid 
            ? 'bg-white/50 backdrop-blur-xl rounded-[2.5rem] shadow-glass border border-white/50 ring-1 ring-white/60'
            : 'bg-white rounded-3xl shadow-sm border border-slate-200';
        
        const headerStyle = isLiquid
            ? 'border-b border-white/30 bg-white/40 backdrop-blur-md sticky top-0'
            : 'border-b border-slate-100 bg-white sticky top-0';

        return html`
            <div key="lesson-container" className=${`${containerStyle} overflow-hidden min-h-[700px] flex flex-col relative`}>
              <div className=${`px-6 md:px-12 py-6 md:py-8 flex justify-between items-start z-20 ${headerStyle}`}>
                <div key="lesson-header-info" className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    ${!isAppMode && html`
                        <span key="lesson-type-badge" className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-indigo-500 to-violet-500 text-white uppercase tracking-widest shadow-md shadow-indigo-500/20">
                          ${NODE_LABELS[NodeType.LESSON]}
                        </span>
                    `}
                  </div>
                  <div key="title-box" className="relative flex items-center">
                    <h1 
                      ref=${marqueeTitleRef}
                      className=${`font-serif font-bold text-slate-900 leading-tight drop-shadow-sm whitespace-normal ${isAppMode ? 'text-2xl md:text-3xl' : (isMultiLine ? 'text-xl md:text-3xl' : 'text-2xl md:text-4xl')}`}
                      style=${selectNoneStyle}
                    >
                      ${hasMath && !isMathRendered ? html`
                        <span 
                          className="inline rounded-xl bg-slate-200/85 text-transparent select-none animate-pulse box-decoration-clone px-1 py-0.5"
                          style=${{
                            WebkitBoxDecorationBreak: 'clone',
                            boxDecorationBreak: 'clone',
                            userSelect: 'none',
                            color: 'transparent',
                            textShadow: 'none'
                          }}
                        >
                          ${currentNode.title}
                        </span>
                      ` : (currentNode.title)}
                    </h1>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  ${mode === 'edit' && !isEditingContent && html`
                     <div key="edit-actions" className="flex gap-3">
                      <button key="btn-edit-title" onClick=${() => handleEditTitle(currentNode)} className=${`px-4 py-2 text-slate-600 rounded-xl font-sans text-sm font-bold transition-all border ${isLiquid ? 'hover:bg-white/60 hover:text-indigo-600 border-transparent hover:border-white/50 hover:shadow-sm' : 'hover:bg-slate-50 border-slate-200'}`}>Sửa tên</button>
                      <button key="btn-open-editor" onClick=${toggleContentEditor} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 border border-white/20"><${LayoutGrid} size=${18} /> Soạn thảo</button>
                    </div>
                  `}
                </div>
                ${mode === 'edit' && isEditingContent && html`
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div key="voice-controls" className=${`flex items-center rounded-xl p-1 mr-2 border shadow-sm ${isLiquid ? 'bg-white/50 backdrop-blur border-white/50' : 'bg-white border-slate-200'}`}>
                       <button key="btn-voice" onClick=${toggleVoiceInput} className=${`p-2 rounded-lg transition-all flex items-center gap-2 ${isListening ? 'bg-red-500 text-white shadow-md animate-pulse' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'}`}>${isListening ? html`<${MicOff} key="mic-off" size=${18} />` : html`<${Mic} key="mic-on" size=${18} />`}</button>
                       <div key="sep-1" className="h-6 w-px bg-slate-300 mx-1"></div>
                       <select key="lang-select" value=${voiceLang} onChange=${(e) => setVoiceLang(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer" disabled=${isListening}><option value="vi-VN">VN</option><option value="en-US">EN</option></select>
                       <div key="sep-2" className="h-6 w-px bg-slate-300 mx-1"></div>
                       <button key="btn-autoformat" onClick=${() => setAutoFormat(!autoFormat)} className=${`p-2 rounded-lg transition-all ${autoFormat ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400'}`}><${Wand2} size=${18} /></button>
                    </div>
                    <button key="btn-cancel" onClick=${() => { setIsEditingContent(false); if(recognitionRef.current) recognitionRef.current.stop(); shouldListenRef.current = false; }} className="px-4 py-2 text-slate-600 hover:bg-white/60 rounded-xl text-sm font-bold transition-colors border border-transparent hover:border-white/50"><${X} size=${18} /> Hủy</button>
                    <button key="btn-save" onClick=${handleSaveContent} disabled=${saving} className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 border border-white/20">${saving ? html`<${Loader2} key="loader-icon" size=${18} className="animate-spin"/>` : html`<${Save} key="save-icon" size=${18} />`} ${saving ? 'Đang lưu...' : 'Lưu bài'}</button>
                  </div>
                `}
              </div>
              
              <div className="flex-1 relative flex flex-col h-full">
                ${isEditingContent ? html`
                  <div className="bg-white/80 select-text flex-1 flex flex-col h-full min-h-[600px]">
                    <textarea id="editor-container" className="w-full h-full flex-1"></textarea>
                  </div>
                ` : html`
                  <div className=${`relative flex flex-col min-h-[500px] ${isLiquid ? 'bg-white/30' : 'bg-white'}`}>
                      ${(!displayLessonContent && loading) ? html`
                        <div key="lesson-empty-loading-skeleton" className="px-6 md:px-12 pt-6 md:pt-8 pb-8 md:pb-12 space-y-5 w-full">
                          <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
                          <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
                          <div className="h-5 bg-slate-200/80 rounded-md w-1/2 animate-pulse"></div>
                          <div className="h-5 bg-slate-200/80 rounded-md w-full animate-pulse"></div>
                          <div className="h-5 bg-slate-200/80 rounded-md w-2/3 animate-pulse"></div>
                          <div className="h-5 bg-slate-200/80 rounded-md w-4/5 animate-pulse"></div>
                        </div>
                      ` : (hasMath && !isMathRendered ? html`
                        <div 
                          key="math-skeleton-content" 
                          style=${isZoomEnabledForMode ? {
                            '--lesson-font-size': `${viewFontSize}pt`,
                            '--lesson-scale': `${viewFontSize / 18}`,
                            zoom: `${viewFontSize / 18}`,
                            fontSize: `${viewFontSize}pt`
                          } : {}}
                          className=${`lesson-content-skeleton ${isZoomEnabledForMode ? 'has-zoom' : ''} px-6 md:px-12 pt-6 md:pt-8 pb-8 md:pb-12 prose prose-slate max-w-none leading-relaxed select-none pointer-events-none relative`}
                          dangerouslySetInnerHTML=${{ __html: skeletonLessonContent }}
                        ></div>
                      ` : null)}
                      <div 
                        ref=${lessonContentRef}
                        style=${isZoomEnabledForMode ? {
                          '--lesson-font-size': `${viewFontSize}pt`,
                          '--lesson-scale': `${viewFontSize / 18}`,
                          zoom: `${viewFontSize / 18}`,
                          fontSize: `${viewFontSize}pt`
                        } : {}}
                        className=${`lesson-content ${isZoomEnabledForMode ? 'has-zoom' : ''} px-6 md:px-12 pt-6 md:pt-8 pb-8 md:pb-12 prose prose-slate max-w-none leading-relaxed prose-a:text-indigo-600 prose-img:rounded-2xl prose-img:shadow-xl select-text transition-opacity duration-200 ${(!displayLessonContent && loading) || (hasMath && !isMathRendered) ? 'invisible opacity-0 pointer-events-none absolute inset-x-0 top-0 -z-10 max-h-0 overflow-hidden' : 'visible opacity-100 relative'}`}
                        dangerouslySetInnerHTML=${{ __html: displayLessonContent || '<div class="flex flex-col items-center justify-center py-32 opacity-40"><div class="w-16 h-16 bg-white/50 rounded-full mb-4 shadow-sm"></div><p class="font-serif italic text-xl text-slate-600">Chưa có nội dung bài học.</p></div>' }}
                      ></div>
                  </div>
                `}
              </div>
            </div>
            <div key="back-button-container" className="mt-8 px-4">
               <button key="btn-back" onClick=${() => handleNavigate(currentNode.parentId)} className=${`group text-slate-600 hover:text-indigo-600 flex items-center gap-2 font-sans text-sm transition-colors font-bold px-5 py-2.5 rounded-2xl inline-flex border ${isLiquid ? 'hover:bg-white/50 hover:shadow-glass backdrop-blur-sm border-transparent hover:border-white/50' : 'bg-white shadow-sm border-slate-200 hover:bg-slate-50'}`}><div key="icon-bg" className="p-1 rounded-full bg-slate-200/50 group-hover:bg-indigo-100 transition-colors"><${ArrowLeft} key="icon" size=${16} /></div> Quay lại</button>
            </div>
        `;
    }

    const headerAppClasses = isAppMode 
      ? (!currentNode 
          ? `p-3 rounded-full text-center items-center justify-center` 
          : `p-6 border-l-[4px] border-l-indigo-500 rounded-tl-none rounded-bl-none rounded-tr-[35px] rounded-br-[35px] text-left items-start justify-start`)
      : '';

    return html`
      <header key="explorer-header" className=${`mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 ${isAppMode ? `mt-6 border ${headerAppClasses} ${isLiquid ? 'bg-white/40 backdrop-blur-sm border-white/20 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}` : 'px-2'}`}>
        <div key="header-title-container" className=${isAppMode ? 'w-full flex items-center justify-between' : 'flex items-end justify-between w-full'}>
          <div>
            ${!isAppMode && html`<h2 key="node-label" className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2"><div key="label-dot" className="w-8 h-1 bg-indigo-500 rounded-full"></div> ${currentNode ? NODE_LABELS[currentNode.type] : 'Trang chủ'}</h2>`}
            <h1 
              key="main-title" 
              ref=${titleRef} 
              className=${`${isAppMode ? 'text-xl md:text-2xl' : 'text-3xl md:text-5xl'} ${currentNode?.type === 'lesson' ? 'font-serif' : 'font-sans'} font-bold text-slate-900 leading-tight drop-shadow-sm`}
            >
              ${currentNode ? currentNode.title : 'Danh sách môn học'}
            </h1>
          </div>
        </div>
        
        ${mode === 'edit' && !isAppMode && !nodeId && html`
           <div key="edit-actions" className=${`flex items-center gap-2 p-1.5 rounded-2xl border ${isLiquid ? 'bg-white/40 backdrop-blur-md border-white/50 shadow-glass' : 'bg-white border-slate-200 shadow-sm'}`}>
             <button key="btn-pass" onClick=${() => setIsPasswordModalOpen(true)} className="px-4 py-2 text-slate-600 hover:text-indigo-600 hover:bg-white/60 rounded-xl text-sm font-bold transition-all flex items-center gap-2"><${KeyRound} size=${16} /> Đổi mật khẩu</button>
             <button key="btn-settings" onClick=${() => navigate('/edit/settings')} className="px-4 py-2 text-slate-600 hover:text-indigo-600 hover:bg-white/60 rounded-xl text-sm font-bold transition-all flex items-center gap-2"><${Settings} size=${16} /> Cài đặt</button>
             <div key="sep" className="w-px h-6 bg-slate-300 mx-1"></div>
             <button key="btn-logout" onClick=${handleLogout} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-all flex items-center gap-2"><${LogOut} size=${16} /> Đăng xuất</button>
           </div>
        `}
      </header>

      ${movingNode && html`
        <div key="moving-node-bar" className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-10">
            <div key="moving-bar-inner" className="max-w-xl mx-auto bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700/50 backdrop-blur-xl">
                <div key="moving-info" className="flex items-center gap-3">
                    <div key="moving-icon" className="p-2 bg-indigo-500 rounded-lg"><${ClipboardList} size=${20} /></div>
                    <div key="moving-text">
                        <p className="text-sm font-bold text-slate-200">Đang di chuyển: <span className="text-white">${movingNode.title}</span></p>
                        <p className="text-xs text-slate-400">Đến: ${currentNode ? currentNode.title : 'Thư mục gốc'}</p>
                    </div>
                </div>
                <div key="moving-actions" className="flex items-center gap-2">
                    <button key="btn-cancel-move" onClick=${handleCancelMove} className="px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl text-sm font-bold transition-colors">Hủy</button>
                    <button key="btn-paste" onClick=${handlePasteNode} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/50 flex items-center gap-2"><${CornerDownRight} size=${16} /> Dán vào đây</button>
                </div>
            </div>
        </div>
      `}

      ${mode === 'edit' && allowedChildTypes && allowedChildTypes.length > 0 && !isSorting && html`
        <div key="edit-controls" className="mb-8 flex flex-wrap gap-3">
          ${allowedChildTypes.map(type => html`
            <button
              key=${`add-${type}`}
              onClick=${() => handleCreate(type)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 hover:shadow-indigo-500/50 transition-all text-sm font-bold border-t border-white/20"
            >
              <${Plus} size=${18} strokeWidth=${3} />
              Thêm ${NODE_LABELS[type]}
            </button>
          `)}
          ${children && children.length > 1 && html`
            <button key="btn-sort" onClick=${() => setIsSorting(true)} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-indigo-600 transition-all text-sm font-bold ml-auto shadow-sm">
                <${ArrowUpDown} size=${18} /> Sắp xếp
            </button>
          `}
        </div>
      `}
      
      ${isSorting && html`
        <div key="sorting-controls" className="mb-6 flex items-center justify-between bg-indigo-50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in">
            <div key="sorting-info" className="flex items-center gap-3">
                <div key="sorting-icon" className="p-2 bg-indigo-100 rounded-xl text-indigo-600"><${ArrowUpDown} size=${20} /></div>
                <div key="sorting-text">
                    <h3 className="font-bold text-indigo-900">Chế độ sắp xếp</h3>
                    <p className="text-xs text-indigo-600">Kéo thả các mục để thay đổi vị trí</p>
                </div>
            </div>
            <div key="sorting-actions" className="flex gap-2">
                <button key="btn-cancel-sort" onClick=${() => { setIsSorting(false); fetchData(); }} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm">Hủy</button>
                <button key="btn-save-sort" onClick=${handleSaveOrder} disabled=${saving} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    ${saving ? html`<${Loader2} className="animate-spin" size=${16} />` : html`<${Save} size=${16} />`} Lưu vị trí
                </button>
            </div>
        </div>
      `}

      ${(!children || children.length === 0) ? html`
        <div key="empty-state" className=${`text-center py-24 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center ${isLiquid ? 'bg-white/20 border-white/40 shadow-glass' : 'bg-white border-slate-200'}`}>
          <div key="empty-icon-container" className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <${ListIcon} key="empty-icon" className="text-slate-300" size=${40} />
          </div>
          <p key="empty-text" className="text-slate-500 font-bold text-lg mb-1">Chưa có mục nào ở đây.</p>
          ${mode === 'edit' && html`<p key="empty-hint" className="text-sm text-slate-400 font-medium">Hãy thêm mục mới để bắt đầu hành trình học tập.</p>`}
        </div>
      ` : html`
        <div key="nodes-list" ref=${sortableListRef} className="grid grid-cols-1 gap-4">
          ${children.map(node => html`
            <${NodeItem} 
              key=${node.id}
              node=${node}
              isEditMode=${mode === 'edit'}
              isSorting=${isSorting}
              isAppMode=${isAppMode}
              uiStyle=${isLiquid ? 'liquid' : 'normal'}
              onClick=${() => handleNavigate(node.id, node)}
              onEdit=${handleEditTitle}
              onDelete=${handleDelete}
              onStartMove=${handleStartMove}
            />
          `)}
        </div>
      `}
    `;
  };

  return html`
    <div className="w-full mx-auto relative min-h-screen">
      <div className="px-2 pb-20">
         ${renderMainContent()}
      </div>

      ${canShowZoom && html`
        <div key="zoom-controls" className="fixed bottom-8 right-6 flex flex-col gap-2 z-40 animate-in slide-in-from-right-10">
            <button key="btn-zoom-in" title="Phóng to cỡ chữ (+2pt)" onClick=${increaseFontSize} className=${`p-3 border text-indigo-600 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60 shadow-glass hover:shadow-glass-hover' : 'bg-white border-slate-200 shadow-md hover:bg-slate-50'}`}><${Plus} size=${24} /></button>
            <div key="zoom-level" onClick=${resetFontSize} title="Cỡ chữ hiện tại. Nhấn để đặt lại 18pt" className=${`cursor-pointer border text-slate-600 font-bold text-xs py-1 px-2 rounded-lg text-center shadow-sm select-none transition-transform hover:scale-105 active:scale-95 ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60' : 'bg-white border-slate-200'}`}>${viewFontSize}pt</div>
            <button key="btn-zoom-out" title="Thu nhỏ cỡ chữ (-2pt)" onClick=${decreaseFontSize} className=${`p-3 border text-slate-600 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60 shadow-glass hover:shadow-glass-hover' : 'bg-white border-slate-200 shadow-md hover:bg-slate-50'}`}><${Minus} size=${24} /></button>
        </div>
      `}

      <${EditorModal} 
        isOpen=${isModalOpen}
        mode=${modalMode}
        targetType=${targetType}
        initialData=${editingNode}
        onClose=${() => setIsModalOpen(false)}
        onSave=${handleSaveModal}
        uiStyle=${isLiquid ? 'liquid' : 'normal'}
      />
      
      <${ChangePasswordModal}
        isOpen=${isPasswordModalOpen}
        onClose=${() => setIsPasswordModalOpen(false)}
        onSave=${handleChangePassword}
        uiStyle=${isLiquid ? 'liquid' : 'normal'}
      />
    </div>
  `;
};
