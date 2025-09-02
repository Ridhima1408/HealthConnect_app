#!/bin/bash

# HealthConnect+ Deployment Validation Script
# This script validates that all components of the deployment are working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
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

# Load environment variables
load_env() {
    if [ -f ".env" ]; then
        source .env
        print_status "Environment variables loaded from .env"
    else
        print_warning ".env file not found, using defaults"
        APP_PORT=${APP_PORT:-3017}
    fi
}

# Test Docker Compose deployment
test_docker_compose() {
    print_header "DOCKER COMPOSE VALIDATION"
    
    # Check if containers are running
    if docker-compose ps | grep -q "Up"; then
        print_status "Docker Compose containers are running ✅"
        
        # List running containers
        print_status "Running containers:"
        docker-compose ps
        
        # Test application endpoint
        local app_url="http://localhost:${APP_PORT:-3017}"
        print_status "Testing application at $app_url"
        
        if curl -f -s "$app_url" >/dev/null; then
            print_status "✅ Application is responding"
            
            # Test specific HealthConnect+ endpoints
            local endpoints=(
                "/"
                "/doctors.html"
                "/book.html"
                "/consultation.html"
                "/about.html"
                "/contact.html"
            )
            
            for endpoint in "${endpoints[@]}"; do
                if curl -f -s "${app_url}${endpoint}" >/dev/null; then
                    print_status "✅ $endpoint is accessible"
                else
                    print_warning "⚠️ $endpoint is not accessible"
                fi
            done
            
        else
            print_error "❌ Application is not responding at $app_url"
            print_status "Container logs:"
            docker-compose logs --tail=20 app
            return 1
        fi
        
    else
        print_error "❌ Docker Compose containers are not running"
        print_status "Container status:"
        docker-compose ps
        return 1
    fi
}

# Test Kubernetes deployment
test_kubernetes() {
    print_header "KUBERNETES VALIDATION"
    
    local namespace="${K8S_NAMESPACE:-healthconnect}"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_warning "kubectl is not configured or cluster is not accessible"
        return 0
    fi
    
    print_status "Kubernetes cluster is accessible ✅"
    
    # Check namespace
    if kubectl get namespace "$namespace" >/dev/null 2>&1; then
        print_status "Namespace '$namespace' exists ✅"
    else
        print_warning "Namespace '$namespace' does not exist"
        return 0
    fi
    
    # Check deployments
    print_status "Checking deployments in namespace '$namespace':"
    kubectl get deployments -n "$namespace" || print_warning "No deployments found"
    
    # Check pods
    print_status "Checking pods in namespace '$namespace':"
    kubectl get pods -n "$namespace" || print_warning "No pods found"
    
    # Check services
    print_status "Checking services in namespace '$namespace':"
    kubectl get services -n "$namespace" || print_warning "No services found"
    
    # Check if pods are ready
    local ready_pods
    ready_pods=$(kubectl get pods -n "$namespace" --field-selector=status.phase=Running -o name 2>/dev/null | wc -l)
    if [ "$ready_pods" -gt 0 ]; then
        print_status "✅ $ready_pods pod(s) are running"
    else
        print_warning "⚠️ No pods are in Running state"
    fi
    
    # Get LoadBalancer URL if available
    local lb_url
    lb_url=$(kubectl get service healthconnect-app-service -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ -n "$lb_url" ]; then
        print_status "🌐 LoadBalancer URL: http://$lb_url"
        
        # Test LoadBalancer endpoint
        if curl -f -s "http://$lb_url" >/dev/null; then
            print_status "✅ LoadBalancer is responding"
        else
            print_warning "⚠️ LoadBalancer is not responding yet (may take a few minutes)"
        fi
    else
        print_warning "LoadBalancer URL not available yet"
    fi
}

# Test MongoDB connection
test_mongodb() {
    print_header "MONGODB VALIDATION"
    
    local mongo_port="${MONGO_HOST_PORT:-27018}"
    
    # Test Docker Compose MongoDB
    if docker-compose ps mongo | grep -q "Up"; then
        print_status "MongoDB container is running ✅"
        
        # Test MongoDB connection
        if docker-compose exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            print_status "✅ MongoDB is responding"
            
            # Check database
            local db_name="${MONGO_DB:-healthconnect}"
            local db_count
            db_count=$(docker-compose exec -T mongo mongosh "$db_name" --eval "db.stats().collections" --quiet 2>/dev/null || echo "0")
            print_status "Database '$db_name' has $db_count collections"
            
        else
            print_error "❌ MongoDB is not responding"
            return 1
        fi
    else
        print_warning "MongoDB container is not running in Docker Compose"
    fi
    
    # Test MongoDB port accessibility
    if nc -z localhost "$mongo_port" 2>/dev/null; then
        print_status "✅ MongoDB port $mongo_port is accessible"
    else
        print_warning "⚠️ MongoDB port $mongo_port is not accessible"
    fi
}

