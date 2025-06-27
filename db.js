// Database manager for SQLite-in-WASM with FTS5 and vector search
console.log('📄 Database module loading...');

// Import SQLite3 WASM at module level (service worker compatible)
let sqlite3 = null;
try {
  importScripts('./sqlite3.js');
  console.log('✅ SQLite3 WASM module imported');
} catch (error) {
  console.error('❌ Error importing SQLite3 WASM:', error);
}

class TextGrabberDB {
  constructor() {
    this.db = null;
    this.worker = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.useFallback = false;
  }

  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  async _initialize() {
    try {
      console.log('🔧 Initializing SQLite database...');
      
      // Check if SQLite3 is available
      if (typeof sqlite3InitModule === 'undefined') {
        console.warn('⚠️ SQLite3 module not available, using fallback storage');
        this.useFallback = true;
        this.isInitialized = true;
        return;
      }
      
      // Initialize SQLite3
      sqlite3 = await sqlite3InitModule();
      console.log('✅ SQLite3 WASM initialized');
      
      // Create database
      this.db = new sqlite3.oo1.DB(':memory:');
      console.log('✅ SQLite database created');
      
      // Test database functionality
      let testResult;
      try {
        // Try a simple query first
        testResult = this.db.exec('SELECT 1 as test');
        console.log('🧪 Database test result:', testResult);
        
        // Alternative test - just try to create a simple table
        this.db.exec('CREATE TEMP TABLE test_table (id INTEGER)');
        this.db.exec('DROP TABLE test_table');
        
        console.log('✅ Database test passed');
      } catch (testError) {
        console.warn('⚠️ Database test failed, using fallback:', testError);
        throw new Error('Database test query failed: ' + testError.message);
      }
      
      // Enable FTS5
      this.db.exec('PRAGMA foreign_keys=ON;');
      
      await this.createTables();
      await this.setupFTS();
      
      this.isInitialized = true;
      console.log('✅ Database initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize database, using fallback:', error);
      this.useFallback = true;
      this.isInitialized = true;
    }
  }

  async createTables() {
    if (this.useFallback) return;
    
    console.log('📋 Creating database tables...');
    
    try {
      // Main entries table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          external_id TEXT UNIQUE,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          text TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          timestamp TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Embeddings table for vector search
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          embedding BLOB NOT NULL,
          model_name TEXT NOT NULL DEFAULT 'text-embedding-3-small',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        );
      `);

      console.log('✅ Tables created');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      this.useFallback = true;
    }
  }

  async setupFTS() {
    if (this.useFallback) return;
    
    console.log('🔍 Setting up FTS5 search...');
    
    try {
      // Create FTS5 virtual table
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          title,
          text,
          url,
          content='entries',
          content_rowid='id'
        );
      `);

