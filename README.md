# HealthConnect+ 🏥

A digital healthcare platform providing online consultations and appointment booking services.

## Features

- 👨‍⚕️ **Doctor Appointment Booking**: Schedule appointments with healthcare professionals
- 💻 **Online Consultations**: Virtual consultations with consultation fees up to ₹1000
- 📧 **Email Notifications**: Automated appointment confirmations via email
- 📱 **SMS Notifications**: Text message confirmations using Twilio
- 🤖 **AI Chatbot**: Healthcare assistance and guidance
- 📋 **Medical Reports**: Secure access to medical records
- 👤 **User Management**: Secure login and session management

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: Session-based with bcrypt
- **Email**: Nodemailer
- **SMS**: Twilio API
- **Frontend**: HTML, CSS, JavaScript
- **Containerization**: Docker & Docker Compose

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd healthconnect
   ```

2. **Start with Docker**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - Web Interface: http://localhost:3017
   - MongoDB: localhost:27018

## Environment Configuration

Configure your `.env` file with:

```env
# Application
APP_PORT=3017
NODE_ENV=production

# Database
MONGO_URI=mongodb://localhost:27017/healthconnect
MONGO_USER=admin
MONGO_PASSWORD=your_password

# Email (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Home page |
| POST | `/login` | User authentication |
| POST | `/logout` | User logout |
| GET | `/book` | Appointment booking page |
| POST | `/api/book-consultation` | Book online consultation |
| POST | `/api/medical-reports` | Access medical reports |
| POST | `/api/chatbot` | AI chatbot interactions |
| POST | `/api/test-email` | Test email configuration |
| POST | `/api/test-sms` | Test SMS configuration |

## License

MIT License - see LICENSE file for details.
