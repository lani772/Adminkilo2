// ============================================================================
// SHARED TYPES FOR CROSS-AI COMMUNICATION
// ============================================================================
// These types are used by Admin Panel, User Panel, and Unified API
// Any AI building a panel should use these exact interfaces

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export type UserRole = 'super_admin' | 'admin' | 'user' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isTwoFactorEnabled: boolean;
  maxDevices: number;
  maxLamps: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  maxDevices?: number;
  maxLamps?: number;
}

export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  maxDevices?: number;
  maxLamps?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ============================================================================
// DEVICES & CONTROLLERS
// ============================================================================

export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'error';
export type DeviceType = 'ESP32' | 'ESP8266';

export interface Controller {
  id: string;
  name: string;
  deviceType: DeviceType;
  macAddress: string;
  ipAddress: string;
  firmwareVersion: string;
  status: DeviceStatus;
  ownerId: string;
  location: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lamp {
  id: string;
  name: string;
  controllerId: string;
  pin: number;
  isOn: boolean;
  brightness: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateControllerRequest {
  name: string;
  deviceType: DeviceType;
  macAddress: string;
  ipAddress: string;
  ownerId: string;
  location: string;
}

export interface CreateLampRequest {
  name: string;
  controllerId: string;
  pin: number;
}

export interface BulkCreateLampsRequest {
  controllerId: string;
  lamps: Array<{
    name: string;
    pin: number;
  }>;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export type AccessLevel = 'read' | 'control' | 'manage' | 'admin';
export type ResourceType = 'controller' | 'lamp';

export interface Permission {
  id: string;
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  accessLevel: AccessLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  timeRestrictions: TimeRestriction | null;
  ipRestrictions: IpRestriction | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
}

export interface TimeRestriction {
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
}

export interface IpRestriction {
  whitelist: string[];
  blacklist: string[];
}

export interface GrantPermissionRequest {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  accessLevel: AccessLevel;
  expiresAt?: string;
  timeRestrictions?: TimeRestriction;
  ipRestrictions?: IpRestriction;
  usageLimit?: number;
}

export interface BulkGrantPermissionRequest {
  userIds: string[];
  resourceType: ResourceType;
  resourceId: string;
  accessLevel: AccessLevel;
  expiresAt?: string;
  timeRestrictions?: TimeRestriction;
  ipRestrictions?: IpRestriction;
  usageLimit?: number;
}

export interface ClonePermissionsRequest {
  fromUserId: string;
  toUserId: string;
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

export interface SystemConfig {
  id: string;
  timezone: string;
  defaultMaxDevices: number;
  defaultMaxLamps: number;
  dataRetentionDays: number;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enablePushNotifications: boolean;
  requireTwoFactor: boolean;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  apiRateLimitPerMinute: number;
  maintenanceMode: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface UpdateSystemConfigRequest {
  timezone?: string;
  defaultMaxDevices?: number;
  defaultMaxLamps?: number;
  dataRetentionDays?: number;
  enableEmailNotifications?: boolean;
  enableSmsNotifications?: boolean;
  enablePushNotifications?: boolean;
  requireTwoFactor?: boolean;
  passwordMinLength?: number;
  passwordRequireSpecialChar?: boolean;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  sessionTimeoutMinutes?: number;
  apiRateLimitPerMinute?: number;
  maintenanceMode?: boolean;
}

// ============================================================================
// MONITORING & ANALYTICS
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface SystemMetrics {
  timestamp: string;
  requestsPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
  activeUsers: number;
  activeDevices: number;
  totalDevices: number;
  totalLamps: number;
  errorRate: number;
}

export interface UserEngagement {
  userId: string;
  username: string;
  lastLoginAt: string;
  totalLogins: number;
  totalActions: number;
  devicesOwned: number;
  lampsControlled: number;
}

export interface DeviceHealth {
  controllerId: string;
  controllerName: string;
  status: DeviceStatus;
  uptime: number;
  lastSeenAt: string;
  errorCount: number;
  restartCount: number;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: 'user_activity' | 'device_performance' | 'energy_usage' | 'security_audit';
  format: 'csv' | 'json' | 'xlsx' | 'pdf';
  generatedAt: string;
  generatedBy: string;
  downloadUrl: string;
}

export interface CreateReportRequest {
  name: string;
  type: 'user_activity' | 'device_performance' | 'energy_usage' | 'security_audit';
  format: 'csv' | 'json' | 'xlsx' | 'pdf';
  startDate: string;
  endDate: string;
  filters?: Record<string, any>;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export type AuditAction = 
  | 'user.created' | 'user.updated' | 'user.deleted'
  | 'permission.granted' | 'permission.revoked'
  | 'device.created' | 'device.updated' | 'device.deleted'
  | 'lamp.created' | 'lamp.toggled' | 'lamp.deleted'
  | 'config.updated' | 'login.success' | 'login.failed';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  username: string;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export type WebSocketEventType =
  | 'device:online'
  | 'device:offline'
  | 'device:error'
  | 'lamp:toggled'
  | 'lamp:brightness_changed'
  | 'permission:granted'
  | 'permission:revoked'
  | 'user:created'
  | 'user:updated'
  | 'user:deleted'
  | 'alert:created'
  | 'alert:resolved'
  | 'system:maintenance_mode'
  | 'system:config_updated';

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  timestamp: string;
  data: T;
  userId?: string; // If event is for specific user
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalDevices: number;
  onlineDevices: number;
  totalLamps: number;
  activeLamps: number;
  totalPermissions: number;
  unresolvedAlerts: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

export interface RecentActivity {
  id: string;
  type: 'user' | 'device' | 'permission' | 'system';
  action: string;
  description: string;
  userId: string;
  username: string;
  timestamp: string;
}
