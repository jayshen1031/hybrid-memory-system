#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const memorySystem = require('./core/memorySystem');
const path = require('path');
const fs = require('fs').promises;

// 版本信息
program
  .version('1.0.0')
  .description('混合记忆系统 - 结合向量搜索和知识图谱的智能记忆管理');

// 存储记忆
program
  .command('store <content>')
  .description('存储新的记忆')
  .option('-t, --type <type>', '记忆类型 (code/doc/note)', 'note')
  .option('-f, --file <path>', '关联的文件路径')
  .option('-p, --project <name>', '项目名称')
  .option('--title <title>', '记忆标题')
  .action(async (content, options) => {
    const spinner = ora('存储记忆中...').start();
    
    try {
      const metadata = {
        type: options.type,
        file_path: options.file,
        project: options.project,
        title: options.title
      };
      
      // 清理undefined的属性
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined) delete metadata[key];
      });
      
      const memoryId = await memorySystem.store(content, metadata);
      spinner.succeed(chalk.green(`记忆已存储: ${memoryId}`));
    } catch (error) {
      spinner.fail(chalk.red(`存储失败: ${error.message}`));
    }
  });

// 查询记忆
program
  .command('query <query>')
  .description('查询记忆')
  .option('-l, --limit <number>', '返回结果数量', '5')
  .option('--type <type>', '查询类型 (auto/semantic/structural/hybrid)', 'auto')
  .action(async (query, options) => {
    const spinner = ora('查询中...').start();
    
    try {
      const results = await memorySystem.query(query, {
        limit: parseInt(options.limit)
      });
      
      spinner.stop();
      
      console.log(chalk.blue('\n查询结果:'));
      console.log(chalk.gray(`查询类型: ${results.type}`));
      console.log(chalk.gray(`查询内容: ${results.query}\n`));
      
      if (results.type === 'semantic' && results.results.documents) {
        results.results.documents.forEach((doc, idx) => {
          console.log(chalk.yellow(`\n[${idx + 1}] 相似度: ${(results.results.scores[idx] * 100).toFixed(1)}%`));
          console.log(chalk.white(doc.substring(0, 200) + '...'));
          
          const metadata = results.results.metadatas[idx];
          if (metadata) {
            console.log(chalk.gray(`元数据: ${JSON.stringify(metadata, null, 2)}`));
          }
        });
      } else if (results.type === 'structural' && results.results) {
        results.results.forEach((result, idx) => {
          if (result.entity) {
            console.log(chalk.yellow(`\n[${idx + 1}] ${result.entity.type}: ${result.entity.name}`));
            console.log(chalk.gray(`ID: ${result.entity.entity_id}`));
            
            if (result.relationships && result.relationships.length > 0) {
              console.log(chalk.cyan('关系:'));
              result.relationships.forEach(rel => {
                console.log(`  - ${rel.type}: ${rel.from_name} → ${rel.to_name}`);
              });
            }
          }
        });
      } else if (results.type === 'hybrid' && results.results) {
        results.results.forEach((result, idx) => {
          console.log(chalk.yellow(`\n[${idx + 1}] ${result.source} | 得分: ${(result.score * 100).toFixed(1)}%`));
          console.log(chalk.white(result.content.substring(0, 200) + '...'));
          
          if (result.relationships && result.relationships.length > 0) {
            console.log(chalk.cyan('关系:'));
            result.relationships.forEach(rel => {
              console.log(`  - ${rel.type}: ${rel.from_name} → ${rel.to_name}`);
            });
          }
        });
      }
    } catch (error) {
      spinner.fail(chalk.red(`查询失败: ${error.message}`));
    }
  });

// 导入项目
program
  .command('import-project <path>')
  .description('导入项目代码结构到记忆系统')
  .option('-e, --extensions <ext>', '文件扩展名 (逗号分隔)', '.js,.ts,.jsx,.tsx,.py')
  .action(async (projectPath, options) => {
    const spinner = ora('扫描项目文件...').start();
    
    try {
      const absolutePath = path.resolve(projectPath);
      const extensions = options.extensions.split(',');
      
      const result = await memorySystem.importProject(absolutePath, { extensions });
      
      spinner.succeed(chalk.green(`项目导入完成: ${result.files} 个文件`));
      console.log(chalk.gray(`项目ID: ${result.project}`));
    } catch (error) {
      spinner.fail(chalk.red(`导入失败: ${error.message}`));
    }
  });

