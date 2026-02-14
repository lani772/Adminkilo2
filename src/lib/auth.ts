import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { User, UserRole } from '@/types';

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================================
// JWT UTILITIES
// ============================================================================

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// AUTHORIZATION UTILITIES
// ============================================================================

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    user: 2,
    admin: 3,
    super_admin: 4,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canManageUser(actorRole: UserRole, targetRole: UserRole): boolean {
  // Super admin can manage anyone
  if (actorRole === 'super_admin') return true;
  
  // Admin can manage users and viewers, but not other admins or super admins
  if (actorRole === 'admin') {
    return targetRole === 'user' || targetRole === 'viewer';
  }
  
  // Users and viewers cannot manage anyone
  return false;
}

export function canAccessResource(
  userRole: UserRole,
  resourceOwnerId: string,
  userId: string
): boolean {
  // Super admin and admin can access all resources
  if (userRole === 'super_admin' || userRole === 'admin') return true;
  
  // Users can only access their own resources
  return resourceOwnerId === userId;
}

// ============================================================================
// SESSION UTILITIES
// ============================================================================

export function generateSessionId(): string {
  return uuidv4();
}

export function getSessionExpiry(): string {
  const now = new Date();
  now.setHours(now.getHours() + 24); // 24 hour session
  return now.toISOString();
}

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string, minLength: number = 8, requireSpecialChar: boolean = true): { valid: boolean; error?: string } {
  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters long` };
  }

  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { valid: true };
}
