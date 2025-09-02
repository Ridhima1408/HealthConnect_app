const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const session = require('express-session');
const fs = require('fs');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB connection using environment variable
const connectDB = require('./db');
connectDB();

// ✅ Email Configuration with Enhanced Error Handling
let transporter = null;
let emailConfigured = false;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional options for better reliability
      secure: true,
      port: 587,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Enhanced transport verification
    transporter.verify((err, success) => {
      if (err) {
        console.warn('⚠️ Email transporter verification failed:', err.message);
        console.warn('⚠️ Email notifications may not work properly');
        emailConfigured = false;
      } else {
        console.log('✅ Email transporter verified and ready');
        emailConfigured = true;
      }
    });
  } catch (transporterError) {
    console.error('❌ Failed to create email transporter:', transporterError.message);
    transporter = null;
    emailConfigured = false;
  }
} else {
  console.warn('⚠️ Email credentials not configured. Email notifications disabled.');
  console.warn('⚠️ Please set EMAIL_USER and EMAIL_PASS in .env file');
}

// Enhanced email sending function
async function sendEmailNotification(emailData, type = 'general') {
  if (!transporter || !emailConfigured) {
    console.warn(`⚠️ Cannot send ${type} email - email service not configured`);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const info = await transporter.sendMail(emailData);
    console.log(`✅ ${type} email sent successfully to ${emailData.to}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (emailErr) {
    console.error(`❌ Failed to send ${type} email to ${emailData.to}:`, emailErr.message);
    return { success: false, error: emailErr.message };
  }
}

// ✅ SMS Configuration
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('📱 Twilio SMS service initialized');
  } catch (twilioErr) {
    console.warn('⚠️ Twilio SMS initialization failed:', twilioErr.message);
  }
} else {
  console.warn('⚠️ SMS service not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for SMS notifications.');
}

// SMS template function for appointments
function createAppointmentSMS(appointmentDetails) {
  const { name, phone, date, doctor } = appointmentDetails;
  return {
    body: `✅ HealthConnect+ Appointment Confirmed!\n\nHi ${name},\nYour appointment is booked:\n📅 ${date}\n👨‍⚕️ Dr. ${doctor}\n📍 HealthConnect+ Medical Center\n\nArrive 15 min early with ID & insurance.\n📞 Questions? Call (555) 123-4567\n\nThank you for choosing HealthConnect+!`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone
  };
}

// SMS template function for consultations
function createConsultationSMS(consultationDetails) {
  const { name, phone, consultationId, type } = consultationDetails;
  
  const typeLabels = {
    instant: 'Instant Consultation',
    scheduled: 'Scheduled Consultation',
    emergency: 'Emergency Consultation'
  };
  
  let message = `🩺 HealthConnect+ Online Consultation Confirmed!\n\nHi ${name},\nConsultation: ${typeLabels[type]}\nID: ${consultationId}\n\n`;
  
  if (type === 'instant') {
    message += `⚡ You'll receive a video call link within 2 minutes. Keep your phone ready!`;
  } else if (type === 'scheduled') {
    message += `📅 You'll receive a video call link 30 minutes before your appointment.`;
  } else {
    message += `🚨 A senior doctor will call you immediately for this emergency consultation.`;
  }
  
  message += `\n\n📞 Support: (555) 123-4567\nThank you for choosing HealthConnect+!`;
  
  return {
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone
  };
}

// Function to send SMS notifications
async function sendSMSNotification(smsData, type = 'appointment') {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ SMS service not available - missing Twilio configuration');
    return { success: false, error: 'SMS service not configured' };
  }
  
  try {
    const message = await twilioClient.messages.create(smsData);
    console.log(`📱 ${type} SMS sent successfully to ${smsData.to}. Message SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (smsErr) {
    console.error(`❌ Failed to send ${type} SMS to ${smsData.to}:`, smsErr.message);
    return { success: false, error: smsErr.message };
  }
}

// Email template function for appointments
function createAppointmentEmail(appointmentDetails) {
  const { name, email, date, doctor } = appointmentDetails;
  return {
    from: process.env.EMAIL_USER || 'healthconnect.noreply@gmail.com',
    to: email,
    subject: '✅ Appointment Confirmation - HealthConnect+',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #0a3d62, #145374); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0;">🏥 HealthConnect+</h1>
          <p style="margin: 10px 0 0 0;">Your Healthcare Partner</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #0a3d62; margin-bottom: 20px;">✅ Appointment Confirmed!</h2>
          
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your appointment has been successfully booked. Here are your appointment details:</p>
          
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">👤 Patient Name:</td>
                <td style="padding: 8px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">📧 Email:</td>
                <td style="padding: 8px;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">📅 Date & Time:</td>
                <td style="padding: 8px;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">👨‍⚕️ Doctor:</td>
                <td style="padding: 8px;">${doctor}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">🏥 Hospital Information</h3>
            <p style="margin: 5px 0;"><strong>📍 Location:</strong> HealthConnect+ Medical Center<br>
            123 Wellness Street, Medical District<br>
            Health City, HC 12345</p>
            <p style="margin: 5px 0;"><strong>📞 Contact:</strong> +1 (555) 123-4567</p>
            <p style="margin: 5px 0;"><strong>🕒 Hours:</strong> Mon-Sat: 8:00 AM - 8:00 PM, Sun: 9:00 AM - 5:00 PM</p>
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">📝 Important Instructions</h3>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Please arrive 15 minutes before your appointment</li>
              <li>Bring a valid ID and insurance card</li>
              <li>Bring any previous medical records or test results</li>
              <li>Take any regular medications as usual unless advised otherwise</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666;">Need to reschedule or have questions?</p>
            <a href="tel:+15551234567" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">📞 Call Us</a>
            <a href="mailto:support@healthconnect.com" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">✉️ Email Us</a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">Thank you for choosing HealthConnect+ for your healthcare needs!</p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>© 2025 HealthConnect+. All rights reserved.</p>
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
}

// Email template function for online consultations
function createConsultationEmail(consultationDetails) {
  const { name, email, consultationId, type, date, concern } = consultationDetails;
  
  const typeLabels = {
    instant: 'Instant Consultation',
    scheduled: 'Scheduled Consultation', 
    emergency: 'Emergency Consultation'
  };
  
  const typePrices = {
    instant: '₹299',
    scheduled: '₹499',
    emergency: '₹799'
  };
  
  return {
    from: process.env.EMAIL_USER || 'healthconnect.noreply@gmail.com',
    to: email,
    subject: `🩺 Online Consultation Confirmed - ${typeLabels[type]} - HealthConnect+`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #0a3d62, #145374); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0;">🩺 HealthConnect+</h1>
          <p style="margin: 10px 0 0 0;">Online Medical Consultation</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #0a3d62; margin-bottom: 20px;">🩺 Online Consultation Confirmed!</h2>
          
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your online consultation has been successfully booked. Here are your consultation details:</p>
          
          <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">👤 Patient Name:</td>
                <td style="padding: 8px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">🆔 Consultation ID:</td>
                <td style="padding: 8px;">${consultationId}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">📋 Type:</td>
                <td style="padding: 8px;">${typeLabels[type]} (${typePrices[type]})</td>
              </tr>
              ${date ? `<tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">📅 Scheduled Date:</td>
                <td style="padding: 8px;">${new Date(date).toLocaleString()}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #0a3d62;">📧 Email:</td>
                <td style="padding: 8px;">${email}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">📱 What Happens Next?</h3>
            ${type === 'instant' ? 
              `<p style="margin: 5px 0;"><strong>⚡ Instant Consultation:</strong><br>
              • You will receive a video call link within 2 minutes<br>
              • Keep your phone ready for the consultation<br>
              • Average consultation time: 15-20 minutes</p>` :
            type === 'scheduled' ? 
              `<p style="margin: 5px 0;"><strong>📅 Scheduled Consultation:</strong><br>
              • You will receive a video call link 30 minutes before your appointment<br>
              • Please be available at the scheduled time<br>
              • Duration: 30-45 minutes</p>` :
              `<p style="margin: 5px 0;"><strong>🚨 Emergency Consultation:</strong><br>
              • A senior doctor will call you immediately<br>
              • Please keep your phone available<br>
              • For severe emergencies, call 911 immediately</p>`
            }
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">📝 Your Health Concern</h3>
            <p style="color: #155724; font-style: italic;">"${concern}"</p>
          </div>
          
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="color: #721c24; margin: 0 0 10px 0;">⚠️ Important Reminders</h3>
            <ul style="margin: 0; padding-left: 20px; color: #721c24;">
              <li>Ensure stable internet connection</li>
              <li>Find a quiet, private space for the consultation</li>
              <li>Have your medical history and current medications ready</li>
              <li>Test your camera and microphone beforehand</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666;">Need to reschedule or have questions?</p>
            <a href="tel:+15551234567" style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">📞 Call Support</a>
            <a href="mailto:consultations@healthconnect.com" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px;">✉️ Email Us</a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">Thank you for choosing HealthConnect+ for your online medical consultation!</p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>© 2025 HealthConnect+. All rights reserved.</p>
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>Consultation ID: ${consultationId}</p>
        </div>
      </div>
    `
  };
}

// ✅ Middleware
app.use(session({
  secret: 'healthconnect-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// -------------------- SCHEMAS -------------------- //
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const appointmentSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  email:  { type: String, required: true },
  phone:  { type: String, required: true },
  date:   { type: String, required: true },
  timeSlot: { type: String, required: true },
  doctor: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Consultation pricing configuration with maximum limit enforcement (INR)
const CONSULTATION_CONFIG = {
  MAX_AMOUNT: 1000, // Maximum consultation amount limit (₹1,000)
  PRICES: {
    instant: 299,    // ₹299 - Instant Consultation
    scheduled: 499,  // ₹499 - Scheduled Consultation  
    emergency: 799   // ₹799 - Emergency Consultation
  },
  LABELS: {
    instant: 'Instant Consultation',
    scheduled: 'Scheduled Consultation',
    emergency: 'Emergency Consultation'
  }
};

// Function to validate consultation amount
function validateConsultationAmount(consultationType) {
  const price = CONSULTATION_CONFIG.PRICES[consultationType];
  if (!price) {
    throw new Error(`Invalid consultation type: ${consultationType}`);
  }
  if (price > CONSULTATION_CONFIG.MAX_AMOUNT) {
    throw new Error(`Consultation amount ₹${price} exceeds maximum limit of ₹${CONSULTATION_CONFIG.MAX_AMOUNT}`);
  }
  return price;
}

// Online Consultation Schema
const consultationSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  patientEmail: { type: String, required: true },
  patientPhone: { type: String, required: true },
  consultationType: { type: String, required: true, enum: ['instant', 'scheduled', 'emergency'] },
  consultationAmount: { type: Number, required: true, max: 1000 }, // Updated max limit to ₹1000
  preferredDate: { type: Date },
  healthConcern: { type: String, required: true },
  medicalHistory: { type: String },
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'] },
  consultationId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});
const Consultation = mongoose.model('Consultation', consultationSchema);

// -------------------- ROUTES -------------------- //

// Register Route
app.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.send("<h2>Passwords do not match. Please go back and try again.</h2>");
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.send("<h2>User already exists.</h2>");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.redirect("/login.html");
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      // Store user session
      req.session.user = {
        id: user._id,
        username: user.username,
        email: user.email
      };
      res.redirect("/index.html");
    } else {
      res.send("<h2>Invalid username or password. <a href='/login.html'>Try again</a></h2>");
    }
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Get user session info
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ 
      loggedIn: true, 
      user: {
        username: req.session.user.username,
        email: req.session.user.email
      }
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // exclude password
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout Route
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Could not log out");
    }
    res.redirect("/login.html");
  });
});

// Enhanced POST booking route with validation
app.post("/api/book-appointment", async (req, res) => {
  try {
    const { name, email, phone, date, timeSlot, doctor } = req.body;

    // Server-side validation
    if (!name || !email || !phone || !date || !timeSlot || !doctor) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required",
        errors: {
          name: !name ? "Name is required" : null,
          email: !email ? "Email is required" : null,
          phone: !phone ? "Phone number is required" : null,
          date: !date ? "Date is required" : null,
          timeSlot: !timeSlot ? "Time slot is required" : null,
          doctor: !doctor ? "Doctor selection is required" : null
        }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email format",
        errors: { email: "Please enter a valid email address" }
      });
    }

    // Phone validation (basic international format)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid phone number format",
        errors: { phone: "Please enter a valid phone number" }
      });
    }

    // Create appointment
    const appointmentData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      date: date,
      timeSlot: timeSlot,
      doctor: doctor
    };

    const newAppointment = new Appointment(appointmentData);
    await newAppointment.save();

    // Send confirmation email
    let emailSent = false;
    try {
      const emailData = createAppointmentEmail({
        name: appointmentData.name,
        email: appointmentData.email,
        phone: appointmentData.phone,
        date: `${appointmentData.date} at ${appointmentData.timeSlot}`,
        doctor: appointmentData.doctor
      });
      
      const emailResult = await sendEmailNotification(emailData, 'appointment');
      emailSent = emailResult.success;
    } catch (mailErr) {
      console.warn('⚠️ Failed to send confirmation email:', mailErr.message);
      // Don't fail the appointment booking if email fails
    }

    // Send confirmation SMS
    let smsSent = false;
    try {
      const smsData = createAppointmentSMS({
        name: appointmentData.name,
        phone: appointmentData.phone,
        date: `${appointmentData.date} at ${appointmentData.timeSlot}`,
        doctor: appointmentData.doctor
      });
      
      const smsResult = await sendSMSNotification(smsData, 'appointment');
      if (smsResult.success) {
        smsSent = true;
      }
    } catch (smsErr) {
      console.warn('⚠️ Failed to send confirmation SMS:', smsErr.message);
      // Don't fail the appointment booking if SMS fails
    }

    // Create success message based on what was sent
    let notificationMessage = "Appointment booked successfully!";
    if (emailSent && smsSent) {
      notificationMessage += " Confirmation email and SMS have been sent.";
    } else if (emailSent) {
      notificationMessage += " A confirmation email has been sent.";
    } else if (smsSent) {
      notificationMessage += " A confirmation SMS has been sent.";
    } else {
      notificationMessage += " Your appointment has been confirmed.";
    }

    res.json({ 
      success: true, 
      message: notificationMessage,
      appointment: {
        id: newAppointment._id,
        name: appointmentData.name,
        date: appointmentData.date,
        timeSlot: appointmentData.timeSlot,
        doctor: appointmentData.doctor
      },
      notifications: {
        emailSent: emailSent,
        smsSent: smsSent
      }
    });
    
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later.",
      error: err.message
    });
  }
});

// Book Appointment using query parameters (legacy support)
app.get("/book", async (req, res) => {
  try {
    // Get data from query parameters instead of request body
    const { name, email, date, doctor } = req.query;

    // Validate required fields
    if (!name || !email || !date || !doctor) {
      return res.status(400).send("<h2>Bad Request: Missing required appointment details (name, email, date, doctor)</h2>");
    }

    const newAppointment = new Appointment({ 
      name, 
      email, 
      phone: 'N/A', // Legacy support
      date, 
      timeSlot: 'N/A', // Legacy support
      doctor 
    });
    await newAppointment.save();

    // Send confirmation email (fire-and-forget)
    try {
      await transporter.sendMail(createAppointmentEmail({ name, email, date, doctor }));
      console.log(`📧 Confirmation email sent to ${email}`);
    } catch (mailErr) {
      console.warn('⚠️ Failed to send confirmation email:', mailErr.message);
    }

    res.send("<h2>Appointment booked successfully! <a href='/index.html'>Go Home</a></h2>");
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Alternative: Book Appointment using route parameters (no request body)
app.get("/book/:name/:email/:date/:doctor", async (req, res) => {
  try {
    // Get data from URL path parameters instead of request body
    const { name, email, date, doctor } = req.params;

    // URL decode the parameters
    const decodedName = decodeURIComponent(name);
    const decodedEmail = decodeURIComponent(email);
    const decodedDate = decodeURIComponent(date);
    const decodedDoctor = decodeURIComponent(doctor);

    const newAppointment = new Appointment({ 
      name: decodedName, 
      email: decodedEmail, 
      date: decodedDate, 
      doctor: decodedDoctor 
    });
    await newAppointment.save();

    // Send confirmation email (fire-and-forget)
    try {
      await transporter.sendMail(createAppointmentEmail({ name: decodedName, email: decodedEmail, date: decodedDate, doctor: decodedDoctor }));
      console.log(`📧 Confirmation email sent to ${decodedEmail}`);
    } catch (mailErr) {
      console.warn('⚠️ Failed to send confirmation email:', mailErr.message);
    }

    res.send(`<h2>Appointment booked successfully!</h2>
             <p><strong>Name:</strong> ${decodedName}</p>
             <p><strong>Email:</strong> ${decodedEmail}</p>
             <p><strong>Date:</strong> ${decodedDate}</p>
             <p><strong>Doctor:</strong> ${decodedDoctor}</p>
             <a href='/index.html'>Go Home</a>`);
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Default Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Test Route
app.get('/test', (req, res) => {
  res.send('Express is connected!');
});

// Online Consultation Booking Route
app.post('/api/book-consultation', async (req, res) => {
  try {
    const { patientName, patientEmail, patientPhone, consultationType, preferredDate, healthConcern, medicalHistory } = req.body;

    // Server-side validation
    if (!patientName || !patientEmail || !patientPhone || !consultationType || !healthConcern) {
      return res.status(400).json({ 
        success: false, 
        message: "All required fields must be filled",
        errors: {
          patientName: !patientName ? "Patient name is required" : null,
          patientEmail: !patientEmail ? "Email is required" : null,
          patientPhone: !patientPhone ? "Phone number is required" : null,
          consultationType: !consultationType ? "Consultation type is required" : null,
          healthConcern: !healthConcern ? "Health concern description is required" : null
        }
      });
    }

    // Validate consultation amount - ENFORCE $1000 LIMIT
    let consultationAmount;
    try {
      consultationAmount = validateConsultationAmount(consultationType);
    } catch (amountErr) {
      return res.status(400).json({
        success: false,
        message: amountErr.message,
        errors: { consultationType: amountErr.message }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email format",
        errors: { patientEmail: "Please enter a valid email address" }
      });
    }

    // Generate unique consultation ID
    const consultationId = `CON-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create consultation record
    const consultationData = {
      patientName: patientName.trim(),
      patientEmail: patientEmail.trim().toLowerCase(),
      patientPhone: patientPhone.trim(),
      consultationType: consultationType,
      consultationAmount: consultationAmount, // Include validated amount
      preferredDate: consultationType === 'scheduled' && preferredDate ? new Date(preferredDate) : null,
      healthConcern: healthConcern.trim(),
      medicalHistory: medicalHistory ? medicalHistory.trim() : '',
      consultationId: consultationId,
      status: consultationType === 'instant' ? 'confirmed' : 'pending'
    };

    const newConsultation = new Consultation(consultationData);
    await newConsultation.save();

    // Send confirmation email
    let emailSent = false;
    try {
      const emailData = createConsultationEmail({
        name: consultationData.patientName,
        email: consultationData.patientEmail,
        consultationId: consultationId,
        type: consultationType,
        date: consultationData.preferredDate,
        concern: consultationData.healthConcern
      });
      
      const emailResult = await sendEmailNotification(emailData, 'consultation');
      emailSent = emailResult.success;
    } catch (mailErr) {
      console.warn('⚠️ Failed to send consultation confirmation email:', mailErr.message);
    }

    // Send confirmation SMS
    let smsSent = false;
    try {
      const smsData = createConsultationSMS({
        name: consultationData.patientName,
        phone: consultationData.patientPhone,
        consultationId: consultationId,
        type: consultationType
      });
      
      const smsResult = await sendSMSNotification(smsData, 'consultation');
      if (smsResult.success) {
        smsSent = true;
      }
    } catch (smsErr) {
      console.warn('⚠️ Failed to send consultation confirmation SMS:', smsErr.message);
    }

    // Create success message based on what was sent
    let notificationMessage = "Online consultation booked successfully!";
    if (emailSent && smsSent) {
      notificationMessage += " Confirmation email and SMS have been sent.";
    } else if (emailSent) {
      notificationMessage += " Confirmation details sent to your email.";
    } else if (smsSent) {
      notificationMessage += " Confirmation SMS has been sent.";
    } else {
      notificationMessage += " Your consultation has been confirmed.";
    }

    res.json({ 
      success: true, 
      message: notificationMessage,
      consultationId: consultationId,
      type: consultationType,
      status: consultationData.status,
      notifications: {
        emailSent: emailSent,
        smsSent: smsSent
      }
    });
    
  } catch (err) {
    console.error("Error booking online consultation:", err);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later.",
      error: err.message
    });
  }
});

