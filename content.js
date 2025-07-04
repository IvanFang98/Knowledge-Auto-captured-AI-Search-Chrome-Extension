// Content script - runs in the context of web pages
console.log('Text Grabber - Content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'ping') {
    // Respond to health check from background script
    sendResponse({ status: 'ready' });
    return;
  }
  
  if (message.action === 'extract_text') {
    // Extract visible text from the page
    const visibleText = extractVisibleText();
    sendResponse({ text: visibleText });
    return;
  }
  
  if (message.action === 'show_notification') {
    // Show notification on the page
    showNotification(message.message);
    sendResponse({ success: true });
    return;
  }
  
  if (message.action === 'confirm_replacement') {
    // Show confirmation dialog for duplicate entries
    showConfirmationDialog(message.message).then(result => {
      sendResponse({ replace: result });
    });
    return true; // Keep message channel open for async response
  }
});

// Function to import articles to NotebookLM
async function importToNotebookLM() {
  // Remove all NotebookLM import logic and messaging
}

// Twitter/X specific text extraction
function extractTwitterText() {
  try {
    console.log('🐦 Extracting Twitter/X content...');
    
    // First, try to find the main tweet article
    const tweetArticle = document.querySelector('article[data-testid="tweet"], article[role="article"]');
    if (!tweetArticle) {
      console.log('❌ No tweet article found');
      return extractVisibleTextFallback();
    }
    
    console.log('✅ Found tweet article, extracting content...');
    
    // Clone the article to avoid modifying the page
    const clone = tweetArticle.cloneNode(true);
    
    // Remove all the UI elements we don't want
    const removeSelectors = [
      // Navigation and UI
      'nav', 'header', '[role="navigation"]', '[role="complementary"]',
      '[data-testid="toolBar"]', '[data-testid="sidebarColumn"]',
      
      // Engagement buttons
      '[data-testid="reply"]', '[data-testid="retweet"]', '[data-testid="like"]',
      '[data-testid="share"]', '[data-testid="bookmark"]',
      
      // User info and metadata
      '[data-testid="User-Name"]', '[data-testid="UserAvatar-Container"]',
      'time', '[datetime]', '[data-testid="UserCell"]',
      
      // Links and URLs
      'a[href*="http"]', 'a[href*="x.com"]', 'a[href*="twitter.com"]',
      
      // Technical elements
      'style', 'script', 'noscript', 'iframe', 'object', 'embed',
      
      // CSS and styling
      '[class*="css-"]', '[style*="display: none"]', '[style*="visibility: hidden"]'
    ];
    
    // Remove unwanted elements
    removeSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Get all text content
    let allText = clone.textContent || '';
    
    // Clean up the text
    allText = allText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    console.log('📄 Raw extracted text:', allText.substring(0, 300) + '...');
    
    // If we got some text, clean it up further
    if (allText && allText.length > 20) {
      // Remove common Twitter metadata patterns
      allText = allText
        .replace(/body\s*\{[^}]*\}/g, '') // Remove CSS
        .replace(/\.css-[a-zA-Z0-9]+/g, '') // Remove CSS classes
        .replace(/[📅📊🔗✕]/g, '') // Remove emoji
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
        .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '') // Remove dates
        .replace(/\d{1,2}:\d{2}\s*[AP]M/g, '') // Remove times
        .replace(/@[a-zA-Z0-9_]+/g, '') // Remove @mentions
        .replace(/#[a-zA-Z0-9_]+/g, '') // Remove #hashtags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log(`✅ Twitter extraction complete: ${allText.length} characters`);
      console.log('✅ Final text:', allText.substring(0, 200) + '...');
      
      return allText;
    }
    
    console.log('⚠️ No meaningful content found, trying alternative approach...');
    
    // Alternative approach: look for any div with substantial text content
    const allDivs = document.querySelectorAll('div');
    let bestText = '';
    let bestLength = 0;
    
    for (const div of allDivs) {
      const text = div.textContent.trim();
      if (text && text.length > 50 && text.length < 5000) {
        // Check if this looks like tweet content (not UI)
        if (!text.includes('body {') && 
            !text.includes('css-') && 
            !text.includes('Home') && 
            !text.includes('Explore') &&
            !text.includes('Notifications')) {
          
          if (text.length > bestLength) {
            bestText = text;
            bestLength = text.length;
          }
        }
      }
    }
    
    if (bestText) {
      console.log(`✅ Found alternative content: ${bestText.length} characters`);
      return bestText.replace(/\s+/g, ' ').trim();
    }
    
    console.log('⚠️ No tweet content found, falling back to general extraction');
    return extractVisibleTextFallback();
    
  } catch (error) {
    console.error('❌ Error in Twitter extraction:', error);
    return extractVisibleTextFallback();
  }
}

