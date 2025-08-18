const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB connection
mongoose.connect("mongodb://localhost:27017/healthconnect", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// -------------------- ROUTES -------------------- //

// Register
app.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.send("<h2>Passwords do not match.</h2>");
    }
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.send("<h2>User already exists.</h2>");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.redirect("/login.html");
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.send("<h2>User not found.</h2>");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.send("<h2>Invalid password.</h2>");

    res.send(`<h2>Welcome, ${user.username}!</h2>`);
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
    res.send("<h2>Appointment booked successfully!</h2>");
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Default Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "html", "index.html"));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
