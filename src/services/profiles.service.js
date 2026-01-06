const mongo = require("../db/mongo");

class ProfilesService {
  async ensureConnected() {
    await mongo.connect();
    const { profiles } = mongo.getCollections();
    return profiles;
  }

  async getProfile(userId) {
    const profiles = await this.ensureConnected();
    return profiles.findOne({ _id: userId });
  }

  async getProfileByEmail(email) {
    const profiles = await this.ensureConnected();
    return profiles.findOne({ email: email.toLowerCase() }); // Case-insensitive search
  }

  async createProfile(userId, data = {}) {
    const profiles = await this.ensureConnected();

    // Check if profile already exists
    const existing = await profiles.findOne({ _id: userId });
    if (existing) return existing;

    const doc = {
      _id: userId,
      email: (data.email || "").toLowerCase(),
      full_name: data.full_name || null,
      phone: data.phone || null,
      is_admin: data.is_admin || false,
      password_hash: data.password_hash || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await profiles.insertOne(doc);
    return doc;
  }

  async updateProfile(userId, updates) {
    const profiles = await this.ensureConnected();

    // Allow updating a controlled set of fields
    const allowed = ["full_name", "phone", "password_hash"];

    const updateDoc = { updated_at: new Date() };

    for (const k of allowed) {
      if (updates[k] !== undefined) {
        updateDoc[k] = updates[k];
      }
    }

    const res = await profiles.findOneAndUpdate(
      { _id: userId },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

    return res.value;
  }

  async getAllProfiles() {
    const profiles = await this.ensureConnected();
    return profiles.find({}).sort({ created_at: -1 }).toArray();
  }

  async profileExists(email) {
    const profiles = await this.ensureConnected();
    const count = await profiles.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }

  async updateLastLogin(userId) {
    const profiles = await this.ensureConnected();
    await profiles.updateOne(
      { _id: userId },
      { 
        $set: { 
          last_login_at: new Date(),
          updated_at: new Date()
        } 
      }
    );
  }
}

module.exports = new ProfilesService();
