// picker_automation.js

const waitFor = (sel, t = 10000) =>
  new Promise((ok, bad) => {
    const mo = new MutationObserver(() => {
      const el = document.querySelector(sel);
      if (el) {
        mo.disconnect();
        ok(el);
      }
    });
    mo.observe(document, { childList: true, subtree: true });
    setTimeout(() => (mo.disconnect(), bad("timeout")), t);
  });

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "PICKER_SELECT_FILES") return;

  const { driveFiles } = msg;

  // 1. Select each row by its data-id (populated by Drive picker)
  for (const f of driveFiles) {
    const row = await waitFor(`div[data-id="${f.id}"]`);
    const cb = row.querySelector('[role="checkbox"]');
    if (cb?.getAttribute("aria-checked") !== "true") cb.click();
  }

  // 2. Click the "Insert" button
  const insert = await waitFor('button[textContent="Select"], button[textContent="Insert"]');
  insert.click();
}); 