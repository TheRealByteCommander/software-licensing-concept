# Software Licensing System

A comprehensive, flexible software licensing system with support for various license models including subscriptions, perpetual licenses, and device-based licensing. Built with modern web technologies and designed for easy integration into existing software products.

## Features

### License Server (Backend)
- **RESTful API** for license management via tRPC
- **Multiple License Types**: Subscription, perpetual, node-locked, user-based, feature-based
- **Real-time Validation**: Online and offline license validation
- **Secure Token System**: JWT-based signed tokens
- **Activation Tracking**: Monitor device activations and usage
- **Database-backed**: MySQL/TiDB for reliable data storage

### Admin Portal (Web UI)
- **Dashboard**: Overview of licenses, products, and activations
- **Product Management**: Create and manage software products
- **License Management**: Generate, view, and revoke licenses
- **Customer Management**: Track customer information
- **Activation Logs**: Monitor all license activations

### Python Client SDK
- **Easy Integration**: Simple API for Python applications
- **Offline Support**: Validate licenses without internet (up to 7 days)
- **Automatic Device ID**: Generates unique device identifiers
- **Secure Token Storage**: Encrypted local token storage
- **Cross-platform**: Works on Windows, macOS, and Linux

## Architecture

```
┌─────────────────┐
│  Admin Portal   │  (React + Tailwind)
│   (Web UI)      │
└────────┬────────┘
         │
         │ tRPC API
         │
┌────────▼────────┐
│ License Server  │  (Node.js + Express + tRPC)
│   (Backend)     │
└────────┬────────┘
         │
         │ SQL
         │
┌────────▼────────┐
│    Database     │  (MySQL/TiDB)
│  (PostgreSQL)   │
└─────────────────┘

┌─────────────────┐
│ Client Apps     │  (Python SDK)
│ (Python, etc.)  │
└────────┬────────┘
         │
         │ HTTPS API
         │
         └──────────► License Server
```

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/license-server.git
cd license-server
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Database

```bash
pnpm db:push
```

### 4. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

### 5. Access Admin Portal

1. Navigate to `http://localhost:3000`
2. Log in with Manus OAuth
3. Create your first product
4. Generate licenses

## Python SDK Usage

### Installation

```bash
cd python-sdk
pip install -e .
```

### Example

```python
from licensing_sdk import LicenseClient

# Initialize client
client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Activate license
result = client.activate()
if result['success']:
    print("License activated!")

# Validate license
if client.is_valid():
    print("License is valid - running application")
    # Your application logic here
else:
    print("Invalid license")
    exit(1)
```

See [Python SDK README](python-sdk/README.md) for detailed documentation.

## Documentation

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Deployment Guide](DEPLOYMENT.md) - Production deployment instructions
- [Python SDK Guide](python-sdk/README.md) - Python client library documentation

## Project Structure

```
license-server/
├── client/                 # React frontend (Admin Portal)
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # tRPC client
├── server/                # Node.js backend
│   ├── routers.ts         # tRPC API routes
│   ├── db.ts              # Database queries
│   └── licenseUtils.ts    # License key generation & JWT
├── drizzle/               # Database schema & migrations
│   └── schema.ts          # Database tables
├── python-sdk/            # Python client library
│   ├── licensing_sdk/     # SDK source code
│   ├── setup.py           # Package configuration
│   └── README.md          # SDK documentation
└── shared/                # Shared types & constants
```

## Technology Stack

### Backend
- **Node.js** + **Express** - Server runtime
- **tRPC** - Type-safe API layer
- **Drizzle ORM** - Database ORM
- **MySQL/TiDB** - Database
- **JWT** - Token-based authentication

### Frontend
- **React 19** - UI framework
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Component library
- **Wouter** - Routing

### Python SDK
- **Requests** - HTTP client
- **PyJWT** - JWT token handling

## License Models Supported

| Model | Description | Use Case |
|-------|-------------|----------|
| **Subscription** | Time-limited with recurring billing | SaaS products |
| **Perpetual** | One-time purchase, unlimited use | Traditional software |
| **Node-Locked** | Tied to specific devices | Desktop applications |
| **User-Based** | Tied to user accounts | Multi-device access |
| **Feature-Based** | Unlocks specific features | Tiered pricing |

## API Endpoints

### Public API (No Auth Required)
- `POST /api/trpc/api.activate` - Activate a license
- `POST /api/trpc/api.validate` - Validate a license token
- `POST /api/trpc/api.deactivate` - Deactivate a license

### Admin API (Auth Required)
- Products: `list`, `create`, `update`, `delete`
- Licenses: `list`, `create`, `update`, `revoke`
- Customers: `list`, `create`, `get`
- Activations: `list`, `byLicense`

See [API Documentation](API_DOCUMENTATION.md) for details.

## Development

### Run Tests

```bash
pnpm test
```

### Build for Production

```bash
pnpm build
```

### Database Migrations

```bash
# Generate migration from schema changes
pnpm db:push

# View database in Drizzle Studio
pnpm db:studio
```

## Deployment

The easiest deployment method is using the Manus platform:

1. Save a checkpoint
2. Click "Publish" in the UI
3. Your app is live with automatic SSL and CDN

For manual deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Security Features

- **Signed JWT Tokens**: Prevent token tampering
- **Device Fingerprinting**: Unique device identification
- **Activation Limits**: Enforce device restrictions
- **License Revocation**: Instantly disable compromised keys
- **Rate Limiting**: Prevent brute-force attacks
- **Offline Validation**: 7-day grace period for offline use

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For questions or issues:
- Check the [API Documentation](API_DOCUMENTATION.md)
- Review the [Python SDK Guide](python-sdk/README.md)
- Open an issue on GitHub

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with:
- [tRPC](https://trpc.io/) - End-to-end typesafe APIs
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
