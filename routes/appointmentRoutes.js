const express = require('express');
const router = express.Router();
const { bookAppointment } = require('../controllers/appointmentController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/book', bookAppointment);

module.exports = router;
