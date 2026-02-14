# Advanced Admin Control Panel - API Documentation

## 🎯 Overview

This is the **Unified API** that powers both the Admin Panel and User Panel. It provides a complete REST API with WebSocket support for real-time cross-panel communication.

## 🔐 Authentication

All API endpoints (except `/api/v2/auth/login`) require authentication via JWT Bearer token.

### Login

```http
POST /api/v2/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "role": "super_admin",
      ...
    },
    "expiresIn": 86400
  }
}
```

### Using the Token

Include the token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 👥 User Management

### List Users

```http
GET /api/v2/admin/users?page=1&pageSize=20&search=john&role=user&isActive=true
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by username, email, or name
- `role` (optional): Filter by role (super_admin, admin, user, viewer)
- `isActive` (optional): Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "isTwoFactorEnabled": false,
      "maxDevices": 10,
      "maxLamps": 50,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8
  }
}
```

### Create User

```http
POST /api/v2/admin/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "username": "new_user",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "user",
  "firstName": "New",
  "lastName": "User",
  "maxDevices": 10,
  "maxLamps": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* User object */ },
  "message": "User created successfully"
}
```

**WebSocket Event Broadcasted:**
```json
{
  "type": "user:created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "user": { /* User object */ }
  }
}
```

---

## 🔐 Permission Management

### List Permissions

```http
GET /api/v2/admin/permissions?userId=uuid&resourceType=controller&resourceId=uuid
Authorization: Bearer {token}
```

**Query Parameters:**
- `userId` (optional): Filter by user ID
- `resourceType` (optional): Filter by resource type (controller, lamp)
- `resourceId` (optional): Filter by resource ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "resourceType": "controller",
      "resourceId": "controller-uuid",
      "accessLevel": "control",
      "grantedBy": "admin-uuid",
      "grantedAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": null,
      "timeRestrictions": null,
      "ipRestrictions": null,
      "usageLimit": null,
      "usageCount": 0,
      "isActive": true
    }
  ],
  "pagination": { /* ... */ }
}
```

### Grant Permission

```http
POST /api/v2/admin/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user-uuid",
  "resourceType": "controller",
  "resourceId": "controller-uuid",
  "accessLevel": "control",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "timeRestrictions": {
    "startTime": "09:00",
    "endTime": "17:00",
    "daysOfWeek": [1, 2, 3, 4, 5]
  },
  "ipRestrictions": {
    "whitelist": ["192.168.1.0/24"],
    "blacklist": []
  },
  "usageLimit": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* Permission object */ },
  "message": "Permission granted successfully"
}
```

**WebSocket Event Broadcasted to User:**
```json
{
  "type": "permission:granted",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "resourceType": "controller",
    "resourceId": "controller-uuid",
    "accessLevel": "control"
  },
  "userId": "user-uuid"
}
```

### Revoke Permission

```http
DELETE /api/v2/admin/permissions?id=permission-uuid
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Permission revoked successfully"
}
```

**WebSocket Event Broadcasted to User:**
```json
{
  "type": "permission:revoked",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "permissionId": "permission-uuid"
  },
  "userId": "user-uuid"
}
```

---

## 📊 Dashboard

### Get Dashboard Stats

```http
GET /api/v2/admin/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 150,
      "activeUsers": 45,
      "totalDevices": 320,
      "onlineDevices": 280,
      "totalLamps": 1250,
      "activeLamps": 450,
      "totalPermissions": 890,
      "unresolvedAlerts": 3,
      "systemHealth": "healthy"
    },
    "recentActivity": [
      {
        "id": "uuid",
        "type": "permission",
        "action": "permission.granted",
        "description": "Granted control access to controller",
        "userId": "admin-uuid",
        "username": "admin",
        "timestamp": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

## 🌐 WebSocket Connection

### Connect to WebSocket

```javascript
const token = localStorage.getItem('admin_token');
const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received event:', message);
  
  // Handle different event types
  switch (message.type) {
    case 'permission:granted':
      // Refresh device list
      fetchDevices();
      break;
    case 'permission:revoked':
      // Remove device from list
      removeDevice(message.data.permissionId);
      break;
    case 'device:online':
      // Update device status
      updateDeviceStatus(message.data.controllerId, 'online');
      break;
    // ... handle other events
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

### WebSocket Event Types

| Event Type | Description | Broadcasted To |
|------------|-------------|----------------|
| `device:online` | Device came online | All users |
| `device:offline` | Device went offline | All users |
| `device:error` | Device error occurred | Admins only |
| `lamp:toggled` | Lamp turned on/off | All users |
| `lamp:brightness_changed` | Lamp brightness changed | All users |
| `permission:granted` | Permission granted to user | Specific user |
| `permission:revoked` | Permission revoked from user | Specific user |
| `user:created` | New user created | Admins only |
| `user:updated` | User updated | Admins + affected user |
| `user:deleted` | User deleted | Admins only |
| `alert:created` | System alert created | Admins only |
| `alert:resolved` | Alert resolved | Admins only |
| `system:maintenance_mode` | Maintenance mode toggled | All users |
| `system:config_updated` | System config updated | Admins only |

---

## 🔄 Cross-Panel Communication Flow

### Example: Admin Grants Permission to User

1. **Admin Panel** → `POST /api/v2/admin/permissions`
2. **API** validates request and creates permission in database
3. **API** broadcasts WebSocket event: `permission:granted` to user
4. **User Panel** (if connected) receives event via WebSocket
5. **User Panel** automatically refreshes device list
6. **User** immediately sees new device without page refresh!

### Example: User Toggles Lamp

1. **User Panel** → `POST /api/v2/devices/lamps/{id}/toggle`
2. **API** validates permission and toggles lamp
3. **API** broadcasts WebSocket event: `lamp:toggled` to all users
4. **Admin Panel** receives event and updates monitoring dashboard
5. **Other User Panels** with access see lamp status update in real-time

---

## 🛡️ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## 🚀 Rate Limiting

- Default: 100 requests per minute per user
- Configurable via system config
- Exceeding limit returns `429 Too Many Requests`

---

## 📝 Access Levels

| Level | Description | Permissions |
|-------|-------------|-------------|
| `read` | View only | View device status, lamp states |
| `control` | Basic control | Toggle lamps, adjust brightness |
| `manage` | Full control | Control + configure settings |
| `admin` | Administrative | Manage + grant permissions |

---

## 🔧 Development

### Default Credentials

- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `super_admin`

### Database

- SQLite database: `admin-panel.db`
- Auto-initialized on first run
- Default super admin created automatically

### Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3000
```

---

## 📚 TypeScript Types

All types are defined in `src/types/index.ts` and can be imported:

```typescript
import type {
  User,
  Permission,
  Controller,
  Lamp,
  GrantPermissionRequest,
  WebSocketEvent,
  // ... and more
} from '@/types';
```

---

## 🎉 Ready for Cross-AI Development!

This API is designed to be used by:
- **AI #1**: Building the Admin Panel (this project)
- **AI #2**: Building the User Panel (separate project)
- **AI #3**: Building mobile apps
- **Human developers**: Extending functionality

All panels communicate through this unified API and WebSocket system!
