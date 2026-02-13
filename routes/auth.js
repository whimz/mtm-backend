const express = require("express");
const router = express.Router();
const { register, login, checkAuth, logout } = require("../controllers/authController");

router.post('/register', register);
router.post('/login', login);
router.get('/me', checkAuth);
router.post('/logout', logout);

module.exports = { router };