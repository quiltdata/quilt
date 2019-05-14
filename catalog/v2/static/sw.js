/* sw.js */
/* eslint-disable no-restricted-globals */
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', () => {
  self.clients.claim().then(() => {
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      windowClients.forEach((windowClient) => {
        windowClient.navigate(windowClient.url);
      });
    });
  });
});
/* eslint-enable no-restricted-globals */
