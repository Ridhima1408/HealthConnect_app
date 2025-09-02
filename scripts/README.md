# HealthConnect+ Deployment Scripts 🏥

This directory contains comprehensive automation scripts for deploying, monitoring, validating, and managing the HealthConnect+ healthcare platform across different environments.

## 🚀 Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Set up the complete CI/CD pipeline
./scripts/setup-pipeline.sh

# Validate your deployment
./scripts/validate-deployment.sh

# Start monitoring your deployment
./scripts/monitor-deployment.sh

# If needed, rollback to a previous version
./scripts/rollback-deployment.sh v1.0.0
```

## 📋 Scripts Overview

### 1. `setup-pipeline.sh` - Pipeline Initialization
**Purpose**: Sets up the complete CI/CD environment including Docker, Jenkins, Kubernetes, and all required dependencies.

**Features**:
- System dependency checks and installation
- Docker and Docker Compose setup
- Kubernetes cluster preparation (kind/minikube)
- Jenkins server configuration via Ansible
- Pipeline validation and GitHub integration guidance
- Environment configuration

**Usage**:
```bash
# Full setup with all components
./scripts/setup-pipeline.sh

# Setup with specific options
./scripts/setup-pipeline.sh --skip-docker --skip-k8s

# Help and options
./scripts/setup-pipeline.sh --help
```

### 2. `validate-deployment.sh` - Deployment Validation
**Purpose**: Comprehensively validates that all components of your deployment are working correctly.

**Features**:
- Docker Compose container health checks
- Kubernetes deployment validation
- MongoDB connection and data integrity tests
- Application endpoint testing
- Network connectivity verification
- Jenkins pipeline status (if configured)
- Security scanning (if Docker scan available)
- Detailed reporting with timestamps

**Usage**:
```bash
# Run full validation
./scripts/validate-deployment.sh

# Validation generates a timestamped report
# Check deployment-validation-YYYYMMDD-HHMMSS.txt for details
```

### 3. `monitor-deployment.sh` - Production Monitoring
**Purpose**: Continuously monitors the health and performance of your HealthConnect+ deployment in real-time.

**Features**:
- Real-time system resource monitoring (CPU, Memory, Disk)
- Docker container health and resource usage tracking
- Kubernetes pod, deployment, and service monitoring
- Application response time and endpoint availability
- MongoDB performance metrics
- Network connectivity monitoring
- Configurable alert thresholds
- Detailed logging with color-coded output
- LoadBalancer status and connectivity testing

**Usage**:
```bash
# Start monitoring with defaults (30s intervals)
./scripts/monitor-deployment.sh

# Custom monitoring settings
./scripts/monitor-deployment.sh --interval 60 --cpu-threshold 85 --mem-threshold 90

# Background monitoring
nohup ./scripts/monitor-deployment.sh --log-file production-monitor.log &

# Options
./scripts/monitor-deployment.sh --help
```

**Alert Thresholds** (customizable):
- CPU Usage: 80%
- Memory Usage: 80%
- Disk Usage: 90%
- Response Time: 5 seconds

### 4. `rollback-deployment.sh` - Deployment Rollback
**Purpose**: Safely rollback to a previous version when issues are detected in production.

**Features**:
- Support for Docker Compose and Kubernetes rollbacks
- Automatic backup creation before rollback
- MongoDB data backup (optional)
- Version verification and validation
- Dry-run mode for testing rollback procedures
- Force rollback option for emergency situations
- Rollback status tracking and reporting
- Support for specific version targeting

**Usage**:
```bash
# List available versions
./scripts/rollback-deployment.sh --list

# Dry run to see what would happen
./scripts/rollback-deployment.sh --dry-run v1.0.0

# Rollback to specific version with database backup
./scripts/rollback-deployment.sh --backup-db v1.0.0

# Rollback only Docker deployment
./scripts/rollback-deployment.sh --type docker v1.0.0

# Emergency rollback (skip verification)
./scripts/rollback-deployment.sh --force v1.0.0

# Check rollback status
./scripts/rollback-deployment.sh --status
```

## 🔧 Environment Configuration

All scripts use the `.env` file for configuration. Key variables:

```bash
# Application Configuration
APP_PORT=3017
NODE_ENV=production

# Database Configuration
MONGO_HOST_PORT=27018
MONGO_DB=healthconnect
MONGO_USERNAME=healthconnect_user
MONGO_PASSWORD=secure_password

# Docker Configuration
DOCKER_HUB_USER=your-dockerhub-username
DOCKER_IMAGE_TAG=latest