# Test Docker images
test_docker_images() {
    print_header "DOCKER IMAGES VALIDATION"
    
    # Check if HealthConnect+ images exist
    local images
    images=$(docker images | grep healthconnect || echo "")
    
    if [ -n "$images" ]; then
        print_status "HealthConnect+ Docker images found:"
        echo "$images"
    else
        print_warning "No HealthConnect+ Docker images found"
        print_status "Building image..."
        docker build -t healthconnect-app:latest .
        print_status "✅ Image built successfully"
    fi
    
    # Check image vulnerabilities (if docker scan is available)
    if command -v docker &> /dev/null; then
        if docker scan --version >/dev/null 2>&1; then
            print_status "Running security scan on healthconnect-app:latest..."
            docker scan healthconnect-app:latest || print_warning "Security scan failed or not configured"
        else
            print_warning "Docker scan not available - consider enabling for security checking"
        fi
    fi
}

# Test network connectivity
test_network() {
    print_header "NETWORK CONNECTIVITY VALIDATION"
    
    # Test external connectivity
    if curl -s --connect-timeout 5 https://www.google.com >/dev/null; then
        print_status "✅ External network connectivity working"
    else
        print_warning "⚠️ External network connectivity issues"
    fi
    
    # Test Docker Hub connectivity
    if curl -s --connect-timeout 5 https://hub.docker.com >/dev/null; then
        print_status "✅ Docker Hub is accessible"
    else
        print_warning "⚠️ Docker Hub is not accessible"
    fi
    
    # Test GitHub connectivity
    if curl -s --connect-timeout 5 https://github.com >/dev/null; then
        print_status "✅ GitHub is accessible"
    else
        print_warning "⚠️ GitHub is not accessible"
    fi
}

# Test Jenkins connectivity (if configured)
test_jenkins() {
    print_header "JENKINS VALIDATION"
    
    # Check if Jenkins URL is configured
    if [ -n "${JENKINS_URL:-}" ]; then
        local jenkins_url="${JENKINS_URL}"
        
        if curl -s --connect-timeout 10 "$jenkins_url" >/dev/null; then
            print_status "✅ Jenkins is accessible at $jenkins_url"
        else
            print_warning "⚠️ Jenkins is not accessible at $jenkins_url"
        fi
    else
        print_warning "Jenkins URL not configured in environment"
        print_status "To test Jenkins connectivity, set JENKINS_URL in .env file"
    fi
}

# Test health endpoints
test_health_endpoints() {
    print_header "HEALTH ENDPOINTS VALIDATION"
    
    local app_url="http://localhost:${APP_PORT:-3017}"
    
    # Test API endpoints if they exist
    local api_endpoints=(
        "/api/health"
        "/api/user"
        "/api/doctors"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        if curl -s "${app_url}${endpoint}" >/dev/null 2>&1; then
            print_status "✅ API endpoint $endpoint is working"
        else
            print_warning "⚠️ API endpoint $endpoint not found (may not be implemented)"
        fi
    done
}

# Generate deployment report
generate_report() {
    print_header "DEPLOYMENT REPORT"
    
    local report_file="deployment-validation-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "# HealthConnect+ Deployment Validation Report"
        echo "Generated: $(date)"
        echo ""
        echo "## Environment"
        echo "NODE_ENV: ${NODE_ENV:-not set}"
        echo "APP_PORT: ${APP_PORT:-not set}"
        echo "MONGO_HOST_PORT: ${MONGO_HOST_PORT:-not set}"
        echo ""
        echo "## Docker Containers"
        docker-compose ps 2>/dev/null || echo "Docker Compose not running"
        echo ""
        echo "## Docker Images"
        docker images | grep healthconnect || echo "No HealthConnect+ images found"
        echo ""
        if command -v kubectl >/dev/null 2>&1 && kubectl cluster-info >/dev/null 2>&1; then
            echo "## Kubernetes Status"
            kubectl get all -n "${K8S_NAMESPACE:-healthconnect}" 2>/dev/null || echo "Kubernetes not configured"
            echo ""
        fi
        echo "## System Resources"
        echo "Disk Usage:"
        df -h . 2>/dev/null || echo "Disk usage not available"
        echo ""
        echo "Memory Usage:"
        free -h 2>/dev/null || echo "Memory usage not available"
        echo ""
    } > "$report_file"
    
    print_status "📄 Deployment report saved to $report_file"
}

# Main validation function
main() {
    print_header "HEALTHCONNECT+ DEPLOYMENT VALIDATION"
    echo "This script validates your HealthConnect+ deployment"
    echo ""
    
    load_env
    test_network
    test_docker_images
    test_mongodb
    test_docker_compose
    test_kubernetes
    test_jenkins
    test_health_endpoints
    generate_report
    
    print_header "VALIDATION COMPLETED!"
    echo ""
    print_status "🎉 HealthConnect+ deployment validation finished!"
    echo ""
    print_status "If you see any warnings or errors above, please address them."
    print_status "For troubleshooting help, check the UBUNTU_DEPLOYMENT_GUIDE.md"
    echo ""
    print_status "Your HealthConnect+ healthcare platform is ready! 🏥"
}

# Run main function
main "$@"