// Function to extract visible text from the page using content-first targeting and smart exclusions
function extractVisibleText() {
  try {
    console.log('🎯 Starting intelligent text extraction...');
    
    // Twitter/X specific extraction
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
      console.log('🐦 Twitter/X detected, using specialized extraction...');
      return extractTwitterText();
    }
    
    // Strategy 1: Content-first targeting - try to find main content containers
    const contentSelectors = [
      'article',
      '[role="main"]', 
      'main',
      '.article-content',
      '.post-content', 
      '.entry-content',
      '.content-area',
      '.article-body',
      '.post-body',
      '.entry-body',
      '.story-body',
      '.article-wrap',
      '.content-wrap'
    ];
    
    let contentContainer = null;
    for (const selector of contentSelectors) {
      contentContainer = document.querySelector(selector);
      if (contentContainer) {
        console.log(`✅ Found content container: ${selector}`);
        break;
      }
    }
    
    // Fallback to body if no content container found
    if (!contentContainer) {
      console.log('⚠️ No content container found, using document.body');
      contentContainer = document.body;
    }
    
    // Strategy 2: Smart exclusions - elements to completely ignore
    const excludeSelectors = [
      // Basic layout elements
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
      
      // Navigation and menus
      '.nav-container', '.header-container', '.footer-container',
      '.nav-module', '.header-nav', '.footer-nav', '.site-footer',
      '.masthead', '.site-header', '.site-nav',
      '.breadcrumb', '.breadcrumbs', '.crumbs',
      '.pagination', '.pager', '.page-nav',
      '.skip-nav', '.skip-link', '.accessibility-nav',
      
      // Financial/market data (generic patterns)
      '.ticker', '.market-data', '.markets-data', '.stock-ticker',
      '.market-overview', '.market-summary', '.stock-data',
      '.financial-data', '.trading-data', '.market-tracker',
      
      // Advertising and promotions
      '.ads', '.ad', '.advertisement', '.sponsored', '.promo-box',
      '.banner', '.promotion-banner', '.subscription-banner',
      '.promo', '.promotion', '.promotional',
      
      // Social and sharing
      '.social', '.social-share', '.social-media', '.share-buttons',
      '.sharing', '.social-icons', '.follow-buttons',
      
      // Comments and engagement
      '.comments', '.comment-section', '.discussion',
      '.related', '.related-articles', '.recommended',
      '.trending', '.popular', '.most-read', '.more-articles',
      
      // Subscription and signup
      '.subscribe', '.subscription', '.paywall', '.signup-form',
      '.newsletter', '.signup', '.sign-up', '.email-signup',
      '.registration', '.login-prompt',
      
      // Utility elements
      '.print', '.email-article', '.save-article',
      '.author-info', '.author-bio', '.byline-extended',
      '.article-tools', '.article-actions',
      '.tags', '.tag-list', '.categories', '.category-list',
      
      // Video and media player elements
      '.video-player', '.media-player', '.audio-player',
      '.player-controls', '.player-settings', '.video-overlay',
      '.captions-menu', '.quality-selector', '.volume-control',
      '.video-controls', '.video-settings',
      
      // Alerts and notifications
      '.breaking-news-bar', '.alert-bar',
      
      // Legal and copyright
      '.copyright', '.legal-notice', '.disclaimer',
      
      // Search and filters
      '.search-box', '.filter-controls', '.sort-options'
    ];
    
    // Clone the container to avoid modifying the original page
    const containerClone = contentContainer.cloneNode(true);
    
    // Remove excluded elements
    excludeSelectors.forEach(selector => {
      const elements = containerClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Remove script, style, and other non-content elements
    const nonContentElements = containerClone.querySelectorAll('script, style, noscript, iframe, object, embed');
    nonContentElements.forEach(el => el.remove());
    
    // Strategy 3: Extract text using TreeWalker with enhanced filtering
    const walker = document.createTreeWalker(
      containerClone,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Check if parent is hidden
          const parentRect = parent.getBoundingClientRect && parent.getBoundingClientRect();
          if (parentRect && (parentRect.width === 0 || parentRect.height === 0)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if text is just whitespace or very short
          const text = node.textContent.trim();
          if (!text || text.length < 3) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if parent has excluded classes/attributes
          const parentClassList = parent.className.toLowerCase();
          const excludePatterns = [
            'ad', 'banner', 'popup', 'modal', 'overlay',
            'share', 'social', 'comment', 'related',
            'sidebar', 'nav', 'menu', 'footer', 'header'
          ];
          
          if (excludePatterns.some(pattern => parentClassList.includes(pattern))) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if text looks like navigation or UI elements
          if (text.match(/^(Home|About|Contact|Menu|Search|Login|Register|Subscribe|Sign In|Skip to|Select What|Most Popular|Latest|More|Main|Video|Audio|Print Edition)$/i)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip financial/stock data patterns
          if (text.match(/^\$?[\d,]+\.?\d*\s*%?$/) || // Numbers with optional $ and %
              text.match(/^[A-Z]{2,5}\s+[\d,]+\.?\d*\s*[+-]?\d*\.?\d*\s*%?$/) || // Stock symbols with data
              text.match(/^(DJIA|S&P|Nasdaq|Russell|VIX|Gold|Bitcoin|Crude Oil|Dollar Index)/i)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip common navigation patterns
          if (text.match(/^(Skip to|Select What to Read|Edition|Use Alt|English|中文|日本語|Print Edition|Latest Headlines|Other Products|Buy Side|Collection|Shop|Wine|World|Business|Politics|Economy|Tech|Markets|Finance|Opinion|Arts|Lifestyle|Real Estate|Personal Finance|Health|Style|Sports|Sections|My Account)$/i)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip short menu-like text
          if (text.length < 30 && text.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip video/audio control text
          if (text.match(/^(Play|Pause|Volume|Mute|Fullscreen|Captions|Quality|Speed|Settings|Keyboard Shortcuts|Listen|minutes|seconds)$/i)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip common UI patterns
          if (text.match(/^(Share|Resize|Advertisement|Continue reading|Subscribe Now|What to Read Next|Continue To Article|Most Popular|Recommended|Videos)$/i)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip very short link text (likely navigation)
          if (parent.tagName === 'A' && text.length < 25) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip text that's mostly numbers/symbols (financial data, timestamps)
          const nonAlphaRatio = (text.match(/[^a-zA-Z\s]/g) || []).length / text.length;
          if (nonAlphaRatio > 0.5 && text.length < 50) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const textParts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text) {
        textParts.push(text);
      }
    }
    
    // Strategy 4: Join and clean up the extracted text
    let fullText = textParts.join(' ');
    
    // Advanced text cleanup
    fullText = fullText
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single newline
      .replace(/\t+/g, ' ')  // Replace tabs with spaces
      .replace(/\u00A0/g, ' ')  // Replace non-breaking spaces
      .trim();
    
    // Final quality check - if extracted text is too short, fallback to simpler extraction
    if (fullText.length < 100) {
      console.log('⚠️ Extracted text too short, trying fallback method...');
      return extractVisibleTextFallback();
    }
    
    console.log(`✅ Successfully extracted ${fullText.length} characters of clean content`);
    return fullText;
    
  } catch (error) {
    console.error('❌ Error in intelligent text extraction:', error);
    return extractVisibleTextFallback();
  }
}

// Fallback extraction method (simplified version of original)
function extractVisibleTextFallback() {
  try {
    console.log('🔄 Using fallback text extraction method...');
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || 
              style.visibility === 'hidden' || 
              style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node.textContent.trim());
    }
    
    let fullText = textNodes.join(' ');
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    console.log(`📄 Fallback extracted ${fullText.length} characters`);
    return fullText;
    
  } catch (error) {
    console.error('❌ Error in fallback extraction:', error);
    return '';
  }
}

// Function to show confirmation dialog for duplicates
function showConfirmationDialog(message) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;
    
    // Create dialog box
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      transform: scale(0.9);
      transition: transform 0.2s ease;
    `;
    
    // Create content
    dialog.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">
          🔄 Duplicate Content Found
        </h3>
        <div style="color: #666; line-height: 1.5; white-space: pre-line; font-size: 14px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="replaceWithNew" style="
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          color: #666;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">Replace with New</button>
        <button id="keepExisting" style="
          padding: 10px 20px;
          border: none;
          background: #2196F3;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">Keep Existing</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Animate in
    setTimeout(() => {
      dialog.style.transform = 'scale(1)';
    }, 10);
    
    // Add event listeners
    const keepButton = dialog.querySelector('#keepExisting');
    const replaceButton = dialog.querySelector('#replaceWithNew');
    
    const cleanup = () => {
      dialog.style.transform = 'scale(0.9)';
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    };
    
    keepButton.addEventListener('click', () => {
      cleanup();
      resolve(false); // Don't replace
    });
    
    replaceButton.addEventListener('click', () => {
      cleanup();
      resolve(true); // Replace
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false); // Default to keeping existing
      }
    });
    
    // Close on Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  });
}

// Function to show notification on the page
function showNotification(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2196F3;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 300px;
    transition: all 0.3s ease;
    transform: translateX(100%);
    border-left: 4px solid #1976D2;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
} 