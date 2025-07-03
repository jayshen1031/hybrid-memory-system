#!/bin/bash

echo "🚀 混合记忆系统快速启动"
echo "========================"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查是否有.env文件
if [ ! -f ".env" ]; then
    echo "⚙️  创建环境配置文件..."
    cp .env.example .env
    echo "❗ 请编辑 .env 文件，填入你的 Azure OpenAI 配置"
    echo "   配置完成后，重新运行此脚本"
    exit 1
fi

# 创建别名
echo "🔧 设置命令别名..."
echo "alias memory='node $PWD/src/cli.js'" >> ~/.zshrc
echo "alias memory='node $PWD/src/cli.js'" >> ~/.bashrc

echo "✅ 安装完成！"
echo ""
echo "📖 使用示例："
echo "  1. 存储记忆: memory store \"重要的代码知识\" --type doc"
echo "  2. 查询记忆: memory query \"如何处理错误\""
echo "  3. 导入项目: memory import-project /path/to/project"
echo "  4. 交互模式: memory interactive"
echo ""
echo "💡 提示: 重新打开终端或运行 'source ~/.zshrc' 来使用 'memory' 命令"