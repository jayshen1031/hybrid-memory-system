const vectorStore = require('../rag/vectorStore');
const sqliteGraph = require('../kg/sqliteGraph');
const queryRouter = require('./queryRouter');
const path = require('path');
const fs = require('fs').promises;

class HybridMemorySystem {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await vectorStore.initialize();
    await sqliteGraph.initialize();
    this.initialized = true;
  }

  // 存储记忆
  async store(content, metadata = {}) {
    await this.initialize();

    const memoryId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 存储到向量数据库
    await vectorStore.add(
      [content],
      [{
        ...metadata,
        memory_id: memoryId,
        created_at: new Date().toISOString()
      }],
      [memoryId]
    );

    // 如果是代码相关内容，也存储到图数据库
    if (metadata.type === 'code' || metadata.file_path) {
      await this.storeCodeStructure(memoryId, content, metadata);
    }

    return memoryId;
  }

  // 存储代码结构到图数据库
  async storeCodeStructure(memoryId, content, metadata) {
    const { file_path, type } = metadata;

    // 创建文件实体
    if (file_path) {
      const fileId = `file:${file_path}`;
      await sqliteGraph.createEntity(
        fileId,
        'File',
        path.basename(file_path),
        {
          path: file_path,
          extension: path.extname(file_path),
          memory_id: memoryId
        }
      );

      // 创建记忆实体
      await sqliteGraph.createEntity(
        memoryId,
        'Memory',
        metadata.title || 'Code Memory',
        {
          content_preview: content.substring(0, 200),
          ...metadata
        }
      );

      // 创建关系
      await sqliteGraph.createRelationship(
        fileId,
        memoryId,
        'HAS_MEMORY',
        { created_at: new Date().toISOString() }
      );

      // 解析和存储代码结构
      if (type === 'code') {
        await this.parseAndStoreCodeStructure(fileId, content, metadata);
      }
    }
  }

  // 解析代码结构（简化版）
  async parseAndStoreCodeStructure(fileId, content, metadata) {
    // 提取函数定义
    const functionPattern = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|\s*=>)/g;
    let match;
    
    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1];
      const functionId = `${fileId}:function:${functionName}`;
      
      await sqliteGraph.createEntity(
        functionId,
        'Function',
        functionName,
        { file: metadata.file_path }
      );
      
      await sqliteGraph.createRelationship(
        fileId,
        functionId,
        'CONTAINS',
        {}
      );
    }

    // 提取类定义
    const classPattern = /class\s+(\w+)/g;
    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classId = `${fileId}:class:${className}`;
      
      await sqliteGraph.createEntity(
        classId,
        'Class',
        className,
        { file: metadata.file_path }
      );
      
      await sqliteGraph.createRelationship(
        fileId,
        classId,
        'CONTAINS',
        {}
      );
    }

    // 提取导入关系
    const importPattern = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      const importId = `import:${importPath}`;
      
      await sqliteGraph.createEntity(
        importId,
        'Import',
        importPath,
        { type: 'dependency' }
      );
      
      await sqliteGraph.createRelationship(
        fileId,
        importId,
        'IMPORTS',
        {}
      );
    }
  }

  // 查询记忆
  async query(queryText, options = {}) {
    await this.initialize();
    
    return await queryRouter.route(queryText, options);
  }

  // 更新记忆
  async update(memoryId, newContent, newMetadata = {}) {
    await this.initialize();

    // 更新向量存储
    await vectorStore.update(memoryId, newContent, {
      ...newMetadata,
      updated_at: new Date().toISOString()
    });

    // 更新图存储中的实体
    const entity = await sqliteGraph.findEntity(memoryId);
    if (entity) {
      await sqliteGraph.createEntity(
        memoryId,
        entity.type,
        newMetadata.title || entity.name,
        {
          ...entity.properties,
          ...newMetadata,
          content_preview: newContent.substring(0, 200)
        }
      );
    }

    return memoryId;
  }

  // 删除记忆
  async delete(memoryId) {
    await this.initialize();

    // 从向量存储删除
    await vectorStore.delete([memoryId]);

    // 从图存储删除相关实体和关系
    // SQLite会自动处理外键约束
    const entity = await sqliteGraph.findEntity(memoryId);
    if (entity) {
      await sqliteGraph.db.prepare('DELETE FROM entities WHERE entity_id = ?').run(memoryId);
    }
  }

  // 获取统计信息
  async getStats() {
    await this.initialize();

    const graphStats = await sqliteGraph.getStats();
    
    return {
      graph: graphStats,
      vector: {
        // ChromaDB的统计信息需要单独实现
        status: 'active'
      }
    };
  }

  // 导入项目代码结构
  async importProject(projectPath, options = {}) {
    await this.initialize();

    const { extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java'] } = options;
    const files = await this.scanDirectory(projectPath, extensions);
    
    const projectId = `project:${path.basename(projectPath)}`;
    await sqliteGraph.createEntity(
      projectId,
      'Project',
      path.basename(projectPath),
      { path: projectPath }
    );

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(projectPath, file);
        
        const metadata = {
          file_path: file,
          relative_path: relativePath,
          project: path.basename(projectPath),
          type: 'code'
        };

        const memoryId = await this.store(content, metadata);
        
        // 创建项目到文件的关系
        const fileId = `file:${file}`;
        await sqliteGraph.createRelationship(
          projectId,
          fileId,
          'CONTAINS_FILE',
          {}
        );
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }

    return {
      project: projectId,
      files: files.length
    };
  }

  // 递归扫描目录
  async scanDirectory(dir, extensions) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过常见的忽略目录
        if (['.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build'].includes(entry.name)) {
          continue;
        }
        files.push(...await this.scanDirectory(fullPath, extensions));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  // 导出记忆
  async export(outputPath) {
    await this.initialize();

    const graphStats = await sqliteGraph.getStats();
    const entities = [];
    const relationships = [];

    // 导出所有实体
    for (const typeInfo of graphStats.types) {
      const typeEntities = await sqliteGraph.findEntitiesByType(typeInfo.type);
      entities.push(...typeEntities);
    }

    // 导出所有关系
    for (const entity of entities) {
      const rels = await sqliteGraph.findRelationships(entity.entity_id);
      relationships.push(...rels);
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      stats: graphStats,
      entities: entities,
      relationships: relationships
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    return exportData;
  }

  // 导入记忆
  async import(inputPath) {
    await this.initialize();

    const data = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
    
    await sqliteGraph.batchImport(
      data.entities.map(e => ({
        id: e.entity_id,
        type: e.type,
        name: e.name,
        properties: e.properties
      })),
      data.relationships.map(r => ({
        from: r.from_id,
        to: r.to_id,
        type: r.type,
        properties: r.properties
      }))
    );

    return {
      imported: {
        entities: data.entities.length,
        relationships: data.relationships.length
      }
    };
  }
}

module.exports = new HybridMemorySystem();