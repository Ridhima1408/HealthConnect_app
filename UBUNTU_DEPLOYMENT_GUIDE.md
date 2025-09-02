# HealthConnect+ Ubuntu Server Setup Commands - Step by Step Guide

## 🏥 HealthConnect+ Healthcare Platform Deployment

### Project Overview
HealthConnect+ is a comprehensive digital healthcare platform offering appointment booking, online consultations, medical records management, and AI-powered health assistance.

## 🚀 Prerequisites Setup on Ubuntu Server

### Step 1: Update System and Install Dependencies
```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget gnupg lsb-release software-properties-common

# Install Git (if not already installed)
sudo apt install -y git

# Install build essentials
sudo apt install -y build-essential
```

### Step 2: Install Docker and Docker Compose
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package lists and install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to docker group (replace 'ubuntu' with your username if different)
sudo usermod -aG docker ubuntu

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify Docker installation
docker --version
docker compose version

# Test Docker installation
sudo docker run hello-world
```

### Step 3: Install Node.js (Required for HealthConnect+)
```bash
# Install Node.js 20 (LTS) - Required for HealthConnect+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for production management (optional)
sudo npm install -g pm2
```

### Step 4: Install AWS CLI
```bash
# Download and install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
sudo apt install -y unzip
unzip awscliv2.zip
sudo ./aws/install

# Clean up
rm -rf aws awscliv2.zip

# Verify installation
aws --version

# Configure AWS credentials (replace with your actual credentials)
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY  
# Default region name: us-east-1 (or your preferred region)
# Default output format: json
```

### Step 5: Install kubectl
```bash
# Download kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Install kubectl
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify installation
kubectl version --client

# Clean up
rm kubectl
```

### Step 6: Clone HealthConnect+ Repository
```bash
# Clone your HealthConnect+ repository
git clone https://github.com/YOUR_USERNAME/healthconnect.git
cd healthconnect

# Verify files are present
ls -la

# Check if all required files exist
ls -la public/
ls -la server.js package.json docker-compose.yml Dockerfile
```

## 🐳 Docker Build and Test Commands

### Step 7: Prepare Environment
```bash
# Create necessary directories for HealthConnect+
mkdir -p public/uploads
mkdir -p data/mongo
mkdir -p logs

# Set proper permissions
chmod -R 755 public/
chmod -R 755 data/
```

### Step 8: Build Docker Image
```bash
# Build the HealthConnect+ Docker image
sudo docker build -t healthconnect-app:latest .

# List images to verify
sudo docker images | grep healthconnect

# Tag for different environments
sudo docker tag healthconnect-app:latest healthconnect-app:v1.0
sudo docker tag healthconnect-app:latest healthconnect-app:production
```

### Step 9: Test Docker Container
```bash
# Run single container for testing
sudo docker run -d \
  --name test-healthconnect \
  -p 3017:3000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/healthconnect \
  healthconnect-app:latest

# Check container status
sudo docker ps

# View container logs
sudo docker logs test-healthconnect

# Test HealthConnect+ application endpoints
curl http://localhost:3017
curl http://localhost:3017/api/health
curl -I http://localhost:3017/index.html

# Stop and remove test container
sudo docker stop test-healthconnect
sudo docker rm test-healthconnect
```

## 🐙 Docker Compose Deployment

### Step 10: Deploy HealthConnect+ with Docker Compose
```bash
# Ensure docker-compose.yml exists
cat docker-compose.yml

# Create environment file (optional)
cat > .env << EOF
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo:27017/healthconnect
MONGODB_PORT=27017
APP_PORT=3017
EOF

# Start all HealthConnect+ services
sudo docker compose up -d

# Check service status
sudo docker compose ps

# View logs for all services
sudo docker compose logs -f

# View logs for specific service
sudo docker compose logs -f app
sudo docker compose logs -f mongo

# Test HealthConnect+ application
curl http://localhost:3017
curl http://localhost:3017/doctors.html
curl http://localhost:3017/book.html

# Health check for MongoDB
sudo docker compose exec mongo mongo --eval "db.adminCommand('ismaster')"

# Scale application (if needed)
sudo docker compose up -d --scale app=2

# Stop services
sudo docker compose down

# Stop and remove volumes (CAUTION: This removes database data)
sudo docker compose down -v
```

## 📦 Push to Container Registries

### Step 11: Push to Docker Hub
```bash
# Login to Docker Hub (you'll be prompted for credentials)
sudo docker login

