const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB connection
require('./db');

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
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
      res.redirect("/index.html");
    } else {
      res.send("<h2>Invalid username or password. <a href='/login.html'>Try again</a></h2>");
    }
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Book Appointment
app.post("/book", async (req, res) => {
  try {
    const { name, email, date, doctor } = req.body;

    const newAppointment = new Appointment({ name, email, date, doctor });
    await newAppointment.save();

    res.send("<h2>Appointment booked successfully! <a href='/index.html'>Go Home</a></h2>");
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

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
