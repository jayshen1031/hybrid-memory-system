const vectorStore = require('../rag/vectorStore');
const sqliteGraph = require('../kg/sqliteGraph');

class QueryRouter {
  constructor() {
    // 查询类型的关键词模式
    this.patterns = {
      structural: {
        keywords: ['依赖', 'depends', '调用', 'calls', '引用', 'imports', '继承', 'extends', '关系', 'relationship', '连接', 'connected'],
        patterns: [
          /谁(调用|依赖|引用|使用)了?/,
          /被(调用|依赖|引用|使用)的?/,
          /(函数|类|模块|文件).*的?(依赖|关系)/,
          /what (calls|depends on|imports|uses)/i,
          /show.*relationship/i
        ]
      },
      semantic: {
        keywords: ['如何', 'how', '什么', 'what', '为什么', 'why', '解决', 'solve', '错误', 'error', '问题', 'problem', '实现', 'implement'],
        patterns: [
          /如何.*(实现|解决|处理)/,
          /什么是/,
          /(error|bug|issue|problem).*fix/i,
          /how (to|do)/i,
          /what (is|does)/i
        ]
      },
      hybrid: {
        keywords: ['相关', 'related', '关于', 'about', '涉及', 'involve', '包含', 'contain'],
        patterns: [
          /.*相关的?(代码|函数|文件)/,
          /关于.*的?(所有|全部)/,
          /find.*related/i,
          /all.*about/i
        ]
      }
    };
  }

  // 分析查询意图
  analyzeIntent(query) {
    const lowerQuery = query.toLowerCase();
    const scores = {
      structural: 0,
      semantic: 0,
      hybrid: 0
    };

    // 检查关键词
    for (const [type, config] of Object.entries(this.patterns)) {
      for (const keyword of config.keywords) {
        if (lowerQuery.includes(keyword)) {
          scores[type] += 2;
        }
      }

      // 检查正则模式
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          scores[type] += 3;
        }
      }
    }

    // 如果没有明显的模式匹配，默认使用语义搜索
    if (Math.max(...Object.values(scores)) === 0) {
      scores.semantic = 1;
    }

    // 返回得分最高的类型
    const maxScore = Math.max(...Object.values(scores));
    const primaryType = Object.entries(scores)
      .find(([_, score]) => score === maxScore)[0];

    // 如果多个类型得分相近，使用混合查询
    const closeScores = Object.values(scores).filter(s => s >= maxScore - 1).length;
    if (closeScores > 1) {
      return 'hybrid';
    }

    return primaryType;
  }

  // 路由查询到相应的处理器
  async route(query, options = {}) {
    const intent = this.analyzeIntent(query);
    console.log(`Query intent: ${intent}`);

    switch (intent) {
      case 'structural':
        return await this.handleStructuralQuery(query, options);
      case 'semantic':
        return await this.handleSemanticQuery(query, options);
      case 'hybrid':
        return await this.handleHybridQuery(query, options);
      default:
        return await this.handleSemanticQuery(query, options);
    }
  }

  // 处理结构化查询（图查询）
  async handleStructuralQuery(query, options) {
    const { entityId, entityType, relationshipType, depth = 2 } = options;

    // 如果提供了具体的实体ID，进行图遍历
    if (entityId) {
      const relationships = await sqliteGraph.traverse(entityId, relationshipType, depth);
      return {
        type: 'structural',
        results: relationships,
        query: query
      };
    }

    // 否则，搜索相关实体
    const entities = await sqliteGraph.searchEntities(query, entityType);
    const results = [];

    // 对每个找到的实体，获取其关系
    for (const entity of entities.slice(0, 5)) {
      const relationships = await sqliteGraph.findRelationships(entity.entity_id);
      results.push({
        entity: entity,
        relationships: relationships
      });
    }

    return {
      type: 'structural',
      results: results,
      query: query
    };
  }

  // 处理语义查询（向量搜索）
  async handleSemanticQuery(query, options) {
    const { limit = 5, filter = {} } = options;

    const results = await vectorStore.query(query, limit, filter);
    
    return {
      type: 'semantic',
      results: {
        documents: results.documents,
        metadatas: results.metadatas,
        scores: results.distances.map(d => 1 - d) // 转换为相似度分数
      },
      query: query
    };
  }

  // 处理混合查询
  async handleHybridQuery(query, options) {
    const { limit = 5 } = options;

    // 并行执行两种查询
    const [semanticResults, structuralResults] = await Promise.all([
      this.handleSemanticQuery(query, { limit }),
      this.handleStructuralQuery(query, {})
    ]);

    // 合并和排序结果
    const mergedResults = this.mergeResults(semanticResults, structuralResults);

    return {
      type: 'hybrid',
      results: mergedResults,
      query: query,
      semantic: semanticResults,
      structural: structuralResults
    };
  }

  // 合并语义和结构化查询结果
  mergeResults(semanticResults, structuralResults) {
    const merged = new Map();

    // 添加语义搜索结果
    if (semanticResults.results.documents) {
      semanticResults.results.documents.forEach((doc, idx) => {
        const key = semanticResults.results.metadatas[idx]?.file_path || `doc_${idx}`;
        merged.set(key, {
          type: 'semantic',
          content: doc,
          metadata: semanticResults.results.metadatas[idx],
          score: semanticResults.results.scores[idx],
          source: 'vector'
        });
      });
    }

    // 添加结构化搜索结果
    if (structuralResults.results) {
      structuralResults.results.forEach(result => {
        if (result.entity) {
          const key = result.entity.entity_id;
          const existing = merged.get(key);
          
          if (existing) {
            // 如果已存在，增强信息
            existing.relationships = result.relationships;
            existing.score = Math.min(1, existing.score + 0.2); // 提升得分
          } else {
            // 新增结果
            merged.set(key, {
              type: 'structural',
              content: result.entity.name,
              metadata: result.entity.properties,
              relationships: result.relationships,
              score: 0.7, // 默认结构化查询得分
              source: 'graph'
            });
          }
        }
      });
    }

    // 转换为数组并按得分排序
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // 返回前10个结果
  }

  // 提取查询中的实体
  extractEntities(query) {
    // 简单的实体提取，可以后续增强
    const entityPatterns = [
      /['"]([^'"]+)['"]/g, // 引号中的内容
      /(\w+\.\w+)/g, // 文件名
      /(\w+)\(/g, // 函数名
      /class\s+(\w+)/g, // 类名
    ];

    const entities = [];
    for (const pattern of entityPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }

    return [...new Set(entities)]; // 去重
  }
}

module.exports = new QueryRouter();