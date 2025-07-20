// notebooklm_automation.js - Based on proven NLM_YT_automator pattern

// Prevent multiple executions of this script
if (window.notebooklmAutomationLoaded) {
  console.log("NotebookLM automation script already loaded, skipping...");
} else {
  window.notebooklmAutomationLoaded = true;
  
  // === GLOBAL STATE ===
  let stopAutomationSignal = false;
  let currentResponseCallback = null;
  let isAutomationRunning = false; // Add flag to prevent multiple executions
  
  console.log("NotebookLM Content Script Loaded (Adapted from NLM_YT_automator)");

  // Add a visible indicator that the script loaded (only if not already present)
  if (!document.getElementById('notebooklm-automation-indicator')) {
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
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 3000);
  }

  const NOTEBOOKLM_SELECTORS = {
      addSourceButton: 'button[aria-label="Add source"], button[aria-label="Add sources"], button.add-source-button, button[data-testid="add-source"], [role="button"]',
      youtubeLinkInput: 'input[formcontrolname="newUrl"], input[placeholder*="URL"], input[placeholder*="url"], input[type="url"], input[placeholder*="link"], input[placeholder*="Link"], input[placeholder*="web"], input[placeholder*="Web"], input[placeholder*="http"], textarea[placeholder*="URL"], textarea[placeholder*="url"]',
      submitButton: 'button[type="submit"], button[aria-label="Insert"], button[aria-label="Add"], button[aria-label="Submit"], button[aria-label="Save"]',
  };

  // --- Helper Functions (from NLM_YT_automator) ---

  function waitForElement(selector, parent = document, timeout = 7000) { // Reduced from 10000
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
              let element = null;
              
              // Try the selector first
              try {
                  element = parent.querySelector(selector);
              } catch (error) {
                  console.log('Selector failed:', selector, error);
                  element = null;
              }
              
              // If selector failed or element not found, try fallback methods
              if (!element) {
                  // For add source button, try to find by text content
                  if (selector.includes('add-source') || selector.includes('Add source')) {
                      const allButtons = parent.querySelectorAll('button, [role="button"]');
                      element = Array.from(allButtons).find(btn => {
                          const text = btn.textContent?.toLowerCase() || '';
                          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                          return text.includes('add') && text.includes('source') || 
                                 ariaLabel.includes('add') && ariaLabel.includes('source');
                      });
                  }
                  // For submit button, try to find by text content
                  else if (selector.includes('submit') || selector.includes('Insert') || selector.includes('Add')) {
                      const allButtons = parent.querySelectorAll('button');
                      element = Array.from(allButtons).find(btn => {
                          const text = btn.textContent?.toLowerCase() || '';
                          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                          return text.includes('insert') || text.includes('add') || text.includes('submit') || text.includes('save') ||
                                 ariaLabel.includes('insert') || ariaLabel.includes('add') || ariaLabel.includes('submit') || ariaLabel.includes('save');
                      });
                  }
              }
              
              if (element && element.offsetParent !== null) {
                  clearInterval(interval);
                  resolve(element);
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  console.log('Available buttons on page:', Array.from(parent.querySelectorAll('button')).map(b => ({
                      text: b.textContent?.substring(0, 50),
                      ariaLabel: b.getAttribute('aria-label'),
                      className: b.className,
                      id: b.id
                  })));
                  console.log('Available input elements on page:', Array.from(parent.querySelectorAll('input, textarea')).map(i => ({
                      type: i.type,
                      placeholder: i.placeholder,
                      formcontrolname: i.getAttribute('formcontrolname'),
                      className: i.className,
                      id: i.id
                  })));
                  reject(new Error(`Timeout: Element "${selector}" not found or not visible after ${timeout}ms.`));
              }
          }, 50); // Reduced from 100ms polling interval
      });
  }

  function waitForElementToDisappear(selector, parent = document, timeout = 7000) { // Reduced from 10000
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
              let element = null;
              
              // Try the selector first
              try {
                  element = parent.querySelector(selector);
              } catch (error) {
                  console.log('Selector failed in waitForElementToDisappear:', selector, error);
                  // If selector is invalid, assume element disappeared
                  element = null;
              }
              
              if (!element || element.offsetParent === null) {
                  clearInterval(interval);
                  resolve();
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  reject(new Error(`Timeout: Element "${selector}" did not disappear after ${timeout}ms.`));
              }
          }, 50); // Reduced from 100ms polling interval
      });
  }

  /**
   * Find the Google Drive chip by looking for its unique characteristics
   */
  function findGoogleDriveChip(searchContext, timeout = 5000) {
      console.log("Searching for Google Drive chip...");
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
              if (stopAutomationSignal) {
                  clearInterval(interval);
                  reject(new Error("Automation stopped by user during findGoogleDriveChip."));
                  return;
              }

              // Try multiple approaches to find Google Drive option
              let driveChip = null;
              
              // Method 1: Look for mat-icon with drive-related text
              const icons = searchContext.querySelectorAll('mat-icon');
              for (const icon of icons) {
                  const iconText = (icon.textContent || "").trim().toLowerCase();
                  if (iconText.includes('drive') || iconText.includes('folder') || iconText.includes('cloud')) {
                      const chip = icon.closest('mat-chip[tabindex="0"]');
                      if (chip && chip.offsetParent !== null) {
                          driveChip = chip;
                          break;
                      }
                  }
              }
              
              // Method 2: Look for text content mentioning Google Drive
              if (!driveChip) {
                  const allElements = searchContext.querySelectorAll('div, button, mat-chip');
                  for (const el of allElements) {
                      const text = (el.textContent || "").toLowerCase();
                      if (text.includes('google') && text.includes('drive')) {
                          if (el.offsetParent !== null) {
                              driveChip = el;
                              break;
                          }
                      }
                  }
              }
              
              // Method 3: Look for data attributes
              if (!driveChip) {
                  driveChip = searchContext.querySelector('[data-drive], [data-testid*="drive"], [aria-label*="Google Drive"]');
              }

              if (driveChip) {
                  clearInterval(interval);
                  console.log("Found Google Drive chip:", driveChip);
                  resolve(driveChip);
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  reject(new Error(`Timeout: Google Drive source type chip not found after ${timeout}ms.`));
              }
          }, 250);
      });
  }

  /**
   * Find the URL/Web source chip by looking for its unique characteristics
   */
  function findUrlChip(searchContext, timeout = 5000) { // Increased timeout back to 5000ms
      console.log("NotebookLM: Searching for URL chip in context:", searchContext);
      return new Promise((resolve, reject) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
              // Look for URL-related chips/buttons using valid selectors
              let urlChip = searchContext.querySelector('button[aria-label*="URL"], button[aria-label*="url"], button[aria-label*="Web"], button[aria-label*="web"], button[aria-label*="Link"], button[aria-label*="link"]');
              
              // If not found with aria-label, try to find by text content
              if (!urlChip) {
                  const allButtons = searchContext.querySelectorAll('button, [role="button"], mat-chip, .chip');
                  console.log("NotebookLM: Found buttons/chips:", allButtons.length);
                  
                  // Log all buttons for debugging
                  Array.from(allButtons).forEach((btn, index) => {
                      const text = btn.textContent?.toLowerCase() || '';
                      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                      console.log(`NotebookLM: Button ${index}: text="${text}", aria-label="${ariaLabel}", visible=${btn.offsetParent !== null}`);
                  });
                  
                  urlChip = Array.from(allButtons).find(btn => {
                      const text = btn.textContent?.toLowerCase() || '';
                      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                      return (text.includes('url') || text.includes('web') || text.includes('link') || 
                              ariaLabel.includes('url') || ariaLabel.includes('web') || ariaLabel.includes('link')) &&
                             btn.offsetParent !== null; // Must be visible
                  });
              }
              
              // If still not found, try looking for any clickable element that might be the URL option
              if (!urlChip) {
                  console.log("NotebookLM: Trying broader search for URL option...");
                  const allElements = searchContext.querySelectorAll('*');
                  urlChip = Array.from(allElements).find(el => {
                      const text = el.textContent?.toLowerCase() || '';
                      return (text.includes('url') || text.includes('web') || text.includes('link')) &&
                             el.offsetParent !== null &&
                             (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || 
                              el.classList.contains('chip') || el.tagName === 'MAT-CHIP');
                  });
              }
              
              if (urlChip) {
                  clearInterval(interval);
                  console.log("NotebookLM: Found URL chip:", urlChip);
                  console.log("NotebookLM: URL chip text:", urlChip.textContent);
                  console.log("NotebookLM: URL chip aria-label:", urlChip.getAttribute('aria-label'));
                  resolve(urlChip);
              } else if (Date.now() - startTime > timeout) {
                  clearInterval(interval);
                  console.log("NotebookLM: All elements in dialog:");
                  const allElements = searchContext.querySelectorAll('*');
                  Array.from(allElements).forEach((el, index) => {
                      const text = el.textContent?.toLowerCase() || '';
                      if (text && text.length < 50) { // Only log elements with text
                          console.log(`NotebookLM: Element ${index}: tag="${el.tagName}", text="${text}", visible=${el.offsetParent !== null}`);
                      }
                  });
                  reject(new Error(`Timeout: URL chip not found after ${timeout}ms.`));
              }
          }, 100); // Increased polling interval for better performance
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

  /**
   * Fallback function to find URL input by examining all inputs
   */
  function findUrlInputFallback(container) {
      console.log('NotebookLM: Using fallback to find URL input...');
      
      const allInputs = container.querySelectorAll('input, textarea');
      console.log('NotebookLM: Found inputs:', allInputs.length);
      
      for (const input of allInputs) {
          const placeholder = (input.placeholder || '').toLowerCase();
          const type = (input.type || '').toLowerCase();
          const formcontrolname = (input.getAttribute('formcontrolname') || '').toLowerCase();
          const className = (input.className || '').toLowerCase();
          
          console.log('NotebookLM: Checking input:', { placeholder, type, formcontrolname, className });
          
          // Check if this looks like a URL input
          if (placeholder.includes('url') || placeholder.includes('link') || placeholder.includes('web') || 
              placeholder.includes('http') || type === 'url' || formcontrolname.includes('url') ||
              className.includes('url') || className.includes('link')) {
              console.log('NotebookLM: Found URL input via fallback:', input);
              return input;
          }
      }
      
      // If no specific URL input found, try the first text input
      const firstTextInput = container.querySelector('input[type="text"], textarea');
      if (firstTextInput) {
          console.log('NotebookLM: Using first text input as fallback:', firstTextInput);
          return firstTextInput;
      }
      
      return null;
  }

  // --- Main Logic ---

  // === MESSAGE HANDLING ===
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("NotebookLM: Received message:", message);
    
    if (message.type === "AUTOMATE_ADD_SOURCES") {
      console.log("NotebookLM: Starting source automation...");
      addSourcesToNotebookLM(message.driveFiles || []);
      sendResponse({ status: "started", data: "Source automation started" });
    } else if (message.type === "AUTOMATE_ADD_ARTICLES") {
      console.log("NotebookLM: Starting article automation...");
      addArticlesAsSources(message.articles || []);
      sendResponse({ status: "started", data: "Article automation started" });
    } else if (message.type === "ADD_ARTICLES_AS_SOURCES") {
      console.log("NotebookLM: Starting article automation (legacy)...");
      addArticlesAsSources(message.articles || []);
      sendResponse({ status: "started", data: "Article automation started" });
    } else if (message.action === "STOP_NOTEBOOKLM_AUTOMATION") {
      console.log("Received STOP_NOTEBOOKLM_AUTOMATION signal.");
      stopAutomationSignal = true;
      sendResponse({ status: "stopped", data: "Automation stopped by user" });
    }
    
    return true; // Keep sendResponse alive for async operations
  });

  async function addSourcesToNotebookLM(sources) {
      if (currentResponseCallback) {
          try {
              currentResponseCallback({ status: "progress", data: `Starting to add ${sources.length} sources...`, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
          } catch(e) { console.warn("Could not send initial progress."); }
      } else {
          chrome.runtime.sendMessage({ status: "progress", data: `Starting to add ${sources.length} sources...`, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
      }

      await delay(500);

      for (let i = 0; i < sources.length; i++) {
          if (stopAutomationSignal) {
              console.log("Automation stopping due to signal.");
              chrome.runtime.sendMessage({ status: "stopped", data: "Automation stopped by user.", type: "NOTEBOOKLM_AUTOMATION_STATUS" });
              return;
          }

          const source = sources[i];
          const progressMessage = `Adding source ${i + 1} of ${sources.length}: "${source.name.substring(0, 30)}..."`;
          console.log(progressMessage);
          chrome.runtime.sendMessage({ status: "progress", data: progressMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS", source_index_processing: i });

          try {
              // 1. Click the main "+ Add" source button
              const addSourceBtn = await waitForElement(NOTEBOOKLM_SELECTORS.addSourceButton, document, 7000);
              addSourceBtn.click();
              await delay(500);

              // 2. In the modal, find and click the "Google Drive" chip
              const dialogContainer = await waitForElement('mat-dialog-container', document, 5000);
              const driveButtonInModal = await findGoogleDriveChip(dialogContainer, 5000);
              driveButtonInModal.click();
              await delay(500);

              // 3. Wait for Drive picker to load and forward to picker automation
              const pickerFrame = await waitForElement('iframe[src*="drive.google.com"]', document, 10000);
              console.log("Found Drive picker iframe, forwarding to picker automation");
              
              // Forward the source data to picker automation
              setTimeout(() => {
                  chrome.runtime.sendMessage({
                      type: "PICKER_SELECT_FILES",
                      driveFiles: [source],
                      frameId: pickerFrame.contentWindow.frameId
                  });
              }, 800);

              // 4. Wait for the process to complete (picker will handle the rest)
              await delay(2000);
              console.log(`Source "${source.name}" forwarded to picker.`);

              chrome.runtime.sendMessage({
                  status: "source_success",
                  data: `Successfully forwarded: "${source.name.substring(0, 30)}..."`,
                  type: "NOTEBOOKLM_AUTOMATION_STATUS",
                  source_index_added: i,
                  source_id: source.id
              });
              await delay(1500 + Math.random() * 500);

          } catch (error) {
              if (stopAutomationSignal || (error.message && error.message.includes("Automation stopped by user"))) {
                  console.log("Process caught stop signal during source addition.");
                  chrome.runtime.sendMessage({ status: "stopped", data: "Automation stopped during source processing.", type: "NOTEBOOKLM_AUTOMATION_STATUS" });
                  return;
              }
              const errorMessage = `Failed to add "${source.name}": ${error.message}. Stopping.`;
              console.error(errorMessage, error);
              chrome.runtime.sendMessage({ status: "error", data: errorMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
              return;
          }
      }
      if (!stopAutomationSignal) {
           console.log("All sources processed successfully (or attempted).");
      }
  }

  async function addArticlesAsSources(articles) {
      // Prevent multiple simultaneous executions
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
      console.log('NotebookLM: Starting automation for', articles.length, 'articles');
      
      try {
          if (currentResponseCallback) {
              try {
                  currentResponseCallback({ status: "progress", data: `Starting to add ${articles.length} articles as sources...`, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
              } catch(e) { console.warn("Could not send initial progress."); }
          } else {
              chrome.runtime.sendMessage({ status: "progress", data: `Starting to add ${articles.length} articles as sources...`, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
          }

          await delay(200); // Reduced from 500

          // Track added articles to prevent duplicates
          const addedUrls = new Set();
          let addedCount = 0;

          for (let i = 0; i < articles.length; i++) {
              if (stopAutomationSignal) {
                  console.log("Automation stopping due to signal.");
                  chrome.runtime.sendMessage({ status: "stopped", data: "Automation stopped by user.", type: "NOTEBOOKLM_AUTOMATION_STATUS" });
                  return;
              }

              const article = articles[i];
              
              // Check if this article URL was already added
              if (addedUrls.has(article.url)) {
                  console.log(`NotebookLM: Skipping duplicate article: "${article.title}" (URL already added)`);
                  chrome.runtime.sendMessage({ 
                      status: "article_skipped", 
                      data: `Skipped duplicate: "${article.title.substring(0, 30)}..."`, 
                      type: "NOTEBOOKLM_AUTOMATION_STATUS",
                      article_index_skipped: i,
                      reason: "duplicate_url"
                  });
                  continue;
              }

              const progressMessage = `Adding article ${i + 1} of ${articles.length}: "${article.title.substring(0, 30)}..."`;
              console.log(progressMessage);
              chrome.runtime.sendMessage({ status: "progress", data: progressMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS", article_index_processing: i });

              try {
                  console.log('NotebookLM: Starting to add article:', article.title);
                  
                  // 1. Click the main "+ Add" source button
                  console.log('NotebookLM: Looking for Add source button...');
                  const addSourceBtn = await waitForElement(NOTEBOOKLM_SELECTORS.addSourceButton, document, 7000);
                  console.log('NotebookLM: Found Add source button:', addSourceBtn);
                  addSourceBtn.click();
                  console.log('NotebookLM: Clicked Add source button');
                  await delay(300); // Reduced from 500

                  // 2. In the modal, find and click the "URL" or "Web" chip (instead of YouTube)
                  console.log('NotebookLM: Looking for dialog container...');
                  const dialogContainer = await waitForElement('mat-dialog-container, [role="dialog"], .dialog, .modal', document, 5000);
                  console.log('NotebookLM: Found dialog container:', dialogContainer);
                  
                  console.log('NotebookLM: Looking for URL chip...');
                  let urlButtonInModal;
                  try {
                    urlButtonInModal = await findUrlChip(dialogContainer, 5000);
                    console.log('NotebookLM: Found URL chip:', urlButtonInModal);
                  } catch (error) {
                    console.log('NotebookLM: URL chip not found, trying fallback...');
                    // Try to find any clickable option in the dialog
                    const allClickable = dialogContainer.querySelectorAll('button, [role="button"], mat-chip, .chip');
                    const visibleClickable = Array.from(allClickable).filter(el => el.offsetParent !== null);
                    console.log('NotebookLM: Found visible clickable elements:', visibleClickable.length);
                    
                    if (visibleClickable.length > 0) {
                      urlButtonInModal = visibleClickable[0];
                      console.log('NotebookLM: Using first available option:', urlButtonInModal.textContent);
                    } else {
                      throw new Error('No clickable options found in dialog');
                    }
                  }
                  
                  urlButtonInModal.click();
                  console.log('NotebookLM: Clicked URL chip');
                  await delay(300); // Reduced from 500

                  // 3. Find the URL input field and paste the article URL
                  console.log('NotebookLM: Looking for URL input field...');
                  const activeDialogForInput = document.querySelector('mat-dialog-container:not([hidden])') || dialogContainer;
                  
                  let urlInput;
                  try {
                    urlInput = await waitForElement(NOTEBOOKLM_SELECTORS.youtubeLinkInput, activeDialogForInput, 3000);
                    console.log('NotebookLM: Found URL input field with selector:', urlInput);
                  } catch (error) {
                    console.log('NotebookLM: Selector failed, trying fallback...');
                    urlInput = findUrlInputFallback(activeDialogForInput);
                    if (!urlInput) {
                      throw new Error('Could not find URL input field with selectors or fallback');
                    }
                  }
                  
                  await typeIntoInput(urlInput, article.url);
                  console.log('NotebookLM: Typed URL:', article.url);
                  await delay(100); // Reduced from 200

                  // 4. Click the "Insert" button
                  console.log('NotebookLM: Looking for Insert button...');
                  const activeDialogForInsert = document.querySelector('mat-dialog-container:not([hidden])') || dialogContainer;
                  const insertButton = await waitForElement(NOTEBOOKLM_SELECTORS.submitButton, activeDialogForInsert, 5000);
                  console.log('NotebookLM: Found Insert button:', insertButton);
                  insertButton.click();
                  console.log('NotebookLM: Clicked Insert button');

                  // 5. Wait for insert process to complete
                  console.log('NotebookLM: Waiting for insert to complete...');
                  await waitForElementToDisappear(NOTEBOOKLM_SELECTORS.youtubeLinkInput, activeDialogForInsert, 10000); // Reduced from 15000
                  console.log(`Article "${article.title}" likely added.`);

                  // 6. Close the dialog if it's still open
                  console.log('NotebookLM: Checking if dialog needs to be closed...');
                  const stillOpenDialog = document.querySelector('mat-dialog-container:not([hidden])');
                  if (stillOpenDialog) {
                    console.log('NotebookLM: Dialog still open, looking for close button...');
                    let closeButton = stillOpenDialog.querySelector('button[aria-label="Close"], button[aria-label="close"], .close-button, [data-testid="close"], button[aria-label*="close"], button[aria-label*="Close"], svg[data-testid="close"], .close-icon, button svg');
                    
                    // If not found with selectors, try to find by text content
                    if (!closeButton) {
                      console.log('NotebookLM: No close button found, trying to find by text content...');
                      const allButtons = stillOpenDialog.querySelectorAll('button');
                      closeButton = Array.from(allButtons).find(btn => {
                        const text = btn.textContent?.trim();
                        return text === '×' || text === 'X' || text === '✕' || text.toLowerCase().includes('close');
                      });
                    }
                    
                    if (closeButton) {
                      console.log('NotebookLM: Found close button, clicking it...');
                      closeButton.click();
                      await delay(200); // Reduced from 500
                    } else {
                      console.log('NotebookLM: No close button found, dialog may have auto-closed');
                    }
                  } else {
                    console.log('NotebookLM: Dialog already closed');
                  }

                  chrome.runtime.sendMessage({
                      status: "article_success",
                      data: `Successfully added: "${article.title.substring(0, 30)}..."`,
                      type: "NOTEBOOKLM_AUTOMATION_STATUS",
                      article_index_added: i,
                      article_url_added: article.url
                  });
                  
                  // Mark this URL as added to prevent duplicates
                  addedUrls.add(article.url);
                  addedCount++;
                  console.log(`NotebookLM: Article "${article.title}" added successfully. Total added: ${addedCount}`);
                  
                  await delay(800 + Math.random() * 300); // Reduced from 1500 + Math.random() * 500

              } catch (error) {
                  if (stopAutomationSignal || (error.message && error.message.includes("Automation stopped by user"))) {
                      console.log("Process caught stop signal during article addition.");
                      chrome.runtime.sendMessage({ status: "stopped", data: "Automation stopped during article processing.", type: "NOTEBOOKLM_AUTOMATION_STATUS" });
                      return;
                  }
                  const errorMessage = `Failed to add "${article.title}": ${error.message}. Stopping.`;
                  console.error(errorMessage, error);
                  chrome.runtime.sendMessage({ status: "error", data: errorMessage, type: "NOTEBOOKLM_AUTOMATION_STATUS" });
                  return;
              }
          }
          if (!stopAutomationSignal) {
               console.log("All articles processed successfully (or attempted).");
               const summaryMessage = `Completed: ${addedCount} articles added, ${articles.length - addedCount} skipped (duplicates)`;
               chrome.runtime.sendMessage({ 
                   status: "completed", 
                   data: summaryMessage, 
                   type: "NOTEBOOKLM_AUTOMATION_STATUS",
                   total_processed: articles.length,
                   total_added: addedCount,
                   total_skipped: articles.length - addedCount
               });
          }
      } finally {
          isAutomationRunning = false;
          console.log('NotebookLM: Automation finished.');
      }
  }
} 