# Tag image for Docker Hub (replace 'yourusername' with your Docker Hub username)
sudo docker tag healthconnect-app:latest yourusername/healthconnect-app:latest
sudo docker tag healthconnect-app:latest yourusername/healthconnect-app:v1.0
sudo docker tag healthconnect-app:latest yourusername/healthconnect-app:production

# Push to Docker Hub
sudo docker push yourusername/healthconnect-app:latest
sudo docker push yourusername/healthconnect-app:v1.0
sudo docker push yourusername/healthconnect-app:production
```

### Step 12: Push to AWS ECR
```bash
# Create ECR repository (if not exists)
aws ecr create-repository --repository-name healthconnect-app --region us-east-1

# Get ECR login token
aws ecr get-login-password --region us-east-1 | sudo docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag image for ECR (replace YOUR_ACCOUNT_ID with your AWS account ID)
sudo docker tag healthconnect-app:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/healthconnect-app:latest
sudo docker tag healthconnect-app:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/healthconnect-app:v1.0

# Push to ECR
sudo docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/healthconnect-app:latest
sudo docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/healthconnect-app:v1.0
```

## ☸️ Kubernetes Deployment

### Step 13: Set up Kubernetes (if using EKS)
```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster for HealthConnect+ (this takes 10-15 minutes)
eksctl create cluster \
  --name healthconnect-cluster \
  --region us-east-1 \
  --nodegroup-name healthconnect-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name healthconnect-cluster

# Verify cluster connection
kubectl get nodes
kubectl cluster-info
```

### Step 14: Create Kubernetes Manifests for HealthConnect+
```bash
# Create k8s directory
mkdir -p k8s

# Create namespace
cat > k8s/namespace.yml << EOF
apiVersion: v1
kind: Namespace
metadata:
  name: healthconnect
---
EOF

# Create MongoDB deployment
cat > k8s/mongodb.yml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: healthconnect
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_DATABASE
          value: healthconnect
        volumeMounts:
        - name: mongodb-storage
          mountPath: /data/db
      volumes:
      - name: mongodb-storage
        persistentVolumeClaim:
          claimName: mongodb-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
  namespace: healthconnect
spec:
  selector:
    app: mongodb
  ports:
  - port: 27017
    targetPort: 27017
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: healthconnect
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF

# Create HealthConnect+ app deployment
cat > k8s/healthconnect-app.yml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: healthconnect-app
  namespace: healthconnect
spec:
  replicas: 3
  selector:
    matchLabels:
      app: healthconnect-app
  template:
    metadata:
      labels:
        app: healthconnect-app
    spec:
      containers:
      - name: healthconnect-app
        image: yourusername/healthconnect-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: MONGODB_URI
          value: mongodb://mongodb-service:27017/healthconnect
        - name: PORT
          value: "3000"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: healthconnect-app-service
  namespace: healthconnect
spec:
  type: LoadBalancer
  selector:
    app: healthconnect-app
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
EOF
```

### Step 15: Deploy HealthConnect+ to Kubernetes
```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Check namespace
kubectl get namespaces

# Check deployments
kubectl get deployments -n healthconnect

# Check pods
kubectl get pods -n healthconnect

# Check services
kubectl get services -n healthconnect

# Get external LoadBalancer URL (this may take a few minutes)
kubectl get service healthconnect-app-service -n healthconnect

# Check application logs
kubectl logs -f deployment/healthconnect-app -n healthconnect

# Port forward for testing (if LoadBalancer is not ready)
kubectl port-forward service/healthconnect-app-service 8080:80 -n healthconnect
```

## 🔧 Jenkins Setup with Ansible

### Step 16: Install Ansible
```bash
# Install Ansible
sudo apt update
sudo apt install -y ansible

# Verify installation
ansible --version
```

### Step 17: Create Ansible Inventory and Playbook
```bash
# Create ansible directory
mkdir -p ansible

# Create inventory file
cat > ansible/inventory.ini << EOF
[jenkins]
jenkins-server ansible_host=YOUR_EC2_PUBLIC_IP ansible_user=ubuntu ansible_ssh_private_key_file=/path/to/your/key.pem

[all:vars]
ansible_ssh_common_args='-o StrictHostKeyChecking=no'
EOF

