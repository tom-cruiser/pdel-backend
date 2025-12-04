const express = require('express');
const coachesController = require('../controllers/coaches.controller');

const publicRouter = express.Router();
publicRouter.get('/', coachesController.list);

module.exports = { publicRouter };
