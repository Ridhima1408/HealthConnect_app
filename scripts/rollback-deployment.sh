#!/bin/bash

# HealthConnect+ Deployment Rollback Script
# This script handles rolling back to a previous version in case of issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🏥 $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Default values
TARGET_VERSION=""
DEPLOYMENT_TYPE=""
BACKUP_DB=false
FORCE_ROLLBACK=false
DRY_RUN=false

# Load environment variables
load_env() {
    if [ -f ".env" ]; then
        source .env
        print_info "Environment variables loaded from .env"
    else
        print_warning ".env file not found, using defaults"
        APP_PORT=${APP_PORT:-3017}
    fi
}

# Show available versions
show_available_versions() {
    print_header "AVAILABLE VERSIONS"
    
    # Docker images
    print_info "Available Docker images:"
    local images
    images=$(docker images | grep healthconnect | head -10)
    if [ -n "$images" ]; then
        echo "$images" | while read -r line; do
            echo "  $line"
        done
    else
        print_warning "No HealthConnect+ Docker images found locally"
    fi
    
    # Git tags
    if [ -d ".git" ]; then
        print_info "Available Git tags (last 10):"
        if git tag --sort=-version:refname | head -10 | while read -r tag; do
            if [ -n "$tag" ]; then
                local commit_hash
                local commit_date
                commit_hash=$(git rev-parse --short "$tag")
                commit_date=$(git log -1 --format="%cd" --date=short "$tag" 2>/dev/null || echo "unknown")
                echo "  $tag ($commit_hash) - $commit_date"
            fi
        done; then
            true
        else
            print_warning "No Git tags found"
        fi
    fi
}

# Create backup before rollback
create_backup() {
    print_header "CREATING BACKUP"
    
    local backup_dir="backups/rollback-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_info "Creating backup in $backup_dir"
    
    # Backup current deployment configuration
    if [ -f "docker-compose.yml" ]; then
        cp docker-compose.yml "$backup_dir/docker-compose.yml"
        print_info "✅ Docker Compose configuration backed up"
    fi
    
    # Backup environment file
    if [ -f ".env" ]; then
        cp .env "$backup_dir/.env"
        print_info "✅ Environment configuration backed up"
    fi
    
    # Backup Kubernetes manifests
    if [ -d "k8s" ]; then
        cp -r k8s "$backup_dir/"
        print_info "✅ Kubernetes manifests backed up"
    fi
    
    # Backup MongoDB data if requested
    if [ "$BACKUP_DB" = true ]; then
        print_info "Creating MongoDB backup..."
        
        if docker-compose ps mongo | grep -q "Up"; then
            local db_name="${MONGO_DB:-healthconnect}"
            local backup_file="$backup_dir/mongodb-backup-$(date +%Y%m%d-%H%M%S).archive"
            
            if docker-compose exec -T mongo mongodump --db "$db_name" --archive > "$backup_file"; then
                print_info "✅ MongoDB backup created: $backup_file"
            else
                print_error "❌ Failed to create MongoDB backup"
                if [ "$FORCE_ROLLBACK" = false ]; then
                    exit 1
                fi
            fi
        else
            print_warning "MongoDB container not running, skipping database backup"
        fi
    fi
    
    # Get current version information
    {
        echo "# Rollback Information"
        echo "Rollback Date: $(date)"
        echo "Target Version: ${TARGET_VERSION}"
        echo "Deployment Type: ${DEPLOYMENT_TYPE}"
        echo ""
        echo "# Current System State"
        echo "## Docker Images"
        docker images | grep healthconnect || echo "No HealthConnect+ images found"
        echo ""
        echo "## Running Containers"
        docker-compose ps 2>/dev/null || echo "Docker Compose not running"
        echo ""
        if command -v kubectl >/dev/null 2>&1 && kubectl cluster-info >/dev/null 2>&1; then
            echo "## Kubernetes Status"
            kubectl get deployments -n "${K8S_NAMESPACE:-healthconnect}" 2>/dev/null || echo "Kubernetes not configured"
        fi
    } > "$backup_dir/rollback-info.txt"
    
    print_info "✅ Backup completed: $backup_dir"
    echo "BACKUP_DIR=$backup_dir" > .rollback_info
}

