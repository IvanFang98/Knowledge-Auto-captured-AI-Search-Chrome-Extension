// notebooklm-proxy.js

console.log('notebooklm-proxy.js loaded');

// Relay MAIN world results to the extension
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'NOTEBOOKLM_API_RESULT') return;
  chrome.runtime.sendMessage({
    type: 'NOTEBOOKLM_API_RESULT_RELAY',
    requestId: event.data.requestId,
    data: event.data.data,
    error: event.data.error
  });
}); 