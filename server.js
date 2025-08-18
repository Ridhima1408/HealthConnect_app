// server.js (Node + Express Backend)
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2');
const app = express();
const fs = require("fs");
const mongoose = require('mongoose');
 
mongoose.connect('mongodb://localhost:27017/healthconnect');
mongoose.connection
.then(() => console.log('MongoDB Connected'))
.catch((err) => console.error('MongoDB connection error:', err));
// Middleware
/*app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
console.log(path.join(__dirname, '../public'));
app.use(
  session({
    secret: 'healthconnect_secret',
    resave: false,
    saveUninitialized: true,
  })
);*/

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Path to JSON file
const usersFile = path.join(__dirname, "users.json");

// 1. Define User schema and model for MongoDB
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// 2. Define Appointment schema and model for MongoDB
const appointmentSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  email:  { type: String, required: true },
  date:   { type: String, required: true },
  doctor: { type: String, required: true }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Register route
app.post("/register", async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.send("<h2>Passwords do not match. Please go back and try again.</h2>");
    }

    // Check if user exists in MongoDB
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
        return res.send("<h2>User already exists. Please choose another username/email.</h2>");
    }

    // Save user to MongoDB
    const newUser = new User({ username, email, password });
    await newUser.save();

    // (Optional) Also save to JSON file for legacy support
    let users = [];
    if (fs.existsSync(usersFile)) {
        const data = fs.readFileSync(usersFile, "utf-8");
        if (data) {
            users = JSON.parse(data);
        }
    }
    users.push({ username, email, password });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

    // Redirect to login page after successful signup
    res.redirect("/login.html");
});


// MySQL Connection


// Login Route
/*app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (results.length > 0) {
        req.session.user = results[0];
        res.redirect('C://Users//ridsolet//Desktop//healthconnect//public//html//dashboard.html');
      } else {
        res.send('Login Failed');
      }
    }
  );
});*/

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Read stored users
    let users = [];
    if (fs.existsSync(usersFile)) {
        const data = fs.readFileSync(usersFile, "utf-8");
        if (data) {
            users = JSON.parse(data);
        }
    }

    // Find matching user
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // Redirect to homepage
        res.redirect("/index.html");
    } else {
        res.send("<h2>Invalid username or password. <a href='/login.html'>Try again</a></h2>");
    }
});

// Book Appointment Route
app.post("/book", async (req, res) => {
    const { name, email, date, doctor } = req.body;

    // Save appointment to MongoDB
    const newAppointment = new Appointment({ name, email, date, doctor });
    await newAppointment.save();

    // Redirect or send confirmation
    res.send("<h2>Appointment booked successfully! <a href='/index.html'>Go Home</a></h2>");
});

// Default Route
app.get('/', (req, res) => {
  res.sendFile(path.join("C://Users//ridsolet//Desktop//healthconnect//public//html//index.html"));
});

app.get('/test', (req, res) => {
  res.send('Express is connected!');
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
