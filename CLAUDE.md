# 混合记忆系统项目记忆

## 项目概述
一个轻量级的智能记忆管理系统，结合向量搜索和知识图谱技术，专为代码项目的知识管理设计。

## 技术栈
- **向量存储**: ChromaDB (本地持久化)
- **图存储**: SQLite (使用JSON字段存储关系)
- **嵌入生成**: Azure OpenAI API
- **查询路由**: 基于模式匹配的意图识别
- **CLI框架**: Commander.js

## 项目结构
```
hybrid-memory-system/
├── src/
│   ├── core/
│   │   ├── config.js          # 配置管理
│   │   ├── embeddings.js      # 向量嵌入生成
│   │   ├── queryRouter.js     # 智能查询路由
│   │   └── memorySystem.js    # 核心记忆系统
│   ├── rag/
│   │   └── vectorStore.js     # ChromaDB向量存储
│   ├── kg/
│   │   └── sqliteGraph.js     # SQLite图存储
│   ├── cli.js                 # CLI命令接口
│   └── index.js               # 模块导出
├── .env.example               # 环境配置模板
├── package.json               # 项目依赖
└── README.md                  # 使用文档
```

## 常用命令

### 开发和测试
```bash
# 安装依赖
npm install

# 运行CLI
node src/cli.js [command]

# 交互式查询
node src/cli.js interactive
```

### 记忆管理
```bash
# 存储记忆
node src/cli.js store "内容" --type code --file /path/to/file

# 查询记忆
node src/cli.js query "查询内容"

# 导入项目
node src/cli.js import-project /path/to/project

# 查看统计
node src/cli.js stats
```

## 核心设计决策

1. **为什么用SQLite而不是Neo4j**
   - 零部署成本，无需额外服务
   - 对于中小型项目足够用
   - 可以后续升级到Neo4j

2. **查询路由策略**
   - 基于关键词和模式自动识别查询意图
   - 语义查询用于内容相似度搜索
   - 结构查询用于代码关系查找
   - 混合查询结合两者优势

3. **代码解析策略**
   - 使用正则表达式提取基本结构
   - 可以后续增强为AST解析
   - 重点关注函数、类和导入关系

## 注意事项

1. **Azure OpenAI配置**
   - 需要在.env中配置Azure OpenAI凭据
   - 如果没有配置，会使用简单的fallback嵌入

2. **性能优化**
   - ChromaDB使用本地持久化，无需服务器
   - SQLite支持并发读取，写入需要注意事务

3. **扩展性**
   - 预留了升级到Neo4j的接口
   - 可以集成更高级的代码解析器
   - 支持自定义查询处理器

## 未来改进方向

1. **增强代码解析**
   - 使用AST解析器获得更准确的代码结构
   - 支持更多编程语言

2. **改进查询理解**
   - 使用机器学习模型进行意图分类
   - 支持更复杂的查询语法

3. **集成到Claude Code**
   - 作为Claude Code的记忆后端
   - 提供实时的代码建议

## 调试技巧

```javascript
// 启用调试日志
DEBUG=* node src/cli.js query "test"

// 直接使用模块
const { memorySystem } = require('./src');
await memorySystem.initialize();
const stats = await memorySystem.getStats();
```