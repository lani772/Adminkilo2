import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/db';
import { withAdminAuth, errorResponse, successResponse, getPaginationParams, createPaginatedResponse, validateRequiredFields, type AuthenticatedRequest } from '@/lib/api-middleware';
import { broadcastPermissionGranted } from '@/lib/websocket';
import type { Permission, GrantPermissionRequest, BulkGrantPermissionRequest, ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET /api/v2/admin/permissions - List all permissions
// ============================================================================

export const GET = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(request);
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');

    // Build query
    let query = 'SELECT * FROM permissions WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }

    if (resourceId) {
      query += ' AND resource_id = ?';
      params.push(resourceId);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = sqlite.prepare(countQuery).get(...params) as any;
    const totalItems = countResult.count;

    // Get paginated results
    query += ' ORDER BY granted_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const rows = sqlite.prepare(query).all(...params) as any[];

    const permissions: Permission[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      accessLevel: row.access_level,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      expiresAt: row.expires_at,
      timeRestrictions: row.time_restrictions ? JSON.parse(row.time_restrictions) : null,
      ipRestrictions: row.ip_restrictions ? JSON.parse(row.ip_restrictions) : null,
      usageLimit: row.usage_limit,
      usageCount: row.usage_count,
      isActive: Boolean(row.is_active),
    }));

    return NextResponse.json(
      createPaginatedResponse(permissions, totalItems, page, pageSize),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return errorResponse('Failed to fetch permissions', 500);
  }
});

// ============================================================================
// POST /api/v2/admin/permissions - Grant permission
// ============================================================================

export const POST = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body: GrantPermissionRequest = await request.json();

    // Validate required fields
    const validation = validateRequiredFields(body, [
      'userId',
      'resourceType',
      'resourceId',
      'accessLevel',
    ]);

    if (!validation.valid) {
      return errorResponse(`Missing required fields: ${validation.missing?.join(', ')}`, 400);
    }

    // Verify user exists
    const user = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(body.userId);
    if (!user) {
      return errorResponse('User not found', 404);
    }

    // Verify resource exists
    const resourceTable = body.resourceType === 'controller' ? 'controllers' : 'lamps';
    const resource = sqlite.prepare(`SELECT id FROM ${resourceTable} WHERE id = ?`).get(body.resourceId);
    if (!resource) {
      return errorResponse(`${body.resourceType} not found`, 404);
    }

    // Check if permission already exists
    const existingPermission = sqlite.prepare(`
      SELECT id FROM permissions 
      WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND is_active = 1
    `).get(body.userId, body.resourceType, body.resourceId);

    if (existingPermission) {
      return errorResponse('Permission already exists for this user and resource', 409);
    }

    // Create permission
    const permissionId = uuidv4();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO permissions (
        id, user_id, resource_type, resource_id, access_level, granted_by, granted_at,
        expires_at, time_restrictions, ip_restrictions, usage_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      permissionId,
      body.userId,
      body.resourceType,
      body.resourceId,
      body.accessLevel,
      request.user!.userId,
      now,
      body.expiresAt || null,
      body.timeRestrictions ? JSON.stringify(body.timeRestrictions) : null,
      body.ipRestrictions ? JSON.stringify(body.ipRestrictions) : null,
      body.usageLimit || null
    );

    // Fetch created permission
    const createdPermission = sqlite.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId) as any;

    const permission: Permission = {
      id: createdPermission.id,
      userId: createdPermission.user_id,
      resourceType: createdPermission.resource_type,
      resourceId: createdPermission.resource_id,
      accessLevel: createdPermission.access_level,
      grantedBy: createdPermission.granted_by,
      grantedAt: createdPermission.granted_at,
      expiresAt: createdPermission.expires_at,
      timeRestrictions: createdPermission.time_restrictions ? JSON.parse(createdPermission.time_restrictions) : null,
      ipRestrictions: createdPermission.ip_restrictions ? JSON.parse(createdPermission.ip_restrictions) : null,
      usageLimit: createdPermission.usage_limit,
      usageCount: createdPermission.usage_count,
      isActive: Boolean(createdPermission.is_active),
    };

    // Create audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, user_id, username, target_type, target_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'permission.granted',
      request.user!.userId,
      request.user!.username,
      'permission',
      permissionId,
      JSON.stringify({
        userId: body.userId,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        accessLevel: body.accessLevel,
      }),
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    // Broadcast event to user (THIS IS KEY FOR CROSS-PANEL COMMUNICATION!)
    broadcastPermissionGranted(
      body.userId,
      body.resourceType,
      body.resourceId,
      body.accessLevel
    );

    return successResponse(permission, 'Permission granted successfully');
  } catch (error) {
    console.error('Error granting permission:', error);
    return errorResponse('Failed to grant permission', 500);
  }
});

// ============================================================================
// DELETE /api/v2/admin/permissions - Revoke permission
// ============================================================================

export const DELETE = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const permissionId = searchParams.get('id');

    if (!permissionId) {
      return errorResponse('Permission ID is required', 400);
    }

    // Check if permission exists
    const permission = sqlite.prepare('SELECT * FROM permissions WHERE id = ?').get(permissionId) as any;
    if (!permission) {
      return errorResponse('Permission not found', 404);
    }

    // Delete permission
    sqlite.prepare('DELETE FROM permissions WHERE id = ?').run(permissionId);

    // Create audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, user_id, username, target_type, target_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'permission.revoked',
      request.user!.userId,
      request.user!.username,
      'permission',
      permissionId,
      JSON.stringify({
        userId: permission.user_id,
        resourceType: permission.resource_type,
        resourceId: permission.resource_id,
      }),
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    // Broadcast event to user
    const { broadcastPermissionRevoked } = await import('@/lib/websocket');
    broadcastPermissionRevoked(permission.user_id, permissionId);

    return successResponse(null, 'Permission revoked successfully');
  } catch (error) {
    console.error('Error revoking permission:', error);
    return errorResponse('Failed to revoke permission', 500);
  }
});
