const memorySystem = require('./src');
const fs = require('fs').promises;

async function storeDevelopmentMemory() {
  console.log('🚀 开始存储混合记忆系统开发过程...\n');

  await memorySystem.memorySystem.initialize();

  // 1. 存储项目概述
  const projectOverview = `
# 混合记忆系统开发过程

## 背景
用户提出想法：将Claude Code的记忆功能与RAG结合，后来讨论了知识图谱方案。

## 技术决策演进
1. 初始方案：Neo4j + RAG
2. 优化方案：轻量级SQLite + ChromaDB
3. 最终决策：渐进式实现，先用轻量级方案，预留升级空间

## 核心价值
- 解决了基础RAG的局限性（缺乏结构化关系）
- 避免了过度工程化（Neo4j部署复杂）
- 实现了实用优先的混合查询系统
`;

  const overviewId = await memorySystem.store(projectOverview, {
    type: 'doc',
    title: '混合记忆系统项目概述',
    project: 'hybrid-memory-system',
    tags: ['architecture', 'design-decision']
  });
  console.log('✅ 项目概述已存储:', overviewId);

  // 2. 存储技术架构决策
  const architectureDecision = `
## 技术架构决策记录

### 为什么选择SQLite而不是Neo4j？
1. **部署简单**：无需独立服务，一个文件搞定
2. **性能足够**：中小型项目的关系查询完全够用
3. **易于升级**：接口设计预留了升级到Neo4j的可能

### 为什么选择ChromaDB？
1. **本地持久化**：无需运行服务器
2. **轻量级**：基于SQLite和DuckDB
3. **API友好**：与LangChain生态兼容

### 查询路由设计
- 基于关键词和正则模式识别查询意图
- 三种查询类型：语义、结构、混合
- 自动降级：复杂查询失败时回退到简单查询
`;

  const archId = await memorySystem.store(architectureDecision, {
    type: 'doc',
    title: '技术架构决策',
    project: 'hybrid-memory-system',
    tags: ['architecture', 'technical-decision']
  });
  console.log('✅ 架构决策已存储:', archId);

  // 3. 存储核心实现代码
  const coreFiles = [
    'src/core/memorySystem.js',
    'src/core/queryRouter.js',
    'src/kg/sqliteGraph.js',
    'src/rag/vectorStore.js'
  ];

  for (const file of coreFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const id = await memorySystem.store(content, {
        type: 'code',
        file_path: file,
        title: `核心模块: ${file}`,
        project: 'hybrid-memory-system'
      });
      console.log(`✅ ${file} 已存储:`, id);
    } catch (error) {
      console.error(`❌ 无法读取 ${file}:`, error.message);
    }
  }

  // 4. 存储使用示例
  const usageExamples = `
## 混合记忆系统使用示例

### 1. 语义查询示例
\`\`\`bash
# 查找解决方案
node src/cli.js query "如何处理端口冲突"

# 查找相似代码
node src/cli.js query "数据库连接池实现"
\`\`\`

### 2. 结构查询示例
\`\`\`bash
# 查找函数调用关系
node src/cli.js query "processData 函数被谁调用"

# 查找文件依赖
node src/cli.js query "utils.js 的依赖关系"
\`\`\`

### 3. 混合查询示例
\`\`\`bash
# 查找相关代码及其关系
node src/cli.js query "用户认证相关的所有代码"
\`\`\`

### 4. 项目导入示例
\`\`\`bash
# 导入整个项目
node src/cli.js import-project /path/to/project

# 导入特定类型文件
node src/cli.js import-project /path/to/project -e .js,.ts
\`\`\`
`;

  const exampleId = await memorySystem.store(usageExamples, {
    type: 'doc',
    title: '使用示例集合',
    project: 'hybrid-memory-system',
    tags: ['examples', 'usage']
  });
  console.log('✅ 使用示例已存储:', exampleId);

  // 5. 存储问题和解决方案
  const solutions = `
## 开发过程中的问题和解决方案

### 问题1：用户提到基础RAG效果可能不好
**解决方案**：设计了混合查询系统，结合向量搜索和图查询的优势

### 问题2：Neo4j部署复杂
**解决方案**：使用SQLite实现轻量级图存储，预留升级接口

### 问题3：需要与现有CLAUDE.md体系集成
**解决方案**：
- 设计了统一的CLI接口
- 支持导入现有项目
- 可以作为Claude Code的记忆后端

### 问题4：Azure OpenAI配置
**解决方案**：
- 支持Azure OpenAI API
- 提供fallback机制（简单哈希向量）
- 灵活的配置系统
`;

  const solutionId = await memorySystem.store(solutions, {
    type: 'doc',
    title: '问题解决方案记录',
    project: 'hybrid-memory-system',
    tags: ['problem-solving', 'solutions']
  });
  console.log('✅ 解决方案已存储:', solutionId);

  // 显示统计信息
  console.log('\n📊 存储完成，查看统计信息...');
  const stats = await memorySystem.getStats();
  console.log('实体总数:', stats.graph.entities);
  console.log('关系总数:', stats.graph.relationships);
  console.log('\n实体类型分布:');
  stats.graph.types.forEach(type => {
    console.log(`  ${type.type}: ${type.count}`);
  });

  console.log('\n✨ 所有记忆已成功存储！');
  console.log('\n💡 现在你可以使用以下命令查询这些记忆:');
  console.log('  node src/cli.js query "混合记忆系统架构"');
  console.log('  node src/cli.js query "为什么选择SQLite"');
  console.log('  node src/cli.js interactive');
}

// 执行存储
storeDevelopmentMemory().catch(console.error);