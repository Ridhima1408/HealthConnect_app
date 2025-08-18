const mysql = require('mysql2');
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'healthconnect',
});
db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});
module.exports = db;
const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/healthconnect", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected via Docker"))
.catch(err => console.error("❌ MongoDB connection error:", err));

