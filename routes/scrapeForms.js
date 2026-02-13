const express = require("express");
const router = express.Router();
const { scrapeForms } = require('../controllers/scrapeFormsController');

router.post('/', scrapeForms);

module.exports = { router }