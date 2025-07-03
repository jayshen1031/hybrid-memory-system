const { ChromaClient } = require('chromadb');
const embeddingService = require('../core/embeddings');
const path = require('path');
const fs = require('fs').promises;
const config = require('../core/config');

class VectorStore {
  constructor() {
    this.client = null;
    this.collection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // 确保持久化目录存在
    await fs.mkdir(config.chroma.persistDirectory, { recursive: true });

    // 暂时直接使用内存存储，避免ChromaDB服务器依赖
    this.useMemoryStore();
    
    // 尝试从文件加载已有数据
    try {
      const dataPath = path.join(config.chroma.persistDirectory, 'memory_store.json');
      const data = await fs.readFile(dataPath, 'utf-8');
      const stored = JSON.parse(data);
      this.memoryStore = stored;
    } catch (error) {
      // 文件不存在，使用空的内存存储
    }
  }

  useMemoryStore() {
    this.memoryStore = {
      documents: [],
      embeddings: [],
      metadatas: [],
      ids: []
    };
    this.initialized = true;
  }

  async add(documents, metadatas = [], ids = []) {
    await this.initialize();

    // 生成嵌入向量
    const embeddings = await Promise.all(
      documents.map(doc => embeddingService.generateEmbedding(doc))
    );

    // 生成ID（如果没有提供）
    if (ids.length === 0) {
      ids = documents.map((_, i) => `doc_${Date.now()}_${i}`);
    }

    // 确保metadatas数组长度匹配
    if (metadatas.length < documents.length) {
      const defaultMeta = { timestamp: new Date().toISOString() };
      while (metadatas.length < documents.length) {
        metadatas.push(defaultMeta);
      }
    }

    if (this.collection) {
      await this.collection.add({
        embeddings: embeddings,
        documents: documents,
        metadatas: metadatas,
        ids: ids
      });
    } else {
      // 内存存储
      this.memoryStore.documents.push(...documents);
      this.memoryStore.embeddings.push(...embeddings);
      this.memoryStore.metadatas.push(...metadatas);
      this.memoryStore.ids.push(...ids);
      
      // 保存到文件
      await this.save();
    }

    return ids;
  }

  async query(queryText, nResults = 5, filter = {}) {
    await this.initialize();

    const queryEmbedding = await embeddingService.generateEmbedding(queryText);

    if (this.collection) {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: nResults,
        where: filter
      });

      return {
        documents: results.documents[0] || [],
        metadatas: results.metadatas[0] || [],
        distances: results.distances[0] || [],
        ids: results.ids[0] || []
      };
    } else {
      // 内存存储查询
      const similarities = this.memoryStore.embeddings.map((emb, i) => ({
        index: i,
        similarity: embeddingService.cosineSimilarity(queryEmbedding, emb)
      }));

      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, nResults);

      return {
        documents: topResults.map(r => this.memoryStore.documents[r.index]),
        metadatas: topResults.map(r => this.memoryStore.metadatas[r.index]),
        distances: topResults.map(r => 1 - r.similarity),
        ids: topResults.map(r => this.memoryStore.ids[r.index])
      };
    }
  }

  async delete(ids) {
    await this.initialize();

    if (this.collection) {
      await this.collection.delete({ ids: ids });
    } else {
      // 从内存存储中删除
      ids.forEach(id => {
        const index = this.memoryStore.ids.indexOf(id);
        if (index > -1) {
          this.memoryStore.documents.splice(index, 1);
          this.memoryStore.embeddings.splice(index, 1);
          this.memoryStore.metadatas.splice(index, 1);
          this.memoryStore.ids.splice(index, 1);
        }
      });
    }
  }

  async update(id, document, metadata) {
    await this.initialize();

    const embedding = await embeddingService.generateEmbedding(document);

    if (this.collection) {
      await this.collection.update({
        ids: [id],
        embeddings: [embedding],
        documents: [document],
        metadatas: [metadata]
      });
    } else {
      const index = this.memoryStore.ids.indexOf(id);
      if (index > -1) {
        this.memoryStore.documents[index] = document;
        this.memoryStore.embeddings[index] = embedding;
        this.memoryStore.metadatas[index] = metadata;
      }
    }
  }

  // 保存到文件
  async save() {
    if (this.memoryStore) {
      const dataPath = path.join(config.chroma.persistDirectory, 'memory_store.json');
      await fs.writeFile(dataPath, JSON.stringify(this.memoryStore, null, 2));
    }
  }
}

module.exports = new VectorStore();