// API endpoint to get consultation pricing configuration
app.get('/api/consultation-config', (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        maxAmount: CONSULTATION_CONFIG.MAX_AMOUNT,
        prices: CONSULTATION_CONFIG.PRICES,
        labels: CONSULTATION_CONFIG.LABELS
      },
      message: `All consultation prices are capped at ₹${CONSULTATION_CONFIG.MAX_AMOUNT} to ensure affordability.`
    });
  } catch (err) {
    console.error('Error getting consultation config:', err);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve consultation configuration',
      error: err.message
    });
  }
});

// Medical Reports API Routes
app.post('/api/medical-reports', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Mock medical reports - in a real application, this would query a database
    // For demonstration purposes, we'll return sample data
    const sampleReports = [
      {
        id: 'RPT001',
        title: 'Complete Blood Count (CBC)',
        type: 'lab',
        date: new Date('2024-12-15'),
        content: '<h3>Complete Blood Count Report</h3><p><strong>Patient:</strong> ' + name + '</p><p><strong>Date:</strong> December 15, 2024</p><table><tr><th>Parameter</th><th>Value</th><th>Reference Range</th></tr><tr><td>Hemoglobin</td><td>13.5 g/dL</td><td>12.0-15.5 g/dL</td></tr><tr><td>RBC Count</td><td>4.8 million/μL</td><td>4.2-5.4 million/μL</td></tr><tr><td>WBC Count</td><td>7,200/μL</td><td>4,500-11,000/μL</td></tr><tr><td>Platelets</td><td>285,000/μL</td><td>150,000-400,000/μL</td></tr></table><p><strong>Interpretation:</strong> All values within normal limits.</p>'
      },
      {
        id: 'RPT002',
        title: 'Chest X-Ray Report',
        type: 'xray',
        date: new Date('2024-12-10'),
        content: '<h3>Chest X-Ray Report</h3><p><strong>Patient:</strong> ' + name + '</p><p><strong>Date:</strong> December 10, 2024</p><p><strong>Study:</strong> Chest X-Ray (PA and Lateral)</p><p><strong>Findings:</strong></p><ul><li>Heart size and contour normal</li><li>Lungs clear bilaterally</li><li>No acute cardiopulmonary abnormalities</li><li>No pleural effusion or pneumothorax</li></ul><p><strong>Impression:</strong> Normal chest X-ray.</p>'
      },
      {
        id: 'RPT003',
        title: 'Prescription - Dr. Smith',
        type: 'prescription',
        date: new Date('2024-12-20'),
        content: '<h3>Medical Prescription</h3><p><strong>Patient:</strong> ' + name + '</p><p><strong>Doctor:</strong> Dr. Smith</p><p><strong>Date:</strong> December 20, 2024</p><h4>Medications:</h4><ol><li><strong>Amoxicillin 500mg</strong> - Take 1 tablet three times daily for 7 days</li><li><strong>Ibuprofen 400mg</strong> - Take 1 tablet as needed for pain (max 3 times daily)</li></ol><p><strong>Instructions:</strong> Complete the full course of antibiotics. Return if symptoms persist.</p><p><strong>Follow-up:</strong> 1 week</p>'
      }
    ];
    
    // Simulate database lookup - return reports if name and email match expected pattern
    // In real implementation, you would query your database here
    const patientReports = sampleReports.filter(report => 
      name.toLowerCase().includes('john') || 
      name.toLowerCase().includes('jane') || 
      email.includes('demo') ||
      email.includes('test')
    );
    
    res.json({
      success: true,
      reports: patientReports,
      message: patientReports.length > 0 ? 
        `Found ${patientReports.length} medical report(s)` : 
        'No medical reports found for the provided information'
    });
    
  } catch (err) {
    console.error('Error fetching medical reports:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching reports',
      error: err.message
    });
  }
});

