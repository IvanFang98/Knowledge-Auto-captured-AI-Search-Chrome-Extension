// Reset NotebookLM Debugging Script
// This will clear the console and reset fetch monitoring

console.clear(); // Clear the console mess

// Restore original fetch if it was overridden
if (window.originalFetch) {
  window.fetch = window.originalFetch;
  console.log('✅ Restored original fetch');
} else {
  console.log('⚠️ No backup found, you may need to reload the page');
}

// Restore original XMLHttpRequest if it was overridden
if (window.originalXHROpen) {
  XMLHttpRequest.prototype.open = window.originalXHROpen;
  XMLHttpRequest.prototype.send = window.originalXHRSend;
  console.log('✅ Restored original XMLHttpRequest');
}

console.log('🔄 Debug monitoring reset. Page reload recommended.');
console.log('');
console.log('Next steps:');
console.log('1. Reload this NotebookLM page (Ctrl+R or Cmd+R)');
console.log('2. Then paste the NEW focused debugging script');

// --- NOTEBOOKLM MAIN WORLD FETCH PROXY ---

async function importToNotebookLM(notebookId, urls) {
  // ... [paste the entire function content here]
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('🔥 Global error in popup:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 Unhandled promise rejection in popup:', event.reason);
}); 