# Create Jenkins setup playbook
cat > ansible/jenkins-setup.yml << EOF
---
- hosts: jenkins
  become: yes
  vars:
    jenkins_port: 8080
    java_version: openjdk-11-jdk

  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes

    - name: Install Java
      apt:
        name: "{{ java_version }}"
        state: present

    - name: Add Jenkins apt repository key
      apt_key:
        url: https://pkg.jenkins.io/debian-stable/jenkins.io.key
        state: present

    - name: Add Jenkins apt repository
      apt_repository:
        repo: deb https://pkg.jenkins.io/debian-stable binary/
        state: present

    - name: Install Jenkins
      apt:
        name: jenkins
        state: present
        update_cache: yes

    - name: Start Jenkins service
      systemd:
        name: jenkins
        state: started
        enabled: yes

    - name: Wait for Jenkins to start
      wait_for:
        port: "{{ jenkins_port }}"
        delay: 10

    - name: Get Jenkins initial admin password
      slurp:
        src: /var/lib/jenkins/secrets/initialAdminPassword
      register: jenkins_password

    - name: Display Jenkins initial admin password
      debug:
        msg: "Jenkins initial admin password: {{ jenkins_password.content | b64decode }}"

    - name: Install Docker (for Jenkins agents)
      apt:
        name: docker.io
        state: present

    - name: Add jenkins user to docker group
      user:
        name: jenkins
        groups: docker
        append: yes

    - name: Restart Jenkins to apply group changes
      systemd:
        name: jenkins
        state: restarted
EOF