// Get individual medical report
app.get('/api/medical-reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Mock report data - in real implementation, query database
    const mockReports = {
      'RPT001': {
        id: 'RPT001',
        title: 'Complete Blood Count (CBC)',
        type: 'lab',
        date: new Date('2024-12-15'),
        content: '<h3>Complete Blood Count Report</h3><p><strong>Date:</strong> December 15, 2024</p><table><tr><th>Parameter</th><th>Value</th><th>Reference Range</th></tr><tr><td>Hemoglobin</td><td>13.5 g/dL</td><td>12.0-15.5 g/dL</td></tr><tr><td>RBC Count</td><td>4.8 million/μL</td><td>4.2-5.4 million/μL</td></tr><tr><td>WBC Count</td><td>7,200/μL</td><td>4,500-11,000/μL</td></tr><tr><td>Platelets</td><td>285,000/μL</td><td>150,000-400,000/μL</td></tr></table><p><strong>Interpretation:</strong> All values within normal limits.</p>'
      },
      'RPT002': {
        id: 'RPT002',
        title: 'Chest X-Ray Report',
        type: 'xray',
        date: new Date('2024-12-10'),
        content: '<h3>Chest X-Ray Report</h3><p><strong>Date:</strong> December 10, 2024</p><p><strong>Study:</strong> Chest X-Ray (PA and Lateral)</p><p><strong>Findings:</strong></p><ul><li>Heart size and contour normal</li><li>Lungs clear bilaterally</li><li>No acute cardiopulmonary abnormalities</li><li>No pleural effusion or pneumothorax</li></ul><p><strong>Impression:</strong> Normal chest X-ray.</p>'
      },
      'RPT003': {
        id: 'RPT003',
        title: 'Prescription - Dr. Smith',
        type: 'prescription',
        date: new Date('2024-12-20'),
        content: '<h3>Medical Prescription</h3><p><strong>Doctor:</strong> Dr. Smith</p><p><strong>Date:</strong> December 20, 2024</p><h4>Medications:</h4><ol><li><strong>Amoxicillin 500mg</strong> - Take 1 tablet three times daily for 7 days</li><li><strong>Ibuprofen 400mg</strong> - Take 1 tablet as needed for pain (max 3 times daily)</li></ol><p><strong>Instructions:</strong> Complete the full course of antibiotics. Return if symptoms persist.</p><p><strong>Follow-up:</strong> 1 week</p>'
      }
    };
    
    const report = mockReports[reportId];
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    res.json({
      success: true,
      report: report
    });
    
  } catch (err) {
    console.error('Error fetching individual report:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching report',
      error: err.message
    });
  }
});

