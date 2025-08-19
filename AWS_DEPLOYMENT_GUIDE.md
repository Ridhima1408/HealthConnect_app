# AWS Deployment Guide - HealthConnect+

## 🚀 Quick Deployment Steps

### 1. Server Configuration ✅
The server is now configured to bind to `0.0.0.0:3000` for AWS deployment.

### 2. AWS Security Group Settings 🔧
Ensure your EC2 instance security group allows:
- **Port 3000**: Custom TCP Rule, Source: 0.0.0.0/0 (Anywhere-IPv4)
- **Port 22**: SSH access for management
- **Port 80**: HTTP (if using reverse proxy)
- **Port 443**: HTTPS (if using SSL)

### 3. Install Dependencies on AWS Instance 📦
```bash
# Update system
sudo yum update -y

# Install Node.js (Amazon Linux 2)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install node
nvm use node

# Install MongoDB
sudo yum install -y docker
sudo systemctl start docker
sudo docker run -d -p 27017:27017 --name mongodb mongo

# Clone and setup project
git clone https://github.com/Ridhima1408/HealthConnect_app.git
cd HealthConnect_app
npm install
```

### 4. Start the Application 🎯
```bash
# Start MongoDB (if not already running)
sudo docker start mongodb

# Start the app
node server.js
```

## 🔍 Troubleshooting "Cannot GET /api/user"

### Problem 1: Server Not Running
**Check if server is running:**
```bash
ps aux | grep node
curl -I http://localhost:3000/test
```

**Solution:**
```bash
cd /path/to/HealthConnect_app
node server.js
```

### Problem 2: Port 3000 Not Accessible
**Check if port is listening:**
```bash
netstat -tlnp | grep 3000
```

**AWS Security Group Fix:**
1. Go to EC2 Console → Security Groups
2. Edit inbound rules
3. Add: Custom TCP, Port 3000, Source: 0.0.0.0/0

### Problem 3: MongoDB Not Running
**Check MongoDB status:**
```bash
sudo docker ps -a | grep mongodb
```

**Start MongoDB:**
```bash
sudo docker start mongodb
```

### Problem 4: Frontend API Calls Failing
The app now automatically detects if it's running on AWS vs localhost and adjusts API URLs accordingly.

## 🧪 Testing Your Deployment

### 1. Test Server Direct Access
```bash
# From your local machine
curl http://65.2.74.240:3000/test
curl http://65.2.74.240:3000/api/user
```

### 2. Test in Browser
1. Visit: `http://65.2.74.240:3000`
2. Open Developer Tools (F12)
3. Check Console tab for config info:
   ```
   🔧 HealthConnect+ Config: {
     environment: 'Production',
     hostname: '65.2.74.240', 
     baseURL: 'http://65.2.74.240:3000',
     userAPI: 'http://65.2.74.240:3000/api/user'
   }
   ```

### 3. Test Login Flow
1. Register a new user
2. Login with credentials
3. Check if navbar shows username
4. Navigate between pages to verify session persistence

## 🔥 Production Deployment (Optional)

### Using PM2 for Production
```bash
# Install PM2
npm install -g pm2

# Start app with PM2
pm2 start server.js --name healthconnect

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor
pm2 status
pm2 logs healthconnect
```

### Using Nginx Reverse Proxy (Optional)
```nginx
server {
    listen 80;
    server_name 65.2.74.240;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📞 Quick Debug Commands

```bash
# Check if app is running
curl http://65.2.74.240:3000/test

# Check API endpoint
curl http://65.2.74.240:3000/api/user

# Check server logs
tail -f server.log

# Check system resources  
top
df -h
free -m
```

## 🚨 Common Error Solutions

**"EACCES: permission denied"**
- Use `sudo` or change port to > 1024

**"EADDRINUSE: address already in use"**
```bash
lsof -ti:3000 | xargs kill -9
```

**"MongoDB connection failed"**
```bash
sudo docker restart mongodb
```

**"Cannot GET /api/user" in browser**
- Check browser console for CORS errors
- Verify security group allows port 3000
- Try direct API access: `http://65.2.74.240:3000/api/user`

## 📱 Current Status
- ✅ Server configured for AWS deployment
- ✅ Frontend auto-detects production vs development
- ✅ Dynamic API URL configuration
- ✅ Session management working
- ✅ All pages updated with config support

Your app should now work correctly on AWS at: **http://65.2.74.240:3000**
