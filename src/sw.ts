/// <reference lib="WebWorker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const appShellHandler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [
      /^\/api\/todoist/,
      /^\/files\//,
      /^https:\/\/api\.todoist\.com\//,
      /^https:\/\/script\.google\.com\//,
      /^https:\/\/accounts\.google\.com\//,
      /^https:\/\/oauth2\.googleapis\.com\//,
    ],
  }),
)

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-assets-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 180, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET' && url.origin === 'https://sheets.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-sheets-read-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET' && url.origin === 'https://cdn.jsdelivr.net',
  new StaleWhileRevalidate({
    cacheName: 'public-cdn-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  }),
)

registerRoute(
  ({ url }) => url.origin === 'https://api.todoist.com' || url.pathname.startsWith('/api/todoist'),
  new NetworkOnly(),
)

registerRoute(
  ({ request, url }) => request.method !== 'GET' && url.origin === 'https://script.google.com',
  new NetworkOnly(),
)

registerRoute(
  ({ request, url }) =>
    request.method !== 'GET' &&
    (url.origin === 'https://accounts.google.com' || url.origin === 'https://oauth2.googleapis.com'),
  new NetworkOnly(),
)
