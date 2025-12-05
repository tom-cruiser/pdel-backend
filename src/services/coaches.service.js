const mongo = require('../db/mongo');

class CoachesService {
  async ensureConnected() {
    await mongo.connect();
    const { coaches } = mongo.getCollections();
    return coaches;
  }

  async getAllCoaches() {
    const coaches = await this.ensureConnected();
    return coaches.find({}).toArray();
  }

  async getCoachById(id) {
    const coaches = await this.ensureConnected();
    return coaches.findOne({ _id: id });
  }

  async createIfMissing(id, name) {
    const coaches = await this.ensureConnected();
    const existing = await coaches.findOne({ _id: id });
    if (existing) return existing;
    const doc = {
      _id: id,
      name: name || `Coach ${id}`,
      created_at: new Date(),
    };
    await coaches.insertOne(doc);
    return doc;
  }
}

module.exports = new CoachesService();
