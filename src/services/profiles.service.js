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
      email: (data.email || '').toLowerCase(),
      full_name: data.full_name || null,
      phone: data.phone || null,
      is_admin: data.is_admin || false,
      password_hash: data.password_hash || null,
      email_confirm_token: data.email_confirm_token || null,
      email_confirmed: data.email_confirmed !== undefined ? data.email_confirmed : false,
      password_reset_token: data.password_reset_token || null,
      password_reset_expires: data.password_reset_expires || null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    await profiles.insertOne(doc);
    return doc;
  }

  async updateProfile(userId, updates) {
    const profiles = await this.ensureConnected();
    
    // Allow updating a controlled set of fields
    const allowed = [
      'full_name',
      'phone',
      'password_hash',
      'email_confirmed',
      'email_confirm_token',
      'password_reset_token',
      'password_reset_expires',
    ];
    
    const updateDoc = { updated_at: new Date() };
    
    for (const k of allowed) {
      if (updates[k] !== undefined) {
        updateDoc[k] = updates[k];
      }
    }
    
    const res = await profiles.findOneAndUpdate(
      { _id: userId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    
    return res.value;
  }

  async getAllProfiles() {
    const profiles = await this.ensureConnected();
    return profiles.find({}).sort({ created_at: -1 }).toArray();
  }

  async getProfileByResetToken(token) {
    const profiles = await this.ensureConnected();
    return profiles.findOne({ 
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() } // Check expiration
    });
  }

  async getProfileByConfirmToken(token) {
    const profiles = await this.ensureConnected();
    return profiles.findOne({ email_confirm_token: token });
  }

  async profileExists(email) {
    const profiles = await this.ensureConnected();
    const count = await profiles.countDocuments({ email: email.toLowerCase() });
    return count > 0;
  }
}

module.exports = new ProfilesService();
