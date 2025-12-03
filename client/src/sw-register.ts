if ('serviceWorker' in navigator) {
  const isHttpsLocalhost = window.location.protocol === 'https:' && window.location.hostname === 'localhost';
  const shouldRegister = window.isSecureContext && !isHttpsLocalhost;

  if (shouldRegister) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration falhou:', err);
      });
    });
  } else {
    console.info('Service Worker registration ignorado para este contexto.');
  }
}
