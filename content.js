// Knowledge Capture & AI Search Extension - Content Script
'use strict';

// === CONFIGURATION ===
const CONFIG = {
  TWITTER_DOMAINS: ['twitter.com', 'x.com'],
  MIN_CONTENT_LENGTH: 20,
  MAX_CONTENT_LENGTH: 10000,
  NOTIFICATION_DURATION: 3000,
  DIALOG_TIMEOUT: 30000,
  
  // Content selectors (ordered by priority)
  CONTENT_SELECTORS: [
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
  ],
  
  // Elements to exclude from text extraction
  EXCLUDE_SELECTORS: [
    // Layout elements
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.nav-container', '.header-container', '.footer-container',
    '.breadcrumb', '.breadcrumbs', '.pagination', '.pager',
    
    // Ads and promotions
    '.ads', '.ad', '.advertisement', '.sponsored', '.promo-box',
    '.banner', '.promotion-banner', '.subscription-banner',
    
    // Social and sharing
    '.social', '.social-share', '.social-media', '.share-buttons',
    '.sharing', '.social-icons', '.follow-buttons',
    
    // Comments and related content
    '.comments', '.comment-section', '.discussion',
    '.related', '.related-articles', '.recommended',
    '.trending', '.popular', '.most-read',
    
    // Subscription and forms
    '.subscribe', '.subscription', '.paywall', '.signup-form',
    '.newsletter', '.signup', '.sign-up', '.email-signup',
    
    // Utility elements
    '.author-info', '.author-bio', '.byline-extended',
    '.article-tools', '.article-actions',
    '.tags', '.tag-list', '.categories',
    
    // Media controls
    '.video-player', '.media-player', '.audio-player',
    '.player-controls', '.player-settings',
    
    // Technical elements
    'style', 'script', 'noscript', 'iframe', 'object', 'embed'
  ],
  
  // Twitter-specific selectors
  TWITTER_EXCLUDE: [
    '[data-testid="toolBar"]', '[data-testid="sidebarColumn"]',
    '[data-testid="reply"]', '[data-testid="retweet"]',
    '[data-testid="like"]', '[data-testid="share"]',
    '[data-testid="bookmark"]', '[data-testid="User-Name"]',
    '[data-testid="UserAvatar-Container"]', 'time', '[datetime]',
    'a[href*="http"]', 'a[href*="x.com"]', 'a[href*="twitter.com"]'
  ]
};