# Rollback Docker Compose deployment
rollback_docker_compose() {
    print_header "ROLLING BACK DOCKER COMPOSE DEPLOYMENT"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "🔍 DRY RUN: Would rollback Docker Compose to version $TARGET_VERSION"
        return 0
    fi
    
    # Check if target version exists
    if ! docker images | grep -q "healthconnect.*$TARGET_VERSION"; then
        print_error "Docker image healthconnect:$TARGET_VERSION not found locally"
        print_info "Available images:"
        docker images | grep healthconnect
        
        # Try to pull the image
        print_info "Attempting to pull healthconnect:$TARGET_VERSION from Docker Hub..."
        if docker pull "${DOCKER_HUB_USER:-healthconnect}/healthconnect:$TARGET_VERSION" 2>/dev/null; then
            print_info "✅ Successfully pulled image from Docker Hub"
        else
            print_error "❌ Failed to pull image from Docker Hub"
            if [ "$FORCE_ROLLBACK" = false ]; then
                exit 1
            fi
        fi
    fi
    
    print_info "Stopping current containers..."
    docker-compose down
    
    # Update docker-compose.yml with target version
    if [ -f "docker-compose.yml" ]; then
        # Create temporary docker-compose file with target version
        sed "s|healthconnect:latest|healthconnect:$TARGET_VERSION|g" docker-compose.yml > docker-compose.rollback.yml
        
        print_info "Starting containers with version $TARGET_VERSION..."
        docker-compose -f docker-compose.rollback.yml up -d
        
        # Wait for services to be ready
        print_info "Waiting for services to be ready..."
        sleep 10
        
        # Verify deployment
        if verify_deployment; then
            print_info "✅ Docker Compose rollback successful"
            mv docker-compose.rollback.yml docker-compose.yml
        else
            print_error "❌ Rollback verification failed"
            docker-compose -f docker-compose.rollback.yml down
            rm docker-compose.rollback.yml
            docker-compose up -d  # Restore previous version
            exit 1
        fi
    else
        print_error "docker-compose.yml not found"
        exit 1
    fi
}

# Rollback Kubernetes deployment
rollback_kubernetes() {
    print_header "ROLLING BACK KUBERNETES DEPLOYMENT"
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_warning "kubectl is not configured or cluster is not accessible"
        return 0
    fi
    
    local namespace="${K8S_NAMESPACE:-healthconnect}"
    
    if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
        print_warning "Namespace $namespace does not exist"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_info "🔍 DRY RUN: Would rollback Kubernetes deployment to version $TARGET_VERSION"
        kubectl get deployments -n "$namespace"
        return 0
    fi
    
    # Check if we should rollback to a specific revision
    local deployments
    deployments=$(kubectl get deployments -n "$namespace" --no-headers | awk '{print $1}')
    
    if [ -n "$deployments" ]; then
        echo "$deployments" | while read -r deployment; do
            print_info "Rolling back deployment: $deployment"
            
            # Get rollout history
            print_info "Rollout history for $deployment:"
            kubectl rollout history deployment/"$deployment" -n "$namespace"
            
            if [ -n "$TARGET_VERSION" ]; then
                # Update image to target version
                kubectl set image deployment/"$deployment" app="healthconnect:$TARGET_VERSION" -n "$namespace"
                print_info "Updated $deployment to use image healthconnect:$TARGET_VERSION"
            else
                # Rollback to previous revision
                kubectl rollout undo deployment/"$deployment" -n "$namespace"
                print_info "Rolled back $deployment to previous revision"
            fi
            
            # Wait for rollout to complete
            print_info "Waiting for rollout to complete..."
            if kubectl rollout status deployment/"$deployment" -n "$namespace" --timeout=300s; then
                print_info "✅ Rollback completed for $deployment"
            else
                print_error "❌ Rollback failed for $deployment"
                if [ "$FORCE_ROLLBACK" = false ]; then
                    exit 1
                fi
            fi
        done
        
        # Verify deployment after rollback
        if verify_kubernetes_deployment; then
            print_info "✅ Kubernetes rollback successful"
        else
            print_error "❌ Kubernetes rollback verification failed"
            if [ "$FORCE_ROLLBACK" = false ]; then
                exit 1
            fi
        fi
    else
        print_warning "No deployments found in namespace $namespace"
    fi
}

# Verify deployment health
verify_deployment() {
    print_info "Verifying deployment health..."
    
    local app_url="http://localhost:${APP_PORT:-3017}"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s --connect-timeout 5 "$app_url" >/dev/null; then
            print_info "✅ Application is responding at $app_url"
            
            # Test critical endpoints
            local endpoints=("/doctors.html" "/book.html")
            local all_endpoints_ok=true
            
            for endpoint in "${endpoints[@]}"; do
                if ! curl -f -s --connect-timeout 5 "${app_url}${endpoint}" >/dev/null; then
                    print_warning "⚠️ Endpoint $endpoint is not accessible"
                    all_endpoints_ok=false
                fi
            done
            
            if [ "$all_endpoints_ok" = true ]; then
                print_info "✅ All critical endpoints are accessible"
                return 0
            fi
        fi
        
        print_info "Waiting for application to be ready... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    print_error "❌ Application health check failed after $max_attempts attempts"
    return 1
}

