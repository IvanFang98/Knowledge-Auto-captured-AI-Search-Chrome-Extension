# 🧠 SmartGrab - NotebookLM Knowledge Connector

**Transform your browsing into an AI-powered knowledge base with seamless NotebookLM integration.**

SmartGrab captures articles as you browse, organizes them locally for instant search, and provides one-click bulk export to NotebookLM via Google Drive. Build your personal knowledge repository and leverage AI insights effortlessly.

## ✨ Key Features

### 📚 Intelligent Article Capture
- **One-click capture** of any webpage content
- **Smart text extraction** with automatic cleaning
- **Metadata preservation** (title, URL, timestamp, word count)
- **Local storage** for instant access and search

### 🔍 Dual Search Engine
- **Keyword Search**: Fast, precise text matching with filters
- **Semantic Search**: AI-powered understanding of meaning and context
- **Advanced Filters**: Time-based, exact phrase, and custom date ranges
- **Real-time results** with highlighted matches

### 🧠 NotebookLM Integration
- **Bulk Export**: Select multiple articles for batch NotebookLM import
- **Google Drive Integration**: Automatic upload to organized folders
- **Multiple Export Formats**:
  - Individual files (best for < 20 articles)
  - Single bulk file (best for > 20 articles) 
  - Themed collections (auto-grouped by topic)
- **Smart Selection Tools**: Bulk select by date, similarity, or topic
- **Export History**: Track all exports with direct Drive links

## 🚀 Quick Start

### Installation
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. Pin the extension to your toolbar

### First Use
1. **Capture Articles**: Use `Ctrl+Shift+S` or click the extension icon while browsing
2. **Search Your Knowledge**: Switch to Search tab to find saved content
3. **Export to NotebookLM**: Go to NotebookLM tab, connect Google Drive, select articles, and export

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
- Bulk selection tools (All, Recent Week, High Similarity)
- Real-time export preview with file count estimates

### 3. Export & Analyze
```
Google Drive Upload → NotebookLM Import → AI Analysis → Insights
```
- One-click export to organized Google Drive folder
- Multiple format options optimized for NotebookLM
- Direct links to import into NotebookLM notebooks

## 🛠 Export Format Guide

### Individual Files
- **Best for**: < 20 articles, detailed analysis
- **Format**: One `.md` file per article with metadata
- **Use case**: Deep dive research on specific topics

### Single Bulk File
- **Best for**: > 20 articles, overview analysis
- **Format**: All articles in one large `.md` file with table of contents
- **Use case**: Comprehensive knowledge review

### Themed Collections
- **Best for**: Mixed content, topic exploration
- **Format**: Auto-grouped by topic (AI, productivity, health, etc.)
- **Use case**: Discovering patterns across different subjects

## ⚙️ Setup & Configuration

### Google Drive Connection
1. Go to **NotebookLM tab** in the extension
2. Click **"Connect Google Drive"**
3. Authorize the extension in the popup window
4. Files will be uploaded to `SmartGrab-NotebookLM-Export` folder

### Search Preferences
- **Keyword Mode**: Instant results, exact matching
- **Semantic Mode**: AI-powered, meaning-based search
- **Filters**: Time-based, verbatim, advanced search operators

## 📊 Smart Selection Features

### Bulk Selection Tools
- **Select All**: Choose all available articles
- **Select None**: Clear all selections
- **Recent Week**: Auto-select articles from past 7 days
- **High Similarity**: Pick top semantically related content

### Export Limits
- **Free NotebookLM**: Up to 50 sources per notebook
- **NotebookLM Plus**: Up to 300 sources per notebook
- **Smart Warnings**: Extension prevents over-limit exports

## 🔄 Automated Workflows

### Daily Research Workflow
1. **Morning**: Capture interesting articles during browsing
2. **Evening**: Review and select relevant content
3. **Weekly**: Bulk export themed collections to NotebookLM
4. **Analysis**: Use NotebookLM for insights and connections

### Project-Based Workflow
1. **Research Phase**: Capture all related articles
2. **Curation**: Select high-quality, relevant sources
3. **Export**: Create themed collection for specific project
4. **AI Analysis**: Generate insights, summaries, and audio overviews

## 🎯 Pro Tips

### Maximizing NotebookLM Value
- **Quality over Quantity**: Select your best 20-30 articles rather than everything
- **Theme Consistency**: Group related articles for better AI analysis
- **Metadata Rich**: Ensure articles have good titles and sources
- **Regular Exports**: Create weekly knowledge snapshots

### Search Best Practices
- **Keyword Mode**: Use specific terms, exact phrases in quotes
- **Semantic Mode**: Ask natural questions, explore concepts
- **Filters**: Combine time filters with search for precise results
- **Export Planning**: Review similarity scores before bulk selection

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
      "wordCount": 1250
    }
  ],
  "exportHistory": [
    {
      "timestamp": "2024-12-25T15:30:00.000Z",
      "articleCount": 15,
      "exportConfig": {"format": "themed"},
      "result": {"driveUrl": "https://drive.google.com/..."}
  }
  ]
}
```

### Google Drive Integration
- **API**: Uses Google Drive v3 REST API
- **Authentication**: OAuth2 with drive.file scope
- **File Format**: Markdown (.md) optimized for NotebookLM
- **Organization**: Auto-created folders with timestamps

### Export Optimization
- **File Size**: Automatically splits large exports
- **Metadata**: Rich frontmatter for better AI processing
- **Cross-References**: Internal linking between related articles
- **Format**: Clean Markdown with proper headings and structure

## 🚦 Troubleshooting

### Common Issues

**Google Drive Connection Fails**
- Check popup blockers
- Ensure Google account permissions
- Try incognito mode for initial setup

**Export Doesn't Appear in Drive**
- Verify folder permissions
- Check the `SmartGrab-NotebookLM-Export` folder
- Look in "Shared with me" if folder was created by different account

**Articles Not Capturing**
- Disable other text capture extensions
- Check page permissions (works on most sites except system pages)
- Try refreshing the page and capturing again

**Search Returns No Results**
- Verify articles are saved (check Settings tab stats)
- Try keyword search instead of semantic
- Clear and reload extension if needed

## 🔮 Future Enhancements

### Planned Features
- **AI Categorization**: Smarter auto-grouping of articles
- **Direct NotebookLM API**: Skip Google Drive when API available
- **Smart Recommendations**: Suggest related articles for export
- **Collaboration**: Share curated collections with teams
- **Advanced Analytics**: Export insights and usage patterns

### Integration Roadmap
- **Notion Integration**: Alternative export destination
- **Obsidian Support**: Local knowledge graph export
- **Research Citations**: Academic-style reference formatting
- **Multi-language**: Support for non-English content

## 📄 License

Open source project. Feel free to modify and distribute.

---

**Ready to supercharge your knowledge workflow? 🚀**

**Capture → Curate → Connect → Comprehend with AI** 