      // Create triggers to keep FTS5 in sync
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS entries_fts_insert AFTER INSERT ON entries 
        BEGIN
          INSERT INTO entries_fts(rowid, title, text, url) 
          VALUES (NEW.id, NEW.title, NEW.text, NEW.url);
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS entries_fts_delete AFTER DELETE ON entries 
        BEGIN
          DELETE FROM entries_fts WHERE rowid = OLD.id;
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS entries_fts_update AFTER UPDATE ON entries 
        BEGIN
          UPDATE entries_fts SET title=NEW.title, text=NEW.text, url=NEW.url 
          WHERE rowid = NEW.id;
        END;
      `);

      console.log('✅ FTS5 setup complete');
    } catch (error) {
      console.error('❌ Error setting up FTS5:', error);
      this.useFallback = true;
    }
  }

  async saveEntry(entry) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.useFallback) {
      return await this.saveEntryFallback(entry);
    }

    try {
      console.log('💾 Saving entry to SQLite database...');
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO entries (external_id, url, title, text, word_count, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.bind([
        entry.id.toString(),
        entry.url,
        entry.title,
        entry.text,
        entry.wordCount,
        entry.timestamp
      ]);

      stmt.step();
      const lastInsertRowid = this.db.exec('SELECT last_insert_rowid()')[0][0];
      stmt.free();
      
      console.log('✅ Entry saved to SQLite with ID:', lastInsertRowid);
      return lastInsertRowid;
      
    } catch (error) {
      console.error('❌ Error saving entry to SQLite, using fallback:', error);
      return await this.saveEntryFallback(entry);
    }
  }

  async saveEntryFallback(entry) {
    try {
      console.log('💾 Saving entry to chrome.storage fallback...');
      const result = await chrome.storage.local.get(['textEntries']);
      const existingEntries = result.textEntries || [];
      
      // Remove duplicate if exists
      const filteredEntries = existingEntries.filter(e => e.id !== entry.id);
      filteredEntries.unshift(entry);
      
      // Keep only last 100 entries
      if (filteredEntries.length > 100) {
        filteredEntries.splice(100);
      }
      
      await chrome.storage.local.set({ textEntries: filteredEntries });
      console.log('✅ Entry saved to chrome.storage fallback');
      return entry.id;
    } catch (error) {
      console.error('❌ Error saving to fallback storage:', error);
      throw error;
    }
  }

  async getAllEntries() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.useFallback) {
      return await this.getAllEntriesFallback();
    }

    try {
      const stmt = this.db.prepare(`
        SELECT external_id as id, url, title, text, word_count as wordCount, timestamp
        FROM entries 
        ORDER BY created_at DESC
      `);

      const entries = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        entries.push({
          id: parseInt(row.id),
          url: row.url,
          title: row.title,
          text: row.text,
          wordCount: row.wordCount,
          timestamp: row.timestamp
        });
      }

      stmt.free();
      console.log(`📚 Retrieved ${entries.length} entries from SQLite`);
      return entries;
      
    } catch (error) {
      console.error('❌ Error retrieving entries from SQLite, using fallback:', error);
      return await this.getAllEntriesFallback();
    }
  }

  async getAllEntriesFallback() {
    try {
      const result = await chrome.storage.local.get(['textEntries']);
      const entries = result.textEntries || [];
      console.log(`📚 Retrieved ${entries.length} entries from chrome.storage fallback`);
      return entries;
    } catch (error) {
      console.error('❌ Error retrieving entries from fallback:', error);
      return [];
    }
  }

  async searchKeywords(query, limit = 50) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.useFallback) {
      return await this.searchKeywordsFallback(query, limit);
    }

    try {
      console.log('🔍 Performing FTS5 search for:', query);
      
      const stmt = this.db.prepare(`
        SELECT 
          e.external_id as id, 
          e.url, 
          e.title, 
          e.text, 
          e.word_count as wordCount, 
          e.timestamp,
          fts.rank
        FROM entries_fts fts
        JOIN entries e ON e.id = fts.rowid
        WHERE entries_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      const entries = [];
      stmt.bind([query, limit]);
      
      while (stmt.step()) {
        const row = stmt.getAsObject();
        entries.push({
          id: parseInt(row.id),
          url: row.url,
          title: row.title,
          text: row.text,
          wordCount: row.wordCount,
          timestamp: row.timestamp,
          score: row.rank
        });
      }