// Download medical report as PDF
app.get('/api/medical-reports/:reportId/download', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Mock PDF generation - in real implementation, generate actual PDF
    const mockReportTitles = {
      'RPT001': 'Complete Blood Count (CBC)',
      'RPT002': 'Chest X-Ray Report',
      'RPT003': 'Prescription - Dr. Smith'
    };
    
    const reportTitle = mockReportTitles[reportId];
    
    if (!reportTitle) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    // Create a simple text-based "PDF" for demonstration
    const reportContent = `HealthConnect+ Medical Report\n\nReport: ${reportTitle}\nReport ID: ${reportId}\nDate: ${new Date().toLocaleDateString()}\n\nThis is a sample medical report download.\nIn a real implementation, this would be a properly formatted PDF document.\n\nFor actual medical reports, please contact our medical records department.\n\n© 2025 HealthConnect+`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(Buffer.from(reportContent, 'utf8'));
    
  } catch (err) {
    console.error('Error downloading report:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while downloading report',
      error: err.message
    });
  }
});

// Email Verification and Test Route
app.post('/api/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(503).json({
        success: false,
        message: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.',
        configured: false
      });
    }
    
    // Send test email
    const testEmailData = {
      from: process.env.EMAIL_USER || 'healthconnect.noreply@gmail.com',
      to: testEmail,
      subject: '🧪 HealthConnect+ Email Test - Configuration Verified',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #0a3d62, #145374); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">🧪 HealthConnect+</h1>
            <p style="margin: 10px 0 0 0;">Email Configuration Test</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #28a745; margin-bottom: 20px;">✅ Email System Working!</h2>
            
            <p>Congratulations! Your HealthConnect+ email notification system is properly configured and working.</p>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin: 0 0 10px 0;">📧 Configuration Details</h3>
              <ul style="margin: 0; padding-left: 20px; color: #155724;">
                <li><strong>Email Service:</strong> ${process.env.EMAIL_SERVICE || 'Gmail (default)'}</li>
                <li><strong>From Address:</strong> ${process.env.EMAIL_USER}</li>
                <li><strong>Test Email:</strong> ${testEmail}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">🎉 What This Means</h3>
              <p style="margin: 0; color: #856404;">Your patients will now receive professional email confirmations when they:</p>
              <ul style="margin: 10px 0 0 20px; color: #856404;">
                <li>Book appointments through your website</li>
                <li>Schedule online consultations</li>
                <li>Complete any healthcare-related forms</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #666;">This was a test email from your HealthConnect+ system.</p>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">Your email notification system is ready to serve your patients!</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© 2025 HealthConnect+. All rights reserved.</p>
            <p>This was an automated test email from your healthcare platform.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(testEmailData);
    console.log(`📧 Test email sent successfully to ${testEmail}`);
    
    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      configured: true,
      emailService: process.env.EMAIL_SERVICE || 'gmail',
      fromAddress: process.env.EMAIL_USER,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Email test failed:', err);
    
    let errorMessage = 'Failed to send test email';
    let troubleshooting = [];
    
    if (err.code === 'EAUTH') {
      errorMessage = 'Email authentication failed';
      troubleshooting = [
        'Check your EMAIL_USER and EMAIL_PASS environment variables',
        'For Gmail, ensure you are using an App Password, not your regular password',
        'Verify 2-Factor Authentication is enabled on your email account',
        'Make sure the App Password is 16 characters without spaces'
      ];
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to email server';
      troubleshooting = [
        'Check your internet connection',
        'Verify EMAIL_SERVICE setting (gmail, outlook, yahoo, etc.)',
        'Ensure firewall is not blocking SMTP connections',
        'Try using a different email service provider'
      ];
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: err.message,
      code: err.code || 'UNKNOWN',
      troubleshooting: troubleshooting,
      configured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS
    });
  }
});

