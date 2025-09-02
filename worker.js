console.log("✅ HealthConnect+ worker started...");

// Example background task (heartbeat log every 10s)
setInterval(() => {
  console.log(`🛠️ Worker running at ${new Date().toISOString()}`);
}, 10000);
