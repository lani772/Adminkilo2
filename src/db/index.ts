import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';

// Database file path
const DB_PATH = 'admin-panel.db';

// Global database instance
let sqliteDb: SqlJsDatabase | null = null;

// Initialize SQLite database
export async function initializeDatabase() {
  console.log('🔧 Initializing database...');

  // Initialize SQL.js
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  let data: Buffer | null = null;
  if (fs.existsSync(DB_PATH)) {
    data = fs.readFileSync(DB_PATH);
  }
  
  sqliteDb = data ? new SQL.Database(data) : new SQL.Database();
  
  // Create tables
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_secret TEXT,
      max_devices INTEGER NOT NULL DEFAULT 10,
      max_lamps INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS controllers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      mac_address TEXT NOT NULL UNIQUE,
      ip_address TEXT NOT NULL,
      firmware_version TEXT NOT NULL DEFAULT '1.0.0',
      status TEXT NOT NULL DEFAULT 'offline',
      owner_id TEXT NOT NULL,
      location TEXT NOT NULL,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS lamps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      controller_id TEXT NOT NULL,
      pin INTEGER NOT NULL,
      is_on INTEGER NOT NULL DEFAULT 0,
      brightness INTEGER NOT NULL DEFAULT 100,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (controller_id) REFERENCES controllers(id) ON DELETE CASCADE
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      access_level TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      time_restrictions TEXT,
      ip_restrictions TEXT,
      usage_limit INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      default_max_devices INTEGER NOT NULL DEFAULT 10,
      default_max_lamps INTEGER NOT NULL DEFAULT 50,
      data_retention_days INTEGER NOT NULL DEFAULT 90,
      enable_email_notifications INTEGER NOT NULL DEFAULT 1,
      enable_sms_notifications INTEGER NOT NULL DEFAULT 0,
      enable_push_notifications INTEGER NOT NULL DEFAULT 1,
      require_two_factor INTEGER NOT NULL DEFAULT 0,
      password_min_length INTEGER NOT NULL DEFAULT 8,
      password_require_special_char INTEGER NOT NULL DEFAULT 1,
      max_login_attempts INTEGER NOT NULL DEFAULT 5,
      lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,
      session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
      api_rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
      maintenance_mode INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS system_alerts (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS system_metrics (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      requests_per_second REAL NOT NULL,
      cpu_usage REAL NOT NULL,
      memory_usage REAL NOT NULL,
      active_users INTEGER NOT NULL,
      active_devices INTEGER NOT NULL,
      total_devices INTEGER NOT NULL,
      total_lamps INTEGER NOT NULL,
      error_rate REAL NOT NULL
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS analytics_reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      generated_by TEXT NOT NULL,
      download_url TEXT NOT NULL,
      FOREIGN KEY (generated_by) REFERENCES users(id)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Check if super admin exists
  const result = sqliteDb.exec('SELECT id FROM users WHERE role = ?', ['super_admin']);
  const existingAdmin = result.length > 0 && result[0].values.length > 0;

  if (!existingAdmin) {
    console.log('👤 Creating default super admin user...');
    
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('admin@123', 10);
    const now = new Date().toISOString();

    sqliteDb.run(`
      INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, max_devices, max_lamps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      'admin',
      'laurentniyigena1@gmail.com',
      passwordHash,
      'super_admin',
      'Super',
      'Admin',
      999,
      9999,
      now,
      now
    ]);

    // Create default system config
    const configId = uuidv4();
    sqliteDb.run(`
      INSERT INTO system_config (id, timezone, default_max_devices, default_max_lamps, data_retention_days, enable_email_notifications, enable_sms_notifications, enable_push_notifications, require_two_factor, password_min_length, password_require_special_char, max_login_attempts, lockout_duration_minutes, session_timeout_minutes, api_rate_limit_per_minute, maintenance_mode, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      configId,
      'UTC',
      10,
      50,
      90,
      1,
      0,
      1,
      0,
      8,
      1,
      5,
      30,
      60,
      100,
      0,
      now,
      adminId
    ]);

    console.log('✅ Default super admin created:');
    console.log('   Email: laurentniyigena1@gmail.com');
    console.log('   Password: admin@123');
  }

  // Save database to file
  saveDatabase();
  
  console.log('✅ Database initialized successfully!');
}

// Save database to file
export function saveDatabase() {
  if (sqliteDb) {
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Database wrapper for compatibility
export const sqlite = {
  prepare: (sql: string) => ({
    run: (...params: any[]) => {
      if (!sqliteDb) throw new Error('Database not initialized');
      sqliteDb.run(sql, params);
      saveDatabase();
      return { changes: sqliteDb.getRowsModified() };
    },
    get: (...params: any[]) => {
      if (!sqliteDb) throw new Error('Database not initialized');
      const stmt = sqliteDb.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: (...params: any[]) => {
      if (!sqliteDb) throw new Error('Database not initialized');
      const result = sqliteDb.exec(sql, params);
      if (result.length === 0) return [];
      const columns = result[0].columns;
      return result[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    }
  })
};

// For Drizzle ORM compatibility (mock)
const db = {
  select: () => ({ from: () => ({}) }),
  insert: () => ({ values: () => ({}) }),
  update: () => ({ set: () => ({ where: () => ({}) }) }),
  delete: () => ({ where: () => ({}) })
};

export { db };
export default db;
