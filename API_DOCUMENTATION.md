# License Server API Documentation

This document describes the RESTful API endpoints provided by the License Server for license activation, validation, and management.

## Base URL

All API endpoints are accessed via the base URL of your deployed License Server:

```
https://your-license-server.com/api/trpc/
```

## Authentication

### Admin Endpoints

Admin endpoints (product management, license management, customer management) require authentication via Manus OAuth. Users must be logged in to access these endpoints.

### Public Endpoints

Public endpoints (activation, validation, deactivation) do not require authentication and can be called directly by client applications.

## API Endpoints

### License Activation

**Endpoint:** `POST /api/trpc/api.activate`

Activate a license on a specific device.

**Request Body:**

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier",
  "deviceInfo": "{\"platform\":\"Linux\",\"version\":\"5.15.0\"}"
}
```

**Response (Success):**

```json
{
  "result": {
    "data": {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Activation successful"
    }
  }
}
```

**Response (Error):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "License is revoked"
  }
}
```

**Error Codes:**
- `NOT_FOUND`: License key not found
- `FORBIDDEN`: License is expired, revoked, or maximum activations reached

---

### License Validation

**Endpoint:** `POST /api/trpc/api.validate`

Validate an existing license token.

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Valid):**

```json
{
  "result": {
    "data": {
      "valid": true,
      "license": {
        "productId": 1,
        "type": "subscription",
        "expiresAt": "2025-12-31T23:59:59.000Z",
        "features": ["premium", "api_access"]
      }
    }
  }
}
```

**Response (Invalid):**

```json
{
  "result": {
    "data": {
      "valid": false,
      "message": "License has expired"
    }
  }
}
```

---

### License Deactivation

**Endpoint:** `POST /api/trpc/api.deactivate`

Deactivate a license on a specific device.

**Request Body:**

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "unique-device-identifier"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "success": true,
      "message": "Deactivation successful"
    }
  }
}
```

---

## Admin API Endpoints

### Products

#### List Products

**Endpoint:** `GET /api/trpc/products.list`

Returns all products.

**Response:**

```json
{
  "result": {
    "data": [
      {
        "id": 1,
        "name": "My Software",
        "description": "Professional software solution",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Create Product

**Endpoint:** `POST /api/trpc/products.create`

**Request:**

```json
{
  "name": "My Software",
  "description": "Professional software solution"
}
```

---

### Licenses

#### List Licenses

**Endpoint:** `GET /api/trpc/licenses.list`

Returns all licenses.

#### Create License

**Endpoint:** `POST /api/trpc/licenses.create`

**Request:**

```json
{
  "productId": 1,
  "type": "subscription",
  "maxActivations": 3,
  "expiresAt": "2025-12-31"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "success": true,
      "licenseKey": "ABCD-EFGH-IJKL-MNOP"
    }
  }
}
```

#### Revoke License

**Endpoint:** `POST /api/trpc/licenses.revoke`

**Request:**

```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX"
}
```

---

### Customers

#### List Customers

**Endpoint:** `GET /api/trpc/customers.list`

#### Create Customer

**Endpoint:** `POST /api/trpc/customers.create`

**Request:**

```json
{
  "email": "customer@example.com",
  "name": "John Doe",
  "company": "Acme Inc."
}
```

---

### Activations

#### List Activations

**Endpoint:** `GET /api/trpc/activations.list`

Returns all activation records.

#### Get Activations by License

**Endpoint:** `GET /api/trpc/activations.byLicense?licenseKey=XXXX-XXXX-XXXX-XXXX`

Returns all activations for a specific license.

---

## License Types

The system supports the following license types:

| Type | Description |
|------|-------------|
| `subscription` | Time-limited license with recurring billing |
| `perpetual` | One-time purchase for unlimited use |
| `node_locked` | Tied to specific number of devices |
| `user_based` | Tied to a user account |
| `feature_based` | Unlocks specific features |

## License Status

| Status | Description |
|--------|-------------|
| `active` | License is valid and can be used |
| `expired` | License has passed its expiration date |
| `revoked` | License has been manually revoked |
| `grace_period` | Payment failed, in grace period |

## Rate Limiting

The API implements rate limiting to prevent abuse. If you exceed the rate limit, you will receive a `429 Too Many Requests` response.

## Error Handling

All errors follow the tRPC error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

Common error codes:
- `BAD_REQUEST`: Invalid request parameters
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error
