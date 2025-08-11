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
    '.mw-parser-output', // Wikipedia main content
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
    
    // Wikipedia specific elements
    '.navbox', '.infobox', '.sidebar', '.toc', '.thumbcaption',
    '.navigation-only', '.printfooter', '.catlinks', '.mw-jump-link',
    '.mw-editsection', '.reference', '.reflist', '.navframe',
    '.mw-collapsible', '.hatnote', '.dablink', '.rellink',
    '#mw-navigation', '#p-search', '#p-personal', '#p-namespaces',
    '#p-views', '#p-cactions', '#footer', '#siteNotice',
    
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
      // Wikipedia specific cleanup
      .replace(/Main menu.*?hide\s*/gi, '') // Remove "Main menu ... hide" navigation
      .replace(/Navigation.*?toggle\s*/gi, '') // Remove navigation toggles
      .replace(/move to sidebar\s*/gi, '') // Remove "move to sidebar"
      .replace(/\[edit\]/g, '') // Remove [edit] links
      .replace(/\[\d+\]/g, '') // Remove citation numbers like [1], [2]
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
  },

  // Check if the page has valid content for auto-capture
  hasValidContent() {
    try {
      // Check if it's a PDF
      if (Utils.isPDF()) {
        return true; // PDFs are always capturable
      }

      // Check for basic content indicators
      const title = document.title?.trim();
      if (!title || title.length < 3) {
        return false;
      }

      // Check for content selectors
      for (const selector of CONFIG.CONTENT_SELECTORS) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || '';
          if (text.length >= CONFIG.MIN_CONTENT_LENGTH) {
            console.log('TextExtractor: Valid content found via:', selector);
            return true;
          }
        }
      }

      // Fallback: check body content
      const bodyText = document.body?.textContent?.trim() || '';
      return bodyText.length >= CONFIG.MIN_CONTENT_LENGTH;
    } catch (error) {
      console.error('Error checking valid content:', error);
      return false;
    }
  },

  // Extract text for auto-capture (similar to extract but returns entry object)
  async extractText() {
    try {
      const text = this.extract();
      if (!text || text.length < CONFIG.MIN_CONTENT_LENGTH) {
        return null;
      }

      // Create entry object
      const entry = {
        title: document.title || 'Untitled',
        url: window.location.href,
        text: text,
        timestamp: new Date().toISOString(),
        wordCount: text.split(/\s+/).length,
        author: this.extractAuthor()
      };

      return entry;
    } catch (error) {
      console.error('Text extraction for auto-capture failed:', error);
      return null;
    }
  },

  // Extract author information
  extractAuthor() {
    try {
      // Try various author selectors
      const authorSelectors = [
        'meta[name="author"]',
        'meta[property="article:author"]',
        '.author',
        '.byline',
        '[rel="author"]',
        '.post-author',
        '.article-author'
      ];

      for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const author = element.getAttribute('content') || element.textContent?.trim();
          if (author && author.length > 0 && author.length < 100) {
            return author;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Author extraction failed:', error);
      return null;
    }
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

// === CAP BANNER (on-page) ===
const CapBanner = {
  async showOnce() {
    try {
      // Avoid duplicates
      if (document.getElementById('kc-cap-banner')) return;
      const bar = Utils.createElement('div', '', {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        background: '#F59E0B',
        color: '#111827',
        padding: '12px 14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '360px',
        borderRadius: '10px',
        boxShadow: '0 8px 18px rgba(0,0,0,0.2)'
      });
      bar.id = 'kc-cap-banner';
      const msg = Utils.createElement('div', '', { lineHeight: '1.35' });
      msg.textContent = 'Free embedding limit reached. Set a Custom Vertex Proxy URL in the extension Settings to continue.';
      const btn = Utils.createElement('button', '', {
        background: '#111827',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: '12px',
        whiteSpace: 'nowrap'
      });
      btn.textContent = 'Open Settings';
      btn.onclick = async () => {
        try {
          // Mark dismissed for this host
          const host = window.location.hostname;
          const { capBannerDismissedSites } = await chrome.storage.local.get('capBannerDismissedSites');
          const map = capBannerDismissedSites || {};
          map[host] = true;
          await chrome.storage.local.set({ capBannerDismissedSites: map });
          // Open settings
          chrome.runtime.sendMessage({ action: 'open_extension_settings' });
        } catch (_) {}
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      };
      bar.appendChild(msg);
      bar.appendChild(btn);
      document.body.appendChild(bar);
    } catch (_) {}
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
    },

    update_auto_capture_setting: (message) => {
      console.log('Auto-capture setting update received:', message.enabled);
      AutoCapture.updateSetting(message.enabled, message.webReminderEnabled, message.autoCaptureDelayMs);
      return { success: true };
    },

    trigger_auto_capture: (message) => {
      console.log('Auto-capture trigger received from background script');
      AutoCapture.triggerFromBackground();
      return { success: true };
    },

    usage_cap_embed: async () => {
      try {
        // Suppress if user already dismissed for this host (once per site)
        const host = window.location.hostname;
        const { capBannerDismissedSites } = await chrome.storage.local.get('capBannerDismissedSites');
        const dismissed = capBannerDismissedSites && capBannerDismissedSites[host];
        if (dismissed) return { success: true, skipped: true };
        // Pause auto-capture and show banner once
        AutoCapture.autoCaptureEnabled = false;
        CapBanner.showOnce();
        return { success: true };
      } catch (_) {
        return { success: false };
      }
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

// === AUTO-CAPTURE FUNCTIONALITY ===
const AutoCapture = {
  autoCaptureEnabled: false,
  hasAutoCapture: false,
  captureTimeout: null,
  
  init() {
    // Load auto-capture setting from storage
    this.loadSettings();
    
    // Set up auto-capture after page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupAutoCapture());
    } else {
      this.setupAutoCapture();
    }
  },
  
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get('extensionSettings');
      const settings = result.extensionSettings || {};
      this.autoCaptureEnabled = settings.autoCaptureEnabled !== undefined ? settings.autoCaptureEnabled : true;
      this.webReminderEnabled = settings.webReminderEnabled !== undefined ? settings.webReminderEnabled : true;
      this.autoCaptureDelayMs = settings.autoCaptureDelayMs !== undefined ? settings.autoCaptureDelayMs : 'default';
      // Pause auto-capture if cap was hit and no custom proxy configured
      try {
        const capState = await chrome.storage.local.get(['autoCapturePaused']);
        const paused = !!capState.autoCapturePaused;
        const hasCustomProxy = !!(settings.customProxyUrl && settings.customProxyUrl.trim());
        if (paused && !hasCustomProxy) {
          this.autoCaptureEnabled = false;
        }
      } catch (_) {}
    } catch (error) {
      console.error('Failed to load auto-capture setting:', error);
      this.autoCaptureEnabled = true;
      this.webReminderEnabled = true;
      this.autoCaptureDelayMs = 'default';
    }
  },
  
  setupAutoCapture() {
    if (!this.autoCaptureEnabled) {
      return;
    }
    
    if (this.hasAutoCapture) {
      return;
    }
    
    // Check if this is a capturable page
    const capturable = this.isCapturablePage();
    
    if (!capturable) {
      return;
    }
    
    // Wait for configured dwell time before capturing
    const delay = (!this.autoCaptureDelayMs || this.autoCaptureDelayMs === 'default')
      ? 3000
      : (Number.isFinite(parseInt(this.autoCaptureDelayMs, 10)) ? parseInt(this.autoCaptureDelayMs, 10) : 3000);
    this.captureTimeout = setTimeout(() => {
      this.performAutoCapture();
    }, delay);
  },
  
  isCapturablePage() {
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    // Skip NotebookLM pages
    if (hostname === 'notebooklm.google.com') {
      return false;
    }
    
    // Skip extension pages
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      return false;
    }
    
    // Skip local files
    if (url.startsWith('file://')) {
      return false;
    }
    
    // Skip chrome:// pages
    if (url.startsWith('chrome://') || url.startsWith('about:')) {
      return false;
    }
    
    // Skip search engine results pages (not valuable for semantic search)
    if (this.isSearchEnginePage(hostname, url)) {
      return false;
    }
    
    // Use smart content analysis to determine if page is worth capturing
    const shouldCapture = ContentAnalyzer.shouldCapturePage();
    
    return shouldCapture;
  },
  
  // Check if it's a search engine results page
  isSearchEnginePage(hostname, url) {
    const searchEngines = [
      { domain: 'www.google.com', pattern: '/search?' },
      { domain: 'www.bing.com', pattern: '/search?' },
      { domain: 'duckduckgo.com', pattern: '/?q=' },
      { domain: 'www.yahoo.com', pattern: '/search?' },
      { domain: 'search.yahoo.com', pattern: '/search?' },
      { domain: 'www.baidu.com', pattern: '/s?' },
      { domain: 'yandex.com', pattern: '/search?' },
      { domain: 'www.qwant.com', pattern: '/?' }
    ];
    
    return searchEngines.some(engine => 
      hostname === engine.domain && url.includes(engine.pattern)
    );
  },

  isSensitiveGoogleService(hostname, url) {
    const sensitiveGoogleServices = [
      'calendar.google.com',           // Google Calendar
      'mail.google.com',               // Gmail
      'drive.google.com',              // Google Drive
      'docs.google.com',               // Google Docs/Sheets/Slides
      'sheets.google.com',
      'slides.google.com',
      'forms.google.com',              // Google Forms
      'photos.google.com',             // Google Photos
      'contacts.google.com',           // Google Contacts
      'keep.google.com',               // Google Keep
      'myaccount.google.com',          // Google Account
      'accounts.google.com',           // Google Auth
      'admin.google.com',              // Google Admin
      'console.cloud.google.com',      // Google Cloud Console
      'analytics.google.com',          // Google Analytics
      'ads.google.com',                // Google Ads
      'pay.google.com',                // Google Pay
      'wallet.google.com'              // Google Wallet
    ];
    
    return sensitiveGoogleServices.includes(hostname);
  },
  
  // Check if it's a login/authentication page
  isLoginPage(url) {
    const loginPatterns = [
      '/login', '/signin', '/sign-in', '/auth', '/authenticate',
      '/register', '/signup', '/sign-up', '/create-account',
      '/password', '/reset', '/forgot', '/verify',
      '/oauth', '/sso', '/saml', '/2fa', '/mfa'
    ];
    
    return loginPatterns.some(pattern => url.toLowerCase().includes(pattern));
  },
  
  // Check if it's a social media platform
  isSocialMediaPlatform(hostname) {
    const socialMediaSites = [
      'facebook.com', 'www.facebook.com', 'm.facebook.com',
      'twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'x.com',
      'instagram.com', 'www.instagram.com',
      'linkedin.com', 'www.linkedin.com',
      'tiktok.com', 'www.tiktok.com',
      'snapchat.com', 'www.snapchat.com',
      'pinterest.com', 'www.pinterest.com',
      'reddit.com', 'www.reddit.com',
      'discord.com', 'www.discord.com',
      'telegram.org', 'web.telegram.org',
      'whatsapp.com', 'web.whatsapp.com'
    ];
    
    return socialMediaSites.includes(hostname);
  },
  
  // Check if it's an email or messaging platform
  isEmailOrMessaging(hostname) {
    const emailMessagingSites = [
      'outlook.live.com', 'outlook.office.com', 'outlook.com',
      'mail.yahoo.com', 'mail.aol.com',
      'protonmail.com', 'tutanota.com',
      'slack.com', 'teams.microsoft.com',
      'zoom.us', 'meet.google.com',
      'skype.com', 'web.skype.com',
      'messenger.com', 'www.messenger.com'
    ];
    
    return emailMessagingSites.includes(hostname);
  },
  
  // Check if it's a financial/banking site
  isFinancialSite(hostname) {
    const financialSites = [
      // Major banks
      'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com',
      'usbank.com', 'capitalone.com', 'americanexpress.com',
      
      // Investment platforms
      'robinhood.com', 'etrade.com', 'schwab.com', 'fidelity.com',
      'tdameritrade.com', 'vanguard.com', 'merrilledge.com',
      
      // Payment platforms
      'paypal.com', 'venmo.com', 'cashapp.com', 'zelle.com',
      'stripe.com', 'square.com',
      
      // Crypto platforms
      'coinbase.com', 'binance.com', 'kraken.com', 'gemini.com',
      
      // Financial services
      'mint.com', 'creditkarma.com', 'nerdwallet.com',
      'turbotax.com', 'hrblock.com'
    ];
    
    return financialSites.some(site => hostname.includes(site));
  },
  
  // Check if it's an e-commerce account/checkout page
  isEcommerceAccountPage(url) {
    const ecommercePatterns = [
      '/account', '/my-account', '/profile', '/dashboard',
      '/checkout', '/cart', '/basket', '/payment',
      '/billing', '/shipping', '/order', '/orders',
      '/wishlist', '/favorites', '/saved-items'
    ];
    
    const ecommerceSites = [
      'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
      'bestbuy.com', 'homedepot.com', 'lowes.com',
      'shopify.com', 'etsy.com', 'aliexpress.com'
    ];
    
    const hostname = new URL(url).hostname;
    const isEcommerceSite = ecommerceSites.some(site => hostname.includes(site));
    const hasEcommercePattern = ecommercePatterns.some(pattern => 
      url.toLowerCase().includes(pattern)
    );
    
    return isEcommerceSite && hasEcommercePattern;
  },
  
  // Check if it's a video streaming platform
  isVideoStreamingPlatform(hostname) {
    const videoStreamingSites = [
      // Video platforms
      'youtube.com', 'www.youtube.com', 'm.youtube.com',
      'youtu.be', 'youtube-nocookie.com',
      
      // Streaming services
      'netflix.com', 'www.netflix.com',
      'hulu.com', 'www.hulu.com',
      'disneyplus.com', 'www.disneyplus.com',
      'hbomax.com', 'play.hbomax.com',
      'primevideo.com', 'www.primevideo.com',
      'apple.com/tv', 'tv.apple.com',
      'peacocktv.com', 'www.peacocktv.com',
      'paramount.com', 'www.paramountplus.com',
      
      // Video conferencing
      'zoom.us', 'us02web.zoom.us', 'us04web.zoom.us',
      'teams.microsoft.com', 'teams.live.com',
      'meet.google.com', 'hangouts.google.com',
      'webex.com', 'www.webex.com',
      'gotomeeting.com', 'www.gotomeeting.com',
      
      // Live streaming
      'twitch.tv', 'www.twitch.tv',
      'vimeo.com', 'player.vimeo.com',
      'dailymotion.com', 'www.dailymotion.com'
    ];
    
    return videoStreamingSites.some(site => hostname.includes(site));
  },
  
  // Check if it's an entertainment/gaming site
  isEntertainmentSite(hostname) {
    const entertainmentSites = [
      // Gaming platforms
      'steam.com', 'store.steampowered.com',
      'epicgames.com', 'store.epicgames.com',
      'origin.com', 'www.origin.com',
      'battle.net', 'us.battle.net',
      'xbox.com', 'www.xbox.com',
      'playstation.com', 'store.playstation.com',
      'nintendo.com', 'www.nintendo.com',
      
      // Gaming news/communities
      'ign.com', 'gamespot.com', 'kotaku.com',
      'polygon.com', 'destructoid.com',
      
      // Entertainment news
      'tmz.com', 'www.tmz.com',
      'entertainment.com', 'ew.com',
      'variety.com', 'www.variety.com',
      'hollywoodreporter.com', 'www.hollywoodreporter.com',
      
      // Music streaming
      'spotify.com', 'open.spotify.com',
      'music.apple.com', 'itunes.apple.com',
      'music.youtube.com',
      'soundcloud.com', 'www.soundcloud.com',
      'pandora.com', 'www.pandora.com',
      
      // Sports
      'espn.com', 'www.espn.com',
      'nfl.com', 'www.nfl.com',
      'nba.com', 'www.nba.com',
      'mlb.com', 'www.mlb.com'
    ];
    
    return entertainmentSites.some(site => hostname.includes(site));
  },
  
  // Check if it's a developer tool or admin interface
  isDeveloperTool(hostname, url) {
    const developerToolSites = [
      // Development platforms
      'github.com', 'www.github.com',
      'gitlab.com', 'www.gitlab.com',
      'bitbucket.org', 'www.bitbucket.org',
      
      // Cloud platforms (admin interfaces)
      'console.aws.amazon.com',
      'portal.azure.com',
      'console.cloud.google.com',
      'dashboard.heroku.com',
      'app.netlify.com',
      'vercel.com/dashboard',
      
      // Monitoring/analytics dashboards
      'app.datadoghq.com',
      'grafana.com',
      'newrelic.com',
      'sentry.io',
      
      // API documentation (often not useful for semantic search)
      'swagger.io', 'app.swaggerhub.com',
      'postman.com', 'web.postman.co'
    ];
    
    const adminPatterns = [
      '/admin', '/dashboard', '/console', '/panel',
      '/manage', '/settings', '/config', '/cp'
    ];
    
    const isDeveloperSite = developerToolSites.some(site => hostname.includes(site));
    const hasAdminPattern = adminPatterns.some(pattern => 
      url.toLowerCase().includes(pattern)
    );
    
    return isDeveloperSite || hasAdminPattern;
  },
  
  // Check if it's a shopping/marketplace site (product pages)
  isShoppingSite(hostname, url) {
    const shoppingSites = [
      'amazon.com', 'www.amazon.com',
      'ebay.com', 'www.ebay.com',
      'walmart.com', 'www.walmart.com',
      'target.com', 'www.target.com',
      'bestbuy.com', 'www.bestbuy.com',
      'homedepot.com', 'www.homedepot.com',
      'lowes.com', 'www.lowes.com',
      'costco.com', 'www.costco.com',
      'samsclub.com', 'www.samsclub.com',
      'etsy.com', 'www.etsy.com',
      'aliexpress.com', 'www.aliexpress.com',
      'alibaba.com', 'www.alibaba.com',
      'wayfair.com', 'www.wayfair.com',
      'overstock.com', 'www.overstock.com'
    ];
    
    const shoppingPatterns = [
      '/product/', '/item/', '/p/', '/dp/',
      '/buy', '/shop', '/store', '/marketplace',
      '/deals', '/sale', '/clearance'
    ];
    
    const isShoppingSite = shoppingSites.some(site => hostname.includes(site));
    const hasShoppingPattern = shoppingPatterns.some(pattern => 
      url.toLowerCase().includes(pattern)
    );
    
    return isShoppingSite && hasShoppingPattern;
  },
  
  async performAutoCapture() {
    if (!this.autoCaptureEnabled || this.hasAutoCapture) {
      return;
    }
    
    try {
      this.hasAutoCapture = true;
      
      // Extract text using the existing TextExtractor
      const entry = await TextExtractor.extractText();
      
      if (!entry || !entry.text || entry.text.length < CONFIG.MIN_CONTENT_LENGTH) {
        return;
      }
      
      // Send to background script for saving (let it handle duplicates properly)
      const response = await chrome.runtime.sendMessage({
        action: 'save_entry',
        entry: entry
      });
      
      if (response && response.success && response.action === 'saved') {
        // Show on-page reminder only if enabled by user
        if (this.webReminderEnabled) {
          NotificationSystem.show(`📄 Auto-captured: ${entry.title}`, 'info');
        }
        
        // Notify popup to refresh if it's open
        try {
          chrome.runtime.sendMessage({
            action: 'refresh_display'
          });
        } catch (error) {
          // Popup might not be open, ignore
        }
      }
    } catch (error) {
      console.error('Auto-capture failed:', error);
    }
  },
  

  
  updateSetting(enabled, webReminderEnabled, autoCaptureDelayMs) {
    this.autoCaptureEnabled = enabled;
    if (typeof webReminderEnabled === 'boolean') {
      this.webReminderEnabled = webReminderEnabled;
    }
    if (autoCaptureDelayMs !== undefined) {
      this.autoCaptureDelayMs = autoCaptureDelayMs;
    }
    // If custom proxy is now set and global pause flag exists, re-enable auto-capture
    chrome.storage.local.get(['extensionSettings','autoCapturePaused'], (res) => {
      try {
        const settings = res.extensionSettings || {};
        const paused = !!res.autoCapturePaused;
        const hasCustomProxy = !!(settings.customProxyUrl && String(settings.customProxyUrl).trim());
        if (hasCustomProxy && paused) {
          this.autoCaptureEnabled = true;
          chrome.storage.local.remove('autoCapturePaused');
        }
      } catch (_) {}
    });
    
    if (enabled && !this.hasAutoCapture) {
      // If enabling and haven't captured this page yet
      this.setupAutoCapture();
    } else if (!enabled && this.captureTimeout) {
      // If disabling, cancel pending capture
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }
  },

  resetForNewPage() {
    // Reset state for new page
    this.hasAutoCapture = false;
    
    // Cancel any pending capture
    if (this.captureTimeout) {
      clearTimeout(this.captureTimeout);
      this.captureTimeout = null;
    }
    
    // Try auto-capture on new page if enabled
    if (this.autoCaptureEnabled) {
      // Add a small delay to let the new page content load
      setTimeout(() => {
        this.setupAutoCapture();
      }, 1000);
    }
  },

  triggerFromBackground() {
    // Load settings first, then try auto-capture
    this.loadSettings().then(() => {
      if (this.autoCaptureEnabled && !this.hasAutoCapture) {
        // Add a small delay to ensure page is ready
        setTimeout(() => {
          this.setupAutoCapture();
        }, 2000); // 2 second delay for background-triggered captures
      }
    }).catch(error => {
      console.error('AutoCapture: Failed to load settings for background trigger:', error);
    });
  }
};