      stmt.free();
      console.log(`🎯 FTS5 search found ${entries.length} results`);
      return entries;
      
    } catch (error) {
      console.error('❌ FTS5 search error, using fallback:', error);
      return await this.searchKeywordsFallback(query, limit);
    }
  }

  async searchKeywordsFallback(query, limit = 50) {
    const allEntries = await this.getAllEntriesFallback();
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    const results = allEntries.filter(entry => {
      const searchableText = [
        entry.title || '',
        entry.url || '',
        entry.text || ''
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    });
    
    console.log(`🎯 Fallback keyword search found ${results.length} results`);
    return results.slice(0, limit);
  }

  async saveEmbedding(entryId, embedding, modelName = 'text-embedding-3-small') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.useFallback) {
      console.log('⚠️ Embeddings not supported in fallback mode');
      return null;
    }

    try {
      console.log('🧠 Saving embedding for entry:', entryId);
      
      // Convert embedding array to blob
      const embeddingBlob = new Float32Array(embedding).buffer;
      
      // Use sql.js API: prepare, bind, step, free
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO embeddings (entry_id, embedding, model_name)
        VALUES (?, ?, ?)
      `);

      stmt.bind([entryId, embeddingBlob, modelName]);
      stmt.step();
      stmt.free();
      
      console.log('✅ Embedding saved');
      return entryId; // Return the entry ID since we don't have lastInsertRowid in sql.js
      
    } catch (error) {
      console.error('❌ Error saving embedding:', error);
      return null;
    }
  }

  async searchSimilar(queryEmbedding, limit = 20) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.useFallback) {
      console.log('⚠️ Semantic search not available in fallback mode, using keyword search');
      return [];
    }

    try {
      console.log('🔍 Performing vector similarity search...');
      
      const stmt = this.db.prepare(`
        SELECT 
          e.external_id as id,
          e.url, 
          e.title, 
          e.text, 
          e.word_count as wordCount, 
          e.timestamp,
          emb.embedding
        FROM embeddings emb
        JOIN entries e ON e.id = emb.entry_id
        ORDER BY e.created_at DESC
      `);

      const results = [];
      const queryVector = new Float32Array(queryEmbedding);
      
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const embeddingBuffer = row.embedding;
        const embeddingVector = new Float32Array(embeddingBuffer);
        
        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryVector, embeddingVector);
        
        results.push({
          id: parseInt(row.id),
          url: row.url,
          title: row.title,
          text: row.text,
          wordCount: row.wordCount,
          timestamp: row.timestamp,
          similarity: similarity
        });
      }

      stmt.free();
      
      // Sort by similarity and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, limit);
      
      console.log(`🎯 Vector search found ${topResults.length} similar results`);
      return topResults;
      
    } catch (error) {
      console.error('❌ Vector search error:', error);
      return [];
    }
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async clearAllEntries() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (!this.useFallback && this.db) {
        console.log('🗑️ Clearing SQLite entries...');
        this.db.exec('DELETE FROM embeddings');
        this.db.exec('DELETE FROM entries');
        this.db.exec('DELETE FROM entries_fts');
      }
      
      // Always clear fallback storage too
      console.log('🗑️ Clearing chrome.storage entries...');
      await chrome.storage.local.set({ textEntries: [] });
      
      console.log('✅ All entries cleared');
      
    } catch (error) {
      console.error('❌ Error clearing entries:', error);
      throw error;
    }
  }

  async getStats() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let totalEntries = 0;
      let totalEmbeddings = 0;
      
      if (!this.useFallback && this.db) {
        // Try SQLite first
        try {
          const entryResult = this.db.exec('SELECT COUNT(*) as count FROM entries');
          const embeddingResult = this.db.exec('SELECT COUNT(*) as count FROM embeddings');
          
          if (entryResult && entryResult[0] && entryResult[0].values) {
            totalEntries = entryResult[0].values[0][0];
          }
          
          if (embeddingResult && embeddingResult[0] && embeddingResult[0].values) {
            totalEmbeddings = embeddingResult[0].values[0][0];
          }
        } catch (sqlError) {
          console.warn('⚠️ SQLite stats query failed, checking fallback storage');
        }
      }
      
      // If SQLite failed or we're using fallback, check chrome.storage
      if (totalEntries === 0) {
        try {
          const result = await chrome.storage.local.get(['textEntries']);
          totalEntries = (result.textEntries || []).length;
        } catch (storageError) {
          console.error('❌ Error reading from chrome.storage:', storageError);
        }
      }
      
      return {
        totalEntries: totalEntries,
        totalEmbeddings: totalEmbeddings,
        embeddingCoverage: totalEntries > 0 ? (totalEmbeddings / totalEntries * 100).toFixed(1) : 0,
        usingFallback: this.useFallback
      };
      
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { totalEntries: 0, totalEmbeddings: 0, embeddingCoverage: 0, usingFallback: true };
    }
  }
}

// Create and export the database instance
// Make it available globally for the extension
if (typeof window !== 'undefined') {
  window.textGrabberDB = new TextGrabberDB();
} else if (typeof self !== 'undefined') {
  self.textGrabberDB = new TextGrabberDB();
}

console.log('✅ Database module loaded'); 