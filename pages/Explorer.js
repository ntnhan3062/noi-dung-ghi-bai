
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
  const [viewFontSize, setViewFontSize] = useState(16);
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

  const selectNoneStyle = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    WebkitTouchCallout: 'none'
  };

  const currentNode = useMemo(() => allNodes.find(n => n.id === nodeId), [allNodes, nodeId]);

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

  // Check Zoom availability: Must be LESSON type AND enabled in config
  const canShowZoom = currentNode?.type === NodeType.LESSON && (uiConfig?.zoom ? (
      (isAppMode && uiConfig.zoom.app) ||
      (mode === 'edit' && uiConfig.zoom.edit) ||
      (mode === 'view' && !isAppMode && uiConfig.zoom.view)
  ) : true);

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
    
    // Rendering lock to prevent concurrent calls
    let isRendering = false;

    const renderMath = () => {
      if (isRendering) return;
      
      const contentElement = lessonContentRef.current || document.querySelector('.lesson-content');
      if (!contentElement) {
        return;
      }

      const hasKatex = typeof katex !== 'undefined' || !!window.katex;
      const hasRender = typeof renderMathInElement !== 'undefined' || !!window.renderMathInElement;

      if (hasKatex && hasRender) {
        isRendering = true;
        const renderFunc = window.renderMathInElement || renderMathInElement;
        console.log('KaTeX: Rendering content in element:', contentElement);
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

          setIsMathRendered(true);
          console.log('KaTeX: Render successful and HTML hidden via JS.');
        } catch (err) {
          console.error('KaTeX: Render error:', err);
          setIsMathRendered(true); // Show content even on error
        } finally {
          // Release lock after a short delay to ensure DOM is stable
          setTimeout(() => { isRendering = false; }, 100);
        }
      } else {
        console.warn('KaTeX: SDK components missing. hasKatex:', hasKatex, 'hasRender:', hasRender);
        // Retry after a short delay if components are missing
        setTimeout(() => {
          renderMath();
        }, 500);
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
        renderMath();
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
      if (observer) observer.disconnect();
      clearInterval(retryInterval);
    };
  }, [currentNode?.content, isEditingContent, viewFontSize, nodeId]);

  useEffect(() => {
    if (currentNode?.type === NodeType.LESSON) {
        if (lastInitializedLessonId.current !== currentNode.id) {
            if (currentNode.content) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(currentNode.content, 'text/html');
                    const elementWithFontSize = doc.querySelector('[style*="font-size"]');
                    if (elementWithFontSize) {
                        const style = elementWithFontSize.style.fontSize;
                        if (style) {
                            const match = style.match(/(\d+(\.\d+)?)(pt|px)/);
                            if (match) {
                                let size = parseFloat(match[1]);
                                const unit = match[3];
                                if (unit === 'px') size = size * 0.75;
                                if (!isNaN(size) && size > 5) setViewFontSize(Math.round(size));
                            }
                        }
                    } else { setViewFontSize(16); }
                } catch (e) { setViewFontSize(16); }
            } else { setViewFontSize(16); }
            lastInitializedLessonId.current = currentNode.id;
        }
    } else { lastInitializedLessonId.current = null; }
  }, [currentNode]);

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
          toolbar: 'undo redo | bold italic underline strikethrough | math | fontfamily fontsize blocks | alignleft aligncenter alignright alignjustify | outdent indent |  numlist bullist | forecolor backcolor removeformat | pagebreak | charmap emoticons | fullscreen  preview save print | insertfile image media template link anchor codesample | ltr rtl',
          toolbar_sticky: true,
          autosave_interval: '30s',
          height: '75vh', 
          min_height: 700,
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
            math_tex: { inline: 'span', classes: ['math-tex', 'not-prose'] }
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

            editor.on('init', () => {
              const contentToLoad = tempContentRef.current !== null ? tempContentRef.current : (currentNode && currentNode.content);
              if (contentToLoad) editor.setContent(contentToLoad);
              setEditorReady(true);
              tempContentRef.current = null;
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

  const handleNavigate = (id) => {
    if (isSorting) return;
    try {
      sessionStorage.setItem('nav_dir', 'right');
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
  const increaseFontSize = () => setViewFontSize(prev => Math.min(prev + 4, 74));
  const decreaseFontSize = () => setViewFontSize(prev => Math.max(prev - 4, 6));
  const allowedChildTypes = ALLOWED_CHILDREN[currentNode ? currentNode.type : NodeType.ROOT] || [];

  const renderMainContent = () => {
    if (error) {
      return html`<${StatusPage} type=${error} />`;
    }

    if (loading && (!Array.isArray(allNodes) || allNodes.length === 0)) {
        return html`
          <div className="w-full max-w-5xl mx-auto space-y-6 animate-pulse p-4">
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded-full w-24"></div>
              <div className="h-8 bg-slate-200 rounded-full w-2/3 md:w-1/3"></div>
            </div>
            
            <div className=${`p-6 md:p-10 rounded-[2rem] border ${isLiquid ? 'bg-white/30 border-white/40 shadow-glass' : 'bg-white border-slate-200 shadow-sm'} space-y-6`}>
              <div className="h-6 bg-slate-200 rounded-full w-3/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 rounded-full w-full"></div>
                <div className="h-4 bg-slate-200 rounded-full w-5/6"></div>
                <div className="h-4 bg-slate-200 rounded-full w-4/6"></div>
              </div>
              
              <div className="pt-6 space-y-4">
                <div className="h-4 bg-slate-200 rounded-full w-full"></div>
                <div className="h-4 bg-slate-200 rounded-full w-11/12"></div>
                <div className="h-4 bg-slate-200 rounded-full w-3/4"></div>
              </div>

              <div className="pt-6 space-y-4">
                <div className="h-4 bg-slate-200 rounded-full w-5/6"></div>
                <div className="h-4 bg-slate-200 rounded-full w-4/6"></div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-spin border-2 border-slate-200 border-t-indigo-500"></div>
              <span className="text-sm font-sans font-bold text-slate-400">Đang chuẩn bị nội dung...</span>
            </div>
          </div>
        `;
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
                      ${currentNode.title}
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
              
              <div className="flex-1 relative flex flex-col">
                ${isEditingContent ? html`
                  <div className="bg-white/80 select-text min-h-[600px]">
                    <textarea id="editor-container" className="w-full"></textarea>
                  </div>
                ` : html`
                  <div className=${`relative flex flex-col min-h-[500px] ${isLiquid ? 'bg-white/30' : 'bg-white'}`}>
                      <div 
                        ref=${lessonContentRef}
                        className="lesson-content p-6 md:p-14 prose prose-slate max-w-none leading-loose prose-a:text-indigo-600 prose-img:rounded-2xl prose-img:shadow-xl select-text"
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
              onClick=${() => handleNavigate(node.id)}
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
      <!-- Content -->
      <div className="px-2 pb-20">
         ${renderMainContent()}
      </div>

      <!-- Floating Zoom Controls -->
      ${canShowZoom && html`
        <div key="zoom-controls" className="fixed bottom-8 right-6 flex flex-col gap-2 z-40 animate-in slide-in-from-right-10">
            <button key="btn-zoom-in" onClick=${increaseFontSize} className=${`p-3 border text-indigo-600 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60 shadow-glass hover:shadow-glass-hover' : 'bg-white border-slate-200 shadow-md hover:bg-slate-50'}`}><${Plus} size=${24} /></button>
            <div key="zoom-level" className=${`border text-slate-600 font-bold text-xs py-1 px-2 rounded-lg text-center shadow-sm select-none ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60' : 'bg-white border-slate-200'}`}>${viewFontSize}pt</div>
            <button key="btn-zoom-out" onClick=${decreaseFontSize} className=${`p-3 border text-slate-600 rounded-2xl transition-all hover:scale-110 active:scale-95 ${isLiquid ? 'bg-white/80 backdrop-blur-md border-white/60 shadow-glass hover:shadow-glass-hover' : 'bg-white border-slate-200 shadow-md hover:bg-slate-50'}`}><${Minus} size=${24} /></button>
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
