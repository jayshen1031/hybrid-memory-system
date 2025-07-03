const Database = require('better-sqlite3');
const path = require('path');
const config = require('../core/config');

class SQLiteGraph {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (this.db) return;

    this.db = new Database(config.sqlite.dbPath);
    
    // 创建表结构
    this.db.exec(`
      -- 实体表（节点）
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT, -- JSON格式存储属性
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 关系表（边）
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT, -- JSON格式存储属性
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_id) REFERENCES entities(entity_id),
        FOREIGN KEY (to_id) REFERENCES entities(entity_id),
        UNIQUE(from_id, to_id, type)
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_id);
    `);

    // 准备常用语句
    this.statements = {
      insertEntity: this.db.prepare(`
        INSERT OR REPLACE INTO entities (entity_id, type, name, properties, updated_at)
        VALUES (@entity_id, @type, @name, @properties, CURRENT_TIMESTAMP)
      `),
      
      insertRelationship: this.db.prepare(`
        INSERT OR REPLACE INTO relationships (from_id, to_id, type, properties)
        VALUES (@from_id, @to_id, @type, @properties)
      `),
      
      findEntity: this.db.prepare(`
        SELECT * FROM entities WHERE entity_id = @entity_id
      `),
      
      findEntitiesByType: this.db.prepare(`
        SELECT * FROM entities WHERE type = @type
      `),
      
      findRelationships: this.db.prepare(`
        SELECT r.*, 
               e1.type as from_type, e1.name as from_name, e1.properties as from_properties,
               e2.type as to_type, e2.name as to_name, e2.properties as to_properties
        FROM relationships r
        JOIN entities e1 ON r.from_id = e1.entity_id
        JOIN entities e2 ON r.to_id = e2.entity_id
        WHERE r.from_id = @entity_id OR r.to_id = @entity_id
      `)
    };
  }

  // 创建或更新实体
  async createEntity(entityId, type, name, properties = {}) {
    await this.initialize();
    
    this.statements.insertEntity.run({
      entity_id: entityId,
      type: type,
      name: name,
      properties: JSON.stringify(properties)
    });
    
    return { entityId, type, name, properties };
  }

  // 创建关系
  async createRelationship(fromId, toId, type, properties = {}) {
    await this.initialize();
    
    this.statements.insertRelationship.run({
      from_id: fromId,
      to_id: toId,
      type: type,
      properties: JSON.stringify(properties)
    });
    
    return { fromId, toId, type, properties };
  }

  // 查找实体
  async findEntity(entityId) {
    await this.initialize();
    
    const result = this.statements.findEntity.get({ entity_id: entityId });
    if (!result) return null;
    
    return {
      ...result,
      properties: JSON.parse(result.properties || '{}')
    };
  }

  // 查找某类型的所有实体
  async findEntitiesByType(type) {
    await this.initialize();
    
    const results = this.statements.findEntitiesByType.all({ type });
    return results.map(r => ({
      ...r,
      properties: JSON.parse(r.properties || '{}')
    }));
  }

  // 查找实体的所有关系
  async findRelationships(entityId) {
    await this.initialize();
    
    const results = this.statements.findRelationships.all({ entity_id: entityId });
    return results.map(r => ({
      ...r,
      properties: JSON.parse(r.properties || '{}'),
      from_properties: JSON.parse(r.from_properties || '{}'),
      to_properties: JSON.parse(r.to_properties || '{}')
    }));
  }

  // 执行图遍历查询
  async traverse(startId, relationshipType, depth = 1) {
    await this.initialize();
    
    const visited = new Set();
    const result = [];
    
    const traverseNode = async (nodeId, currentDepth) => {
      if (currentDepth > depth || visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const relationships = await this.findRelationships(nodeId);
      const filtered = relationships.filter(r => r.type === relationshipType);
      
      for (const rel of filtered) {
        const nextId = rel.from_id === nodeId ? rel.to_id : rel.from_id;
        result.push(rel);
        await traverseNode(nextId, currentDepth + 1);
      }
    };
    
    await traverseNode(startId, 0);
    return result;
  }

  // 搜索实体（支持模糊匹配）
  async searchEntities(query, type = null) {
    await this.initialize();
    
    let sql = 'SELECT * FROM entities WHERE name LIKE @query';
    const params = { query: `%${query}%` };
    
    if (type) {
      sql += ' AND type = @type';
      params.type = type;
    }
    
    const stmt = this.db.prepare(sql);
    const results = stmt.all(params);
    
    return results.map(r => ({
      ...r,
      properties: JSON.parse(r.properties || '{}')
    }));
  }

  // 获取统计信息
  async getStats() {
    await this.initialize();
    
    const entityCount = this.db.prepare('SELECT COUNT(*) as count FROM entities').get();
    const relationshipCount = this.db.prepare('SELECT COUNT(*) as count FROM relationships').get();
    const typeStats = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM entities 
      GROUP BY type
    `).all();
    
    return {
      entities: entityCount.count,
      relationships: relationshipCount.count,
      types: typeStats
    };
  }

  // 批量导入数据
  async batchImport(entities, relationships) {
    await this.initialize();
    
    const insertEntity = this.db.prepare(`
      INSERT OR REPLACE INTO entities (entity_id, type, name, properties, updated_at)
      VALUES (@entity_id, @type, @name, @properties, CURRENT_TIMESTAMP)
    `);
    
    const insertRelationship = this.db.prepare(`
      INSERT OR REPLACE INTO relationships (from_id, to_id, type, properties)
      VALUES (@from_id, @to_id, @type, @properties)
    `);
    
    const transaction = this.db.transaction(() => {
      for (const entity of entities) {
        insertEntity.run({
          entity_id: entity.id,
          type: entity.type,
          name: entity.name,
          properties: JSON.stringify(entity.properties || {})
        });
      }
      
      for (const rel of relationships) {
        insertRelationship.run({
          from_id: rel.from,
          to_id: rel.to,
          type: rel.type,
          properties: JSON.stringify(rel.properties || {})
        });
      }
    });
    
    transaction();
  }

  // 清空数据库
  async clear() {
    await this.initialize();
    
    this.db.exec(`
      DELETE FROM relationships;
      DELETE FROM entities;
    `);
  }

  // 关闭数据库连接
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = new SQLiteGraph();