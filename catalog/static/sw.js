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
