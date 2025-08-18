const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  email:  { type: String, required: true },
  date:   { type: String, required: true },
  doctor: { type: String, required: true }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