// === UTILITIES ===
const Utils = {
  // Text processing
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  },
  
  removePatterns(text) {
    return text
      .replace(/body\s*\{[^}]*\}/g, '') // Remove CSS
      .replace(/\.css-[a-zA-Z0-9]+/g, '') // Remove CSS classes
      .replace(/[📅📊🔗✕]/g, '') // Remove common emoji
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '') // Remove dates
      .replace(/\d{1,2}:\d{2}\s*[AP]M/g, '') // Remove times
      .replace(/@[a-zA-Z0-9_]+/g, '') // Remove @mentions
      .replace(/#[a-zA-Z0-9_]+/g, '') // Remove #hashtags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  },
  
  isValidText(text) {
    return text && 
           text.length >= CONFIG.MIN_CONTENT_LENGTH && 
           text.length <= CONFIG.MAX_CONTENT_LENGTH;
  },
  
  // DOM utilities
  removeElements(container, selectors) {
    selectors.forEach(selector => {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (error) {
        console.warn(`Failed to remove elements with selector: ${selector}`, error);
      }
    });
  },
  
  findContentContainer() {
    for (const selector of CONFIG.CONTENT_SELECTORS) {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Found content container: ${selector}`);
        return container;
      }
    }
    console.log('No content container found, using document.body');
    return document.body;
  },
  
  // Site detection
  isTwitter() {
    return CONFIG.TWITTER_DOMAINS.some(domain => 
      window.location.hostname.includes(domain)
    );
  },
  
  isPDF() {
    // Check if current page is a PDF
    const url = window.location.href.toLowerCase();
    const contentType = document.contentType || '';
    
    console.log('PDF Detection Debug:');
    console.log('- URL:', url);
    console.log('- Content type:', contentType);
    
    // Direct PDF URL
    if (url.includes('.pdf')) {
      console.log('- PDF detected: Direct PDF URL');
      return true;
    }
    
    // PDF content type
    if (contentType.includes('application/pdf')) {
      console.log('- PDF detected: PDF content type');
      return true;
    }
    
    // Chrome's PDF viewer
    const chromeViewer = document.querySelector('#viewer, .pdfViewer, [data-l10n-id="viewer"]');
    if (chromeViewer) {
      console.log('- PDF detected: Chrome PDF viewer');
      return true;
    }
    
    // Embedded PDF elements
    const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe[src*=".pdf"]');
    if (pdfEmbed) {
      console.log('- PDF detected: Embedded PDF element');
      return true;
    }
    
    // PDF.js viewer (common PDF viewer library)
    const pdfjsViewer = document.querySelector('#viewerContainer, .pdfViewer, .textLayer');
    if (pdfjsViewer) {
      console.log('- PDF detected: PDF.js viewer');
      return true;
    }
    
    // Check for PDF-specific meta tags
    const pdfMeta = document.querySelector('meta[name="pdf-url"], meta[property="pdf-url"]');
    if (pdfMeta) {
      console.log('- PDF detected: PDF meta tag');
      return true;
    }
    
    // Check for PDF-specific classes or IDs
    const pdfElements = document.querySelectorAll('[class*="pdf"], [id*="pdf"], [class*="PDF"], [id*="PDF"]');
    if (pdfElements.length > 0) {
      console.log('- PDF detected: PDF-specific elements found');
      return true;
    }
    
    // Check if page content suggests it's PDF-related
    const pageContent = document.title + ' ' + (document.body.textContent || '');
    if (pageContent.toLowerCase().includes('pdf') || 
        pageContent.toLowerCase().includes('download') ||
        pageContent.toLowerCase().includes('mathematician') ||
        pageContent.toLowerCase().includes('apology')) {
      console.log('- PDF detected: Page content suggests PDF-related content');
      return true;
    }
    
    console.log('- PDF not detected');
    return false;
  },
  
  // UI utilities
  createElement(tag, className, styles = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    Object.assign(element.style, styles);
    return element;
  },
  
  // Async utilities
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// === TEXT EXTRACTION ENGINE ===
const TextExtractor = {
  extract() {
    console.log('Starting intelligent text extraction...');
    
    try {
      // Check for PDF first
      if (Utils.isPDF()) {
        console.log('PDF detected, attempting PDF text extraction...');
        const pdfText = this.extractPDF();
        console.log('PDF extraction result length:', pdfText.length);
        return pdfText;
      }
      
      // Use site-specific extraction if available
      if (Utils.isTwitter()) {
        console.log('Twitter/X detected, using specialized extraction...');
        return this.extractTwitter();
      }
      
      // Use general extraction for other sites
      console.log('Using general text extraction...');
      return this.extractGeneral();
    } catch (error) {
      console.error('Text extraction failed:', error);
      return this.extractFallback();
    }
  },
  
  extractTwitter() {
    try {
      console.log('Extracting Twitter/X content...');
      
      // Find main tweet article
      const tweetArticle = document.querySelector('article[data-testid="tweet"], article[role="article"]');
      if (!tweetArticle) {
        console.log('No tweet article found');
        return this.extractFallback();
      }
      
      console.log('Found tweet article, extracting content...');
      
      // Clone to avoid modifying the page
      const clone = tweetArticle.cloneNode(true);
      
      // Remove Twitter-specific UI elements
      Utils.removeElements(clone, [
        ...CONFIG.EXCLUDE_SELECTORS,
        ...CONFIG.TWITTER_EXCLUDE
      ]);
      
      // Extract and clean text
      let text = clone.textContent || '';
      text = Utils.cleanText(text);
      text = Utils.removePatterns(text);
      
      console.log(`Twitter extraction: ${text.length} characters`);
      
      if (Utils.isValidText(text)) {
        console.log('Twitter extraction successful');
        return text;
      }
      
      console.log('No meaningful Twitter content found, trying alternative...');
      return this.findBestTextContent();
      
    } catch (error) {
      console.error('Twitter extraction error:', error);
      return this.extractFallback();
    }
  },
  
  extractPDF() {
    try {
      console.log('Attempting PDF text extraction...');
      
      // Method 1: Try to extract from Chrome's PDF viewer
      const pdfViewer = document.querySelector('#viewer, .pdfViewer, [data-l10n-id="viewer"], #viewerContainer');
      if (pdfViewer) {
        console.log('Found Chrome PDF viewer');
        return this.extractFromPDFViewer(pdfViewer);
      }
      
      // Method 2: Try to extract from PDF.js viewer
      const pdfjsViewer = document.querySelector('.textLayer, .pdfViewer, [class*="textLayer"]');
      if (pdfjsViewer) {
        console.log('Found PDF.js viewer');
        return this.extractFromPDFViewer(pdfjsViewer);
      }
      
      // Method 3: Try to extract from any text-like content on the page
      const textElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5, h6, article, section');
      let extractedText = '';
      
      for (const element of textElements) {
        const text = element.textContent || '';
        if (text.trim().length > 50) { // Only meaningful text blocks
          extractedText += text + '\n\n';
        }
      }
      
      if (extractedText.trim().length > 100) {
        console.log('Extracted text from PDF-like content');
        return Utils.cleanText(extractedText);
      }
      
      // Method 4: Try to extract from embedded PDF (limited due to CORS)
      const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe[src*=".pdf"]');
      if (pdfEmbed) {
        console.log('Found PDF embed element - CORS limited');
        return this.extractPDFFallback();
      }
      
      // Method 5: Try to extract from any visible text (more aggressive)
      console.log('Trying aggressive text extraction...');
      const allText = document.body.textContent || '';
      if (allText.trim().length > 200) {
        console.log('Extracted text from body content');
        return Utils.cleanText(allText);
      }
      
      // Method 6: Check if this is a page about a PDF (like a download page)
      const pageText = document.title + ' ' + (document.body.textContent || '');
      if (pageText.toLowerCase().includes('pdf') || pageText.toLowerCase().includes('download')) {
        console.log('Page appears to be about a PDF');
        return this.extractPDFFallback();
      }
      
      // Method 7: Fallback - return informative message
      return this.extractPDFFallback();
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      return this.extractPDFFallback();
    }
  },
  
  extractFromPDFViewer(viewer) {
    try {
      console.log('Extracting from Chrome PDF viewer...');
      
      // Look for text layers in Chrome's PDF viewer
      const textLayers = viewer.querySelectorAll('.textLayer, .text-layer, [class*="text"]');
      let extractedText = '';
      
      for (const layer of textLayers) {
        const text = layer.textContent || '';
        if (text.trim().length > 10) {
          extractedText += text + '\n';
        }
      }
      
      if (extractedText.trim().length > 50) {
        console.log('Successfully extracted text from PDF viewer');
        return Utils.cleanText(extractedText);
      }
      
      // Try alternative selectors for PDF content
      const contentElements = viewer.querySelectorAll('div, span, p');
      for (const element of contentElements) {
        const text = element.textContent || '';
        if (text.trim().length > 100) {
          extractedText += text + '\n\n';
        }
      }
      
      if (extractedText.trim().length > 100) {
        return Utils.cleanText(extractedText);
      }
      
      return this.extractPDFFallback();
      
    } catch (error) {
      console.error('PDF viewer extraction error:', error);
      return this.extractPDFFallback();
    }
  },
  
  extractPDFFallback() {
    console.log('PDF extraction not possible - returning informative message');
    return 'This appears to be a PDF document. PDF text extraction is limited due to browser security restrictions. To capture PDF content, consider:\n\n' +
           '1. Opening the PDF in a text-based PDF viewer\n' +
           '2. Converting the PDF to text format\n' +
           '3. Copying and pasting the text content manually\n' +
           '4. Using the PDF URL for reference purposes';
  },
  
  extractGeneral() {
    try {
      console.log('Starting general text extraction...');
      
      // Find content container
      const container = Utils.findContentContainer();
      if (!container) {
        console.log('No content container found, trying best text content method...');
        return this.findBestTextContent();
      }
      
      console.log('Found content container:', container.tagName, container.className);
      
      // Clone container to avoid modifying the page
      const clone = container.cloneNode(true);
      
      // Remove unwanted elements
      Utils.removeElements(clone, CONFIG.EXCLUDE_SELECTORS);
      
      // Extract text
      let text = clone.textContent || '';
      text = Utils.cleanText(text);
      
      console.log(`General extraction: ${text.length} characters`);
      
      if (Utils.isValidText(text)) {
        console.log('General extraction successful');
        return text;
      }
      
      console.log('Content container text too short, trying best text content method...');
      return this.findBestTextContent();
      
    } catch (error) {
      console.error('General extraction error:', error);
      return this.findBestTextContent();
    }
  },
  
  findBestTextContent() {
    console.log('Searching for best text content...');
    
    // Try different element types in order of preference
    const selectors = [
      'article', 'main', '[role="main"]', 
      '.content', '.post-content', '.entry-content', '.article-content',
      '.story-body', '.article-body', '.post-body',
      'div', 'section', 'p'
    ];
    
    let bestText = '';
    let bestScore = 0;
    let bestElement = null;
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`Checking ${elements.length} elements for selector: ${selector}`);
      
      for (const element of elements) {
        // Skip if element is inside excluded areas
        if (this.isExcludedElement(element)) continue;
        
        const text = element.textContent?.trim();
        if (!text || text.length < CONFIG.MIN_CONTENT_LENGTH) continue;
        
        // Score based on length and content quality
        const lengthScore = Math.min(text.length / 1000, 5); // Max 5 points for length
        const qualityScore = this.calculateContentQuality(text);
        const selectorScore = this.getSelectorScore(selector);
        const totalScore = lengthScore + qualityScore + selectorScore;
        
        if (totalScore > bestScore) {
          bestText = text;
          bestScore = totalScore;
          bestElement = element;
        }
      }
      
      // If we found good content with high-priority selectors, use it
      if (bestScore > 3 && ['article', 'main', '[role="main"]'].includes(selector)) {
        break;
      }
    }
    
    if (Utils.isValidText(bestText)) {
      console.log(`Found best content: ${bestText.length} characters, score: ${bestScore}, element: ${bestElement?.tagName}`);
      return Utils.cleanText(bestText);
    }
    
    console.log('No good content found, trying document body...');
    return this.extractFallback();
  },
  
  isExcludedElement(element) {
    // Check if element or its parent matches exclusion selectors
    const excludeSelectors = ['nav', 'header', 'footer', 'aside', '.sidebar', '.menu', '.navigation'];
    
    for (const selector of excludeSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return true;
      }
    }
    return false;
  },
  
  getSelectorScore(selector) {
    const scores = {
      'article': 3,
      'main': 3,
      '[role="main"]': 3,
      '.content': 2,
      '.post-content': 2,
      '.entry-content': 2,
      '.article-content': 2,
      '.story-body': 2,
      '.article-body': 2,
      '.post-body': 2,
      'div': 1,
      'section': 1,
      'p': 0.5
    };
    return scores[selector] || 0;
  },
  
  calculateContentQuality(text) {
    let score = 0;
    
    // Penalize UI-like text
    const uiPatterns = ['Home', 'Explore', 'Notifications', 'body {', 'css-'];
    if (uiPatterns.some(pattern => text.includes(pattern))) {
      score -= 2;
    }
    
    // Reward readable content
    const sentences = text.split(/[.!?]+/).length;
    if (sentences > 1) score += 1;
    
    const words = text.split(/\s+/).length;
    if (words > 20) score += 1;
    
    // Penalize very short or very long content
    if (text.length < 100) score -= 1;
    if (text.length > 5000) score -= 1;
    
    return score;
  },
  
  extractFallback() {
    console.log('Using fallback text extraction...');
    
    try {
      // Try multiple fallback approaches
      const fallbackMethods = [
        () => this.extractFromSpecificElements(),
        () => this.extractFromBodyWithFiltering(),
        () => this.extractFromVisibleText(),
        () => this.extractMinimalContent()
      ];
      
      for (const method of fallbackMethods) {
        const result = method();
        if (result && result !== 'No readable content found on this page.') {
          return result;
        }
      }
      
      console.log('All fallback methods failed');
      return 'No readable content found on this page.';
      
    } catch (error) {
      console.error('Fallback extraction failed:', error);
      return 'Text extraction failed.';
    }
  },
  
  extractFromSpecificElements() {
    console.log('Trying extraction from specific elements...');
    
    // Try to find text in specific elements
    const specificSelectors = [
      'h1, h2, h3, h4, h5, h6',
      'p:not(.sidebar p):not(.menu p):not(.nav p)',
      'li:not(.sidebar li):not(.menu li):not(.nav li)',
      'blockquote',
      'pre',
      'span:not(.icon):not(.button)'
    ];
    
    let combinedText = '';
    
    for (const selector of specificSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isExcludedElement(element)) continue;
        const text = element.textContent?.trim();
        if (text && text.length > 10) {
          combinedText += text + ' ';
        }
      }
    }
    
    const cleaned = Utils.cleanText(combinedText);
    if (Utils.isValidText(cleaned)) {
      console.log(`Specific elements extraction: ${cleaned.length} characters`);
      return cleaned;
    }
    
    return null;
  },
  
  extractFromBodyWithFiltering() {
    console.log('Trying body extraction with filtering...');
    
    // Clone body and remove unwanted elements
    const body = document.body.cloneNode(true);
    Utils.removeElements(body, CONFIG.EXCLUDE_SELECTORS);
    
    // Also remove specific unwanted elements
    const additionalExcludes = [
      'script', 'style', 'noscript', 'iframe', 'object', 'embed',
      '.cookie-notice', '.popup', '.modal', '.overlay'
    ];
    Utils.removeElements(body, additionalExcludes);
    
    const text = body.textContent || '';
    const cleaned = Utils.cleanText(text);
    
    if (Utils.isValidText(cleaned)) {
      const truncated = cleaned.length > CONFIG.MAX_CONTENT_LENGTH 
        ? cleaned.substring(0, CONFIG.MAX_CONTENT_LENGTH) + '...'
        : cleaned;
      console.log(`Body filtering extraction: ${truncated.length} characters`);
      return truncated;
    }
    
    return null;
  },
  
  extractFromVisibleText() {
    console.log('Trying visible text extraction...');
    
    // Get all visible text elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip hidden elements
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip excluded elements
          if (this.isExcludedElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let combinedText = '';
    let node;
    
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text && text.length > 5) {
        combinedText += text + ' ';
      }
    }
    
    const cleaned = Utils.cleanText(combinedText);
    if (Utils.isValidText(cleaned)) {
      console.log(`Visible text extraction: ${cleaned.length} characters`);
      return cleaned;
    }
    
    return null;
  },
  
  extractMinimalContent() {
    console.log('Trying minimal content extraction...');
    
    // As a last resort, try to get any meaningful text
    const title = document.title || '';
    const bodyText = document.body?.textContent || '';
    const cleaned = Utils.cleanText(bodyText);
    
    // Lower the minimum content length requirement for fallback
    if (cleaned.length >= 10) {
      const result = title ? `Title: ${title}\n\n${cleaned}` : cleaned;
      const truncated = result.length > CONFIG.MAX_CONTENT_LENGTH 
        ? result.substring(0, CONFIG.MAX_CONTENT_LENGTH) + '...'
        : result;
      console.log(`Minimal content extraction: ${truncated.length} characters`);
      return truncated;
    }
    
    return null;
  }
};

// === NOTIFICATION SYSTEM ===
const NotificationSystem = {
  show(message, type = 'info') {
    console.log(`Showing notification: ${message}`);
    
    try {
      // Remove existing notifications
      this.removeExisting();
      
      // Create notification element
      const notification = this.createElement(message, type);
      document.body.appendChild(notification);
      
      // Auto-remove after duration
      setTimeout(() => this.remove(notification), CONFIG.NOTIFICATION_DURATION);
      
      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      // Fallback to console log
      console.log(`NOTIFICATION: ${message}`);
    }
  },
  
  createElement(message, type) {
    const notification = Utils.createElement('div', 'knowledge-capture-notification', {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '10000',
      background: this.getBackgroundColor(type),
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      maxWidth: '300px',
      wordWrap: 'break-word',
      opacity: '0',
      transform: 'translateY(-20px)',
      transition: 'all 0.3s ease'
    });
    
    notification.textContent = message;
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });
    
    return notification;
  },
  
  getBackgroundColor(type) {
    const colors = {
      success: '#4CAF50',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3'
    };
    return colors[type] || colors.info;
  },
  
  removeExisting() {
    const existing = document.querySelectorAll('.knowledge-capture-notification');
    existing.forEach(notification => this.remove(notification));
  },
  
  remove(notification) {
    if (!notification || !notification.parentNode) return;
    
    // Animate out
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
};

// === DIALOG SYSTEM ===
const DialogSystem = {
  async showConfirmation(message) {
    console.log(`Showing confirmation dialog: ${message}`);
    
    return new Promise((resolve) => {
      try {
        const dialog = this.createDialog(message, resolve);
        document.body.appendChild(dialog);
        
        // Auto-reject after timeout
        setTimeout(() => {
          resolve(false);
          this.removeDialog(dialog);
        }, CONFIG.DIALOG_TIMEOUT);
        
      } catch (error) {
        console.error('Failed to show dialog:', error);
        resolve(false);
      }
    });
  },
  
  createDialog(message, resolve) {
    // Create overlay
    const overlay = Utils.createElement('div', 'knowledge-capture-dialog-overlay', {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '10001',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: '0',
      transition: 'opacity 0.3s ease'
    });
    
    // Create dialog
    const dialog = Utils.createElement('div', 'knowledge-capture-dialog', {
      background: 'white',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '500px',
      margin: '20px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      transform: 'scale(0.9)',
      transition: 'transform 0.3s ease'
    });
    
    // Message
    const messageEl = Utils.createElement('div', 'dialog-message', {
      fontSize: '16px',
      lineHeight: '1.5',
      marginBottom: '24px',
      color: '#333',
      whiteSpace: 'pre-wrap'
    });
    messageEl.textContent = message;
    
    // Buttons container
    const buttons = Utils.createElement('div', 'dialog-buttons', {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end'
    });
    
    // Cancel button
    const cancelBtn = this.createButton('Keep Existing', false, resolve, overlay);
    // Confirm button
    const confirmBtn = this.createButton('Replace', true, resolve, overlay);
    confirmBtn.style.backgroundColor = '#2196F3';
    
    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttons);
    overlay.appendChild(dialog);
    
    // Setup event handlers
    this.setupDialogEvents(overlay, resolve);
    
    // Animate in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      dialog.style.transform = 'scale(1)';
    });
    
    return overlay;
  },
  
  createButton(text, result, resolve, overlay) {
    const button = Utils.createElement('button', 'dialog-button', {
      padding: '12px 24px',
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      backgroundColor: result ? '#2196F3' : '#666',
      color: 'white',
      transition: 'background-color 0.2s ease'
    });
    
    button.textContent = text;
    button.addEventListener('click', () => {
      resolve(result);
      this.removeDialog(overlay);
    });
    
    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = result ? '#1976D2' : '#555';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = result ? '#2196F3' : '#666';
    });
    
    return button;
  },
  
  setupDialogEvents(overlay, resolve) {
    // Click overlay to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        resolve(false);
        this.removeDialog(overlay);
      }
    });
    
    // Escape key to cancel
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        resolve(false);
        this.removeDialog(overlay);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  },
  
  removeDialog(overlay) {
    if (!overlay || !overlay.parentNode) return;
    
    // Animate out
    overlay.style.opacity = '0';
    const dialog = overlay.querySelector('.knowledge-capture-dialog');
    if (dialog) {
      dialog.style.transform = 'scale(0.9)';
    }
    
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 300);
  }
};

// === MESSAGE HANDLER ===
const MessageHandler = {
  handlers: {
    ping: () => {
      console.log('Ping received from background script');
      return { status: 'ready' };
    },
    
    extract_text: () => {
      console.log('Text extraction requested');
      console.log('Current URL:', window.location.href);
      console.log('Content type:', document.contentType);
      console.log('Is PDF detected:', Utils.isPDF());
      
      const text = TextExtractor.extract();
      console.log(`Extracted ${text.length} characters`);
      console.log('First 200 characters:', text.substring(0, 200));
      
      return { text };
    },
    
    show_notification: (message) => {
      console.log('Notification requested:', message.message);
      NotificationSystem.show(message.message);
      return { success: true };
    },
    
    confirm_replacement: async (message) => {
      console.log('Confirmation dialog requested:', message.message);
      const result = await DialogSystem.showConfirmation(message.message);
      console.log('User response:', result ? 'Replace' : 'Keep existing');
      return { replace: result };
    },
    
    showDuplicateModal: (message) => {
      // This message is meant for the popup, not the content script
      // Just ignore it silently
      return { ignored: true };
    }
  },
  
  async handle(message, sender, sendResponse) {
    console.log('Content script received message:', message.action);
    
    try {
      const handler = this.handlers[message.action];
      if (!handler) {
        console.warn('Unknown message action:', message.action);
        sendResponse({ error: 'Unknown action' });
        return false;
      }
      
      const result = await handler(message, sender);
      sendResponse(result);
      return true;
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
      return false;
    }
  }
};

// === INITIALIZATION ===
const ContentScript = {
  init() {
    console.log('Knowledge Capture & AI Search - Content script loaded');
    this.setupMessageListener();
    this.injectStyles();
  },
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const isAsync = MessageHandler.handle(message, sender, sendResponse);
      return isAsync; // Keep message channel open for async responses
    });
  },
  
  injectStyles() {
    // Inject styles for notifications and dialogs
    const styles = `
      .knowledge-capture-notification {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
      }
      
      .knowledge-capture-dialog-overlay * {
        box-sizing: border-box;
      }
      
      .knowledge-capture-dialog {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }
      
      .dialog-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .dialog-button:active {
        transform: translateY(0);
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }
};

// === AUTO-INITIALIZATION ===
(() => {
  ContentScript.init();
})(); 

// === NOTEBOOKLM DETECTION ===
function detectNotebookLM() {
  // Check if we're on a NotebookLM page
  if (window.location.hostname === 'notebooklm.google.com') {
    const url = window.location.href;
    const notebookMatch = url.match(/\/notebook\/([a-f0-9-]+)/);
    
    if (notebookMatch) {
      const notebookId = notebookMatch[1];
      console.log('NotebookLM: Detected notebook ID:', notebookId);
      
      // Store the notebook ID for the extension to use
      chrome.storage.local.set({ 
        'lastNotebookId': notebookId,
        'lastNotebookUrl': url,
        'lastNotebookTimestamp': Date.now()
      }, () => {
        console.log('NotebookLM: Stored notebook ID:', notebookId);
      });
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'notebookDetected',
        notebookId: notebookId,
        url: url
      });
    }
  }
}

// Run detection when page loads
detectNotebookLM();

// Also detect when URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    detectNotebookLM();
  }
}).observe(document, { subtree: true, childList: true }); 