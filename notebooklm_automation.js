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

  // Add indicator that script loaded
  function addIndicator() {
    if (!document.getElementById('notebooklm-automation-indicator') && document.body) {
      const indicator = document.createElement('div');
      indicator.id = 'notebooklm-automation-indicator';
      indicator.style.cssText = `
        position: fixed; top: 10px; left: 10px; z-index: 10000;
        background: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px;
        font-family: Arial, sans-serif; font-size: 12px;
      `;
      indicator.textContent = '🤖 NotebookLM Automation Ready';
      document.body.appendChild(indicator);
      setTimeout(() => {
        if (indicator.parentNode) indicator.remove();
      }, 3000);
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
    urlInput: 'input[formcontrolname="newUrl"], input[placeholder*="URL"], input[placeholder*="url"], input[type="url"], input[placeholder*="link"], input[placeholder*="Link"], input[placeholder*="web"], input[placeholder*="Web"], input[placeholder*="http"], textarea[placeholder*="URL"], textarea[placeholder*="url"], input[type="text"], textarea[placeholder*="Paste"], textarea[placeholder*="paste"], input[placeholder*="Enter URL"], input[placeholder*="enter URL"]',
    submitButton: 'button[type="submit"], button[aria-label="Insert"], button[aria-label="Add"], button[aria-label="Submit"], button[aria-label="Save"], button[title*="Insert"], button[title*="Add"], button[title*="Submit"], button[title*="Save"]',
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
      const visible = input.offsetParent !== null;
      
      if (visible && (placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('web') || 
          placeholder.includes('http') || placeholder.includes('paste') || placeholder.includes('enter') ||
          type === 'url' || formcontrolname.includes('url') || formcontrolname.includes('link') ||
          className.includes('url') || className.includes('link') || className.includes('web') ||
          id.includes('url') || id.includes('link') || id.includes('web') ||
          name.includes('url') || name.includes('link') || name.includes('web'))) {
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

  // === MESSAGE HANDLING ===
  console.log("NotebookLM: Setting up message listener...");
  
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("NotebookLM: Received message:", message);
      
      if (message.type === "AUTOMATE_ADD_ARTICLES" || message.type === "ADD_ARTICLES_AS_SOURCES") {
        console.log("NotebookLM: Starting article automation...");
        addArticlesAsSources(message.articles || []);
        sendResponse({ status: "started", data: "Article automation started" });
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
    console.log('NotebookLM: Starting batch automation for', articles.length, 'articles');
    
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
          console.log(`NotebookLM: Skipping duplicate article: "${article.title}" (URL already in batch)`);
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
        return;
      }

      console.log(`NotebookLM: Processing ${uniqueArticles.length} unique articles in batch`);

      try {
        // 1. First, ensure we're in the Sources tab
        console.log('NotebookLM: Ensuring we are in the Sources tab...');
        
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
            console.log('NotebookLM: Sources tab not active, clicking it...');
            sourcesTab.click();
            await delay(1000);
          } else {
            console.log('NotebookLM: Sources tab is already active');
          }
        } else {
          console.log('NotebookLM: Sources tab not found, continuing anyway...');
        }
        
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

        // 4. Find the URL input field and paste all URLs at once
        console.log('NotebookLM: Looking for URL input field...');
        const activeDialogForInput = dialogContainer;
        
        let urlInput;
        try {
          urlInput = await waitForElement(SELECTORS.urlInput, activeDialogForInput, 3000);
          console.log('NotebookLM: Found URL input field with selector:', urlInput);
        } catch (error) {
          console.log('NotebookLM: Selector failed, trying fallback...');
          urlInput = findUrlInputFallback(activeDialogForInput);
          if (!urlInput) {
            throw new Error('Could not find URL input field with selectors or fallback');
          }
        }
        
        // Combine all URLs into one string, separated by newlines
        const allUrls = uniqueArticles.map(article => article.url).join('\n');
        await typeIntoInput(urlInput, allUrls);
        console.log(`NotebookLM: Typed ${uniqueArticles.length} URLs in batch`);
        await delay(100);

        // 5. Click the "Insert" button
        console.log('NotebookLM: Looking for Insert button...');
        const activeDialogForInsert = dialogContainer;
        const insertButton = await waitForElement(SELECTORS.submitButton, activeDialogForInsert, 5000);
        console.log('NotebookLM: Found Insert button:', insertButton);
        insertButton.click();
        console.log('NotebookLM: Clicked Insert button');

        // 6. Wait for insert process to complete
        console.log('NotebookLM: Waiting for batch insert to complete...');
        await waitForElementToDisappear(SELECTORS.urlInput, activeDialogForInsert, 15000); // Increased timeout for batch
        console.log(`Batch of ${uniqueArticles.length} articles likely added.`);

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
        const errorMessage = `Failed to add batch of articles: ${error.message}. Stopping.`;
        console.error(errorMessage, error);
        chrome.runtime.sendMessage({ status: "error", data: errorMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
        return;
      }
      
    } finally {
      isAutomationRunning = false;
      console.log('NotebookLM: Batch automation finished.');
    }
  }
} 