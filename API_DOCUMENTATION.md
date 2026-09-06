# Byte Commander License Server - API Documentation

This document describes the RESTful API endpoints provided by the Byte Commander License Server for license activation, validation, and management. The system supports flexible licensing models including subscriptions, perpetual licenses, and 2FA-protected activations.

## Versioned Contract

For production integrations, use the versioned API contract:

- **OpenAPI v1:** [`api/openapi.v1.yaml`](api/openapi.v1.yaml)
- **Integration quickstart (Python/Node/.NET):** [`INTEGRATION_GUIDE.md`](INTEGRATION_GUIDE.md)

The OpenAPI file defines request/response payloads and a consistent error envelope for the public activation + 2FA endpoints.

## Wire Format (tRPC + superjson)

The server uses **tRPC with superjson**. Direct HTTP clients must wrap payloads accordingly (SDKs handle this automatically):

**Request:**
```json
{ "json": { "licenseKey": "XXXX-XXXX-XXXX-XXXX", "deviceId": "device-123" } }
```

**Success response:**
```json
{
  "result": {
    "data": {
      "json": { "success": true, "token": "...", "message": "Activation successful" }
    }
  }
}
```

**Error response:**
```json
{
  "error": {
    "json": {
      "message": "License not found",
      "code": -32004,
      "data": { "code": "NOT_FOUND", "httpStatus": 404, "path": "api.activate" }
    }
  }
}
```

Use `error.json.data.code` as the semantic error code (`NOT_FOUND`, `FORBIDDEN`, etc.).

**User & admin guides:** [docs/ANLEITUNG_SOFTWARENUTZER.md](docs/ANLEITUNG_SOFTWARENUTZER.md) · [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md)

## Base URL

All API endpoints are accessed via the base URL of your deployed License Server:

```
<license-server-url>/api/trpc/
```

## Authentication

### Admin Endpoints

Admin endpoints (product management, license management, customer management) require authentication via BC OAuth. Users must be logged in to access these endpoints.

### Public Endpoints

Public endpoints (activation, validation, deactivation) do not require authentication and can be called directly by client applications.

## API Endpoints

### License Activation

**Endpoint:** `POST /api/trpc/api.activate`

Activate a license on a specific device.

**Request Body:**

```json
{
  "json": {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "deviceId": "unique-device-identifier",
    "deviceInfo": "{\"platform\":\"Linux\",\"version\":\"5.15.0\"}"
  }
}
```

**Response (Success):**

```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "message": "Activation successful",
        "features": ["basic", "inspection", "Trends", "Export"],
        "productId": 2,
        "offlineGraceHours": 72,
        "offlineUntil": "2026-09-09T12:00:00.000Z"
      }
    }
  }
}
```

**Response (Error):**