# Verify Kubernetes deployment
verify_kubernetes_deployment() {
    local namespace="${K8S_NAMESPACE:-healthconnect}"
    
    # Check if all pods are running
    local pods_ready
    pods_ready=$(kubectl get pods -n "$namespace" --field-selector=status.phase=Running -o name 2>/dev/null | wc -l)
    
    if [ "$pods_ready" -gt 0 ]; then
        print_info "✅ $pods_ready pod(s) are running"
        
        # Test LoadBalancer if available
        local lb_url
        lb_url=$(kubectl get service healthconnect-app-service -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        
        if [ -n "$lb_url" ]; then
            print_info "Testing LoadBalancer at $lb_url..."
            if curl -f -s --connect-timeout 10 "http://$lb_url" >/dev/null; then
                print_info "✅ LoadBalancer is responding"
                return 0
            else
                print_warning "⚠️ LoadBalancer is not responding yet"
            fi
        fi
        
        return 0
    else
        print_error "❌ No pods are running"
        return 1
    fi
}

# Show rollback status
show_status() {
    print_header "ROLLBACK STATUS"
    
    # Current version info
    if [ -f ".rollback_info" ]; then
        source .rollback_info
        if [ -n "${BACKUP_DIR:-}" ] && [ -d "$BACKUP_DIR" ]; then
            print_info "📁 Backup available at: $BACKUP_DIR"
        fi
    fi
    
    # Docker status
    print_info "Current Docker Compose status:"
    docker-compose ps 2>/dev/null || echo "  Docker Compose not running"
    
    # Kubernetes status
    if kubectl cluster-info >/dev/null 2>&1; then
        local namespace="${K8S_NAMESPACE:-healthconnect}"
        print_info "Current Kubernetes status (namespace: $namespace):"
        kubectl get pods -n "$namespace" 2>/dev/null || echo "  No pods found"
    fi
    
    # Application health
    local app_url="http://localhost:${APP_PORT:-3017}"
    if curl -f -s --connect-timeout 5 "$app_url" >/dev/null; then
        print_info "✅ Application is healthy at $app_url"
    else
        print_error "❌ Application is not responding at $app_url"
    fi
}

# Show help
show_help() {
    echo "HealthConnect+ Deployment Rollback Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [VERSION]"
    echo ""
    echo "OPTIONS:"
    echo "  -t, --type TYPE          Deployment type (docker|kubernetes|both) [default: both]"
    echo "  -b, --backup-db          Create MongoDB backup before rollback"
    echo "  -f, --force              Force rollback even if verification fails"
    echo "  -n, --dry-run            Show what would be done without executing"
    echo "  -s, --status             Show current rollback status"
    echo "  -l, --list               List available versions"
    echo "  -h, --help               Show this help"
    echo ""
    echo "VERSION:"
    echo "  Specify target version to rollback to (e.g., v1.0.0, latest, previous)"
    echo "  If not specified, will rollback to previous version"
    echo ""
    echo "Examples:"
    echo "  $0 v1.0.0                # Rollback to version v1.0.0"
    echo "  $0 --type docker v1.0.0  # Rollback only Docker deployment"
    echo "  $0 --dry-run v1.0.0      # Show what would be done"
    echo "  $0 --backup-db v1.0.0    # Rollback with MongoDB backup"
    echo "  $0 --status              # Show current status"
    echo "  $0 --list                # List available versions"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -b|--backup-db)
            BACKUP_DB=true
            shift
            ;;
        -f|--force)
            FORCE_ROLLBACK=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--status)
            load_env
            show_status
            exit 0
            ;;
        -l|--list)
            show_available_versions
            exit 0
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            TARGET_VERSION="$1"
            shift
            ;;
    esac
done

# Validate deployment type
case "${DEPLOYMENT_TYPE}" in
    ""|docker|kubernetes|both)
        # Valid types
        ;;
    *)
        print_error "Invalid deployment type: $DEPLOYMENT_TYPE"
        print_error "Valid types: docker, kubernetes, both"
        exit 1
        ;;
esac

# Main rollback process
main() {
    print_header "HEALTHCONNECT+ DEPLOYMENT ROLLBACK"
    
    load_env
    
    # Default values
    DEPLOYMENT_TYPE=${DEPLOYMENT_TYPE:-both}
    
    if [ -z "$TARGET_VERSION" ]; then
        print_error "No target version specified"
        print_info "Available versions:"
        show_available_versions
        echo ""
        print_info "Usage: $0 [OPTIONS] VERSION"
        exit 1
    fi
    
    print_info "🎯 Target version: $TARGET_VERSION"
    print_info "📦 Deployment type: $DEPLOYMENT_TYPE"
    print_info "💾 Backup database: $BACKUP_DB"
    print_info "🔍 Dry run: $DRY_RUN"
    echo ""
    
    if [ "$DRY_RUN" = false ]; then
        read -p "Are you sure you want to rollback to version $TARGET_VERSION? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Rollback cancelled"
            exit 0
        fi
        
        # Create backup
        create_backup
    fi
    
    # Perform rollback based on type
    case "$DEPLOYMENT_TYPE" in
        docker)
            rollback_docker_compose
            ;;
        kubernetes)
            rollback_kubernetes
            ;;
        both)
            rollback_docker_compose
            rollback_kubernetes
            ;;
    esac
    
    if [ "$DRY_RUN" = false ]; then
        print_header "ROLLBACK COMPLETED"
        print_info "🎉 Rollback to version $TARGET_VERSION completed successfully!"
        echo ""
        print_info "Next steps:"
        print_info "1. Verify application functionality"
        print_info "2. Check monitoring and logs"
        print_info "3. Update deployment documentation"
        print_info "4. Investigate cause of original issue"
        echo ""
        show_status
    else
        print_header "DRY RUN COMPLETED"
        print_info "🔍 Dry run completed - no changes were made"
    fi
}

# Run main function
main "$@"
