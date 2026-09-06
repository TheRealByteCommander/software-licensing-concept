# Byte Commander License Server - Deployment Guide

This guide explains how to deploy the Byte Commander License Server to production.

**Admin setup after deployment:** [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md)

## Prerequisites

- Node.js 18+ and pnpm
- MySQL or TiDB database
- Domain name with SSL certificate

## Environment Variables

The following environment variables are automatically configured by the BC platform:

- `DATABASE_URL`: MySQL/TiDB connection string
- `JWT_SECRET`: Session cookie signing secret
- `VITE_APP_ID`: BC OAuth application ID
- `OAUTH_SERVER_URL`: BC OAuth backend base URL
- `VITE_OAUTH_PORTAL_URL`: BC login portal URL
- `OWNER_OPEN_ID`, `OWNER_NAME`: Owner's info
- `VITE_APP_TITLE`: Application title (default: "Byte Commander License Server")
- `VITE_APP_LOGO`: Logo image URL (Byte Commander logo)
- `LOCAL_AUTH_ENABLED`: Set to `true` for self-hosted password + TOTP admin login
- `LOCAL_AUTH_OPEN_ID`, `LOCAL_AUTH_NAME`, `LOCAL_AUTH_EMAIL`: Local admin identity (login identifier)
- `LOCAL_AUTH_SETUP_TOKEN`: Recommended one-time bootstrap secret for first-time password + TOTP enrollment
- `LOCAL_AUTH_LOGIN_MAX_ATTEMPTS`, `LOCAL_AUTH_LOGIN_WINDOW_MS`: Login/setup rate limit (default 8 attempts / 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`: Public license API rate limits

## Deployment Steps

### 1. Database Setup

The database schema is automatically created when you run:

```bash
pnpm db:push
```

This command:
1. Generates migration files from the schema
2. Applies migrations to the database

### 2. Build the Application

```bash
pnpm install
pnpm build
```

### 3. Start the Production Server

```bash
pnpm start
```

The server will start on port 3000 by default.

### 4. Configure Reverse Proxy

Set up a reverse proxy (nginx, Caddy, etc.) to handle SSL termination and forward requests to the application.

**Example nginx configuration:**

```nginx
server {
    listen 80;
    server_name license.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name license.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Using BC Platform Deployment

The easiest way to deploy is using the BC platform's built-in deployment:

1. Save a checkpoint in the development environment
2. Click the "Publish" button in the UI
3. The application will be automatically deployed with:
   - Automatic SSL certificate
   - CDN for static assets
   - Database connection
   - Environment variables

## Post-Deployment

### 1. Create Your First Product

See [docs/ANLEITUNG_LIZENZADMIN.md](docs/ANLEITUNG_LIZENZADMIN.md) for the full workflow.

1. Navigate to **Products** (`/products`)
2. Click **Add Product**
3. Enter product name and description
4. Optional: open the **Shield** dialog to configure 2FA

### 2. Generate Licenses

1. Navigate to **Licenses** (`/licenses`)
2. Click **Create License**
3. Select product, license type, max activations, optional expiry
4. Copy the generated license key

### 3. Distribute to Customers

Provide customers with:
- The license key
- The server URL (e.g. `<license-server-url>`)
- The product ID (if required by your integration)
- [End-user guide](docs/ANLEITUNG_SOFTWARENUTZER.md) or your own onboarding
- SDK / integration docs: [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)

## Monitoring

### Health Check

The application provides a health check endpoint:

```bash
curl <license-server-url>/
```

### Database Monitoring

Monitor your database for:
- Connection pool usage
- Query performance
- Storage usage

### Application Logs

Check application logs for errors:

```bash
pm2 logs  # if using PM2
journalctl -u license-server  # if using systemd
```

## Backup

### Database Backup

Regularly backup your database:

```bash
mysqldump -u user -p license_db > backup.sql
```

### Automated Backups

Set up automated daily backups:

```bash
# Add to crontab
0 2 * * * mysqldump -u user -p'password' license_db > /backups/license_$(date +\%Y\%m\%d).sql
```

## Scaling

### Horizontal Scaling

The application is stateless and can be scaled horizontally:

1. Deploy multiple instances
2. Use a load balancer to distribute traffic
3. Ensure all instances connect to the same database

### Database Scaling

For high-traffic scenarios:

1. Use read replicas for validation queries
2. Implement caching (Redis) for frequently accessed data
3. Consider using TiDB for horizontal database scaling

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Rate Limiting**: Implement rate limiting at the reverse proxy level
3. **Database Security**: Use strong passwords and restrict database access
4. **Regular Updates**: Keep dependencies up to date
5. **Monitoring**: Set up monitoring and alerting for suspicious activity

## Self-hosted admin login (password + TOTP)

When `LOCAL_AUTH_ENABLED=true`, **or** BC OAuth is not configured (`OAUTH_SERVER_URL` / `VITE_APP_ID` missing), the admin portal no longer grants access automatically. Unauthenticated visitors see `/login`.

Public license SDK endpoints (`api.activate`, `api.validate`, `api.deactivate`, product-activation 2FA) stay reachable **without** an admin session.

### 1. Environment

```env
LOCAL_AUTH_ENABLED=true
LOCAL_AUTH_OPEN_ID=local-admin
LOCAL_AUTH_NAME=Local Admin
LOCAL_AUTH_EMAIL=admin@localhost
LOCAL_AUTH_SETUP_TOKEN=generate-a-long-random-string
JWT_SECRET=generate-a-long-random-string-min-32-chars
```

`JWT_SECRET` signs the session cookie **and** encrypts the admin TOTP secret at rest. Use a unique value per VPS.

`LOCAL_AUTH_SETUP_TOKEN` is strongly recommended. If it is set, the first-time setup form requires it. If it is omitted, setup is allowed only while no password hash exists yet (anyone who can reach `/login` can enroll the first admin).

### 2. Database

Apply schema updates (adds `localAdminCredentials`):

```bash
pnpm db:push
```

### 3. First-time bootstrap

1. Open `https://license.example.com/login`
2. Enter the setup token (if configured), choose a password (min. 12 characters), confirm it
3. Scan the QR code with Google Authenticator or another TOTP app
4. Enter a 6-digit code to finish setup — this also signs you in
5. Remove or rotate `LOCAL_AUTH_SETUP_TOKEN` after enrollment if you want to prevent a second bootstrap on a wiped credentials row

After setup, login is always: identifier (email / openId / name) → password → TOTP. Password alone never creates a session.

### 4. Day-to-day login / logout

- Sign in at `/login`
- Sign out from the user menu (clears the `app_session_id` session cookie)

### 5. Keep BC OAuth instead

Leave `LOCAL_AUTH_ENABLED` unset/`false` and configure `OAUTH_SERVER_URL`, `VITE_APP_ID`, and `VITE_OAUTH_PORTAL_URL`. `/login` then redirects to the OAuth portal.

Product-level 2FA for license activation is unchanged and independent of admin login TOTP.

## Troubleshooting

### Database Connection Issues

Check the `DATABASE_URL` environment variable and ensure the database is accessible.

### Authentication Issues

For BC OAuth, verify `OAUTH_SERVER_URL`, `VITE_APP_ID`, and `VITE_OAUTH_PORTAL_URL`. For self-hosted login, confirm `JWT_SECRET`, that `pnpm db:push` created `localAdminCredentials`, and that password + TOTP were enrolled at `/login`.

### Performance Issues

- Check database query performance
- Monitor server resources (CPU, memory)
- Review application logs for errors

## Support

For issues or questions:
- Check the API documentation
- Review the example code
- Contact support at support@example.com
