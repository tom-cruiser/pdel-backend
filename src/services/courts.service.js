const mongo = require("../db/mongo");

class CourtsService {
  async ensureConnected() {
    await mongo.connect();
    const { courts } = mongo.getCollections();
    return courts;
  }

  async getAllCourts(activeOnly = true) {
    const courts = await this.ensureConnected();
    const filter = activeOnly ? { is_active: true } : {};
    return courts.find(filter).sort({ name: 1 }).toArray();
  }

  async getCourtById(id) {
    const courts = await this.ensureConnected();
    return courts.findOne({ _id: id });
  }

  async createCourt(courtData) {
    const courts = await this.ensureConnected();
    const doc = {
      _id: courtData.id || require('crypto').randomUUID(),
      name: courtData.name,
      color: courtData.color,
      description: courtData.description,
      is_active: courtData.is_active !== false,
      created_at: new Date(),
    };
    await courts.insertOne(doc);
    return doc;
  }

  async updateCourt(id, courtData) {
    const courts = await this.ensureConnected();
    const updateDoc = {
      ...(courtData.name !== undefined && { name: courtData.name }),
      ...(courtData.color !== undefined && { color: courtData.color }),
      ...(courtData.description !== undefined && { description: courtData.description }),
      ...(courtData.is_active !== undefined && { is_active: courtData.is_active }),
      updated_at: new Date(),
    };
    const res = await courts.findOneAndUpdate(
      { _id: id },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    return res.value;
  }

  async deleteCourt(id) {
    const courts = await this.ensureConnected();
    return courts.findOneAndDelete({ _id: id }).then(r => r.value);
  }
}

module.exports = new CourtsService();
