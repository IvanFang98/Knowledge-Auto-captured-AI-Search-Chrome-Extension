require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.MAX_REQUESTS_PER_HOUR || 100,
  message: 'Too many requests from this IP, please try again after an hour'
});

// Configure server timeouts
app.use((req, res, next) => {
  // Set timeout to 5 minutes
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Request size logging middleware
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/api/search' || req.path === '/api/upload')) {
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const sizeInMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
      console.log(`[${new Date().toISOString()}] 📊 Request size: ${sizeInMB}MB`);
    }
  }
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(limiter);

// Persistent vector store management
class VectorStore {
  constructor() {
    this.files = new Map(); // fileId -> { id, filename, content, uploadedAt }
    this.assistant = null; // { id, name, instructions }
    this.thread = null; // { id }
    this.lastUpdated = null;
  }

  async initialize() {
    console.log(`[${new Date().toISOString()}] 🔧 Initializing vector store...`);
    
    // Create a persistent assistant if it doesn't exist
    if (!this.assistant) {
      await this.createAssistant();
    }
    
    // Create a persistent thread
    if (!this.thread) {
      await this.createThread();
    }
    
    console.log(`[${new Date().toISOString()}] ✅ Vector store initialized`);
  }

  async createAssistant() {
    console.log(`[${new Date().toISOString()}] 🤖 Creating persistent assistant...`);
    try {
      this.assistant = await openai.beta.assistants.create({
        name: "SmartGrab AI Search Assistant",
        instructions: `You are a helpful assistant that analyzes uploaded documents to answer questions. You have access to multiple text files that contain relevant information. 

IMPORTANT INSTRUCTIONS:
1. ALWAYS use the file_search tool to find specific information in the documents
2. EXTRACT and PRESENT the actual content from the documents - don't just say "look at the document"
3. SYNTHESIZE information from multiple sources when relevant
4. Provide SPECIFIC, ACTIONABLE answers based on the document content
5. If the documents contain step-by-step instructions, present them clearly
6. If the documents contain examples, include them in your response
7. Always base your answers on the actual content found in the documents
8. Format your response as 3-5 clear bullet points with simple reference numbers
9. Each bullet point should be concise (1-2 sentences maximum)
10. Use SIMPLE reference numbers like [1] [2] [3] at the end of each bullet point
11. DO NOT use complex citations like 【4:0†filename】 - only use [1] [2] [3]
12. Keep the format clean and easy to read

RESPONSE FORMAT:
• [First point with specific information] [1]
• [Second point with specific information] [2]
• [Third point with specific information] [3]

Remember: Use simple reference numbers [1] [2] [3], not complex citations.`,
        model: "gpt-4-turbo-preview",
        tools: [{ type: "file_search" }]
      });
      console.log(`[${new Date().toISOString()}] ✅ Assistant created: ${this.assistant.id}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error creating assistant:`, error);
      throw error;
    }
  }

  async createThread() {
    console.log(`[${new Date().toISOString()}] 📝 Creating persistent thread...`);
    try {
      this.thread = await openai.beta.threads.create();
      console.log(`[${new Date().toISOString()}] ✅ Thread created: ${this.thread.id}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error creating thread:`, error);
      throw error;
    }
  }

