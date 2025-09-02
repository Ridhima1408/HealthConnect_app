// MongoDB initialization script for HealthConnect+
// This script runs when MongoDB container starts for the first time

print('Starting HealthConnect+ MongoDB initialization...');

// Switch to admin database
db = db.getSiblingDB('admin');

// Create the healthconnect database
db = db.getSiblingDB('healthconnect');

// Create a user for the healthconnect database
db.createUser({
  user: 'admin',
  pwd: 'HealthConnect2025!',
  roles: [
    {
      role: 'readWrite',
      db: 'healthconnect'
    },
    {
      role: 'dbAdmin',
      db: 'healthconnect'
    }
  ]
});

// Create some initial collections with indexes
db.createCollection('appointments');
db.createCollection('consultations');
db.createCollection('users');

// Create indexes for better performance
db.appointments.createIndex({ "email": 1 });
db.appointments.createIndex({ "date": 1 });
db.consultations.createIndex({ "email": 1 });
db.consultations.createIndex({ "createdAt": 1 });
db.users.createIndex({ "email": 1 });

print('HealthConnect+ MongoDB initialization completed successfully!');
