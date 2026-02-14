import { NextRequest, NextResponse } from 'next/server';
import { db, sqlite } from '@/db';
import { verifyPassword, generateToken, validateEmail } from '@/lib/auth';
import type { LoginRequest, AuthResponse, ApiResponse, User } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user by username or email
    const user = sqlite.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(username, username) as any;

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Account is disabled' },
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    sqlite.prepare(`
      UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(user.id);

    // Create user object (without password hash)
    const userResponse: User = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: Boolean(user.is_active),
      isTwoFactorEnabled: Boolean(user.is_two_factor_enabled),
      maxDevices: user.max_devices,
      maxLamps: user.max_lamps,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };

    // Generate JWT token
    const token = generateToken(userResponse);

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    sqlite.prepare(`
      INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      user.id,
      token,
      request.headers.get('x-forwarded-for') || 'unknown',
      request.headers.get('user-agent') || 'unknown',
      expiresAt.toISOString()
    );

    const response: AuthResponse = {
      token,
      user: userResponse,
      expiresIn: 86400, // 24 hours in seconds
    };

    return NextResponse.json<ApiResponse<AuthResponse>>(
      { success: true, data: response },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
