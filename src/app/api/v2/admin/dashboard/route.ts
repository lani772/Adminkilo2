import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/db';
import { withAdminAuth, successResponse, errorResponse, type AuthenticatedRequest } from '@/lib/api-middleware';
import type { DashboardStats, RecentActivity } from '@/types';

// ============================================================================
// GET /api/v2/admin/dashboard - Get dashboard statistics
// ============================================================================

export const GET = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    // Get total users
    const totalUsersResult = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const totalUsers = totalUsersResult.count;

    // Get active users (logged in within last 24 hours)
    const activeUsersResult = sqlite.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE last_login_at > datetime('now', '-24 hours')
    `).get() as any;
    const activeUsers = activeUsersResult.count;

    // Get total devices
    const totalDevicesResult = sqlite.prepare('SELECT COUNT(*) as count FROM controllers').get() as any;
    const totalDevices = totalDevicesResult.count;

    // Get online devices
    const onlineDevicesResult = sqlite.prepare(`
      SELECT COUNT(*) as count FROM controllers 
      WHERE status = 'online'
    `).get() as any;
    const onlineDevices = onlineDevicesResult.count;

    // Get total lamps
    const totalLampsResult = sqlite.prepare('SELECT COUNT(*) as count FROM lamps').get() as any;
    const totalLamps = totalLampsResult.count;

    // Get active lamps (turned on)
    const activeLampsResult = sqlite.prepare('SELECT COUNT(*) as count FROM lamps WHERE is_on = 1').get() as any;
    const activeLamps = activeLampsResult.count;

    // Get total permissions
    const totalPermissionsResult = sqlite.prepare('SELECT COUNT(*) as count FROM permissions WHERE is_active = 1').get() as any;
    const totalPermissions = totalPermissionsResult.count;

    // Get unresolved alerts
    const unresolvedAlertsResult = sqlite.prepare('SELECT COUNT(*) as count FROM system_alerts WHERE is_resolved = 0').get() as any;
    const unresolvedAlerts = unresolvedAlertsResult.count;

    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (unresolvedAlerts > 10) {
      systemHealth = 'critical';
    } else if (unresolvedAlerts > 5) {
      systemHealth = 'degraded';
    }

    const stats: DashboardStats = {
      totalUsers,
      activeUsers,
      totalDevices,
      onlineDevices,
      totalLamps,
      activeLamps,
      totalPermissions,
      unresolvedAlerts,
      systemHealth,
    };

    // Get recent activity
    const recentActivityRows = sqlite.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all() as any[];

    const recentActivity: RecentActivity[] = recentActivityRows.map((row) => {
      const details = JSON.parse(row.details);
      let description = '';

      switch (row.action) {
        case 'user.created':
          description = `Created user ${details.username}`;
          break;
        case 'user.updated':
          description = `Updated user settings`;
          break;
        case 'user.deleted':
          description = `Deleted a user`;
          break;
        case 'permission.granted':
          description = `Granted ${details.accessLevel} access to ${details.resourceType}`;
          break;
        case 'permission.revoked':
          description = `Revoked permission`;
          break;
        case 'device.created':
          description = `Added new device`;
          break;
        case 'lamp.toggled':
          description = `Toggled lamp ${details.isOn ? 'on' : 'off'}`;
          break;
        case 'config.updated':
          description = `Updated system configuration`;
          break;
        case 'login.success':
          description = `Logged in`;
          break;
        default:
          description = row.action;
      }

      return {
        id: row.id,
        type: row.target_type,
        action: row.action,
        description,
        userId: row.user_id,
        username: row.username,
        timestamp: row.created_at,
      };
    });

    return successResponse({
      stats,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return errorResponse('Failed to fetch dashboard data', 500);
  }
});
