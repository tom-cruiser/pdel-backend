const mongo = require('../db/mongo');

class CoachesService {
  async ensureConnected() {
    await mongo.connect();
    const { coaches } = mongo.getCollections();
    return coaches;
  }

  async getAllCoaches() {
    const coaches = await this.ensureConnected();
    const docs = await coaches.find({}).toArray();
    if (!docs || docs.length === 0) {
      // Seed with sensible defaults so frontend can fetch coaches instead
      // of hardcoding them. IDs match the frontend placeholder values.
      const defaults = [
        { _id: 'c1', name: 'Mutika', created_at: new Date() },
        { _id: 'c2', name: 'Seif', created_at: new Date() },
        { _id: 'c3', name: 'Abdullah', created_at: new Date() },
        { _id: 'c4', name: 'Malick', created_at: new Date() },
      ];
      try {
        await coaches.insertMany(defaults);
        return defaults;
      } catch (e) {
        // If insertion fails (race condition or permissions), return empty list
        return docs;
      }
    }
    return docs;
  }

  async getCoachById(id) {
    const coaches = await this.ensureConnected();
    return coaches.findOne({ _id: id });
  }

  async createIfMissing(id, name) {
    const coaches = await this.ensureConnected();
    const existing = await coaches.findOne({ _id: id });
    if (existing) return existing;
    const doc = { _id: id, name: name || null, created_at: new Date() };
    await coaches.insertOne(doc);
    return doc;
  }
}

module.exports = new CoachesService();
