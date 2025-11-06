# Deployment Guide

This guide explains how to deploy the License Server to production.

## Prerequisites

- Node.js 18+ and pnpm
- MySQL or TiDB database
- Domain name with SSL certificate

## Environment Variables

The following environment variables are automatically configured by the Manus platform:

- `DATABASE_URL`: MySQL/TiDB connection string
- `JWT_SECRET`: Session cookie signing secret
- `VITE_APP_ID`: Manus OAuth application ID
- `OAUTH_SERVER_URL`: Manus OAuth backend base URL
- `VITE_OAUTH_PORTAL_URL`: Manus login portal URL
- `OWNER_OPEN_ID`, `OWNER_NAME`: Owner's info
- `VITE_APP_TITLE`: Application title
- `VITE_APP_LOGO`: Logo image URL

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

## Using Manus Platform Deployment

The easiest way to deploy is using the Manus platform's built-in deployment:

1. Save a checkpoint in the development environment
2. Click the "Publish" button in the UI
3. The application will be automatically deployed with:
   - Automatic SSL certificate
   - CDN for static assets
   - Database connection
   - Environment variables

## Post-Deployment

### 1. Create Your First Product

Log in to the admin portal and create a product:

1. Navigate to "Products"
2. Click "Add Product"
3. Enter product name and description
4. Save

### 2. Generate Licenses

1. Navigate to "Licenses"
2. Click "Create License"
3. Select the product
4. Choose license type and settings
5. Save and copy the generated license key

### 3. Distribute to Customers

Provide customers with:
- The license key
- The server URL (e.g., `https://license.example.com`)
- The product ID
- The Python SDK or integration instructions

## Monitoring

### Health Check

The application provides a health check endpoint:

```bash
curl https://license.example.com/
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

## Troubleshooting

### Database Connection Issues

Check the `DATABASE_URL` environment variable and ensure the database is accessible.

### Authentication Issues

Verify that OAuth environment variables are correctly set.

### Performance Issues

- Check database query performance
- Monitor server resources (CPU, memory)
- Review application logs for errors

## Support

For issues or questions:
- Check the API documentation
- Review the example code
- Contact support at support@example.com
