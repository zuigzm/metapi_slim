/**
 * 脚本用于重置数据库（删除所有数据）
 * 运行方式: npx tsx scripts/reset-db.ts
 */
import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = resolve('./data/hub.db');

async function resetDatabase() {
  console.log('开始重置数据库...', DB_PATH);

  const sqlite = new Database(DB_PATH);

  try {
    // 禁用外键约束
    sqlite.exec('PRAGMA foreign_keys = OFF');

    // 获取所有表名
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

    console.log('找到的表:', tables.map(t => t.name).join(', '));

    // 删除所有表的数据
    for (const { name } of tables) {
      if (name.startsWith('sqlite_')) continue; // 跳过系统表
      try {
        sqlite.prepare(`DELETE FROM ${name}`).run();
        console.log(`已清空表: ${name}`);
      } catch (error: any) {
        console.log(`表 ${name} 无法清空: ${error.message}`);
      }
    }

    // 重新启用外键约束
    sqlite.exec('PRAGMA foreign_keys = ON');

    console.log('数据库重置完成!');
  } finally {
    sqlite.close();
  }
}

resetDatabase().catch(console.error);