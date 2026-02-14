import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractBearerToken, hasRole, type JWTPayload } from './auth';
import type { UserRole, ApiResponse } from '@/types';

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
  options?: { requiredRole?: UserRole }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Verify token
      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      // Check role if required
      if (options?.requiredRole && !hasRole(payload.role, options.requiredRole)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Attach user to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = payload;

      // Call the actual handler
      return handler(authenticatedRequest);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// ============================================================================
// ADMIN-ONLY MIDDLEWARE
// ============================================================================

export function withAdminAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRole: 'admin' });
}

// ============================================================================
// SUPER ADMIN-ONLY MIDDLEWARE
// ============================================================================

export function withSuperAdminAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRole: 'super_admin' });
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

export function errorResponse(error: string, status: number = 400): NextResponse {
  return NextResponse.json<ApiResponse>(
    { success: false, error },
    { status }
  );
}

export function successResponse<T>(data: T, message?: string): NextResponse {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data, message },
    { status: 200 }
  );
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { valid: boolean; missing?: string[] } {
  const missing = requiredFields.filter((field) => !body[field]);
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  return { valid: true };
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function getPaginationParams(request: NextRequest): PaginationParams {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

export function createPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number
) {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}
