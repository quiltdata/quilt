# Sales Production Deployment Instructions

## Overview

This document provides step-by-step instructions for deploying the Quilt Catalog container with MCP integration to the sales-prod ECS cluster in account 850787717197.

## Prerequisites

- AWS CLI configured with appropriate permissions for account 850787717197
- Access to the sales-prod ECS cluster
- ECR repository access (already created: `quiltdata/catalog`)

## Container Information

- **Repository**: `850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog`
- **Tag**: `mcp-integration`
- **Digest**: `sha256:cdce04aacdbd3fb72b0d96f27ba7f871789d6ce7a759874009072450623866a3`
- **Size**: 856 bytes (compressed)

## Deployment Steps

### Step 1: Verify Current ECS Service

First, check the current ECS service configuration:

```bash
aws ecs describe-services \
  --cluster sales-prod \
  --services quilt-catalog-service \
  --region us-east-1
```

### Step 2: Update Task Definition

Create a new task definition with the updated container image:

```bash
# Get the current task definition
aws ecs describe-task-definition \
  --task-definition quilt-catalog \
  --region us-east-1 > current-task-definition.json

# Edit the task definition to update the image URI
# Change the "image" field to:
# "image": "850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:mcp-integration"

# Register the new task definition
aws ecs register-task-definition \
  --cli-input-json file://current-task-definition.json \
  --region us-east-1
```

### Step 3: Update ECS Service

Update the ECS service to use the new task definition:

```bash
aws ecs update-service \
  --cluster sales-prod \
  --service quilt-catalog-service \
  --task-definition quilt-catalog \
  --force-new-deployment \
  --region us-east-1
```

### Step 4: Monitor Deployment

Monitor the deployment progress:

```bash
# Check service status
aws ecs describe-services \
  --cluster sales-prod \
  --services quilt-catalog-service \
  --region us-east-1

# Check running tasks
aws ecs list-tasks \
  --cluster sales-prod \
  --service-name quilt-catalog-service \
  --region us-east-1

# Get task details
aws ecs describe-tasks \
  --cluster sales-prod \
  --tasks <TASK-ARN> \
  --region us-east-1
```

### Step 5: Verify Health Checks

Check that the new containers are healthy:

```bash
# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET-GROUP-ARN> \
  --region us-east-1

# Test the health check endpoint
curl -f http://<ALB-DNS-NAME>/healthcheck
```

## Configuration

The container uses the same configuration as the previous version. No additional environment variables are required for MCP integration.

### Environment Variables (Current)

```bash
REGION=us-east-1
API_GATEWAY=https://api.quiltdata.com
ALWAYS_REQUIRE_AUTH=true
NO_DOWNLOAD=false
S3_PROXY_URL=https://s3-proxy.quiltdata.com
INTERCOM_APP_ID=<your_intercom_id>
REGISTRY_URL=https://registry.quiltdata.com
PASSWORD_AUTH=true
SSO_AUTH=true
SSO_PROVIDERS=google,okta
SENTRY_DSN=<your_sentry_dsn>
MIXPANEL_TOKEN=<your_mixpanel_token>
ANALYTICS_BUCKET=quilt-analytics
SERVICE_BUCKET=quilt-service
CATALOG_MODE=production
CHUNKED_CHECKSUMS=true
QURATOR=true
STACK_VERSION=latest
PACKAGE_ROOT=s3://your-bucket
```

## MCP Integration Features

The new container includes:

1. **Dynamic Authentication Manager**: Enhanced JWT-based authentication
2. **AWS Bucket Discovery**: Dynamic S3 bucket detection from IAM policies
3. **MCP Client**: Tool execution framework for AI assistants
4. **JWT Compression**: 90.3% size reduction for large token payloads
5. **Enhanced Security**: Role-based access control with live permission updates

## Verification Steps

### 1. Container Health
- Check that containers are running and healthy
- Verify health check endpoint returns "Nginx Catalog"
- Monitor CloudWatch logs for any errors

### 2. MCP Integration
- Open browser developer tools
- Check for MCP-related console logs
- Verify JWT token generation and compression
- Test MCP tool execution (if available)

### 3. Authentication
- Test user login and role selection
- Verify JWT token contains correct permissions
- Check bucket access permissions

### 4. Performance
- Monitor container resource usage
- Check response times
- Verify no memory leaks or performance degradation

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   - Check environment variables
   - Verify ECR permissions
   - Check CloudWatch logs

2. **MCP Connection Failed**
   - Verify MCP server is running
   - Check network connectivity
   - Review CORS configuration

3. **Authentication Issues**
   - Check JWT token generation
   - Verify role permissions
   - Review IAM policies

4. **Performance Issues**
   - Monitor resource usage
   - Check for memory leaks
   - Review application logs

### Log Locations

- **Container Logs**: CloudWatch Logs `/aws/ecs/quilt-catalog`
- **Nginx Logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **Application Logs**: Browser console

## Rollback Procedure

If issues occur, rollback to the previous version:

```bash
# Get the previous task definition
aws ecs describe-task-definition \
  --task-definition quilt-catalog:<PREVIOUS-REVISION> \
  --region us-east-1

# Update service to use previous task definition
aws ecs update-service \
  --cluster sales-prod \
  --service quilt-catalog-service \
  --task-definition quilt-catalog:<PREVIOUS-REVISION> \
  --force-new-deployment \
  --region us-east-1
```

## Post-Deployment

After successful deployment:

1. **Monitor**: Watch for any issues for 24-48 hours
2. **Document**: Record any configuration changes or issues
3. **Update**: Notify team of successful deployment
4. **Cleanup**: Remove old task definitions if desired

## Support

For issues or questions:
- Check CloudWatch logs first
- Review this documentation
- Contact the development team
- Create a support ticket if needed