// 统计信息
program
  .command('stats')
  .description('显示记忆系统统计信息')
  .action(async () => {
    const spinner = ora('获取统计信息...').start();
    
    try {
      const stats = await memorySystem.getStats();
      spinner.stop();
      
      console.log(chalk.blue('\n记忆系统统计:'));
      console.log(chalk.white(`实体总数: ${stats.graph.entities}`));
      console.log(chalk.white(`关系总数: ${stats.graph.relationships}`));
      
      console.log(chalk.yellow('\n实体类型分布:'));
      stats.graph.types.forEach(type => {
        console.log(`  ${type.type}: ${type.count}`);
      });
    } catch (error) {
      spinner.fail(chalk.red(`获取统计失败: ${error.message}`));
    }
  });

// 导出记忆
program
  .command('export <output>')
  .description('导出记忆到文件')
  .action(async (output) => {
    const spinner = ora('导出记忆...').start();
    
    try {
      const result = await memorySystem.export(output);
      spinner.succeed(chalk.green(`导出完成: ${output}`));
      console.log(chalk.gray(`实体: ${result.entities.length}, 关系: ${result.relationships.length}`));
    } catch (error) {
      spinner.fail(chalk.red(`导出失败: ${error.message}`));
    }
  });

// 导入记忆
program
  .command('import <input>')
  .description('从文件导入记忆')
  .action(async (input) => {
    const spinner = ora('导入记忆...').start();
    
    try {
      const result = await memorySystem.import(input);
      spinner.succeed(chalk.green(`导入完成`));
      console.log(chalk.gray(`实体: ${result.imported.entities}, 关系: ${result.imported.relationships}`));
    } catch (error) {
      spinner.fail(chalk.red(`导入失败: ${error.message}`));
    }
  });

// 交互式查询
program
  .command('interactive')
  .alias('i')
  .description('进入交互式查询模式')
  .action(async () => {
    console.log(chalk.blue('进入交互式记忆查询模式 (输入 exit 退出)\n'));
    
    while (true) {
      const { query } = await inquirer.prompt([
        {
          type: 'input',
          name: 'query',
          message: '查询>',
          validate: input => input.trim() !== ''
        }
      ]);
      
      if (query.toLowerCase() === 'exit') {
        console.log(chalk.yellow('退出交互模式'));
        break;
      }
      
      try {
        const results = await memorySystem.query(query);
        
        // 显示结果（简化版）
        if (results.results.documents) {
          results.results.documents.forEach((doc, idx) => {
            console.log(chalk.cyan(`\n[${idx + 1}]`), doc.substring(0, 150) + '...');
          });
        } else if (results.results.length > 0) {
          results.results.forEach((result, idx) => {
            console.log(chalk.cyan(`\n[${idx + 1}]`), result.content || result.entity?.name || 'Unknown');
          });
        } else {
          console.log(chalk.gray('没有找到相关记忆'));
        }
      } catch (error) {
        console.error(chalk.red(`查询错误: ${error.message}`));
      }
      
      console.log(''); // 空行
    }
  });

// 快速添加记忆（从文件）
program
  .command('add-file <file>')
  .description('从文件添加记忆')
  .option('--title <title>', '记忆标题')
  .action(async (file, options) => {
    const spinner = ora('读取文件...').start();
    
    try {
      const absolutePath = path.resolve(file);
      const content = await fs.readFile(absolutePath, 'utf-8');
      
      spinner.text = '存储记忆...';
      
      const metadata = {
        type: 'code',
        file_path: absolutePath,
        title: options.title || path.basename(file)
      };
      
      const memoryId = await memorySystem.store(content, metadata);
      spinner.succeed(chalk.green(`文件已添加到记忆: ${memoryId}`));
    } catch (error) {
      spinner.fail(chalk.red(`添加失败: ${error.message}`));
    }
  });

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}