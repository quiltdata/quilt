# Rollback Strategy for Quilt Catalog MCP Integration

## Overview

This document outlines the comprehensive rollback strategy for the Quilt Catalog container with MCP integration deployed to the sales-prod ECS cluster. The strategy covers immediate rollback procedures, complete rollback options, and monitoring strategies.

## Rollback Scenarios

### 1. Immediate Rollback (Emergency)

**When to use**: Critical issues affecting user access or system stability

**Time to execute**: 2-5 minutes

**Steps**:

1. **Identify Current Task Definition**:
   ```bash
   aws ecs describe-services \
     --cluster sales-prod \
     --services quilt-catalog-service \
     --region us-east-1 \
     --query 'services[0].taskDefinition'
   ```

2. **Get Previous Task Definition**:
   ```bash
   # List all task definition revisions
   aws ecs list-task-definitions \
     --family-prefix quilt-catalog \
     --region us-east-1 \
     --sort DESC
   ```

3. **Rollback to Previous Version**:
   ```bash
   aws ecs update-service \
     --cluster sales-prod \
     --service quilt-catalog-service \
     --task-definition quilt-catalog:<PREVIOUS-REVISION> \
     --force-new-deployment \
     --region us-east-1
   ```

4. **Monitor Rollback**:
   ```bash
   # Watch service status
   aws ecs describe-services \
     --cluster sales-prod \
     --services quilt-catalog-service \
     --region us-east-1 \
     --query 'services[0].deployments'
   ```

### 2. Complete Rollback (Full Revert)

**When to use**: Major issues requiring complete reversion of all changes

**Time to execute**: 10-15 minutes

**Steps**:

1. **Revert Code Changes**:
   ```bash
   # In the git repository
   git revert <commit-hash-of-mcp-integration>
   git push origin master
   ```

2. **Rebuild Container**:
   ```bash
   cd catalog
   npm run build
   docker build -t quilt-catalog-rollback .
   ```

3. **Push Rollback Container**:
   ```bash
   docker tag quilt-catalog-rollback:latest \
     850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:rollback
   docker push 850787717197.dkr.ecr.us-east-1.amazonaws.com/quiltdata/catalog:rollback
   ```

4. **Update ECS Service**:
   ```bash
   aws ecs update-service \
     --cluster sales-prod \
     --service quilt-catalog-service \
     --task-definition quilt-catalog:rollback \
     --force-new-deployment \
     --region us-east-1
   ```

### 3. Partial Rollback (Feature Disable)

**When to use**: MCP integration issues but other features working

**Time to execute**: 5-10 minutes

**Steps**:

1. **Disable MCP Features**:
   - Update environment variables to disable MCP
   - Set `QURATOR=false` or similar flags
   - Redeploy with modified configuration

2. **Update Service Configuration**:
   ```bash
   # Update task definition with disabled MCP
   aws ecs update-service \
     --cluster sales-prod \
     --service quilt-catalog-service \
     --task-definition quilt-catalog:no-mcp \
     --force-new-deployment \
     --region us-east-1
   ```

## Rollback Triggers

### Automatic Rollback Triggers

- **Health Check Failures**: >50% of containers unhealthy for 5+ minutes
- **Error Rate**: >10% error rate for 10+ minutes
- **Response Time**: >5 second average response time for 10+ minutes
- **Memory Usage**: >90% memory usage for 5+ minutes

### Manual Rollback Triggers

- **User Reports**: Multiple user reports of issues
- **Performance Degradation**: Significant performance impact
- **Security Issues**: Any security-related problems
- **Data Loss**: Any risk of data loss or corruption

## Monitoring and Detection

### Real-time Monitoring

1. **CloudWatch Alarms**:
   ```bash
   # Create alarm for high error rate
   aws cloudwatch put-metric-alarm \
     --alarm-name "quilt-catalog-high-error-rate" \
     --alarm-description "High error rate in quilt-catalog service" \
     --metric-name "HTTPCode_Target_5XX_Count" \
     --namespace "AWS/ApplicationELB" \
     --statistic "Sum" \
     --period 300 \
     --threshold 10 \
     --comparison-operator "GreaterThanThreshold" \
     --evaluation-periods 2
   ```