// === SMART CONTENT ANALYSIS ===
const ContentAnalyzer = {
  // Educational/informational keywords that indicate valuable content
  EDUCATIONAL_KEYWORDS: [
    'analysis', 'research', 'study', 'explains', 'explanation', 'tutorial',
    'guide', 'how to', 'what is', 'definition', 'concept', 'theory',
    'method', 'approach', 'framework', 'model', 'principle', 'strategy',
    'insight', 'finding', 'discovery', 'evidence', 'data', 'statistics',
    'report', 'paper', 'article', 'publication', 'journal', 'academic',
    'scholarly', 'scientific', 'technical', 'professional', 'expert',
    'authority', 'reference', 'source', 'citation', 'bibliography'
  ],

  // Commercial/transactional keywords that indicate low-value content
  COMMERCIAL_KEYWORDS: [
    'buy', 'purchase', 'order', 'checkout', 'cart', 'shopping',
    'sale', 'discount', 'offer', 'deal', 'price', 'cost',
    'subscribe', 'sign up', 'register', 'login', 'account',
    'payment', 'billing', 'shipping', 'delivery', 'return',
    'review', 'rating', 'star', 'recommend', 'sponsored', 'ad'
  ],

  // DOM patterns that indicate page types
  DOM_PATTERNS: {
    // High-value content indicators
    EDUCATIONAL: [
      'article', 'main', '[role="main"]', '.content', '.article',
      '.post', '.entry', '.story', '.paper', '.research',
      '.tutorial', '.guide', '.documentation', '.manual'
    ],
    
    // Low-value content indicators
    COMMERCIAL: [
      '.cart', '.checkout', '.payment', '.billing', '.order',
      '.product', '.item', '.buy', '.purchase', '.shopping',
      '.subscribe', '.signup', '.login', '.account', '.profile'
    ],
    
    // Navigation/noise indicators
    NAVIGATION: [
      'nav', '.nav', '.navigation', '.menu', '.sidebar',
      '.breadcrumb', '.pagination', '.footer', '.header',
      '.ad', '.advertisement', '.sponsored', '.promo'
    ],
    
    // Interactive elements (forms, buttons)
    INTERACTIVE: [
      'form', 'input', 'button', '.btn', '.button',
      '.form', '.login-form', '.signup-form', '.search-form'
    ]
  },

  // Analyze page content quality using multiple heuristics
  analyzePageQuality() {
    const analysis = {
      score: 0,
      factors: {},
      recommendations: []
    };

    // 1. DOM Structure Analysis
    const domScore = this.analyzeDOMStructure();
    analysis.factors.domStructure = domScore;
    analysis.score += domScore.score;

    // 2. Content Quality Analysis
    const contentScore = this.analyzeContentQuality();
    analysis.factors.contentQuality = contentScore;
    analysis.score += contentScore.score;

    // 3. Text-to-Noise and Media-to-Text Ratio
    const textNoiseScore = this.analyzeTextToNoiseRatio();
    analysis.factors.textNoiseRatio = textNoiseScore;
    analysis.score += textNoiseScore.score;

    // 4. Page Type Detection (URL + metadata)
    const pageTypeScore = this.detectPageType();
    analysis.factors.pageType = pageTypeScore;
    analysis.score += pageTypeScore.score;

    // 5. Educational Value Assessment
    const educationalScore = this.assessEducationalValue();
    analysis.factors.educationalValue = educationalScore;
    analysis.score += educationalScore.score;

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.factors);

    return analysis;
  },

  // Analyze DOM structure for content vs. noise
  analyzeDOMStructure() {
    const result = { score: 0, details: {} };
    
    // Count different types of elements
    const educationalElements = this.countElements(ContentAnalyzer.DOM_PATTERNS.EDUCATIONAL);
    const commercialElements = this.countElements(ContentAnalyzer.DOM_PATTERNS.COMMERCIAL);
    const navigationElements = this.countElements(ContentAnalyzer.DOM_PATTERNS.NAVIGATION);
    const interactiveElements = this.countElements(ContentAnalyzer.DOM_PATTERNS.INTERACTIVE);

    result.details = {
      educational: educationalElements,
      commercial: commercialElements,
      navigation: navigationElements,
      interactive: interactiveElements
    };

    // Score based on element ratios
    const totalElements = educationalElements + commercialElements + navigationElements + interactiveElements;
    
    if (totalElements > 0) {
      const educationalRatio = educationalElements / totalElements;
      const commercialRatio = commercialElements / totalElements;
      const navigationRatio = navigationElements / totalElements;
      const interactiveRatio = interactiveElements / totalElements;

      // Positive score for educational content
      result.score += educationalRatio * 50;
      
      // Negative score for commercial content
      result.score -= commercialRatio * 30;
      
      // Negative score for too much navigation/noise
      result.score -= navigationRatio * 20;
      
      // Negative score for too many interactive elements (forms, etc.)
      result.score -= interactiveRatio * 25;
    }

    return result;
  },

  // Analyze content quality based on text characteristics
  analyzeContentQuality() {
    const result = { score: 0, details: {} };
    
    const mainContent = this.extractMainContent();
    if (!mainContent) {
      result.score = -50; // No main content found
      return result;
    }

    const text = mainContent.textContent || '';
    const wordCount = text.split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).length;
    const paragraphCount = mainContent.querySelectorAll('p').length;

    result.details = {
      wordCount,
      sentenceCount,
      paragraphCount,
      avgWordsPerSentence: sentenceCount > 0 ? wordCount / sentenceCount : 0,
      avgWordsPerParagraph: paragraphCount > 0 ? wordCount / paragraphCount : 0
    };

    // Score based on content characteristics
    if (wordCount < 50) {
      result.score -= 30; // Too short
    } else if (wordCount > 500) {
      result.score += 20; // Substantial content
    }

    if (sentenceCount > 5) {
      result.score += 15; // Multiple sentences
    }

    if (paragraphCount > 2) {
      result.score += 15; // Well-structured
    }

    // Penalize very short sentences (likely navigation/ads)
    if (result.details.avgWordsPerSentence < 3) {
      result.score -= 20;
    }

    // Strong minimum-content gates (generic)
    if (wordCount < 250) {
      result.score -= 25; // Not enough substance
    }
    if (paragraphCount < 3) {
      result.score -= 20; // Poor structure
    }
    if (result.details.avgWordsPerSentence < 6) {
      result.score -= 15; // Too terse
    }

    return result;
  },

  // Calculate text-to-noise ratio
  analyzeTextToNoiseRatio() {
    const result = { score: 0, details: {} };
    
    const body = document.body;
    if (!body) return result;

    // Get all text content
    const allText = body.textContent || '';
    const totalCharacters = allText.length;
    
    // Get main content area text
    const mainContent = this.extractMainContent();
    const mainText = mainContent ? (mainContent.textContent || '') : '';
    const mainCharacters = mainText.length;
    const mainParagraphs = mainContent ? mainContent.querySelectorAll('p').length : 0;
    const mainWordCount = mainText.split(/\s+/).length;

    // Calculate ratio
    const textToNoiseRatio = totalCharacters > 0 ? mainCharacters / totalCharacters : 0;
    
    // Media dominance (generic media vs text)
    const mediaElements = document.querySelectorAll('video, iframe, embed, object').length;
    const imageElements = document.querySelectorAll('img, picture, figure').length;
    const mediaToTextRatio = (mediaElements + imageElements) / Math.max(mainParagraphs, 1);

    result.details = {
      totalCharacters,
      mainCharacters,
      textToNoiseRatio,
      mediaElements,
      imageElements,
      mediaToTextRatio,
      mainParagraphs,
      mainWordCount
    };

    // Score based on ratio
    if (textToNoiseRatio > 0.7) {
      result.score += 30; // High content ratio
    } else if (textToNoiseRatio > 0.5) {
      result.score += 15; // Good content ratio
    } else if (textToNoiseRatio < 0.2) {
      result.score -= 30; // Too much noise
    }

    // Penalize media-dominant pages or short-with-video pages
    if (mediaToTextRatio > 2) {
      result.score -= 25;
    }
    if (mediaElements > 0 && mainWordCount < 250) {
      result.score -= 35;
    }

    return result;
  },

  // Detect page type based on URL and content patterns
  detectPageType() {
    const result = { score: 0, details: {} };
    
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    // URL intent
    if (/(\/product\/|\/item\/|\/buy\/|\/cart|\/checkout|\/signin|\/login|\?ref=|\?tag=)/.test(url)) {
      result.score -= 25;
    }
    if (/(\/article\/|\/post\/|\/blog\/|\/docs\/|\/guide\/|\/wiki\/)/.test(url)) {
      result.score += 15;
    }

    // Metadata: OpenGraph type
    const ogType = this.getOpenGraphType();
    if (ogType) {
      result.details.ogType = ogType;
      if (/(product)/i.test(ogType)) result.score -= 40;
      if (/(video)/i.test(ogType)) result.score -= 30;
      if (/(article|blog)/i.test(ogType)) result.score += 20;
    }

    // Schema.org JSON-LD types
    const jsonLdTypes = this.getJsonLdTypes();
    result.details.jsonLdTypes = jsonLdTypes;
    if (jsonLdTypes.some(t => /product|offer|aggregaterating/i.test(t))) {
      result.score -= 40;
    }
    if (jsonLdTypes.some(t => /videoobject/i.test(t))) {
      result.score -= 30;
    }
    if (jsonLdTypes.some(t => /article|newsarticle|techarticle|howto/i.test(t))) {
      result.score += 20;
    }

    // Domain heuristics (generic, not a fixed list, but cues)
    if (/shop|store|buy|cart|checkout/.test(hostname)) {
      result.score -= 20;
    }

    return result;
  },

  getOpenGraphType() {
    const el = document.querySelector('meta[property="og:type"], meta[name="og:type"]');
    const val = el && (el.getAttribute('content') || '').toLowerCase();
    return val || null;
  },

  getJsonLdTypes() {
    const types = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '{}');
        const collect = (node) => {
          if (!node) return;
          if (Array.isArray(node)) {
            node.forEach(collect);
            return;
          }
          if (typeof node === 'object') {
            if (node['@type']) {
              if (Array.isArray(node['@type'])) {
                node['@type'].forEach(t => types.push(String(t).toLowerCase()));
              } else {
                types.push(String(node['@type']).toLowerCase());
              }
            }
            for (const key of Object.keys(node)) {
              if (key !== '@type') collect(node[key]);
            }
          }
        };
        collect(data);
      } catch (_) { /* ignore malformed JSON-LD */ }
    });
    return types;
  },

  // Assess educational value based on keyword presence
  assessEducationalValue() {
    const result = { score: 0, details: {} };
    
    const text = document.body.textContent.toLowerCase();
    
    let educationalCount = 0;
    let commercialCount = 0;

    // Count educational keywords
    for (const keyword of ContentAnalyzer.EDUCATIONAL_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        educationalCount += matches.length;
      }
    }

    // Count commercial keywords
    for (const keyword of ContentAnalyzer.COMMERCIAL_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        commercialCount += matches.length;
      }
    }

    result.details = { educationalCount, commercialCount };

    // Score based on keyword ratios
    if (educationalCount > 0) {
      result.score += Math.min(educationalCount * 2, 30); // Cap at 30 points
    }
    
    if (commercialCount > 0) {
      result.score -= Math.min(commercialCount * 1.5, 25); // Cap at 25 points
    }

    return result;
  },

  // Generate recommendations based on analysis
  generateRecommendations(factors) {
    const recommendations = [];
    
    if (factors.domStructure.score < -20) {
      recommendations.push('High commercial/navigation content detected');
    }
    
    if (factors.contentQuality.score < -20) {
      recommendations.push('Content too short or poorly structured');
    }
    
    if (factors.textNoiseRatio.score < -20) {
      recommendations.push('Low content-to-noise ratio');
    }
    
    if (factors.pageType.score < -20) {
      recommendations.push('Commercial/transactional page detected');
    }
    
    if (factors.educationalValue.score < -20) {
      recommendations.push('Low educational keyword density');
    }

    return recommendations;
  },

  // Helper: Count elements matching selectors
  countElements(selectors) {
    let count = 0;
    for (const selector of selectors) {
      try {
        count += document.querySelectorAll(selector).length;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return count;
  },

  // Helper: Extract main content area
  extractMainContent() {
    const mainSelectors = [
      'main', 'article', '[role="main"]',
      '.content', '.article', '.post', '.entry',
      '.main-content', '.article-content', '.post-content'
    ];

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 100) {
        return element;
      }
    }

    // Fallback to body if no main content found
    return document.body;
  },

  // Main decision function
  shouldCapturePage() {
    const analysis = this.analyzePageQuality();
    const threshold = 40; // Stricter minimum score to capture

    // Gates using content quality and metadata
    const cq = analysis.factors.contentQuality?.details || {};
    const minContentGate = (cq.wordCount || 0) >= 200 && (cq.paragraphCount || 0) >= 3;

    const ogType = this.getOpenGraphType() || '';
    const jsonTypes = this.getJsonLdTypes();
    const isProductOrVideo = /product/i.test(ogType) ||
      jsonTypes.some(t => /product|offer|videoobject/i.test(t));
    const metadataGate = !(isProductOrVideo && (cq.wordCount || 0) < 400);

    if (!minContentGate || !metadataGate) {
      return false;
    }

    return analysis.score >= threshold;
  }
};

// === AUTO-INITIALIZATION ===
(() => {
  ContentScript.init();
  AutoCapture.init();
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
    
    // Reset and retry auto-capture for new page
    AutoCapture.resetForNewPage();
  }
}).observe(document, { subtree: true, childList: true }); 