  async uploadDocument(text, filename) {
    console.log(`[${new Date().toISOString()}] 📝 Uploading document: ${filename}`);
    
    // Check if file already exists
    for (const [fileId, fileInfo] of this.files) {
      if (fileInfo.filename === filename && fileInfo.content === text) {
        console.log(`[${new Date().toISOString()}] ✅ Document already exists: ${fileId}`);
        return fileId;
      }
    }
    
    // Sanitize filename to remove invalid characters
    const sanitizedFilename = filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid filesystem characters with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .replace(/__+/g, '_') // Replace multiple underscores with single
      .substring(0, 100); // Limit length to prevent path too long errors
    
    const tmpDir = os.tmpdir();
    const tmpFilePath = path.join(tmpDir, `${Date.now()}-${sanitizedFilename}`);
    
    try {
      // Write text to a temporary file
      fs.writeFileSync(tmpFilePath, text, 'utf8');
      console.log(`[${new Date().toISOString()}] 💾 Temporary file created at: ${tmpFilePath}`);
      
      // Upload file to OpenAI
      const file = await openai.files.create({
        file: fs.createReadStream(tmpFilePath),
        purpose: "assistants"
      });
      
      console.log(`[${new Date().toISOString()}] ✅ File uploaded to OpenAI: ${file.id} (${filename})`);
      
      // Store file info
      this.files.set(file.id, {
        id: file.id,
        filename: filename,
        content: text,
        uploadedAt: new Date()
      });
      
      this.lastUpdated = new Date();
      return file.id;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error uploading file:`, error);
      throw error;
    } finally {
      // Clean up the temporary file
      try { 
        fs.unlinkSync(tmpFilePath);
        console.log(`[${new Date().toISOString()}] 🗑️ Temporary file cleaned up: ${tmpFilePath}`);
      } catch (e) {
        console.error(`[${new Date().toISOString()}] ⚠️ Failed to clean up temporary file:`, e);
      }
    }
  }

  async search(query) {
    console.log(`[${new Date().toISOString()}] 🔍 Searching in vector store...`);
    
    if (this.files.size === 0) {
      throw new Error('No documents available for search');
    }

    // Prepare file attachments
    const attachments = Array.from(this.files.keys()).map(fileId => ({
      file_id: fileId,
      tools: [{ type: "file_search" }]
    }));

    console.log(`[${new Date().toISOString()}] 📎 Using ${attachments.length} files for search`);

    // Add the user's message to the thread with file attachments
    console.log(`[${new Date().toISOString()}] 📎 Adding message with file attachments...`);
    await openai.beta.threads.messages.create(this.thread.id, {
      role: "user", 
      content: `Question: ${query}

Please search through the uploaded documents and provide a comprehensive answer.

REQUIREMENTS:
- Use the file_search tool to find relevant information
- Extract and present ONLY the actual content from the documents
- IGNORE navigation elements, metadata, HTML tags, and UI text
- Focus on the main content, articles, posts, and substantive information
- Provide specific, actionable information from the actual content
- If there are steps, lists, or examples in the documents, include them
- Format your response as 3-5 clear bullet points
- Each bullet point should be 1-2 sentences maximum
- Use reference number [1] for all bullet points since there is only one document
- DO NOT use complex citations like 【4:0†filename】 - only use [1]
- Don't just say "look at the document" - actually tell me what the document says
- IMPORTANT: Use ONLY ONE bullet point symbol (•) per line, not double bullets

CONTENT TO IGNORE:
- Navigation menus (Home, Explore, Notifications, etc.)
- Social media UI elements (@mentions, #hashtags, engagement metrics)
- Timestamps and dates
- Copyright notices and legal text
- Error messages and UI text
- HTML markup and metadata
- URLs and links

CONTENT TO EXTRACT:
- Main articles and posts
- Substantive information and insights
- Lists, steps, and examples
- Key points and takeaways
- Actual content that answers the question

RESPONSE FORMAT:
• [First point with specific information from the content] [1]
• [Second point with specific information from the content] [1]
• [Third point with specific information from the content] [1]

DO NOT use:
• • [Double bullet points] [1]
- • [Mixed bullet points] [1]
• [Point with wrong reference number] [4]

Focus on giving me the actual information from the documents in a clean, readable format with simple reference numbers.`,
      attachments: attachments
    });
    
    // Run the assistant
    console.log(`[${new Date().toISOString()}] 🚀 Starting assistant run...`);
    const run = await openai.beta.threads.runs.create(this.thread.id, {
      assistant_id: this.assistant.id,
      instructions: "You have access to uploaded text files through the message attachments. Use the file_search tool to find and analyze information from these documents. EXTRACT and PRESENT ONLY the actual content - ignore navigation elements, metadata, HTML tags, and UI text. Focus on the main content, articles, posts, and substantive information that directly answers the user's question. Provide specific, actionable information based on what you find in the files."
    });
    
    // Wait for the run to complete
    console.log(`[${new Date().toISOString()}] ⏳ Waiting for run to complete...`);
    await this.waitForRunCompletion(this.thread.id, run.id);
    
    // Get the messages from the thread
    console.log(`[${new Date().toISOString()}] 📥 Retrieving messages...`);
    const messages = await openai.beta.threads.messages.list(this.thread.id);
    
    // Find the assistant's response
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No response from assistant');
    }

    return assistantMessage.content[0].text.value;
  }

  async waitForRunCompletion(threadId, runId, maxAttempts = 30) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
        console.log(`[${new Date().toISOString()}] 🔄 Run status: ${runStatus.status} (attempt ${attempts + 1}/${maxAttempts})`);
        
        if (runStatus.status === 'completed') {
          return runStatus;
        }
        
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
          throw new Error(`Run failed with status: ${runStatus.status} - ${runStatus.last_error?.message || 'Unknown error'}`);
        }
        
        // Wait for 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error checking run status:`, error);
        // If we get an error, wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }
    
    throw new Error('Run timed out after maximum attempts');
  }

  getStats() {
    return {
      filesCount: this.files.size,
      assistantId: this.assistant?.id,
      threadId: this.thread?.id,
      lastUpdated: this.lastUpdated
    };
  }

  async cleanup() {
    console.log(`[${new Date().toISOString()}] 🧹 Cleaning up vector store...`);
    
    // Delete all files
    for (const [fileId, fileInfo] of this.files) {
      try {
        await openai.files.del(fileId);
        console.log(`[${new Date().toISOString()}] 🗑️ Deleted file: ${fileId}`);
      } catch (error) {
        console.warn(`[${new Date().toISOString()}] ⚠️ Failed to delete file ${fileId}:`, error);
      }
    }
    
    // Delete assistant
    if (this.assistant) {
      try {
        await openai.beta.assistants.del(this.assistant.id);
        console.log(`[${new Date().toISOString()}] 🗑️ Deleted assistant: ${this.assistant.id}`);
      } catch (error) {
        console.warn(`[${new Date().toISOString()}] ⚠️ Failed to delete assistant:`, error);
      }
    }
    
    // Clear in-memory data
    this.files.clear();
    this.assistant = null;
    this.thread = null;
    this.lastUpdated = null;
    
    console.log(`[${new Date().toISOString()}] ✅ Vector store cleaned up`);
  }
}

// Global vector store instance
const vectorStore = new VectorStore();

// Function to clean text content for semantic search using AI
async function cleanTextForSemanticSearch(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
  console.log('🧹 Cleaning text for semantic search...');
  console.log('📊 Original text length:', rawText.length);
  
  // First, do basic HTML cleanup
  let cleanedText = rawText
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersand entities
    .replace(/&lt;/g, '<') // Replace less than entities
    .replace(/&gt;/g, '>') // Replace greater than entities
    .replace(/&quot;/g, '"') // Replace quote entities
    .replace(/&#39;/g, "'") // Replace apostrophe entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // If text is very short after basic cleanup, return it as is
  if (cleanedText.length < 200) {
    console.log('📊 Text too short for AI processing, returning basic cleaned text');
    return cleanedText;
  }
  
  try {
    // Use ChatGPT to extract meaningful content
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ No API key available, using basic cleaning');
      return cleanedText;
    }
    
    console.log('🤖 Using AI to extract meaningful content...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a content extraction specialist. Your job is to extract ONLY the meaningful, substantive content from web pages, social media posts, articles, etc. while removing ALL metadata, navigation elements, UI text, timestamps, engagement metrics, and other non-content elements.

CRITICAL RULES - REMOVE ALL OF THESE:
1. ALL social media metadata: "@username", "· Dec 22, 2024", "5:08 PM", "1.3M Views", "137 1K 5.4K 12K"
2. ALL social media headers: "Joe Hudson on X:", "User on Twitter:", "Post on Facebook:", etc.
3. ALL engagement metrics: "Views", "Likes", "Shares", "Comments", "Retweets", "Reposts"
4. ALL navigation elements: "Home", "Explore", "Notifications", "Messages", "Grok", "Bookmarks", "Jobs", "Communities", "Premium", "Verified", "Orgs", "Profile", "More", "Post", "Reply", "See new posts", "Conversation"
5. ALL UI elements: "Post your reply", "Reply", "To view keyboard shortcuts", "View keyboard shortcuts"
6. ALL URLs and links: "https://x.com/...", "🔗 https://..."
7. ALL timestamps and dates: "📅 6/25/2025", "• 📊 1096 words"
8. ALL social media formatting: "(1)", "(2)", "(3)" at the beginning of lines
9. ALL HTML, CSS, JavaScript, and technical elements
10. ALL copyright notices, terms of service, privacy policies
11. ALL error messages and UI text
12. ALL social media platform names: "X", "Twitter", "Facebook", "Instagram", etc.

KEEP ONLY:
- The actual content that a human would want to read
- The substance of articles, tweets, posts, etc.
- Meaningful text that provides value
- The core message or information

If there's no meaningful content after removing all metadata, return "NO_MEANINGFUL_CONTENT"

Return ONLY the cleaned content, no explanations or additional text.`
        },
        {
          role: 'user',
          content: `Extract the meaningful content from this text, removing ALL metadata and UI elements:

${cleanedText}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });
    
    const aiCleanedText = response.choices[0].message.content.trim();
    
    // Check if AI returned the special marker
    if (aiCleanedText === 'NO_MEANINGFUL_CONTENT') {
      console.log('⚠️ AI detected no meaningful content');
      return '';
    }
    
    console.log('📊 AI cleaned text length:', aiCleanedText.length);
    console.log('📊 Text reduction:', Math.round((1 - aiCleanedText.length / rawText.length) * 100) + '%');
    
    return aiCleanedText;
    
  } catch (error) {
    console.error('❌ Error using AI for text cleaning:', error);
    console.log('🔄 Falling back to basic cleaning...');
    
    // Fallback to basic cleaning
    return cleanedText
      .replace(/(?:@[a-zA-Z0-9_]+)/g, ' ') // Remove @mentions
      .replace(/(?:#[a-zA-Z0-9_]+)/g, ' ') // Remove #hashtags
      .replace(/(?:https?:\/\/[^\s]+)/g, ' ') // Remove URLs
      .replace(/(?:www\.[^\s]+)/g, ' ') // Remove www URLs
      .replace(/(?:\d{1,2}:\d{2}\s*(?:AM|PM)?\s*·\s*\w+\s+\d{1,2},\s+\d{4}\s*·\s*[\d.]+[KMB]?\s*Views?)/g, ' ') // Remove timestamps with metrics
      .replace(/(?:\d+(?:\.\d+)?[KMB]?\s*(?:Views?|Likes?|Shares?|Comments?|Retweets?))/gi, ' ') // Remove engagement metrics
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

// Document upload endpoint
app.post('/api/upload', async (req, res) => {
  console.log(`[${new Date().toISOString()}] 📥 Received upload request`);
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      console.error(`[${new Date().toISOString()}] ❌ Invalid request:`, { documents });
      return res.status(400).json({ error: 'Invalid request. Documents array required.' });
    }

    console.log(`[${new Date().toISOString()}] 📝 Processing ${documents.length} documents for upload`);

    // Initialize vector store if needed
    await vectorStore.initialize();

    // Upload each document
    const uploadedFiles = [];
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      if (document && document.text && document.text.trim().length > 0) {
        try {
          const filename = document.filename || `document_${i + 1}.txt`;
          const cleanedText = await cleanTextForSemanticSearch(document.text);
          const fileId = await vectorStore.uploadDocument(cleanedText, filename);
          uploadedFiles.push({
            fileId: fileId,
            filename: filename,
            size: cleanedText.length
          });
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Failed to upload document ${i + 1}:`, error);
        }
      }
    }

    console.log(`[${new Date().toISOString()}] ✅ Upload completed: ${uploadedFiles.length} files`);
    
    res.json({
      success: true,
      uploadedFiles: uploadedFiles,
      totalFiles: vectorStore.files.size,
      stats: vectorStore.getStats()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Upload API Error:`, error);
    res.status(500).json({
      error: 'An error occurred during upload',
      details: error.message
    });
  }
});

// Search endpoint using persistent vector store
app.post('/api/search', async (req, res) => {
  console.log(`[${new Date().toISOString()}] 📥 Received search request`);
  try {
    const { query } = req.body;

    if (!query) {
      console.error(`[${new Date().toISOString()}] ❌ Invalid request:`, { query });
      return res.status(400).json({ error: 'Invalid request. Query required.' });
    }

    console.log(`[${new Date().toISOString()}] 🔍 Processing search query: "${query}"`);

    // Initialize vector store if needed
    await vectorStore.initialize();

    // Search in the vector store
    const answer = await vectorStore.search(query);

    // Get the cleaned document content for references
    const cleanedContent = Array.from(vectorStore.files.values()).map(fileInfo => fileInfo.content).join('\n\n');

    console.log(`[${new Date().toISOString()}] ✅ Search completed successfully`);
    
    res.json({
      answer: answer,
      cleanedContent: cleanedContent,
      model: "gpt-4-turbo-preview",
      stats: vectorStore.getStats()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Search API Error:`, error);
    res.status(500).json({
      error: 'An error occurred during search',
      details: error.message
    });
  }
});

// Get vector store stats
app.get('/api/stats', (req, res) => {
  res.json({
    stats: vectorStore.getStats()
  });
});

// Cleanup endpoint (for testing/reset)
app.post('/api/cleanup', async (req, res) => {
  console.log(`[${new Date().toISOString()}] 🧹 Received cleanup request`);
  try {
    await vectorStore.cleanup();
    res.json({ success: true, message: 'Vector store cleaned up' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Cleanup Error:`, error);
    res.status(500).json({
      error: 'An error occurred during cleanup',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    vectorStore: vectorStore.getStats()
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`[${new Date().toISOString()}] 🚀 SmartGrab AI Search Server started with persistent vector store`);
}); 