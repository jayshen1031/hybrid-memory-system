const memorySystem = require('./core/memorySystem');
const vectorStore = require('./rag/vectorStore');
const sqliteGraph = require('./kg/sqliteGraph');
const queryRouter = require('./core/queryRouter');

module.exports = {
  memorySystem,
  vectorStore,
  sqliteGraph,
  queryRouter,
  
  // 便捷方法
  store: memorySystem.store.bind(memorySystem),
  query: memorySystem.query.bind(memorySystem),
  update: memorySystem.update.bind(memorySystem),
  delete: memorySystem.delete.bind(memorySystem),
  importProject: memorySystem.importProject.bind(memorySystem),
  getStats: memorySystem.getStats.bind(memorySystem)
};