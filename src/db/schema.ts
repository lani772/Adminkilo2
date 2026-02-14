import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['super_admin', 'admin', 'user', 'viewer'] }).notNull().default('user'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isTwoFactorEnabled: integer('is_two_factor_enabled', { mode: 'boolean' }).notNull().default(false),
  twoFactorSecret: text('two_factor_secret'),
  maxDevices: integer('max_devices').notNull().default(10),
  maxLamps: integer('max_lamps').notNull().default(50),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text('last_login_at'),
});

// ============================================================================
// CONTROLLERS TABLE
// ============================================================================

export const controllers = sqliteTable('controllers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  deviceType: text('device_type', { enum: ['ESP32', 'ESP8266'] }).notNull(),
  macAddress: text('mac_address').notNull().unique(),
  ipAddress: text('ip_address').notNull(),
  firmwareVersion: text('firmware_version').notNull().default('1.0.0'),
  status: text('status', { enum: ['online', 'offline', 'maintenance', 'error'] }).notNull().default('offline'),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  location: text('location').notNull(),
  lastSeenAt: text('last_seen_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// LAMPS TABLE
// ============================================================================

export const lamps = sqliteTable('lamps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  controllerId: text('controller_id').notNull().references(() => controllers.id, { onDelete: 'cascade' }),
  pin: integer('pin').notNull(),
  isOn: integer('is_on', { mode: 'boolean' }).notNull().default(false),
  brightness: integer('brightness').notNull().default(100),
  color: text('color'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// PERMISSIONS TABLE
// ============================================================================

export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  resourceType: text('resource_type', { enum: ['controller', 'lamp'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  accessLevel: text('access_level', { enum: ['read', 'control', 'manage', 'admin'] }).notNull(),
  grantedBy: text('granted_by').notNull().references(() => users.id),
  grantedAt: text('granted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text('expires_at'),
  timeRestrictions: text('time_restrictions'), // JSON string
  ipRestrictions: text('ip_restrictions'), // JSON string
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// ============================================================================
// SYSTEM CONFIG TABLE
// ============================================================================

export const systemConfig = sqliteTable('system_config', {
  id: text('id').primaryKey(),
  timezone: text('timezone').notNull().default('UTC'),
  defaultMaxDevices: integer('default_max_devices').notNull().default(10),
  defaultMaxLamps: integer('default_max_lamps').notNull().default(50),
  dataRetentionDays: integer('data_retention_days').notNull().default(90),
  enableEmailNotifications: integer('enable_email_notifications', { mode: 'boolean' }).notNull().default(true),
  enableSmsNotifications: integer('enable_sms_notifications', { mode: 'boolean' }).notNull().default(false),
  enablePushNotifications: integer('enable_push_notifications', { mode: 'boolean' }).notNull().default(true),
  requireTwoFactor: integer('require_two_factor', { mode: 'boolean' }).notNull().default(false),
  passwordMinLength: integer('password_min_length').notNull().default(8),
  passwordRequireSpecialChar: integer('password_require_special_char', { mode: 'boolean' }).notNull().default(true),
  maxLoginAttempts: integer('max_login_attempts').notNull().default(5),
  lockoutDurationMinutes: integer('lockout_duration_minutes').notNull().default(30),
  sessionTimeoutMinutes: integer('session_timeout_minutes').notNull().default(60),
  apiRateLimitPerMinute: integer('api_rate_limit_per_minute').notNull().default(100),
  maintenanceMode: integer('maintenance_mode', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text('updated_by').notNull().references(() => users.id),
});

// ============================================================================
// SYSTEM ALERTS TABLE
// ============================================================================

export const systemAlerts = sqliteTable('system_alerts', {
  id: text('id').primaryKey(),
  severity: text('severity', { enum: ['info', 'warning', 'error', 'critical'] }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull(),
  isResolved: integer('is_resolved', { mode: 'boolean' }).notNull().default(false),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// SYSTEM METRICS TABLE
// ============================================================================

export const systemMetrics = sqliteTable('system_metrics', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  requestsPerSecond: real('requests_per_second').notNull(),
  cpuUsage: real('cpu_usage').notNull(),
  memoryUsage: real('memory_usage').notNull(),
  activeUsers: integer('active_users').notNull(),
  activeDevices: integer('active_devices').notNull(),
  totalDevices: integer('total_devices').notNull(),
  totalLamps: integer('total_lamps').notNull(),
  errorRate: real('error_rate').notNull(),
});

// ============================================================================
// AUDIT LOGS TABLE
// ============================================================================

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  username: text('username').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  details: text('details').notNull(), // JSON string
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// ANALYTICS REPORTS TABLE
// ============================================================================

export const analyticsReports = sqliteTable('analytics_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['user_activity', 'device_performance', 'energy_usage', 'security_audit'] }).notNull(),
  format: text('format', { enum: ['csv', 'json', 'xlsx', 'pdf'] }).notNull(),
  generatedAt: text('generated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  generatedBy: text('generated_by').notNull().references(() => users.id),
  downloadUrl: text('download_url').notNull(),
});

// ============================================================================
// SESSIONS TABLE (for tracking active sessions)
// ============================================================================

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
