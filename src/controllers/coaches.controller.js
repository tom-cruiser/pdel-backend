const coachesService = require('../services/coaches.service');
const { formatResponse } = require('../utils/helpers');

const coachesController = {
  async list(req, res, next) {
    try {
      const docs = await coachesService.getAllCoaches();
      res.json(formatResponse(true, docs));
    } catch (err) {
      next(err);
    }
  }
};

module.exports = coachesController;
