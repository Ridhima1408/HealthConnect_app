// db.js
const mongoose = require("mongoose");

// MongoDB connection with better timeout settings
const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb://127.0.0.1:27017/healthconnect", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      bufferMaxEntries: 0, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionRetryDelayMS: 5000, // Retry every 5 seconds
      heartbeatFrequencyMS: 10000 // Send a ping every 10 seconds
    });
    
    console.log("✅ MongoDB connected successfully");
    console.log(`📍 Connected to: ${conn.connection.host}:${conn.connection.port}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("🔍 Check if MongoDB is running on your server with: sudo systemctl status mongod");
    process.exit(1);
  }
};

// Handle connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

connectDB();

module.exports = mongoose;
    