# Run the Jenkins setup playbook
ansible-playbook -i ansible/inventory.ini ansible/jenkins-setup.yml -v
```

### Step 18: Create Jenkinsfile for HealthConnect+
```bash
# Create Jenkinsfile
cat > Jenkinsfile << EOF
pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = 'healthconnect-app'
        DOCKER_TAG = "\${BUILD_NUMBER}"
        DOCKERHUB_REPO = 'yourusername/healthconnect-app'
        KUBECONFIG_FILE = 'kubeconfig'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                script {
                    sh 'npm install'
                    sh 'npm test || true'
                }
            }
        }
        
        stage('Docker Build') {
            steps {
                script {
                    docker.build("\${DOCKER_IMAGE}:\${DOCKER_TAG}")
                    docker.build("\${DOCKER_IMAGE}:latest")
                }
            }
        }
        
        stage('Docker Push') {
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
                        docker.image("\${DOCKER_IMAGE}:\${DOCKER_TAG}").push()
                        docker.image("\${DOCKER_IMAGE}:latest").push("\${DOCKERHUB_REPO}:latest")
                        docker.image("\${DOCKER_IMAGE}:\${DOCKER_TAG}").push("\${DOCKERHUB_REPO}:\${DOCKER_TAG}")
                    }
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                        sh '''
                            kubectl set image deployment/healthconnect-app healthconnect-app='''+DOCKERHUB_REPO+''':'''+DOCKER_TAG+''' -n healthconnect
                            kubectl rollout status deployment/healthconnect-app -n healthconnect
                        '''
                    }
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    sleep(30) // Wait for deployment
                    sh '''
                        kubectl get pods -n healthconnect
                        kubectl get services -n healthconnect
                        
                        # Get LoadBalancer URL and test
                        LB_URL=\$(kubectl get service healthconnect-app-service -n healthconnect -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
                        if [ ! -z "\$LB_URL" ]; then
                            curl -f http://\$LB_URL || echo "Health check failed"
                        fi
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo 'HealthConnect+ deployment successful!'
        }
        failure {
            echo 'HealthConnect+ deployment failed!'
        }
        always {
            sh 'docker system prune -f'
        }
    }
}
EOF
```

## 🧪 Testing Commands

### Test HealthConnect+ Application
```bash
# Test Docker build
sudo docker build -t test-healthconnect .
sudo docker run --rm -p 3017:3000 test-healthconnect &
sleep 10
curl http://localhost:3017
curl http://localhost:3017/doctors.html
curl http://localhost:3017/book.html
curl http://localhost:3017/api/health || echo "API endpoint not available"

# Test Docker Compose
sudo docker compose -f docker-compose.yml up --build -d
sleep 15
curl http://localhost:3017
curl http://localhost:3017/index.html
sudo docker compose down

# Test Kubernetes deployment
kubectl apply -f k8s/ --dry-run=client
kubectl get all -n healthconnect
kubectl port-forward service/healthconnect-app-service 8080:80 -n healthconnect &
sleep 10
curl http://localhost:8080
```

### Test HealthConnect+ Specific Endpoints
```bash
# Test all major HealthConnect+ pages
curl -I http://localhost:3017/
curl -I http://localhost:3017/index.html
curl -I http://localhost:3017/book.html
curl -I http://localhost:3017/consultation.html
curl -I http://localhost:3017/doctors.html
curl -I http://localhost:3017/about.html
curl -I http://localhost:3017/contact.html
curl -I http://localhost:3017/login.html

# Test static assets
curl -I http://localhost:3017/global.css
curl -I http://localhost:3017/js/navbar.js

# Test API endpoints (if available)
curl http://localhost:3017/api/user
curl http://localhost:3017/api/doctors
```

## 📊 Monitoring Commands

### Docker Monitoring
```bash
# Check HealthConnect+ container stats
sudo docker stats

# Check HealthConnect+ compose services
sudo docker compose logs -f app
sudo docker compose logs -f mongo

# Check system resource usage
sudo docker system df
sudo docker system events

# Monitor container health
sudo docker inspect healthconnect-app | grep -i health
```

### Kubernetes Monitoring
```bash
# Check HealthConnect+ cluster resource usage
kubectl top nodes
kubectl top pods -n healthconnect

# Check pod details and events
kubectl describe pod -l app=healthconnect-app -n healthconnect
kubectl describe pod -l app=mongodb -n healthconnect

# Check service endpoints
kubectl get endpoints -n healthconnect

# Check ingress (if configured)
kubectl get ingress -n healthconnect

# Monitor logs
kubectl logs -f deployment/healthconnect-app -n healthconnect
kubectl logs -f deployment/mongodb -n healthconnect
```

## 🔄 Maintenance Commands

### Docker Maintenance
```bash
# Update HealthConnect+ application
sudo docker compose pull
sudo docker compose up -d --no-deps app

# Backup MongoDB data
sudo docker compose exec mongo mongodump --db healthconnect --out /data/backup
sudo docker cp \$(docker compose ps -q mongo):/data/backup ./mongodb-backup-\$(date +%Y%m%d)

# Restore MongoDB data
sudo docker compose exec mongo mongorestore --db healthconnect /data/backup/healthconnect

# Clean up unused Docker resources
sudo docker image prune -a
sudo docker container prune
sudo docker volume prune
sudo docker system prune -a --volumes
```

### Kubernetes Maintenance
```bash
# Update HealthConnect+ deployment
kubectl set image deployment/healthconnect-app healthconnect-app=yourusername/healthconnect-app:v2.0 -n healthconnect

# Scale HealthConnect+ deployment
kubectl scale deployment healthconnect-app --replicas=5 -n healthconnect

# Restart deployment
kubectl rollout restart deployment/healthconnect-app -n healthconnect
kubectl rollout restart deployment/mongodb -n healthconnect

# Check rollout status
kubectl rollout status deployment/healthconnect-app -n healthconnect

# Backup MongoDB data in Kubernetes
kubectl exec deployment/mongodb -n healthconnect -- mongodump --db healthconnect --out /tmp/backup
kubectl cp healthconnect/\$(kubectl get pod -l app=mongodb -n healthconnect -o jsonpath='{.items[0].metadata.name}'):/tmp/backup ./k8s-mongodb-backup-\$(date +%Y%m%d)
```

## ⚠️ HealthConnect+ Specific Notes

### Environment Variables
```bash
# Required environment variables for HealthConnect+
export NODE_ENV=production
export PORT=3000
export MONGODB_URI=mongodb://localhost:27017/healthconnect
export MONGODB_PORT=27017
export APP_PORT=3017

# Optional environment variables
export EMAIL_SERVICE=gmail
export EMAIL_USER=your-email@gmail.com
export EMAIL_PASS=your-app-password
export JWT_SECRET=your-jwt-secret
export SESSION_SECRET=your-session-secret
```

### Database Setup
```bash
# Initialize MongoDB with HealthConnect+ collections
sudo docker compose exec mongo mongo healthconnect --eval "
db.createCollection('users');
db.createCollection('appointments');
db.createCollection('doctors');
db.createCollection('consultations');
db.createCollection('medical_reports');
db.users.createIndex({email: 1}, {unique: true});
db.appointments.createIndex({patientEmail: 1});
db.appointments.createIndex({date: 1});
"
```

### SSL/TLS Setup (Production)
```bash
# Install Certbot for Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace your-domain.com)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🚨 Troubleshooting Quick Fixes

### If Docker build fails:
```bash
# Clear Docker cache and rebuild
sudo docker system prune -a --volumes
sudo docker build --no-cache -t healthconnect-app:latest .

# Check Dockerfile syntax
sudo docker build --no-cache --progress=plain -t healthconnect-app:latest .
```

### If MongoDB connection fails:
```bash
# Check MongoDB container
sudo docker compose logs mongo
sudo docker compose exec mongo mongo --eval "db.adminCommand('ismaster')"

# Check network connectivity
sudo docker compose exec app ping mongo
sudo docker compose exec app nslookup mongo
```

### If HealthConnect+ app won't start:
```bash
# Check application logs
sudo docker compose logs app
kubectl logs deployment/healthconnect-app -n healthconnect

# Check if all required files exist
ls -la public/
ls -la server.js package.json

# Check port conflicts
sudo netstat -tlnp | grep 3017
sudo lsof -i :3017
```

### If Kubernetes pods won't start:
```bash
# Describe pods for detailed info
kubectl describe pod -l app=healthconnect-app -n healthconnect
kubectl describe pod -l app=mongodb -n healthconnect

# Check events
kubectl get events -n healthconnect --sort-by='.lastTimestamp'

# Check resource constraints
kubectl top nodes
kubectl describe node
```

### If LoadBalancer doesn't get external IP:
```bash
# Check AWS Load Balancer Controller
kubectl get pods -n kube-system | grep aws-load-balancer

# Install AWS Load Balancer Controller if missing
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.4.4/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json

# Create service account and install controller
eksctl create iamserviceaccount \
  --cluster=healthconnect-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name=AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::YOUR_ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=healthconnect-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

## 📋 Quick Reference Commands

### Start HealthConnect+ Services
```bash
# Docker Compose
sudo docker compose up -d

# Kubernetes
kubectl apply -f k8s/
```

### Check HealthConnect+ Status
```bash
# Docker
sudo docker compose ps
curl http://localhost:3017

# Kubernetes  
kubectl get all -n healthconnect
kubectl get service healthconnect-app-service -n healthconnect
```

### View HealthConnect+ Logs
```bash
# Docker
sudo docker compose logs -f app

# Kubernetes
kubectl logs -f deployment/healthconnect-app -n healthconnect
```

### Scale HealthConnect+ Application
```bash
# Docker Compose
sudo docker compose up -d --scale app=3

# Kubernetes
kubectl scale deployment healthconnect-app --replicas=5 -n healthconnect
```

---

## 🏥 HealthConnect+ Specific Features

### Available Pages:
- **Home**: `/` or `/index.html` - Main landing page with hero section
- **Book Appointment**: `/book.html` - Appointment booking form
- **Online Consultation**: `/consultation.html` - Video consultation booking
- **Doctors**: `/doctors.html` - List of available doctors
- **About**: `/about.html` - About the platform and facilities
- **Contact**: `/contact.html` - Contact information and form
- **Login**: `/login.html` - User authentication

### API Endpoints (if available):
- `GET /api/user` - User session management
- `POST /api/book-appointment` - Book appointments
- `POST /api/book-consultation` - Book consultations
- `GET /api/doctors` - Get doctor listings
- `POST /api/contact` - Contact form submission

### Key Features:
- 🏥 Hospital appointment booking
- 💬 Online video consultations  
- 👨‍⚕️ Doctor profiles and specialties
- 📱 Mobile responsive design
- 🔐 User authentication system
- 📊 Medical records management
- 🤖 AI chatbot assistance
- 🚨 Emergency services integration

---

**Remember**: Replace all placeholder values with your actual values:
- `YOUR_USERNAME` → Your GitHub/DockerHub username
- `YOUR_ACCOUNT_ID` → Your AWS Account ID  
- `YOUR_EC2_PUBLIC_IP` → Your EC2 instance public IP
- `yourusername` → Your actual username
- `/path/to/your/key.pem` → Path to your SSH key file

**Security Note**: Never commit credentials, API keys, or sensitive information to your repository. Use environment variables, AWS Secrets Manager, or Kubernetes secrets for production deployments.
