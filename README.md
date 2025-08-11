# Knowledge Auto-captured & AI Search

Knowledge Auto-captured & AI Search captures articles as you browse and read, organizes them locally for instant search, and provides seamless export to NotebookLM. Build your personal knowledge repository with AI-powered insights and semantic understanding.

## ✨ Key Features

### 📚 Intelligent Article Capture
- **Auto-capture** automatically saves supported articles as you browse (configurable)
- **Manual capture** with keyboard shortcut (`Cmd+Shift+S` on Mac, `Ctrl+Shift+S` on Windows/Linux)
- **Smart text extraction** with automatic cleaning and formatting
- **Metadata preservation** (title, URL, timestamp, word count, author)
- **Local storage** for instant access and privacy
- **Duplicate detection** with smart replacement options
- **Dwell-time control**: Optional delay before auto-capture (Default 3s, 10s, 20s, 30s, 1m, 2m, 5m)

### 🔍 Dual Search Engine
- **Semantic Search**: Vertex AI powered 
  - Meaning-based search helps you find what you need without typing the exact keywords
  - Exact citation linking AI response and source articles
- **Keyword Search**: Fast, precise text matching with advanced filters
  
### 🔁 Resilient Embedding Sync
- **Auto-embed on save**: New articles are embedded automatically in the background
- **Persistent backfill queue**: Any missed embeddings are queued and retried with exponential backoff

### 🆓 Vertex AI limits 
- **Free limits** (one-time): 100 embeddings + 200 semantic searches
- **Over the limit**: Auto-capture and semantic search are paused
- **Resume unlimited usage**: Paste your own Cloud Run Vertex proxy URL in Settings; limits are bypassed and all functionalities resumes automatically

### 🧠 NotebookLM Integration
- **Bulk Export**: Select multiple articles for batch NotebookLM import
- **Automatic NotebookLM Export**: Export to NotebookLM for in-depth semantic search and learning 

**Why NotebookLM?**
NotebookLM has the best Retrieval-augmented generation (RAG) pipeline currently that indexes your sources, retrieves the most relevant chunks, and grounds answers with citations. You get high‑quality, citeable results that stay faithful to your content and scale well across multi‑document queries. 

## 🚀 Quick Start

### First Use
1. **Auto-Capture Enabled**: Articles are automatically saved as you browse (enabled by default)
2. **Manual Capture**: Use `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows/Linux) for manual capture
3. **Search Your Knowledge**: Switch to Search tab to find saved content
4. **Export to NotebookLM**: Select articles and export to NotebookLM for AI analysis
5. **Customize Settings**: Turn off auto-capture for manual-only mode if preferred; adjust dwell-time; paste a Custom Vertex Proxy URL to remove free-tier limits

## 🔍 Search Features

### Keyword Search
- **Instant Results**: Fast text-based search with exact matching
- **Advanced Filters**:
  - **Time Filter**: Last week, month, year, or custom date range
  - **Verbatim Filter**: Exact phrase matching (On/Off)
  - **Advanced Search**: Boolean operators for complex queries
- **Full Context**: Shows entire sentences containing matches
- **Smart Highlighting**: Highlights exact keyword matches

### Semantic Search
- **AI-Powered**: Uses Vertex AI for understanding meaning and context
- **Conversational**: Ask natural questions, not just keywords
- **Citation System**: 
  - Click `[1]`, `[2]`, etc. in AI response to jump to source articles
  - Click circle numbers in Sources to jump back to citations

- **No API Key Required**: Works locally with built-in AI capabilities

## ⚙️ Setup & Configuration

### Vertex Proxy Settings
- **Default mode**: Uses the built-in proxy billed to the author’s project with free-tier caps (100 embeds / 200 semantic searches)
- **Heavy usage**: Deploy your own Cloud Run proxy and paste its URL in Settings → Custom Vertex Proxy URL
  - Guide: [Cloud Run quickstart](https://cloud.google.com/run/docs/quickstarts/deploy-container)
  - Requirements: Allow unauthenticated invocations; copy the service URL and paste it into the extension
  - After applying: The extension automatically resumes auto-capture and embeddings using your proxy

### Data security
- All data stays local by default:
  - Recent items: `chrome.storage.local`
  - Archived items: IndexedDB
  - Embeddings: IndexedDB (`vertex-embeddings → vectors`)
- If you supply a Custom Vertex Proxy URL, only the text required to create embeddings or generate responses is sent to your proxy/Vertex AI. No remote storage of your library is performed by the extension.

### Storage limits
- Chrome’s `chrome.storage.local` has a ~5 MB quota. The extension keeps recent items there and automatically archives older items to IndexedDB to avoid quota issues.
- A background backfill queue ensures embeddings eventually get created without blocking or exceeding quotas.

### Auto‑capture: where it works (and not)
- Works on readable pages over 500 words:
  - Articles and essays (e.g., blogs, Substack, Medium)
  - Documentation and guides (e.g., MDN, developer.chrome.com)
  - Reference and research (e.g., Wikipedia, arXiv abstract pages)
- Skips non‑valuable or sensitive pages:
  - Search results, home feeds, infinite‑scroll timelines
  - Video/meeting platforms (e.g., YouTube watch pages, Zoom)
  - Email, calendars, chats, dashboards (e.g., Gmail, Google Calendar, internal tools)
  - Financial/e‑commerce account areas (e.g., bank portals, shopping carts, checkout)

## 📄 License
Open source project. Feel free to modify and distribute.

