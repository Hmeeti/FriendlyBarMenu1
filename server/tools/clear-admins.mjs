import { createRequire } from 'module';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../prisma/dev.db');

// Prefer raw sqlite3 via child process if better-sqlite3 missing
if (!fs.existsSync(dbPath)) {
  console.error('DB not found', dbPath);
  process.exit(1);
}

import { execSync } from 'child_process';

try {
  execSync('sqlite3 --version', { stdio: 'ignore' });
  execSync(`sqlite3 "${dbPath}" "DELETE FROM AuditLog; DELETE FROM AdminUser;"`, { stdio: 'inherit' });
  console.log('cleared via sqlite3');
} catch {
  // fallback: Node Buffer rewrite using sql.js? Use prisma with old schema via SQL through node:sqlite if available
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('DELETE FROM AuditLog; DELETE FROM AdminUser;');
  db.close();
  console.log('cleared via node:sqlite');
}
