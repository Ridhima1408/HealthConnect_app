// MongoDB Initialization Script for HealthConnect+
// This script runs when the MongoDB container starts for the first time

print('🚀 Initializing HealthConnect+ Database...');

// Switch to the healthconnect database
db = db.getSiblingDB('healthconnect');

// Create collections with validation schemas
print('📋 Creating collections with validation...');

// Users collection
db.createCollection("users", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["username", "email", "password", "createdAt"],
         properties: {
            username: {
               bsonType: "string",
               description: "Username is required and must be a string"
            },
            email: {
               bsonType: "string",
               pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
               description: "Email must be a valid email address"
            },
            password: {
               bsonType: "string",
               description: "Password is required"
            },
            role: {
               enum: ["user", "doctor", "admin"],
               description: "Role must be one of: user, doctor, admin"
            },
            isActive: {
               bsonType: "bool",
               description: "Active status must be boolean"
            },
            createdAt: {
               bsonType: "date",
               description: "Creation date is required"
            }
         }
      }
   }
});

// Appointments collection
db.createCollection("appointments", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["patientName", "email", "phone", "doctor", "date", "time", "createdAt"],
         properties: {
            patientName: {
               bsonType: "string",
               description: "Patient name is required"
            },
            email: {
               bsonType: "string",
               pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            },
            phone: {
               bsonType: "string",
               description: "Phone number is required"
            },
            doctor: {
               bsonType: "string",
               description: "Doctor selection is required"
            },
            date: {
               bsonType: "string",
               description: "Appointment date is required"
            },
            time: {
               bsonType: "string",
               description: "Appointment time is required"
            },
            status: {
               enum: ["scheduled", "completed", "cancelled", "no-show"],
               description: "Status must be valid appointment status"
            }
         }
      }
   }
});

// Consultations collection
db.createCollection("consultations", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["patientName", "email", "consultationType", "healthConcern", "createdAt"],
         properties: {
            patientName: {
               bsonType: "string",
               description: "Patient name is required"
            },
            email: {
               bsonType: "string",
               pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            },
            consultationType: {
               enum: ["instant", "scheduled", "emergency"],
               description: "Consultation type must be valid"
            },
            amount: {
               bsonType: "number",
               minimum: 299,
               maximum: 1000,
               description: "Amount must be between 299 and 1000"
            },
            status: {
               enum: ["pending", "in-progress", "completed", "cancelled"],
               description: "Status must be valid consultation status"
            }
         }
      }
   }
});

// Medical Reports collection
db.createCollection("medicalReports", {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["patientName", "email", "title", "type", "date", "createdAt"],
         properties: {
            patientName: {
               bsonType: "string",
               description: "Patient name is required"
            },
            email: {
               bsonType: "string",
               pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            },
            title: {
               bsonType: "string",
               description: "Report title is required"
            },
            type: {
               enum: ["lab", "xray", "prescription", "consultation", "surgery", "general"],
               description: "Report type must be valid"
            }
         }
      }
   }
});

// Create indexes for better performance
print('🔍 Creating database indexes...');

// Users indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "createdAt": 1 });

// Appointments indexes
db.appointments.createIndex({ "email": 1 });
db.appointments.createIndex({ "date": 1, "time": 1 });
db.appointments.createIndex({ "createdAt": 1 });
db.appointments.createIndex({ "status": 1 });

// Consultations indexes
db.consultations.createIndex({ "email": 1 });
db.consultations.createIndex({ "consultationType": 1 });
db.consultations.createIndex({ "createdAt": 1 });
db.consultations.createIndex({ "status": 1 });

// Medical Reports indexes
db.medicalReports.createIndex({ "email": 1 });
db.medicalReports.createIndex({ "patientName": 1 });
db.medicalReports.createIndex({ "type": 1 });
db.medicalReports.createIndex({ "date": 1 });

// Insert sample data for testing
print('📊 Inserting sample data...');

// Sample doctors data
db.doctors.insertMany([
   {
      name: "Dr. Aditi Sharma",
      speciality: "Cardiologist",
      experience: "15+ years",
      image: "/doc2.jpg",
      description: "Expert in treating heart diseases and preventive cardiology.",
      available: true,
      createdAt: new Date()
   },
   {
      name: "Dr. Ravi Kumar",
      speciality: "Dermatologist", 
      experience: "12+ years",
      image: "/doc1.jpg",
      description: "Specializes in skin care, acne treatments, and cosmetic dermatology.",
      available: true,
      createdAt: new Date()
   },
   {
      name: "Dr. Sneha Iyer",
      speciality: "Pediatrician",
      experience: "10+ years", 
      image: "/doc3.jpg",
      description: "Dedicated to child healthcare and preventive pediatrics.",
      available: true,
      createdAt: new Date()
   }
]);

// Sample medical reports for demo
db.medicalReports.insertMany([
   {
      patientName: "John Doe",
      email: "john.doe@example.com",
      title: "Blood Test Results",
      type: "lab",
      date: new Date(),
      content: "<h3>Complete Blood Count</h3><p>All values within normal range.</p>",
      createdAt: new Date()
   },
   {
      patientName: "Jane Smith", 
      email: "jane.smith@example.com",
      title: "Chest X-Ray Report",
      type: "xray",
      date: new Date(),
      content: "<h3>Chest X-Ray</h3><p>Clear lungs, no abnormalities detected.</p>",
      createdAt: new Date()
   }
]);

// Create admin user
print('👤 Creating admin user...');
db.users.insertOne({
   username: "admin",
   email: "admin@healthconnect.com",
   password: "$2b$10$YourHashedPasswordHere", // You should hash this properly
   role: "admin",
   isActive: true,
   createdAt: new Date(),
   lastLogin: null
});

// Create application configuration
print('⚙️ Setting up application configuration...');
db.config.insertOne({
   name: "healthconnect-config",
   version: "1.0.0",
   features: {
      appointments: true,
      consultations: true,
      medicalReports: true,
      aiChatbot: true,
      notifications: {
         email: true,
         sms: true
      }
   },
   limits: {
      maxConsultationAmount: 1000,
      appointmentSlotsPerDay: 50,
      maxReportsPerUser: 100
   },
   createdAt: new Date(),
   updatedAt: new Date()
});

print('✅ HealthConnect+ Database initialization completed successfully!');
print('📈 Collections created: users, appointments, consultations, medicalReports, doctors, config');
print('🔐 Indexes created for optimal performance');
print('📋 Sample data inserted for testing');
print('🎉 Database is ready for use!');