2. **Health Check Monitoring**:
   ```bash
   # Monitor target group health
   aws elbv2 describe-target-health \
     --target-group-arn <TARGET-GROUP-ARN> \
     --region us-east-1
   ```

3. **Container Logs**:
   ```bash
   # Monitor container logs
   aws logs tail /aws/ecs/quilt-catalog \
     --follow \
     --region us-east-1
   ```

### Key Metrics to Watch

- **Response Time**: Should be <2 seconds average
- **Error Rate**: Should be <1% of total requests
- **Memory Usage**: Should be <80% of allocated memory
- **CPU Usage**: Should be <70% of allocated CPU
- **Health Check Success**: Should be >95%

## Rollback Validation

### Immediate Validation (0-5 minutes)

1. **Service Status**: Verify service is running
2. **Health Checks**: Confirm health check endpoint responds
3. **Basic Functionality**: Test basic catalog features
4. **Error Logs**: Check for critical errors

### Short-term Validation (5-30 minutes)

1. **User Access**: Verify users can access the catalog
2. **Authentication**: Test login and role selection
3. **Performance**: Monitor response times
4. **Stability**: Ensure no crashes or restarts

### Long-term Validation (30+ minutes)

1. **Full Feature Testing**: Test all catalog features
2. **Load Testing**: Verify performance under load
3. **User Feedback**: Monitor user reports
4. **System Stability**: Ensure long-term stability

## Rollback Communication

### Internal Communication

1. **Immediate**: Notify team via Slack/email
2. **Status Updates**: Provide regular updates during rollback
3. **Post-Rollback**: Document lessons learned

### External Communication

1. **User Notifications**: If user-facing issues
2. **Status Page**: Update status page if needed
3. **Support Team**: Notify support team of issues

## Prevention Strategies

### Pre-deployment

1. **Staging Testing**: Thorough testing in staging environment
2. **Canary Deployment**: Gradual rollout to subset of users
3. **Feature Flags**: Ability to disable features without rollback
4. **Monitoring Setup**: Comprehensive monitoring before deployment

### Post-deployment

1. **Gradual Rollout**: Deploy to small percentage first
2. **Real-time Monitoring**: Watch metrics closely
3. **User Feedback**: Monitor user reports
4. **Quick Response**: Be ready to rollback quickly

## Recovery Procedures

### After Successful Rollback

1. **Root Cause Analysis**: Identify what went wrong
2. **Fix Issues**: Address the underlying problems
3. **Re-test**: Thoroughly test fixes
4. **Re-deploy**: Deploy fixes when ready

### After Failed Rollback

1. **Emergency Response**: Escalate to senior team members
2. **Alternative Solutions**: Consider alternative approaches
3. **External Help**: Contact AWS support if needed
4. **Communication**: Keep stakeholders informed

## Documentation Updates

### Rollback Log

Maintain a log of all rollbacks:

```markdown
## Rollback Log

### 2025-09-25 - MCP Integration Rollback
- **Trigger**: High error rate (15%)
- **Time**: 14:30 UTC
- **Duration**: 3 minutes
- **Root Cause**: JWT token size exceeded limits
- **Resolution**: Implemented JWT compression
- **Prevention**: Added token size monitoring
```

### Lessons Learned

Document lessons learned from each rollback:

1. **What went wrong**
2. **How it was detected**
3. **How it was fixed**
4. **How to prevent it**

## Emergency Contacts

- **Primary**: Development Team Lead
- **Secondary**: DevOps Engineer
- **Escalation**: CTO/VP Engineering
- **AWS Support**: Premium Support Case

## Rollback Checklist

### Pre-rollback
- [ ] Identify the issue
- [ ] Determine rollback type needed
- [ ] Notify team
- [ ] Prepare rollback commands

### During Rollback
- [ ] Execute rollback commands
- [ ] Monitor service status
- [ ] Verify health checks
- [ ] Test basic functionality

### Post-rollback
- [ ] Validate rollback success
- [ ] Monitor for 30+ minutes
- [ ] Document the incident
- [ ] Plan next steps

## Conclusion

This rollback strategy provides multiple options for different scenarios, from immediate emergency rollbacks to complete system reversion. The key is to be prepared, act quickly, and learn from each incident to improve future deployments.