// Email Configuration Status Route
app.get('/api/email-status', (req, res) => {
  try {
    const emailConfigured = !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS;
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    
    res.json({
      success: true,
      configured: emailConfigured,
      emailService: emailService,
      fromAddress: emailConfigured ? process.env.EMAIL_USER : 'Not configured',
      status: emailConfigured ? 'Ready' : 'Needs configuration',
      message: emailConfigured ? 
        'Email notification system is properly configured and ready to send emails.' : 
        'Email system requires configuration. Please set EMAIL_USER and EMAIL_PASS environment variables.'
    });
  } catch (err) {
    console.error('Error checking email status:', err);
    res.status(500).json({
      success: false,
      message: 'Error checking email configuration status',
      error: err.message
    });
  }
});

// SMS Verification and Test Route
app.post('/api/test-sms', async (req, res) => {
  try {
    const { testPhone } = req.body;
    
    if (!testPhone) {
      return res.status(400).json({
        success: false,
        message: 'Test phone number is required'
      });
    }
    
    // Phone number validation (basic international format)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(testPhone.replace(/[\s\-\(\)]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }
    
    // Check if SMS configuration is available
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      return res.status(503).json({
        success: false,
        message: 'SMS service not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
        configured: false
      });
    }
    
    // Send test SMS
    const testSMSData = {
      body: `🧪 HealthConnect+ SMS Test - Configuration Verified\n\nHi there! This is a test message from your HealthConnect+ system.\n\n✅ Your SMS notification system is working properly!\n\nYour patients will now receive instant SMS confirmations for:\n• Appointment bookings\n• Online consultation scheduling\n• Important health reminders\n\n📞 Support: (555) 123-4567\n\nTimestamp: ${new Date().toLocaleString()}\n\n© 2025 HealthConnect+`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhone
    };
    
    const smsResult = await sendSMSNotification(testSMSData, 'test');
    
    if (smsResult.success) {
      res.json({
        success: true,
        message: `Test SMS sent successfully to ${testPhone}`,
        configured: true,
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...',
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        messageSid: smsResult.sid,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to send test SMS to ${testPhone}`,
        error: smsResult.error,
        configured: true
      });
    }
    
  } catch (err) {
    console.error('SMS test failed:', err);
    
    let errorMessage = 'Failed to send test SMS';
    let troubleshooting = [];
    
    if (err.code === 20003) {
      errorMessage = 'SMS authentication failed';
      troubleshooting = [
        'Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables',
        'Verify your Twilio account credentials are correct',
        'Ensure your Twilio account is active and has sufficient credits',
        'Check that your account has SMS sending permissions'
      ];
    } else if (err.code === 21211) {
      errorMessage = 'Invalid phone number';
      troubleshooting = [
        'Ensure the phone number is in correct international format',
        'Include country code (e.g., +1 for US numbers)',
        'Verify the phone number is a valid mobile number',
        'Check that the number can receive SMS messages'
      ];
    } else if (err.code === 21608) {
      errorMessage = 'Twilio phone number not configured properly';
      troubleshooting = [
        'Check your TWILIO_PHONE_NUMBER environment variable',
        'Ensure the phone number is verified in your Twilio account',
        'Verify the phone number has SMS capabilities',
        'Make sure the phone number format includes country code'
      ];
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: err.message,
      code: err.code || 'UNKNOWN',
      troubleshooting: troubleshooting,
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
    });
  }
});

// SMS Configuration Status Route
app.get('/api/sms-status', (req, res) => {
  try {
    const smsConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
    
    res.json({
      success: true,
      configured: smsConfigured,
      twilioAccountSid: smsConfigured ? process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...' : 'Not configured',
      fromNumber: smsConfigured ? process.env.TWILIO_PHONE_NUMBER : 'Not configured',
      status: smsConfigured ? 'Ready' : 'Needs configuration',
      message: smsConfigured ? 
        'SMS notification system is properly configured and ready to send messages.' : 
        'SMS system requires configuration. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.'
    });
  } catch (err) {
    console.error('Error checking SMS status:', err);
    res.status(500).json({
      success: false,
      message: 'Error checking SMS configuration status',
      error: err.message
    });
  }
});

// AI Chatbot API Route
app.post('/api/chatbot', (req, res) => {
  try {
    const { message } = req.body;
    const lowerMessage = message.toLowerCase();
    
    let response = "I'm here to help with your health-related questions. How can I assist you today?";
    
    // Enhanced AI-like responses based on keywords
    const responses = {
      // Greetings
      'hello|hi|hey|good morning|good afternoon|good evening': [
        "Hello! Welcome to HealthConnect+. How can I assist you with your health needs today?",
        "Hi there! I'm your virtual health assistant. What can I help you with?",
        "Good day! I'm here to help with appointments, symptoms, or any health questions."
      ],
      
      // Appointments
      'appointment|book|schedule|doctor|consultation': [
        "I can help you book an appointment! You can visit our 'Book Appointment' page or tell me what type of specialist you need.",
        "To schedule an appointment, I'll need to know: preferred date, time, and which doctor you'd like to see. Would you like me to guide you through the booking process?",
        "Our doctors are available for consultations. What type of medical concern do you have? I can recommend the right specialist."
      ],
      
      // Symptoms and Health
      'symptoms|pain|fever|headache|cough|sick|illness|hurt': [
        "I understand you're experiencing symptoms. While I can provide general information, it's important to consult with a healthcare professional for proper diagnosis. Would you like to book an appointment?",
        "For any concerning symptoms, I recommend speaking with one of our doctors. Our symptom checker on the homepage can provide initial guidance, but professional medical advice is always best.",
        "Health symptoms should be evaluated by a medical professional. I can help you book an urgent appointment or direct you to our emergency services if needed."
      ],
      
      // Emergency
      'emergency|urgent|ambulance|911|critical|serious': [
        "🚨 For medical emergencies, please call 911 immediately or go to your nearest emergency room. For urgent but non-emergency care, you can call our hospital at +1 (555) 123-4567.",
        "If this is a medical emergency, please call 911 right away. For urgent consultations, I can help you book a same-day appointment with our on-call doctors."
      ],
      
      // Hospital Information
      'location|address|hours|contact|phone|where': [
        "📍 HealthConnect+ Medical Center is located at:\n123 Wellness Street, Medical District, Health City, HC 12345\n📞 Phone: +1 (555) 123-4567\n🕒 Hours: Mon-Sat 8AM-8PM, Sun 9AM-5PM",
        "You can find us at 123 Wellness Street in the Medical District. We're open Mon-Sat 8AM-8PM and Sunday 9AM-5PM. Call us at +1 (555) 123-4567 for any questions!"
      ],
      
      // Services
      'services|treatment|specialties|departments': [
        "We offer comprehensive healthcare services including: General Medicine, Cardiology, Pediatrics, Orthopedics, Dermatology, Mental Health, and Emergency Care. Which specialty interests you?",
        "Our medical center provides full-service healthcare with specialized departments. I can help you find the right doctor for your specific needs. What type of care are you looking for?"
      ],
      
      // Insurance and Billing
      'insurance|cost|payment|billing|price': [
        "We accept most major insurance plans. For specific coverage questions, please call our billing department at +1 (555) 123-4567 ext. 2. Our staff can verify your benefits before your appointment.",
        "Payment options include insurance, cash, and payment plans. Our financial counselors can discuss costs and help with insurance verification when you book your appointment."
      ]
    };
    
    // Find matching response
    for (const [keywords, responseList] of Object.entries(responses)) {
      const keywordRegex = new RegExp(keywords, 'i');
      if (keywordRegex.test(lowerMessage)) {
        response = responseList[Math.floor(Math.random() * responseList.length)];
        break;
      }
    }
    
    // Add helpful follow-up suggestions
    const suggestions = [
      "Would you like to book an appointment?",
      "Need help finding a specific doctor?",
      "Want to check our available time slots?",
      "Looking for our contact information?"
    ];
    
    res.json({ 
      response: response,
      suggestions: Math.random() > 0.5 ? [suggestions[Math.floor(Math.random() * suggestions.length)]] : [],
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Chatbot error:', err);
    res.status(500).json({ 
      response: "I'm sorry, I'm having trouble processing your request right now. Please try again or contact our support team.",
      error: true
    });
  }
});

// Start Server - AWS Deployment Ready
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 Server accessible at: http://13.233.255.20/:${PORT}`);
  console.log(`📋 API endpoints:`);
  console.log(`   - GET /api/user - Check user session`);
  console.log(`   - POST /login - User login`);
  console.log(`   - POST /logout - User logout`);
  console.log(`   - GET /book - Book appointment`);
  console.log(`   - POST /api/book-consultation - Book online consultation (max ₹${CONSULTATION_CONFIG.MAX_AMOUNT})`);
  console.log(`   - GET /api/consultation-config - Get pricing configuration`);
  console.log(`   - POST /api/medical-reports - Access medical reports`);
  console.log(`   - GET /api/email-status - Check email configuration status`);
  console.log(`   - POST /api/test-email - Send test email to verify configuration`);
  console.log(`   - GET /api/sms-status - Check SMS configuration status`);
  console.log(`   - POST /api/test-sms - Send test SMS to verify configuration`);
  console.log(`   - POST /api/chatbot - AI chatbot interactions`);
  console.log(`🛡️ Consultation amount limit: ₹${CONSULTATION_CONFIG.MAX_AMOUNT}`);
  console.log(`📧 Email status: ${process.env.EMAIL_USER ? 'Configured ✅' : 'Needs setup ⚠️'}`);
  console.log(`📱 SMS status: ${(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) ? 'Configured ✅' : 'Needs setup ⚠️'}`);
});
