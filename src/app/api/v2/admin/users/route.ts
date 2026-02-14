import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/db';
import { hashPassword, validateEmail, validateUsername, validatePassword, canManageUser } from '@/lib/auth';
import { withAdminAuth, errorResponse, successResponse, getPaginationParams, createPaginatedResponse, validateRequiredFields, type AuthenticatedRequest } from '@/lib/api-middleware';
import { broadcastUserCreated } from '@/lib/websocket';
import type { User, CreateUserRequest, ApiResponse, PaginatedResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// GET /api/v2/admin/users - List all users with pagination
// ============================================================================

export const GET = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(request);
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const isActive = searchParams.get('isActive');

    // Build query
    let query = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (isActive !== null && isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = sqlite.prepare(countQuery).get(...params) as any;
    const totalItems = countResult.count;

    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const rows = sqlite.prepare(query).all(...params) as any[];

    const users: User[] = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: Boolean(row.is_active),
      isTwoFactorEnabled: Boolean(row.is_two_factor_enabled),
      maxDevices: row.max_devices,
      maxLamps: row.max_lamps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    }));

    return NextResponse.json(
      createPaginatedResponse(users, totalItems, page, pageSize),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching users:', error);
    return errorResponse('Failed to fetch users', 500);
  }
});

// ============================================================================
// POST /api/v2/admin/users - Create new user
// ============================================================================

export const POST = withAdminAuth(async (request: AuthenticatedRequest) => {
  try {
    const body: CreateUserRequest = await request.json();

    // Validate required fields
    const validation = validateRequiredFields(body, [
      'username',
      'email',
      'password',
      'role',
      'firstName',
      'lastName',
    ]);

    if (!validation.valid) {
      return errorResponse(`Missing required fields: ${validation.missing?.join(', ')}`, 400);
    }

    // Validate username
    const usernameValidation = validateUsername(body.username);
    if (!usernameValidation.valid) {
      return errorResponse(usernameValidation.error!, 400);
    }

    // Validate email
    if (!validateEmail(body.email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Validate password
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) {
      return errorResponse(passwordValidation.error!, 400);
    }

    // Check if actor can create user with this role
    if (!canManageUser(request.user!.role, body.role)) {
      return errorResponse('You do not have permission to create users with this role', 403);
    }

    // Check if username already exists
    const existingUser = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(body.username);
    if (existingUser) {
      return errorResponse('Username already exists', 409);
    }

    // Check if email already exists
    const existingEmail = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existingEmail) {
      return errorResponse('Email already exists', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO users (
        id, username, email, password_hash, role, first_name, last_name,
        max_devices, max_lamps, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      body.username,
      body.email,
      passwordHash,
      body.role,
      body.firstName,
      body.lastName,
      body.maxDevices || 10,
      body.maxLamps || 50,
      now,
      now
    );

    // Fetch created user
    const createdUser = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    const user: User = {
      id: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
      firstName: createdUser.first_name,
      lastName: createdUser.last_name,
      isActive: Boolean(createdUser.is_active),
      isTwoFactorEnabled: Boolean(createdUser.is_two_factor_enabled),
      maxDevices: createdUser.max_devices,
      maxLamps: createdUser.max_lamps,
      createdAt: createdUser.created_at,
      updatedAt: createdUser.updated_at,
      lastLoginAt: createdUser.last_login_at,
    };

    // Create audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, user_id, username, target_type, target_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'user.created',
      request.user!.userId,
      request.user!.username,
      'user',
      userId,
      JSON.stringify({ username: body.username, role: body.role }),
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown'
    );

    // Broadcast event
    broadcastUserCreated(user);

    return successResponse(user, 'User created successfully');
  } catch (error) {
    console.error('Error creating user:', error);
    return errorResponse('Failed to create user', 500);
  }
});
