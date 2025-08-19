const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/healthconnect')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ MongoDB connection
require('./db');

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
  date:   { type: String, required: true },
  doctor: { type: String, required: true }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

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
app.get("/api/user", async (req, res) => {
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

// Book Appointment using query parameters (no request body)
app.get("/book", async (req, res) => {
  try {
    // Get data from query parameters instead of request body
    const { name, email, date, doctor } = req.query;

    // Validate required fields
    if (!name || !email || !date || !doctor) {
      return res.status(400).send("<h2>Bad Request: Missing required appointment details (name, email, date, doctor)</h2>");
    }

    const newAppointment = new Appointment({ name, email, date, doctor });
    await newAppointment.save();

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
  res.sendFile(path.join(__dirname, "public", "html", "index.html"));
});

// Test Route
app.get('/test', (req, res) => {
  res.send('Express is connected!');
});

// Start Server - AWS Deployment Ready
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 Server accessible at: http://65.2.74.240:${PORT}`);
  console.log(`📋 API endpoints:`);
  console.log(`   - GET /api/user - Check user session`);
  console.log(`   - POST /login - User login`);
  console.log(`   - POST /logout - User logout`);
  console.log(`   - GET /book - Book appointment`);
});
