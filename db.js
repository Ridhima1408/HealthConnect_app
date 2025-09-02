// db.js
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,                 // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 30000, // Timeout after 30s if server not found
      socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
      heartbeatFrequencyMS: 10000,     // Ping MongoDB every 10s
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`📍 Connected to: ${conn.connection.host}:${conn.connection.port}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("🔍 Check if MongoDB is running: sudo systemctl status mongod");
    console.warn("⚠️ Continuing without MongoDB - some features will be limited");
    // Don't exit - let the app run without database for demo
  }
};

// Handle runtime events
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

module.exports = connectDB;
