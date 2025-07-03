const { AzureOpenAI } = require('@azure/openai');
const config = require('./config');

class EmbeddingService {
  constructor() {
    if (config.azure.apiKey && config.azure.endpoint) {
      this.client = new AzureOpenAI({
        apiKey: config.azure.apiKey,
        endpoint: config.azure.endpoint,
        apiVersion: config.azure.apiVersion,
        deployment: config.azure.deploymentName
      });
    }
  }

  async generateEmbedding(text) {
    if (!this.client) {
      // 如果没有Azure配置，返回简单的哈希向量作为fallback
      return this.simpleEmbedding(text);
    }

    try {
      const response = await this.client.embeddings.create({
        input: text,
        model: "text-embedding-ada-002"
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Azure embedding error:', error);
      return this.simpleEmbedding(text);
    }
  }

  // 简单的fallback嵌入生成
  simpleEmbedding(text) {
    const vector = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      vector[i % 1536] += text.charCodeAt(i) / 1000;
    }
    return vector;
  }

  // 计算余弦相似度
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

module.exports = new EmbeddingService();