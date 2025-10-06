# Catalog Container Deployment Guide

## Overview

This document describes the current Quilt Catalog container setup and provides deployment instructions for the sales account (850787717197) with MCP integration.

## Current Container Architecture

### Base Image
- **Base**: `amazonlinux:2023.8.20250908.0`
- **Web Server**: Nginx
- **Runtime**: Node.js 20 (for build process)

### Container Structure

```
/usr/share/nginx/html/          # Static web assets
├── index.html                  # Main application
├── embed.html                  # Embed mode
├── oauth-callback.html         # OAuth callback
├── config.js                   # Runtime configuration (generated)
├── config.json                 # Runtime configuration (generated)
└── [webpack assets]            # JS/CSS bundles

/etc/nginx/
├── nginx.conf                  # Main nginx configuration
└── conf.d/default.conf         # Web server configuration

/tmp/
├── config.json                 # Environment-substituted config
└── config.js                   # Browser-accessible config
```

### Configuration System

The container uses a two-stage configuration system:

1. **Build-time**: `config.json.tmpl` is copied into the container
2. **Runtime**: Environment variables are substituted using `envsubst`
3. **Browser**: Configuration is exposed as `window.QUILT_CATALOG_CONFIG`

#### Environment Variables Required

```bash
REGION=us-east-1
API_GATEWAY=https://api.quiltdata.com
ALWAYS_REQUIRE_AUTH=true
NO_DOWNLOAD=false
S3_PROXY_URL=https://s3-proxy.quiltdata.com
INTERCOM_APP_ID=your_intercom_id
REGISTRY_URL=https://registry.quiltdata.com
PASSWORD_AUTH=true
SSO_AUTH=true
SSO_PROVIDERS=google,okta
SENTRY_DSN=your_sentry_dsn
MIXPANEL_TOKEN=your_mixpanel_token
ANALYTICS_BUCKET=quilt-analytics
SERVICE_BUCKET=quilt-service
CATALOG_MODE=production
CHUNKED_CHECKSUMS=true
QURATOR=true
STACK_VERSION=latest
PACKAGE_ROOT=s3://your-bucket
```

## ECS Infrastructure (Sales Account)

### Cluster Configuration
- **Cluster Name**: `sales-prod`
- **Region**: `us-east-1`
- **Account**: `850787717197`

### Task Definition
- **Family**: `quilt-catalog`
- **CPU**: 256 (0.25 vCPU)
- **Memory**: 512 MB
- **Network Mode**: `awsvpc`
- **Platform Version**: `LATEST`

### Service Configuration
- **Service Name**: `quilt-catalog-service`
- **Desired Count**: 2
- **Launch Type**: Fargate
- **Health Check**: `/healthcheck` endpoint

### Load Balancer
- **Type**: Application Load Balancer (ALB)
- **Scheme**: Internet-facing
- **Listeners**: 
  - Port 80 (HTTP) → Port 80 (Container)
  - Port 443 (HTTPS) → Port 80 (Container)
- **Target Group**: `quilt-catalog-tg`
- **Health Check Path**: `/healthcheck`

### Security Groups
- **ALB Security Group**: 
  - Inbound: 80, 443 from 0.0.0.0/0
  - Outbound: 80 to ECS Security Group
- **ECS Security Group**:
  - Inbound: 80 from ALB Security Group
  - Outbound: All traffic

## Current Deployment Process

### 1. Build Process
```bash
cd catalog
npm run build
```

### 2. Docker Build
```bash
docker build -t quilt-catalog .
```

### 3. ECR Push (Current)
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  730278974607.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag quilt-catalog:latest \
  730278974607.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:latest
docker push 730278974607.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:latest
```

### 4. ECS Update
```bash
# Update service with new image
aws ecs update-service \
  --cluster sales-prod \
  --service quilt-catalog-service \
  --force-new-deployment
```

## MCP Integration Changes

### New Features Added
1. **Dynamic Authentication Manager**: JWT-based auth with compression
2. **AWS Bucket Discovery**: Dynamic S3 bucket detection
3. **MCP Client**: Tool execution framework
4. **JWT Compression**: 90.3% size reduction for large token payloads

### Files Modified
- `app/services/DynamicAuthManager.js` - Enhanced authentication
- `app/services/EnhancedTokenGenerator.js` - JWT compression
- `app/services/AWSBucketDiscoveryService.js` - Dynamic bucket discovery
- `app/components/Assistant/MCP/` - MCP client components
- `app/services/mcpAuthorization.js` - Role definitions

### Configuration Changes
No additional environment variables required for MCP integration. The existing configuration will work with the MCP server running in the same cluster.

## Rollback Strategy

### Immediate Rollback (Emergency)
If the new deployment causes issues:

1. **Revert to Previous Image**:
   ```bash
   aws ecs update-service \
     --cluster sales-prod \
     --service quilt-catalog-service \
     --task-definition quilt-catalog:previous-version
   ```

2. **Force New Deployment**:
   ```bash
   aws ecs update-service \
     --cluster sales-prod \
     --service quilt-catalog-service \
     --force-new-deployment
   ```

### Complete Rollback
If a full rollback is needed:

1. **Revert Code Changes**:
   ```bash
   git revert <commit-hash>
   git push origin master
   ```

2. **Rebuild and Deploy**:
   ```bash
   # Follow deployment process above
   ```

### Monitoring Rollback
- **CloudWatch Logs**: Monitor `/var/log/nginx/error.log`
- **ALB Health Checks**: Verify target health
- **Browser Console**: Check for JavaScript errors
- **MCP Connectivity**: Verify MCP server communication

## Health Checks

### Container Health
- **Endpoint**: `/healthcheck`
- **Expected Response**: `Nginx Catalog`
- **Timeout**: 30 seconds
- **Interval**: 30 seconds

### Application Health
- **Frontend**: Check browser console for errors
- **MCP Integration**: Verify tool execution
- **Authentication**: Test JWT token generation

## Security Considerations

### JWT Security
- **Signing Algorithm**: HMAC-SHA256
- **Token Expiration**: 24 hours
- **Compression**: Secure field abbreviation

### Network Security
- **HTTPS Only**: All traffic encrypted
- **CORS**: Configured for MCP server communication
- **Security Headers**: X-Frame-Options DENY

## Troubleshooting

### Common Issues
1. **Container Won't Start**: Check environment variables
2. **MCP Connection Failed**: Verify MCP server availability
3. **JWT Token Errors**: Check signing secret configuration
4. **Bucket Access Denied**: Verify IAM role permissions

### Log Locations
- **Container Logs**: CloudWatch Logs `/aws/ecs/quilt-catalog`
- **Nginx Logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Application Logs**: Browser console

## Next Steps

1. Build and push new container to sales account ECR
2. Update ECS service with new image
3. Monitor deployment and verify MCP integration
4. Document any issues or additional configuration needed




