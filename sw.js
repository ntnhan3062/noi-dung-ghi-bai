const CACHE_NAME = 'noi-dung-ghi-bai-v6';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'index.css',
  'index.js',
  'App.js',
  'utils/html.js',
  'services/apiService.js',
  'context/BreadcrumbContext.js',
  'context/ClassContext.js',
  'context/LayoutErrorContext.js',
  'components/Breadcrumbs.js',
  'components/ChangePasswordModal.js',
  'components/EditorModal.js',
  'components/ErrorBoundary.js',
  'components/InitialLoadingScreen.js',
  'components/NodeItem.js',
  'components/SettingsModal.js',
  'components/StatusPage.js',
  'pages/AuthGuard.js',
  'pages/ClassManagementPage.js',
  'pages/Explorer.js',
  'pages/SettingsPage.js'
];

// Install Service Worker and cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell & static assets');
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn('[Service Worker] Asset skip (not found or bundled):', url);
          });
        })
      );
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate & clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch events helper: Stale-While-Revalidate for JS/CSS/CDN assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const scope = self.registration.scope;

  // Bypass API calls, let them fetch from network normally
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle SPA navigation requests: Fallback to cached index.html or scope path if offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        console.log('[Service Worker] Offline fallback to index.html for navigation:', url.pathname);
        return caches.match(new URL('index.html', scope).href) || caches.match(scope);
      })
    );
    return;
  }

  // Dynamic caching for external CDN assets like ESM.sh, Google Fonts, TinyMCE, KaTeX
  const isCDN = url.origin.includes('esm.sh') || 
                url.origin.includes('cdnjs.cloudflare.com') || 
                url.origin.includes('fonts.googleapis.com') || 
                url.origin.includes('fonts.gstatic.com') || 
                url.origin.includes('cdn.jsdelivr.net');

  // Check if it matches any of local cached assets
  const isLocalAsset = ASSETS_TO_CACHE.some(asset => {
    const assetUrl = new URL(asset, scope).href;
    return request.url === assetUrl;
  });

  if (isLocalAsset) {
    // Network-First strategy for local app assets: Always get latest code from server, fallback to cache when offline
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  if (isCDN) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchedResponse = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('[Service Worker] CDN Network fetch failed for:', url.pathname, err);
            return null;
          });

          return cachedResponse || fetchedResponse;
        });
      })
    );
  }
});
