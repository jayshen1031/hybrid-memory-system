# 混合记忆系统 (Hybrid Memory System)

一个轻量级的智能记忆管理系统，结合了向量搜索和知识图谱，专为代码项目记忆管理设计。

## 特性

- 🔍 **智能查询路由**：自动识别查询意图（语义/结构/混合）
- 📊 **向量语义搜索**：基于ChromaDB的本地向量存储
- 🕸️ **知识图谱**：使用SQLite实现的轻量级图存储
- 🚀 **零依赖部署**：无需额外的数据库服务
- 🔧 **代码结构解析**：自动提取函数、类、导入关系
- 💾 **持久化存储**：所有数据本地保存

## 安装

```bash
cd /Users/jay/Documents/baidu/projects/hybrid-memory-system
npm install

# 复制环境配置
cp .env.example .env
# 编辑 .env 文件，填入你的 Azure OpenAI 配置
```

## 快速开始

### 1. 存储记忆

```bash
# 存储简单文本
node src/cli.js store "这是一个重要的解决方案" --type doc --title "错误处理方案"

# 存储代码文件
node src/cli.js add-file ./src/utils/helper.js --title "工具函数"

# 导入整个项目
node src/cli.js import-project /path/to/your/project
```

### 2. 查询记忆

```bash
# 语义查询（自动识别）
node src/cli.js query "如何处理端口冲突"

# 结构查询
node src/cli.js query "谁调用了 processData 函数"

# 交互式查询
node src/cli.js interactive
```

### 3. 管理记忆

```bash
# 查看统计信息
node src/cli.js stats

# 导出记忆
node src/cli.js export ./backup.json

# 导入记忆
node src/cli.js import ./backup.json
```

## 在代码中使用

```javascript
const { memorySystem } = require('./src/index');

// 初始化
await memorySystem.initialize();

// 存储记忆
const memoryId = await memorySystem.store(
  "重要的代码片段或文档",
  {
    type: 'code',
    file_path: '/path/to/file.js',
    project: 'my-project'
  }
);

// 查询记忆
const results = await memorySystem.query("查找错误处理相关代码");

// 导入项目
await memorySystem.importProject('/path/to/project');
```

## 查询类型说明

系统会自动识别查询意图：

- **语义查询**：适合查找相似内容、解决方案、文档
  - 例如："如何实现用户认证"、"错误处理最佳实践"
  
- **结构查询**：适合查找代码关系、依赖链
  - 例如："show_memory 函数被谁调用"、"utils.js 的依赖关系"
  
- **混合查询**：结合语义和结构信息
  - 例如："查找所有关于数据库连接的代码及其调用关系"

## 集成到现有项目

在你的项目中创建 `.memory/config.js`：

```javascript
module.exports = {
  // 记忆系统路径
  memorySystemPath: '/Users/jay/Documents/baidu/projects/hybrid-memory-system',
  
  // 自动导入的文件类型
  autoImportExtensions: ['.js', '.ts', '.py'],
  
  // 忽略的目录
  ignoreDirs: ['node_modules', '.git', 'dist']
};
```

## 常见使用场景

1. **项目知识库**：导入整个项目，快速查找函数用法和依赖关系
2. **错误解决方案**：记录遇到的问题和解决方案，下次快速找到
3. **代码片段管理**：保存常用代码片段，支持语义搜索
4. **项目文档**：存储项目相关文档，支持智能检索

## 技术架构

- **向量存储**：ChromaDB（本地持久化）
- **图存储**：SQLite（JSON字段存关系）
- **嵌入生成**：Azure OpenAI
- **查询路由**：基于模式匹配的意图识别

## 未来扩展

当需要更强大的功能时，可以：
- 升级到 Neo4j 获得更强的图查询能力
- 集成 RAGFlow 改善文档处理
- 添加 GraphRAG 实现自动关系抽取

## License

MIT