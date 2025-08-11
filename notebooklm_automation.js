// Disable non-critical console output in production
(function() {
  const c = globalThis.console;
  if (!c) return;
  const noop = function() {};
  try {
    c.log = noop;
    c.info = noop;
    c.debug = noop;
    c.trace = noop;
  } catch (_) {}
})();

// === CRITICAL: NOTEBOOKLM AUTOMATION SCRIPT ===
// 
// WARNING: This is a critical automation script that has been broken multiple times.
// DO NOT modify this file without thorough testing and understanding of the workflow.
//
// WORKFLOW OVERVIEW:
// 1. Navigate to Sources tab (NOT Studio tab)
// 2. Click "+ Add" button in Sources tab
// 3. Wait for dialog to appear
// 4. Click URL/Web option in dialog
// 5. Find URL input field
// 6. Paste article URL
// 7. Click Insert/Submit button
// 8. Wait for completion
//
// CRITICAL REQUIREMENTS:
// - ALWAYS navigate to Sources tab first (this prevents Studio tab issues)
// - NEVER click generic "Add" buttons (they open Studio tab)
// - ALWAYS wait for elements to be ready before clicking
// - Use multiple fallback methods for element detection
//
// notebooklm_automation.js - Based on proven NLM_YT_automator pattern

// Prevent multiple executions of this script
if (window.notebooklmAutomationLoaded) {
  console.log("NotebookLM automation script already loaded, skipping...");
} else {
  window.notebooklmAutomationLoaded = true;
  
  // === GLOBAL STATE ===
  let stopAutomationSignal = false;
  let isAutomationRunning = false;
  
  console.log("NotebookLM Content Script Loaded");

  // === INITIALIZATION ===
  console.log("NotebookLM: Content script starting...");
  
  // Set global flag to indicate script is ready
  window.notebooklmAutomationReady = true;

  // Add indicator that script loaded
  // Wait for DOMContentLoaded to ensure we can add the indicator
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addIndicator);
  } else {
    addIndicator();
  }
  function addIndicator() {
    // Add progress indicator
    if (!document.getElementById('notebooklm-automation-indicator')) {
      // If body doesn't exist yet, wait for it
      if (!document.body) {
        // Wait for document.body
        setTimeout(addIndicator, 100);
        return;
      }
      // Create indicator element (invisible marker for readiness)
      const indicator = document.createElement('div');
      indicator.id = 'notebooklm-automation-indicator';
      indicator.style.cssText = `
        position: fixed; top: -99999px; left: -99999px; width: 0; height: 0;
        opacity: 0; pointer-events: none; overflow: hidden; z-index: -1;
      `;
      indicator.textContent = '';
      document.body.appendChild(indicator);
      // Indicator added
      
      // Make indicator persistent for injection process
      // Only remove after a longer delay or when injection is complete
      setTimeout(() => {
        const indicator = document.getElementById('notebooklm-automation-indicator');
        if (indicator && !window.isAutomationRunning) {
          indicator.remove();
          // Indicator removed
        }
      }, 30000); // Keep for 30 seconds instead of 3
    } else {
      // Indicator already exists
    }
  }

  // Add progress indicator for injection
  function addProgressIndicator() {
    if (!document.getElementById('knowledge-capture-progress-indicator')) {
      // If body doesn't exist yet, wait for it
      if (!document.body) {
        // Wait for document.body
        setTimeout(addProgressIndicator, 100);
        return;
      }
      const progressIndicator = document.createElement('div');
      progressIndicator.id = 'knowledge-capture-progress-indicator';
      progressIndicator.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10001;
        background: rgba(0, 0, 0, 0.9); color: white; padding: 20px; border-radius: 10px;
        font-family: Arial, sans-serif; font-size: 14px; text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 300px;
      `;
      progressIndicator.innerHTML = `
        <div style="margin-bottom: 15px; font-size: 24px;">🧠</div>
        <div style="font-weight: 600; margin-bottom: 10px;">Knowledge Auto-captured & AI Search Auto-Injection</div>
        <div style="margin-bottom: 15px;">Adding articles to NotebookLM...</div>
        <div style="background: #333; height: 4px; border-radius: 2px; overflow: hidden;">
          <div id="knowledge-capture-progress-bar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">Please wait, do not close this tab</div>
      `;
      document.body.appendChild(progressIndicator);
    }
  }

  // Update progress bar
  function updateProgress(percentage) {
    const progressBar = document.getElementById('knowledge-capture-progress-bar');
    if (progressBar) {
      progressBar.style.width = percentage + '%';
    }
  }

  // Remove progress indicator
  function removeProgressIndicator() {
    const progressIndicator = document.getElementById('knowledge-capture-progress-indicator');
    if (progressIndicator) {
      progressIndicator.remove();
    }
  }
  
  if (document.body) {
    addIndicator();
  } else {
    document.addEventListener('DOMContentLoaded', addIndicator);
  }

  // === SELECTORS ===
  const SELECTORS = {
    addSourceButton: 'button[aria-label="Add"], button[aria-label="Add source"], button[aria-label="Add sources"], button.add-button, button.add-source-button, button[data-testid="add"], button[data-testid="add-source"], button[data-testid="add-sources"], [role="button"][aria-label="Add"], [role="button"][aria-label="Add source"], [role="button"][aria-label="Add sources"]',
    urlInput: 'input[formcontrolname="newUrl"], input[placeholder*="URL"], input[placeholder*="url"], input[type="url"], input[placeholder*="link"], input[placeholder*="Link"], input[placeholder*="web"], input[placeholder*="Web"], input[placeholder*="http"], textarea[placeholder*="URL"], textarea[placeholder*="url"], input[type="text"], textarea[placeholder*="Paste"], textarea[placeholder*="paste"], input[placeholder*="Enter URL"], input[placeholder*="enter URL"], input[aria-label*="URL"], input[aria-label*="url"], textarea[aria-label*="URL"], textarea[aria-label*="url"], input[data-testid*="url"], textarea[data-testid*="url"], input[name*="url"], textarea[name*="url"]',
    submitButton: 'button[type="submit"], button[aria-label="Insert"], button[aria-label="Add"], button[aria-label="Submit"], button[aria-label="Save"], button[title*="Insert"], button[title*="Add"], button[title*="Submit"], button[title*="Save"], button[data-testid*="insert"], button[data-testid*="submit"], button[data-testid*="add"], button[data-testid*="save"], [role="button"][aria-label*="Insert"], [role="button"][aria-label*="Add"], [role="button"][aria-label*="Submit"], [role="button"][aria-label*="Save"]',
  };

  // === HELPER FUNCTIONS ===

  function waitForElement(selector, parent = document, timeout = 7000) {
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
        try {
          const element = parent.querySelector(selector);
              if (element && element.offsetParent !== null) {
                  clearInterval(interval);
                  resolve(element);
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
            reject(new Error(`Timeout: Element "${selector}" not found or not visible after ${timeout}ms.`));
          }
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            clearInterval(interval);
                  reject(new Error(`Timeout: Element "${selector}" not found or not visible after ${timeout}ms.`));
              }
        }
      }, 50);
      });
  }

  function waitForElementToDisappear(selector, parent = document, timeout = 7000) {
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
        try {
          const element = parent.querySelector(selector);
              if (!element || element.offsetParent === null) {
                  clearInterval(interval);
                  resolve();
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  reject(new Error(`Timeout: Element "${selector}" did not disappear after ${timeout}ms.`));
              }
        } catch (error) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
      });
  }

  async function findDialogContainer(timeout = 10000) {
          const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const dialogSelectors = [
        'mat-dialog-container', '[role="dialog"]', '.dialog', '.modal', 
        '[data-testid*="dialog"]', '[data-testid*="modal"]', '[aria-modal="true"]',
        '.MuiDialog-root', '.MuiModal-root', '[class*="dialog"]', '[class*="modal"]',
        '.overlay', '.popup', '[class*="overlay"]', '[class*="popup"]'
      ];

      for (const selector of dialogSelectors) {
        try {
          const dialogContainer = document.querySelector(selector);
          if (dialogContainer && dialogContainer.offsetParent !== null) {
            return dialogContainer;
                          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      await delay(100);
    }
    throw new Error('Dialog container not found after multiple attempts');
  }

  function findUrlChip(searchContext, timeout = 5000) {
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
        // Strategy 1: Look for buttons with URL-related aria-labels
        let urlChip = searchContext.querySelector('button[aria-label*="URL"], button[aria-label*="url"], button[aria-label*="Web"], button[aria-label*="web"], button[aria-label*="Link"], button[aria-label*="link"], button[aria-label*="Website"], button[aria-label*="website"]');
              
        // Strategy 2: Look for buttons with URL-related text content
              if (!urlChip) {
          const allButtons = searchContext.querySelectorAll('button, [role="button"], mat-chip, .chip, [data-testid*="url"], [data-testid*="web"], [data-testid*="link"]');
                  urlChip = Array.from(allButtons).find(btn => {
                      const text = btn.textContent?.toLowerCase() || '';
                      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            const dataTestId = btn.getAttribute('data-testid')?.toLowerCase() || '';
            return (text.includes('url') || text.includes('web') || text.includes('link') || text.includes('website') ||
                    ariaLabel.includes('url') || ariaLabel.includes('web') || ariaLabel.includes('link') || ariaLabel.includes('website') ||
                    dataTestId.includes('url') || dataTestId.includes('web') || dataTestId.includes('link')) &&
                   btn.offsetParent !== null;
                  });
              }
              
        // Strategy 3: Look for any clickable element that might work
              if (!urlChip) {
          const allClickable = searchContext.querySelectorAll('button, [role="button"], mat-chip, .chip');
          const visibleClickable = Array.from(allClickable).filter(el => el.offsetParent !== null);
          
          if (visibleClickable.length > 0) {
            urlChip = visibleClickable.find(el => {
                      const text = el.textContent?.toLowerCase() || '';
              const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
              return !text.includes('close') && !text.includes('cancel') && !text.includes('×') && 
                     !ariaLabel.includes('close') && !ariaLabel.includes('cancel');
            }) || visibleClickable[0];
          }
              }
              
              if (urlChip) {
                  clearInterval(interval);
                  resolve(urlChip);
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  reject(new Error(`Timeout: URL chip not found after ${timeout}ms.`));
              }
      }, 100);
      });
  }

  async function typeIntoInput(inputElement, text) {
      if (stopAutomationSignal) throw new Error("Automation stopped by user during typeIntoInput.");
      inputElement.focus();
      inputElement.value = text;
      inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
  }

  function delay(ms) {
      return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, ms);
          const intervalId = setInterval(() => {
              if (stopAutomationSignal) {
                  clearTimeout(timeoutId);
                  clearInterval(intervalId);
                  reject(new Error("Automation stopped by user during delay."));
              }
          }, 100);
          setTimeout(() => clearInterval(intervalId), ms);
      });
  }

  function findUrlInputFallback(container) {
      const allInputs = container.querySelectorAll('input, textarea');
      
    // First priority: Look for URL-specific inputs
      for (const input of allInputs) {
          const placeholder = (input.placeholder || '').toLowerCase();
          const type = (input.type || '').toLowerCase();
          const formcontrolname = (input.getAttribute('formcontrolname') || '').toLowerCase();
          const className = (input.className || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const name = (input.name || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const dataTestId = (input.getAttribute('data-testid') || '').toLowerCase();
      const visible = input.offsetParent !== null;
      
      if (visible && (placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('web') || 
          placeholder.includes('http') || placeholder.includes('paste') || placeholder.includes('enter') ||
          type === 'url' || formcontrolname.includes('url') || formcontrolname.includes('link') ||
          className.includes('url') || className.includes('link') || className.includes('web') ||
          id.includes('url') || id.includes('link') || id.includes('web') ||
          name.includes('url') || name.includes('link') || name.includes('web') ||
          ariaLabel.includes('url') || ariaLabel.includes('link') || ariaLabel.includes('web') ||
          dataTestId.includes('url') || dataTestId.includes('link') || dataTestId.includes('web'))) {
              return input;
          }
      }
      
    // Second priority: Look for any text input that's visible and not disabled
    for (const input of allInputs) {
      const visible = input.offsetParent !== null;
      const disabled = input.disabled || input.readOnly;
      const type = (input.type || '').toLowerCase();
      
      if (visible && !disabled && (type === 'text' || type === 'url' || input.tagName === 'TEXTAREA')) {
        return input;
      }
    }
    
    // Third priority: Any input that's visible
    for (const input of allInputs) {
      const visible = input.offsetParent !== null;
      const disabled = input.disabled || input.readOnly;
      
      if (visible && !disabled) {
        return input;
      }
  }

    // Last resort: Any input at all
    return allInputs.length > 0 ? allInputs[0] : null;
  }

  function findSubmitButtonFallback(container) {
    const allButtons = container.querySelectorAll('button, [role="button"]');
    
    // First priority: Look for buttons with submit-related text content
    for (const button of allButtons) {
      const textContent = (button.textContent || '').toLowerCase().trim();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.title || '').toLowerCase();
      const dataTestId = (button.getAttribute('data-testid') || '').toLowerCase();
      const className = (button.className || '').toLowerCase();
      const visible = button.offsetParent !== null;
      
      if (visible && (
        textContent.includes('insert') || textContent.includes('add') || textContent.includes('submit') || textContent.includes('save') ||
        ariaLabel.includes('insert') || ariaLabel.includes('add') || ariaLabel.includes('submit') || ariaLabel.includes('save') ||
        title.includes('insert') || title.includes('add') || title.includes('submit') || title.includes('save') ||
        dataTestId.includes('insert') || dataTestId.includes('add') || dataTestId.includes('submit') || dataTestId.includes('save') ||
        className.includes('submit') || className.includes('insert') || className.includes('add') || className.includes('save')
      )) {
        return button;
      }
    }
    
    // Second priority: Look for primary buttons (often styled as submit buttons)
    for (const button of allButtons) {
      const className = (button.className || '').toLowerCase();
      const visible = button.offsetParent !== null;
      const disabled = button.disabled;
      
      if (visible && !disabled && (
        className.includes('primary') || className.includes('cta') || className.includes('submit') ||
        button.type === 'submit'
      )) {
        return button;
      }
    }
    
    // Third priority: Any visible, enabled button
    for (const button of allButtons) {
      const visible = button.offsetParent !== null;
      const disabled = button.disabled;
      
      if (visible && !disabled) {
        return button;
      }
    }
    
    // Last resort: Any button at all
    return allButtons.length > 0 ? allButtons[0] : null;
  }

  // === MESSAGE HANDLING ===
  console.log("NotebookLM: Setting up message listener...");
  
  if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("NotebookLM: Received message:", message);
    
      if (message.type === "AUTOMATE_ADD_ARTICLES" || message.type === "ADD_ARTICLES_AS_SOURCES") {
      console.log("NotebookLM: Starting article automation...");
      addArticlesAsSources(message.articles || []);
      sendResponse({ status: "started", data: "Article automation started" });
      } else if (message.type === "CHECK_INJECTION_STATUS") {
        console.log("NotebookLM: Status check requested, isAutomationRunning:", isAutomationRunning);
        // Send current status
        const status = isAutomationRunning ? "in_progress" : "completed";
        const response = { 
          status: status,
          isRunning: isAutomationRunning,
          data: isAutomationRunning ? "Automation in progress..." : "Automation completed"
        };
        console.log("NotebookLM: Sending status response:", response);
        try {
          sendResponse(response);
        } catch (error) {
          console.log("NotebookLM: Could not send status response:", error.message);
        }
    } else if (message.action === "STOP_NOTEBOOKLM_AUTOMATION") {
      console.log("Received STOP_NOTEBOOKLM_AUTOMATION signal.");
      stopAutomationSignal = true;
      sendResponse({ status: "stopped", data: "Automation stopped by user" });
    }
    
      return true;
    });
    console.log("NotebookLM: Message listener set up successfully");
      } else {
    console.error("NotebookLM: chrome.runtime.onMessage not available");
  }
  
  // Log that content script is fully initialized
  console.log("NotebookLM: Content script fully initialized and ready");

  // === MAIN AUTOMATION FUNCTION ===
  async function addArticlesAsSources(articles) {
    // === CRITICAL: DO NOT MODIFY THIS WORKFLOW ===
    // This function implements the NotebookLM Sources tab automation
    // The workflow order and logic are critical for success
    
      if (isAutomationRunning) {
          console.log('NotebookLM: Automation already running, skipping duplicate request');
          chrome.runtime.sendMessage({ 
              status: "skipped", 
              data: "Automation already running, skipping duplicate request", 
              type: "NOTEBOOKLM_AUTOMATION_STATUS" 
          });
          return;
      }
      
      isAutomationRunning = true;
    // Start batch automation
    
    // Safety timeout to prevent infinite "in progress" state
    const safetyTimeout = setTimeout(() => {
      console.log('NotebookLM: Safety timeout triggered - resetting automation state');
      isAutomationRunning = false;
      chrome.runtime.sendMessage({ 
        status: "timeout", 
        data: "Automation safety timeout triggered", 
        type: "NOTEBOOKLM_AUTOMATION_STATUS" 
      });
    }, 120000); // 2 minutes
      
    // Add progress indicator
    addProgressIndicator();
    updateProgress(10);
    
    try {
      chrome.runtime.sendMessage({ status: "progress", data: `Starting to add ${articles.length} articles as sources in batch...`, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
      await delay(200);

      // Filter out duplicates
      const uniqueArticles = [];
          const addedUrls = new Set();

      for (const article of articles) {
        if (!addedUrls.has(article.url)) {
          uniqueArticles.push(article);
          addedUrls.add(article.url);
        } else {
          // Skip duplicate article
                  chrome.runtime.sendMessage({ 
                      status: "article_skipped", 
                      data: `Skipped duplicate: "${article.title.substring(0, 30)}..."`, 
                      type: "NOTEBOOKLM_AUTOMATION_STATUS",
                      reason: "duplicate_url"
                  });
        }
      }

      if (uniqueArticles.length === 0) {
        console.log('NotebookLM: No unique articles to add');
        chrome.runtime.sendMessage({ 
          status: "completed", 
          data: "No unique articles to add", 
          type: "NOTEBOOKLM_AUTOMATION_STATUS",
          total_processed: articles.length,
          total_added: 0,
          total_skipped: articles.length
        });
        removeProgressIndicator();
        return;
      }

      // Process unique articles
      updateProgress(20);

      try {
        // 1. First, ensure we're in the Sources tab
        // Ensure we're in the Sources tab
        updateProgress(30);
        
        let sourcesTab = document.querySelector('button[aria-label="Sources"], button[data-testid="sources-tab"], [role="tab"][aria-label="Sources"]');
        
        if (!sourcesTab) {
          const allTabs = document.querySelectorAll('button, [role="tab"]');
          for (const tab of allTabs) {
            const text = tab.textContent?.trim() || '';
            if (text === 'Sources') {
              sourcesTab = tab;
              break;
            }
          }
        }
        
        if (sourcesTab) {
          const isActive = sourcesTab.getAttribute('aria-selected') === 'true' || 
                         sourcesTab.classList.contains('active') || 
                         sourcesTab.classList.contains('selected') ||
                         sourcesTab.style.backgroundColor ||
                         sourcesTab.style.borderBottom;
          
          if (!isActive) {
            // Activate Sources tab
            sourcesTab.click();
            await delay(1000);
          } else {
            // Sources tab already active
          }
        } else {
          // Sources tab not found, continuing
        }
        
        updateProgress(40);
        
        // 2. Now click the "+ Add" button in the Sources tab
        console.log('NotebookLM: Looking for + Add button in Sources tab...');
        
        const allButtons = document.querySelectorAll('button, [role="button"]');
        let addSourceBtn = null;
        
        for (const btn of allButtons) {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const dataTestId = btn.getAttribute('data-testid') || '';
          const className = btn.className || '';
          const visible = btn.offsetParent !== null;
          
          if (visible && (
            text === '+ Add' ||
            text === 'Add' ||
            (text.includes('+') && text.includes('Add')) ||
            ariaLabel === 'Add' ||
            ariaLabel === 'Add source' ||
            ariaLabel === 'Add sources' ||
            dataTestId === 'add' ||
            dataTestId === 'add-source' ||
            dataTestId === 'add-sources' ||
            className.includes('add-button') ||
            className.includes('add-source')
          )) {
            console.log('NotebookLM: Found + Add button:', btn);
            addSourceBtn = btn;
            break;
          }
        }
        
        if (!addSourceBtn) {
          console.log('NotebookLM: No + Add button found, trying general selector...');
          addSourceBtn = await waitForElement(SELECTORS.addSourceButton, document, 7000);
        }
        
                  console.log('NotebookLM: Found Add source button:', addSourceBtn);
                  addSourceBtn.click();
                  console.log('NotebookLM: Clicked Add source button');
        await delay(500);
        updateProgress(50);

        // 3. In the modal, find and click the "URL" or "Web" chip
                  console.log('NotebookLM: Looking for dialog container...');
        
        const dialogContainer = await findDialogContainer(10000);
                  console.log('NotebookLM: Found dialog container:', dialogContainer);
                  
                  console.log('NotebookLM: Looking for URL chip...');
                  let urlButtonInModal;
                  try {
                    urlButtonInModal = await findUrlChip(dialogContainer, 5000);
                    console.log('NotebookLM: Found URL chip:', urlButtonInModal);
                  } catch (error) {
                    console.log('NotebookLM: URL chip not found, trying fallback...');
          
          const allClickable = dialogContainer.querySelectorAll('button, [role="button"], mat-chip, .chip, [tabindex], [onclick]');
                    const visibleClickable = Array.from(allClickable).filter(el => el.offsetParent !== null);
                    
                    if (visibleClickable.length > 0) {
            urlButtonInModal = visibleClickable.find(el => {
              const text = el.textContent?.toLowerCase() || '';
              const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
              return !text.includes('close') && !text.includes('cancel') && !text.includes('×') && 
                     !ariaLabel.includes('close') && !ariaLabel.includes('cancel');
            }) || visibleClickable[0];
            
            console.log('NotebookLM: Using fallback option:', urlButtonInModal.textContent);
                    } else {
                      throw new Error('No clickable options found in dialog');
                    }
                  }
                  
                  urlButtonInModal.click();
                  console.log('NotebookLM: Clicked URL chip');
        await delay(300);
        updateProgress(60);

        // 4. Find the URL input field and paste all URLs at once
                  console.log('NotebookLM: Looking for URL input field...');
        const activeDialogForInput = dialogContainer;
                  
                  // Debug: Log dialog content
                  console.log('NotebookLM: Dialog container HTML:', activeDialogForInput.outerHTML.substring(0, 500));
                  console.log('NotebookLM: All inputs in dialog:', activeDialogForInput.querySelectorAll('input, textarea'));
                  
                  let urlInput;
                  try {
          urlInput = await waitForElement(SELECTORS.urlInput, activeDialogForInput, 5000); // Increased timeout
                    console.log('NotebookLM: Found URL input field with selector:', urlInput);
                  } catch (error) {
                    console.log('NotebookLM: Selector failed, trying fallback...');
                    console.log('NotebookLM: Selector error:', error.message);
                    urlInput = findUrlInputFallback(activeDialogForInput);
                    if (!urlInput) {
                      // Better error message with debugging info
                      const allInputs = activeDialogForInput.querySelectorAll('input, textarea');
                      console.error('NotebookLM: Available inputs:', Array.from(allInputs).map(inp => ({
                        tag: inp.tagName,
                        type: inp.type,
                        placeholder: inp.placeholder,
                        className: inp.className,
                        id: inp.id,
                        name: inp.name,
                        formcontrolname: inp.getAttribute('formcontrolname')
                      })));
                      throw new Error(`Could not find URL input field. Found ${allInputs.length} inputs but none matched our selectors. Please check if NotebookLM interface has changed.`);
                    }
                  }
                  
        // Combine all URLs into one string, separated by newlines
        const allUrls = uniqueArticles.map(article => article.url).join('\n');
        await typeIntoInput(urlInput, allUrls);
        console.log(`NotebookLM: Typed ${uniqueArticles.length} URLs in batch`);
        await delay(100);
        updateProgress(70);

        // 5. Click the "Insert" button
                  console.log('NotebookLM: Looking for Insert button...');
        const activeDialogForInsert = dialogContainer;
        
        // Debug: Log dialog content for submit button
        console.log('NotebookLM: Dialog container HTML for submit button:', activeDialogForInsert.outerHTML.substring(0, 500));
        console.log('NotebookLM: All buttons in dialog:', activeDialogForInsert.querySelectorAll('button, [role="button"]'));
        
        let insertButton;
        try {
          insertButton = await waitForElement(SELECTORS.submitButton, activeDialogForInsert, 5000);
          console.log('NotebookLM: Found Insert button with selector:', insertButton);
        } catch (error) {
          console.log('NotebookLM: Submit button selector failed, trying fallback...');
          console.log('NotebookLM: Submit button selector error:', error.message);
          insertButton = findSubmitButtonFallback(activeDialogForInsert);
          if (!insertButton) {
            // Better error message with debugging info
            const allButtons = activeDialogForInsert.querySelectorAll('button, [role="button"]');
            console.error('NotebookLM: Available buttons:', Array.from(allButtons).map(btn => ({
              tag: btn.tagName,
              type: btn.type,
              ariaLabel: btn.getAttribute('aria-label'),
              title: btn.title,
              className: btn.className,
              id: btn.id,
              textContent: btn.textContent?.trim(),
              dataTestId: btn.getAttribute('data-testid'),
              role: btn.getAttribute('role')
            })));
            throw new Error(`Could not find submit button. Found ${allButtons.length} buttons but none matched our selectors. Please check if NotebookLM interface has changed.`);
          }
        }
        
        insertButton.click();
        console.log('NotebookLM: Clicked Insert button');
        updateProgress(80);

        // 6. Wait for insert process to complete
        console.log('NotebookLM: Waiting for batch insert to complete...');
        await waitForElementToDisappear(SELECTORS.urlInput, activeDialogForInsert, 15000); // Increased timeout for batch
        console.log(`Batch of ${uniqueArticles.length} articles likely added.`);
        updateProgress(90);

        // 7. Close the dialog if it's still open
                  console.log('NotebookLM: Checking if dialog needs to be closed...');
        const stillOpenDialog = dialogContainer;
                  if (stillOpenDialog) {
                    console.log('NotebookLM: Dialog still open, looking for close button...');
                    let closeButton = stillOpenDialog.querySelector('button[aria-label="Close"], button[aria-label="close"], .close-button, [data-testid="close"], button[aria-label*="close"], button[aria-label*="Close"], svg[data-testid="close"], .close-icon, button svg');
                    
                    if (!closeButton) {
                      const allButtons = stillOpenDialog.querySelectorAll('button');
                      closeButton = Array.from(allButtons).find(btn => {
                        const text = btn.textContent?.trim();
                        return text === '×' || text === 'X' || text === '✕' || text.toLowerCase().includes('close');
                      });
                    }
                    
                    if (closeButton) {
                      console.log('NotebookLM: Found close button, clicking it...');
                      closeButton.click();
            await delay(200);
                    } else {
                      console.log('NotebookLM: No close button found, dialog may have auto-closed');
                    }
                  } else {
                    console.log('NotebookLM: Dialog already closed');
                  }

        // 8. Navigate back to the main notebook view (Chat tab) - SAFE APPROACH
        console.log('NotebookLM: Safely navigating back to Chat tab...');
        await delay(1500); // Wait longer for dialog to fully close
        
        // SAFE navigation - only click specific Chat tab elements
        console.log('NotebookLM: Using safe navigation to Chat tab...');
        
        let chatTabClicked = false;
        
        // Method 1: Look for Chat tab with very specific selectors
        const safeChatSelectors = [
          'button[aria-label="Chat"]',
          'button[data-testid="chat-tab"]',
          '[role="tab"][aria-label="Chat"]'
        ];
        
        for (const selector of safeChatSelectors) {
          if (chatTabClicked) break;
          
          try {
            const chatTab = document.querySelector(selector);
            if (chatTab && !chatTab.disabled && chatTab.offsetParent !== null) {
              console.log('NotebookLM: Found Chat tab with safe selector:', selector);
              
              // Check if it's already active
              const isActive = chatTab.getAttribute('aria-selected') === 'true' || 
                             chatTab.classList.contains('active') || 
                             chatTab.classList.contains('selected');
              
              if (!isActive) {
                console.log('NotebookLM: Chat tab not active, clicking it...');
                chatTab.click();
                chatTabClicked = true;
                await delay(1000);
              } else {
                console.log('NotebookLM: Chat tab is already active');
                chatTabClicked = true;
              }
              break;
            }
          } catch (e) {
            console.log('NotebookLM: Safe selector failed:', selector, e.message);
          }
        }
        
        // Method 2: If Chat not found, try Studio tab with safe selectors
        if (!chatTabClicked) {
          console.log('NotebookLM: Chat tab not found, trying Studio with safe selectors...');
          const safeStudioSelectors = [
            'button[aria-label="Studio"]',
            'button[data-testid="studio-tab"]',
            '[role="tab"][aria-label="Studio"]'
          ];
          
          for (const selector of safeStudioSelectors) {
            if (chatTabClicked) break;
            
            try {
              const studioTab = document.querySelector(selector);
              if (studioTab && !studioTab.disabled && studioTab.offsetParent !== null) {
                console.log('NotebookLM: Found Studio tab with safe selector:', selector);
                
                // Check if it's already active
                const isActive = studioTab.getAttribute('aria-selected') === 'true' || 
                               studioTab.classList.contains('active') || 
                               studioTab.classList.contains('selected');
                
                if (!isActive) {
                  console.log('NotebookLM: Studio tab not active, clicking it...');
                  studioTab.click();
                  chatTabClicked = true;
                  await delay(1000);
                } else {
                  console.log('NotebookLM: Studio tab is already active');
                  chatTabClicked = true;
                }
                break;
              }
            } catch (e) {
              console.log('NotebookLM: Safe Studio selector failed:', selector, e.message);
            }
          }
        }
        
        // Method 3: Very safe text-based search - only for visible tabs
        if (!chatTabClicked) {
          console.log('NotebookLM: Using very safe text-based search...');
          const visibleTabs = document.querySelectorAll('button[role="tab"], [role="tab"]');
          
          for (const tab of visibleTabs) {
            if (chatTabClicked) break;
            
            // Only consider visible tabs
            if (tab.offsetParent === null) continue;
            
            const text = tab.textContent?.trim() || '';
            const ariaLabel = tab.getAttribute('aria-label') || '';
            const isDisabled = tab.disabled || tab.getAttribute('aria-disabled') === 'true';
            
            // Only click Chat or Studio tabs, never anything else
            if ((text === 'Chat' || ariaLabel === 'Chat' || text === 'Studio' || ariaLabel === 'Studio') && 
                !isDisabled && text !== 'Sources' && ariaLabel !== 'Sources') {
              console.log('NotebookLM: Found safe tab by text:', text);
              
              // Check if it's already active
              const isActive = tab.getAttribute('aria-selected') === 'true' || 
                             tab.classList.contains('active') || 
                             tab.classList.contains('selected');
              
              if (!isActive) {
                console.log('NotebookLM: Safe tab not active, clicking it...');
                tab.click();
                chatTabClicked = true;
                await delay(1000);
              } else {
                console.log('NotebookLM: Safe tab is already active');
                chatTabClicked = true;
              }
              break;
            }
          }
        }
        
        // Final verification: ensure we're not in Sources
        await delay(500);
        const finalSourcesTab = document.querySelector('button[aria-label="Sources"], button[data-testid="sources-tab"], [role="tab"][aria-label="Sources"]');
        if (finalSourcesTab) {
          const isSourcesActive = finalSourcesTab.getAttribute('aria-selected') === 'true' || 
                                finalSourcesTab.classList.contains('active') || 
                                finalSourcesTab.classList.contains('selected');
          if (isSourcesActive) {
            console.log('NotebookLM: Still in Sources tab, trying one final safe click...');
            // Only try to click Chat or Studio, nothing else
            const finalChatTab = document.querySelector('button[aria-label="Chat"], button[data-testid="chat-tab"]');
            if (finalChatTab && !finalChatTab.disabled) {
              console.log('NotebookLM: Final safe click on Chat tab');
              finalChatTab.click();
              await delay(1000);
            }
          } else {
            console.log('NotebookLM: Successfully navigated away from Sources tab');
          }
        } else {
          console.log('NotebookLM: Sources tab not found, navigation complete');
        }
        
        // Additional safety: ensure no dialogs are open
        await delay(500);
        const anyDialog = document.querySelector('div[role="dialog"], .mat-dialog-container, [data-testid="dialog"]');
        if (anyDialog) {
          console.log('NotebookLM: Dialog still open, trying to close it...');
          const closeBtn = anyDialog.querySelector('button[aria-label="Close"], button[title="Close"], .close-button, [data-testid="close"]');
          if (closeBtn) {
            closeBtn.click();
            await delay(500);
          }
        }

        // Send success messages for all articles
        for (let i = 0; i < uniqueArticles.length; i++) {
          const article = uniqueArticles[i];
                  chrome.runtime.sendMessage({
                      status: "article_success",
                      data: `Successfully added: "${article.title.substring(0, 30)}..."`,
                      type: "NOTEBOOKLM_AUTOMATION_STATUS",
                      article_index_added: i,
                      article_url_added: article.url
                  });
        }
        
        console.log(`NotebookLM: Batch of ${uniqueArticles.length} articles added successfully`);
        updateProgress(100);
        
          if (!stopAutomationSignal) {
          console.log("Batch automation completed successfully.");
          const summaryMessage = `Completed: ${uniqueArticles.length} articles added in batch, ${articles.length - uniqueArticles.length} skipped (duplicates)`;
               chrome.runtime.sendMessage({ 
                   status: "completed", 
                   data: summaryMessage, 
                   type: "NOTEBOOKLM_AUTOMATION_STATUS",
                   total_processed: articles.length,
            total_added: uniqueArticles.length,
            total_skipped: articles.length - uniqueArticles.length
          });
        }

      } catch (error) {
        if (stopAutomationSignal || (error.message && error.message.includes("Automation stopped by user"))) {
          console.log("Process caught stop signal during batch addition.");
          chrome.runtime.sendMessage({ status: "stopped", data: "Automation stopped during batch processing.", type: "NOTEBOOKLM_AUTOMATION_STATUS" });
          return;
        }
        let errorMessage = `Failed to add batch of articles: ${error.message}. Stopping.`;
        
        // Special handling for extension context invalidated
        if (error.message.includes("Extension context invalidated")) {
          errorMessage = `🔄 Extension Reloaded: Please refresh this NotebookLM page and try again. The extension was updated while this page was open.`;
          console.error(errorMessage);
          // Show user-friendly message on the page
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #ff9800; color: white; padding: 16px; border-radius: 8px;
            font-family: Arial, sans-serif; font-size: 14px; max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          `;
          notification.innerHTML = `
            <strong>🔄 Extension Updated</strong><br>
            Please refresh this page and try again.
          `;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 8000);
          return;
        }
        
        // Special handling for UI element not found errors
        if (error.message.includes("Could not find URL input field")) {
          errorMessage = `❌ NotebookLM Interface Error: Cannot find the URL input field. This usually means:\n\n1. NotebookLM interface has changed\n2. Please try refreshing the NotebookLM page\n3. Make sure you're in a notebook (not just the home page)\n4. Try clicking "Sources" tab manually first\n\nOriginal error: ${error.message}`;
        }
        
        console.error(errorMessage, error);
        
        // Try to send message, but handle context invalidated gracefully
        try {
          chrome.runtime.sendMessage({ status: "error", data: errorMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
        } catch (sendError) {
          console.error("Could not send error message - extension context invalidated");
        }
        return;
      }
      
      } finally {
        // Clear safety timeout
        if (safetyTimeout) {
          clearTimeout(safetyTimeout);
          console.log('NotebookLM: Safety timeout cleared');
        }
        
        // Always reset automation state
        isAutomationRunning = false;
        removeProgressIndicator();
        console.log('NotebookLM: Batch automation finished, state reset');
        
        // Send explicit completion message
        try {
          chrome.runtime.sendMessage({ 
            status: "completed", 
            data: "Automation completed and state reset", 
            type: "NOTEBOOKLM_AUTOMATION_STATUS" 
          });
        } catch (sendError) {
          console.log('NotebookLM: Could not send completion message (context may be invalidated)');
        }
      }
  }
} 