# AWS Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-west-2
ECR_REPOSITORY=healthconnect

# Kubernetes Configuration
K8S_NAMESPACE=healthconnect
K8S_CLUSTER_NAME=healthconnect-cluster

# Jenkins Configuration
JENKINS_URL=http://localhost:8080

# Monitoring Configuration
ALERT_EMAIL=admin@healthconnect.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
```

## 🏗️ CI/CD Pipeline Architecture

The scripts support a complete DevOps pipeline:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │───▶│   Jenkins CI    │───▶│   Docker Hub    │
│                 │    │                 │    │   + AWS ECR     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Monitoring &   │◀───│   Production    │◀───│   Kubernetes    │
│   Alerting      │    │   Deployment    │    │   + Docker      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Rollback &    │
                       │   Recovery      │
                       └─────────────────┘
```

## 📊 Monitoring Dashboard

The monitoring script provides real-time insights:

```
🏥 HEALTHCONNECT+ PRODUCTION MONITORING
========================================
[INFO] Monitoring started at 2024-01-15 10:30:00
[INFO] Check interval: 30s
[METRIC] System memory usage: 65%
[METRIC] App Container - CPU: 25%, Memory: 512MB (30%)
[INFO] Application is responding at http://localhost:3017
[METRIC] Application response time: 0.25s
[METRIC] K8s Pods - Total: 3, Running: 3, Failed: 0
[INFO] LoadBalancer healthconnect-service: a1b2c3d4-load-balancer.us-west-2.elb.amazonaws.com
```

## 🔐 Security Best Practices

The scripts implement several security measures:

- **Environment Variables**: Sensitive data in `.env` files
- **Docker Security**: Image vulnerability scanning when available
- **Kubernetes RBAC**: Service accounts with minimal permissions
- **Network Policies**: Controlled traffic between components
- **Backup Encryption**: Secure backup storage
- **Access Logging**: Audit trail for all operations

## 🚨 Troubleshooting Guide

### Common Issues

1. **Docker Compose fails to start**
   ```bash
   # Check logs
   docker-compose logs
   
   # Recreate containers
   docker-compose down -v
   docker-compose up -d
   ```

2. **Kubernetes pods not starting**
   ```bash
   # Check pod status
   kubectl describe pods -n healthconnect
   
   # Check events
   kubectl get events -n healthconnect --sort-by='.lastTimestamp'
   ```

3. **MongoDB connection issues**
   ```bash
   # Test MongoDB connectivity
   docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
   
   # Check MongoDB logs
   docker-compose logs mongo
   ```

4. **Application not responding**
   ```bash
   # Check application logs
   docker-compose logs app
   
   # Verify port binding
   netstat -tlnp | grep 3017
   ```

### Script Debugging

Enable debug mode for any script:
```bash
# Run with debug output
bash -x scripts/validate-deployment.sh

# Check script permissions
ls -la scripts/
chmod +x scripts/*.sh
```

## 📈 Performance Optimization

### Resource Allocation Recommendations

**Development Environment**:
- CPU: 2-4 cores
- Memory: 4-8 GB
- Disk: 20 GB

**Production Environment**:
- CPU: 4-8 cores
- Memory: 8-16 GB
- Disk: 100+ GB (depending on data volume)

### Scaling Strategies

1. **Horizontal Scaling** (Kubernetes):
   ```bash
   kubectl scale deployment healthconnect-app --replicas=3 -n healthconnect
   ```

2. **Database Scaling**:
   - MongoDB replica sets
   - Read replicas for better performance

3. **Load Balancing**:
   - AWS Application Load Balancer
   - NGINX ingress controller

## 🔄 Maintenance Schedule

**Daily**: 
- Monitor deployment health via `monitor-deployment.sh`
- Review application logs

**Weekly**: 
- Run full validation via `validate-deployment.sh`
- Update dependencies and security patches

**Monthly**: 
- Performance optimization review
- Backup strategy validation
- Disaster recovery testing

## 📞 Support and Contributing

For issues, improvements, or questions:

1. **Check the logs**: All scripts generate detailed logs
2. **Validation first**: Run `validate-deployment.sh` to identify issues
3. **Monitor actively**: Use `monitor-deployment.sh` for real-time insights
4. **Safe rollbacks**: Use `rollback-deployment.sh` for quick recovery

## 🏷️ Version Compatibility

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Kubernetes**: 1.20+
- **Node.js**: 14+
- **MongoDB**: 5.0+
- **Jenkins**: 2.400+

---

**Made with ❤️ for HealthConnect+ - Improving Healthcare Through Technology**
