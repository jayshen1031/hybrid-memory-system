const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

module.exports = {
  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
  },
  sqlite: {
    dbPath: path.resolve(process.env.SQLITE_DB_PATH || './memory.db')
  },
  chroma: {
    persistDirectory: path.resolve(process.env.CHROMA_PERSIST_DIRECTORY || './chroma_db')
  },
  project: {
    defaultPath: process.env.DEFAULT_PROJECT_PATH || process.cwd()
  },
  claude: {
    useClaudeCode: process.env.USE_CLAUDE_CODE === 'true'
  }
};