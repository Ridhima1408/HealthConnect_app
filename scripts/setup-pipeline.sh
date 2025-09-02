#!/bin/bash

# HealthConnect+ CI/CD Pipeline Setup Script
# This script helps you set up the complete CI/CD pipeline

set -e  # Exit on any error

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

# Check if running on supported OS
check_os() {
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_error "This script is designed for Linux systems. Please use WSL or a Linux VM."
        exit 1
    fi
}

# Check if required commands are available
check_dependencies() {
    print_header "CHECKING DEPENDENCIES"
    
    local required_commands=("git" "docker" "kubectl" "aws" "ansible" "curl")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        else
            print_status "$cmd is installed ✅"
        fi
    done
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        print_error "Missing required commands: ${missing_commands[*]}"
        print_warning "Please install missing dependencies first:"
        echo "Run: sudo apt update && sudo apt install -y git curl"
        echo "Follow the Ubuntu deployment guide for Docker, kubectl, AWS CLI, and Ansible installation"
        exit 1
    fi
    
    print_status "All dependencies are satisfied! ✅"
}

# Initialize environment files
init_environment() {
    print_header "INITIALIZING ENVIRONMENT"
    
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual values!"
    else
        print_status ".env file already exists"
    fi
    
    # Create logs directory
    mkdir -p logs
    mkdir -p public/uploads
    
    print_status "Environment initialized ✅"
}

# Setup Docker
setup_docker() {
    print_header "DOCKER SETUP"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker service."
        exit 1
    fi
    
    print_status "Docker is running ✅"
    
    # Build local image for testing
    print_status "Building HealthConnect+ Docker image..."
    docker build -t healthconnect-app:latest .
    
    print_status "Docker setup completed ✅"
}

# Setup Kubernetes (optional)
setup_kubernetes() {
    print_header "KUBERNETES SETUP (OPTIONAL)"
    
    read -p "Do you want to set up Kubernetes cluster? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Setting up Kubernetes namespace..."
        
        # Apply namespace
        kubectl apply -f k8s/00-namespace.yml
        
        print_status "Kubernetes namespace created ✅"
        print_warning "Remember to configure kubeconfig in Jenkins credentials"
    else
        print_status "Skipping Kubernetes setup"
    fi
}

# Setup Jenkins with Ansible
setup_jenkins() {
    print_header "JENKINS SETUP"
    
    print_status "Jenkins will be set up using Ansible playbook"
    print_warning "Make sure you have:"
    echo "1. An EC2 instance running"
    echo "2. SSH key configured"
    echo "3. Updated ansible/inventory.ini with correct IP and key path"
    
    read -p "Have you configured ansible/inventory.ini? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Running Ansible playbook to set up Jenkins..."
        ansible-playbook -i ansible/inventory.ini ansible/jenkins-setup.yml -v
        print_status "Jenkins setup completed ✅"
    else
        print_warning "Please configure ansible/inventory.ini first, then run:"
        echo "ansible-playbook -i ansible/inventory.ini ansible/jenkins-setup.yml -v"
    fi
}

# Validate pipeline components
validate_pipeline() {
    print_header "PIPELINE VALIDATION"
    
    # Check required files
    local required_files=(
        "Jenkinsfile"
        "docker-compose.yml"
        "Dockerfile"
        "k8s/00-namespace.yml"
        "k8s/01-mongodb.yml"
        "k8s/02-healthconnect-app.yml"
        "k8s/03-services.yml"
        "ansible/jenkins-setup.yml"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_status "$file exists ✅"
        else
            print_error "$file is missing ❌"
        fi
    done
    
    # Test Docker Compose
    print_status "Testing Docker Compose configuration..."
    docker-compose config > /dev/null
    print_status "Docker Compose configuration is valid ✅"
    
    # Validate Kubernetes manifests
    print_status "Validating Kubernetes manifests..."
    for manifest in k8s/*.yml; do
        kubectl apply --dry-run=client -f "$manifest" > /dev/null
        print_status "$(basename "$manifest") is valid ✅"
    done
}

# Setup GitHub integration
setup_github() {
    print_header "GITHUB INTEGRATION"
    
    print_status "Setting up GitHub integration..."
    
    # Check if git is configured
    if [ -z "$(git config --get user.name)" ] || [ -z "$(git config --get user.email)" ]; then
        print_warning "Git is not configured. Please set your name and email:"
        echo "git config --global user.name 'Your Name'"
        echo "git config --global user.email 'your.email@example.com'"
    fi
    
    # Check if remote origin is set
    if git remote get-url origin >/dev/null 2>&1; then
        print_status "Git remote origin is configured ✅"
    else
        print_warning "Git remote origin is not configured. Please add your repository:"
        echo "git remote add origin https://github.com/yourusername/healthconnect.git"
    fi
    
    print_status "Don't forget to:"
    echo "1. Push all pipeline files to your repository"
    echo "2. Configure webhook in GitHub repository settings"
    echo "3. Point Jenkins job to your repository"
}

# Main setup function
main() {
    print_header "HEALTHCONNECT+ CI/CD PIPELINE SETUP"
    echo "This script will help you set up the complete CI/CD pipeline"
    echo ""
    
    check_os
    check_dependencies
    init_environment
    setup_docker
    validate_pipeline
    setup_kubernetes
    setup_jenkins
    setup_github
    
    print_header "SETUP COMPLETED!"
    echo ""
    print_status "🎉 HealthConnect+ CI/CD pipeline setup is complete!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Edit .env file with your actual configuration"
    echo "2. Push all files to your GitHub repository"
    echo "3. Access Jenkins and create a pipeline job"
    echo "4. Configure Jenkins credentials:"
    echo "   - dockerhub-credentials"
    echo "   - aws-access-key-id"
    echo "   - aws-secret-access-key"
    echo "   - kubeconfig (if using Kubernetes)"
    echo "5. Test your first pipeline run!"
    echo ""
    echo "📖 For detailed instructions, refer to UBUNTU_DEPLOYMENT_GUIDE.md"
    echo ""
    print_status "Happy deploying! 🚀"
}

# Run main function
main "$@"
