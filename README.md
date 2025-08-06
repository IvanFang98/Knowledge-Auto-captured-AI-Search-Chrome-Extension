# Knowledge Capture & AI Search

**Transform your browsing into an AI-powered knowledge base with local semantic search and NotebookLM integration.**

Knowledge Capture & AI Search captures articles as you browse, organizes them locally for instant search, and provides seamless export to NotebookLM. Build your personal knowledge repository with AI-powered insights and semantic understanding.

## ✨ Key Features

### 📚 Intelligent Article Capture
- **One-click capture** with keyboard shortcut (`Cmd+Shift+S` on Mac, `Ctrl+Shift+S` on Windows/Linux)
- **Smart text extraction** with automatic cleaning and formatting
- **Metadata preservation** (title, URL, timestamp, word count, author)
- **Local storage** for instant access and privacy
- **Duplicate detection** with smart replacement options

### 🔍 Dual Search Engine
- **Keyword Search**: Fast, precise text matching with advanced filters
  - Exact phrase matching with verbatim filter
  - Time-based filtering (last week, month, year, custom range)
  - Advanced search with boolean operators (AND, OR, NOT)
- **Semantic Search**: AI-powered understanding using Vertex AI
  - Meaning-based search, not just keyword matching
  - Bi-directional citation linking between AI response and source articles
  - Nonsensical query detection with helpful suggestions
- **Real-time results** with highlighted matches and full sentence context

### 🧠 NotebookLM Integration
- **Bulk Export**: Select multiple articles for batch NotebookLM import
- **Smart Selection Tools**: Select All, Select None, Select Recent
- **Export to NotebookLM**: Direct integration with Google's AI notebook
- **Export History**: Track all exports with direct links

## 🚀 Quick Start

### Installation
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Pin the extension to your toolbar

### First Use
1. **Capture Articles**: Use `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows/Linux) while browsing
2. **Search Your Knowledge**: Switch to Search tab to find saved content
3. **Export to NotebookLM**: Select articles and export to NotebookLM for AI analysis

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
- **Smart Detection**: Identifies nonsensical queries and suggests better alternatives
- **No API Key Required**: Works locally with built-in AI capabilities

### Search Modes
- **Switch Between Modes**: Toggle between Keyword and Semantic search
- **Filter Visibility**: Filters automatically show/hide based on search mode
- **Results Display**: Different result formats optimized for each mode

## 🧠 NotebookLM Workflow

### 1. Capture & Organize
```
Browse Articles → Capture Content → Local Storage → Smart Search
```
- Save articles instantly with keyboard shortcut
- Content automatically cleaned and organized
- Local search for immediate access

### 2. Curate & Select
```
Review Articles → Multi-Select → Preview Export → Choose Format
```
- Browse all saved articles with checkboxes
- Bulk selection tools (All, None, Recent)
- Real-time selection count and export preview

### 3. Export & Analyze
```
NotebookLM Export → AI Analysis → Insights & Connections
```
- One-click export to NotebookLM
- AI-powered analysis and insights
- Direct integration with Google's AI notebook

## ⚙️ Setup & Configuration

### Search Preferences
- **Keyword Mode**: Instant results, exact matching, advanced filters
- **Semantic Mode**: AI-powered, meaning-based search, citation linking
- **Filter Management**: Time-based, verbatim, advanced search operators

### Keyboard Shortcuts
- **Capture Page**: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Windows/Linux)
- **Open Extension**: Click extension icon in toolbar
- **Search**: Press Enter in search bar
- **Clear Search**: Click X button or press Escape

## 📊 Smart Selection Features

### Bulk Selection Tools
- **Select All**: Choose all available articles
- **Select None**: Clear all selections
- **Individual Selection**: Check/uncheck specific articles
- **Selection Count**: Real-time display of selected articles

### Export to NotebookLM
- **Selected Articles**: Export only chosen articles
- **Direct Integration**: Seamless connection with NotebookLM
- **Export History**: Track previous exports

## 🔄 Workflow Examples

### Daily Research Workflow
1. **Morning**: Capture interesting articles during browsing
2. **Afternoon**: Use semantic search to explore connections
3. **Evening**: Select relevant content for NotebookLM export
4. **Analysis**: Use NotebookLM for AI-powered insights

### Project-Based Workflow
1. **Research Phase**: Capture all related articles
2. **Exploration**: Use semantic search to discover connections
3. **Curation**: Select high-quality, relevant sources
4. **Export**: Send to NotebookLM for comprehensive analysis

## 🎯 Pro Tips

### Maximizing Search Value
- **Keyword Mode**: Use specific terms, exact phrases in quotes, leverage filters
- **Semantic Mode**: Ask natural questions, explore concepts, use citation links
- **Combined Approach**: Start with semantic search, then use keyword search for specific details
- **Filter Usage**: Combine time filters with search for precise results

### NotebookLM Best Practices
- **Quality over Quantity**: Select your best articles rather than everything
- **Related Content**: Group related articles for better AI analysis
- **Regular Exports**: Create knowledge snapshots for ongoing projects

## 🔧 Technical Details

### Storage Architecture
```javascript
{
  "textEntries": [
    {
      "id": 1735123456789,
      "title": "Article Title",
      "url": "https://example.com",
      "text": "Cleaned article content...",
      "timestamp": "2024-12-25T10:30:00.000Z",
      "wordCount": 1250,
      "author": "Author Name"
    }
  ],
  "searchState": {
    "currentSearchMode": "keyword|semantic",
    "searchFilterState": {
      "timeFilter": "all|week|month|year|custom",
      "resultsFilter": "all|verbatim",
      "advancedFilter": {...}
    }
  }
}
```

### AI Integration
- **Vertex AI**: Google's enterprise AI platform for semantic search
- **Local Processing**: No data sent to external servers for search
- **Embedding Storage**: Local vector database for fast semantic search
- **Citation System**: Bi-directional linking between AI responses and sources

### Search Optimization
- **Hybrid Approach**: Combines keyword and semantic search
- **Smart Filtering**: Time-based, verbatim, and advanced filters
- **Real-time Results**: Instant search with highlighted matches
- **Context Preservation**: Full sentence display with proper punctuation

## 🚦 Troubleshooting

### Common Issues

**Articles Not Capturing**
- Check keyboard shortcut settings in Chrome
- Ensure page is fully loaded before capturing
- Try refreshing the page and capturing again
- Check for popup blockers or permission issues

**Search Returns No Results**
- Verify articles are saved (check main page for entries)
- Try switching between Keyword and Semantic search modes
- Use different search terms or try semantic search for broader results
- Check if filters are limiting results

**Semantic Search Not Working**
- Ensure you have internet connection (required for AI processing)
- Try refreshing the extension
- Check if Vertex AI service is available
- Try keyword search as alternative

**NotebookLM Export Issues**
- Ensure you have NotebookLM access
- Check if articles are selected before export
- Verify NotebookLM tab is open and accessible

## 🔮 Future Enhancements

### Planned Features
- **Enhanced AI**: Improved semantic search capabilities
- **Better Organization**: Smart categorization and tagging
- **Advanced Filters**: More sophisticated search and filter options
- **Export Formats**: Additional export destinations and formats
- **Collaboration**: Share knowledge bases with teams

### Integration Roadmap
- **Direct API**: Enhanced NotebookLM integration
- **Alternative Exports**: Notion, Obsidian, and other platforms
- **Research Tools**: Citation formatting and academic features
- **Multi-language**: Support for non-English content

## 📄 License

Open source project. Feel free to modify and distribute.

---

**Ready to supercharge your knowledge workflow? 🚀**

**Capture → Search → Understand → Export with AI** 