```json
{
  "error": {
    "json": {
      "message": "License is revoked",
      "code": -32003,
      "data": { "code": "FORBIDDEN", "httpStatus": 403, "path": "api.activate" }
    }
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
  "json": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Valid):**

```json
{
  "result": {
    "data": {
      "json": {
        "valid": true,
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "license": {
          "productId": 2,
          "type": "subscription",
          "expiresAt": "2025-12-31T23:59:59.000Z",
          "features": ["basic", "inspection", "Trends", "Export"],
          "offlineGraceHours": 72,
          "offlineUntil": "2026-09-09T12:00:00.000Z"
        }
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
      "json": {
        "valid": false,
        "message": "License has expired"
      }
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
  "json": {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "deviceId": "unique-device-identifier"
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "message": "Deactivation successful"
      }
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

**Response:**

```json
{
  "success": true,
  "id": 1,
  "name": "My Software"
}
```

The numeric `id` is the Product ID used by SDKs and `api.activate` / `api.validate`.

---

### Admin Users

Portal accounts in the `users` table (OAuth and local admin). Not license customers.

| Endpoint | Access | Description |
|---|---|---|
| `GET /api/trpc/users.list` | admin | List id, name, email, role, loginMethod, lastSignedIn, disabled |
| `POST /api/trpc/users.setRole` | admin | `{ id, role: "user" \| "admin" }` |
| `POST /api/trpc/users.setDisabled` | admin | `{ id, disabled }` |

Self-demotion, self-disable, and removing the last active admin are rejected.

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
  "expiresAt": "2025-12-31",
  "metadata": "{\"features\":[\"pro\"],\"staleActivationDays\":14}"
}
```

`metadata.staleActivationDays` (optional) enables automatic stale-seat reclaim. During activation, devices that have not validated within the configured number of days are automatically deactivated before seat-limit enforcement.

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

### Stripe Checkout (Public)

These endpoints are for **embedding in the product** (AnomalyMatrix). They do **not** require an admin session. licadmin is vendor-only; there is no end-customer portal.

Supports **subscription** and **one-time payment** billing plans. After payment, licenses are issued immediately and can be activated without waiting for email delivery.

Renew/cancel (same public auth: `licenseKey` + purchase email):

- `GET /api/trpc/stripe.getLicenseBilling`
- `POST /api/trpc/stripe.createCustomerPortalSession` (`returnUrl` required)
- `POST /api/trpc/stripe.cancelSubscription` (`cancelAtPeriodEnd` defaults to true)

#### List Public Billing Plans

**Endpoint:** `GET /api/trpc/stripe.plans.listPublic`

Returns active plans with `billingModel` (`subscription` | `one_time`).

#### Create Checkout Session

**Endpoint:** `POST /api/trpc/stripe.createCheckoutSession`

**Request:**

```json
{
  "json": {
    "billingPlanId": 1,
    "customerEmail": "customer@example.com",
    "successUrl": "<ihre-app-url>/purchase?success=1&session_id={CHECKOUT_SESSION_ID}",
    "cancelUrl": "<ihre-app-url>/purchase?canceled=1"
  }
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "json": {
        "sessionId": "cs_test_...",
        "url": "Stripe Checkout (externer Redirect)",
        "billingModel": "subscription"
      }
    }
  }
}
```

Redirect the user to `url`. Use `{CHECKOUT_SESSION_ID}` in `successUrl` for immediate license retrieval.

#### Get Checkout Result (Immediate Unlock)

**Endpoint:** `GET /api/trpc/stripe.getCheckoutResult?input={"json":{"sessionId":"cs_test_..."}}`

Poll until `readyToActivate` is `true`, then call `api.activate` with the returned `licenseKey`.

**Response (completed):**

```json
{
  "result": {
    "data": {
      "json": {
        "status": "completed",
        "readyToActivate": true,
        "sessionId": "cs_test_...",
        "licenseKey": "AAAA-BBBB-CCCC-DDDD",
        "productId": 1,
        "productName": "My App",
        "licenseType": "perpetual",
        "billingModel": "one_time",
        "expiresAt": null,
        "features": ["pro"]
      }
    }
  }
}
```

**Typical purchase + unlock flow:**

1. `stripe.createCheckoutSession` → redirect to Stripe
2. After redirect: `stripe.getCheckoutResult({ sessionId })`
3. `api.activate({ licenseKey, deviceId })` → software unlocked

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

All errors follow the tRPC + superjson error format:

```json
{
  "error": {
    "json": {
      "message": "Human-readable error message",
      "code": -32004,
      "data": {
        "code": "NOT_FOUND",
        "httpStatus": 404,
        "path": "api.activate"
      }
    }
  }
}
```

Common semantic codes (`error.json.data.code`):
- `BAD_REQUEST`: Invalid request parameters
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `INTERNAL_SERVER_ERROR`: Server error


## 2FA (Google Authenticator) Activation

For products that require 2FA, use the following two-step process:

### Step 1: Initiate 2FA Activation

**Endpoint:** `POST /api/trpc/twoFA.initiateActivation`

Initiate a license activation that requires 2FA confirmation.

**Request Body:**

```json
{
  "json": {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "deviceId": "unique-device-identifier",
    "deviceInfo": "{\"platform\":\"Linux\",\"version\":\"5.15.0\"}"
  }
}
```

**Response (Success):**

```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "activationToken": "random-token-string",
        "expiresIn": 600
      }
    }
  }
}
```

### Step 2: Confirm with TOTP Code

**Endpoint:** `POST /api/trpc/twoFA.confirmActivationWith2FA`

Confirm the activation with a TOTP code from Google Authenticator.

**Request Body:**

```json
{
  "json": {
    "activationToken": "token-from-step-1",
    "totpCode": "123456"
  }
}
```

**Response (Success):**

```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "message": "2FA verification successful, license activated"
      }
    }
  }
}
```

**Important Notes:**
- The activation token expires in 10 minutes
- TOTP codes are 6 digits and valid for 30 seconds
- 2FA is only required during initial activation, not during validation
- Validation of existing licenses does not require 2FA
