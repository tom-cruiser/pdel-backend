const imagekitService = require("./imagekit.service");
const mongo = require("../db/mongo");
const config = require('../config');
let pool;
if (!config.MONGODB_URI) {
  pool = require('../db').pool;
}

class GalleryService {
  async getAllImages() {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { gallery_images } = mongo.getCollections();
      const images = await gallery_images.find({}).sort({ created_at: -1 }).toArray();
      // Map _id to id for frontend compatibility
      return images.map(img => ({ ...img, id: img._id }));
    }

    const result = await pool.query(
      "SELECT * FROM gallery_images ORDER BY created_at DESC"
    );
    return result.rows;
  }

  async createImage(imageData) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { gallery_images } = mongo.getCollections();
      const doc = {
        _id: require('crypto').randomUUID(),
        title: imageData.title,
        description: imageData.description,
        image_url: imageData.image_url,
        uploaded_by: imageData.uploaded_by,
        created_at: new Date(),
      };
      await gallery_images.insertOne(doc);
      // Return with id field for frontend compatibility
      return { ...doc, id: doc._id };
    }

    const result = await pool.query(
      `INSERT INTO gallery_images (title, description, image_url, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        imageData.title,
        imageData.description,
        imageData.image_url,
        imageData.uploaded_by,
      ]
    );
    return result.rows[0];
  }

  async uploadAndCreateImage(file, imageData, uploadedBy) {
    const uploadResult = await imagekitService.uploadImage(
      file.buffer,
      file.originalname,
      "/court-booking/gallery"
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error);
    }

    return this.createImage({
      ...imageData,
      image_url: uploadResult.data.url,
      uploaded_by: uploadedBy,
    });
  }

  async deleteImage(id) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { gallery_images } = mongo.getCollections();
      
      console.log('[GalleryService] Attempting to delete image with id:', id);
      
      // The id passed from frontend is actually the _id in MongoDB
      // MongoDB _id can be either string or ObjectId, try both
      const res = await gallery_images.findOneAndDelete({ _id: id });
      
      console.log('[GalleryService] Delete result:', res);
      
      if (res.value) {
        console.log('[GalleryService] Successfully deleted image');
        return { ...res.value, id: res.value._id };
      }
      
      console.log('[GalleryService] Image not found for id:', id);
      return null;
    }

    const result = await pool.query(
      "DELETE FROM gallery_images WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }

  async updateImage(id, updates) {
    if (process.env.MONGODB_URI) {
      await mongo.connect();
      const { gallery_images } = mongo.getCollections();
      const updateDoc = {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        updated_at: new Date(),
      };
      const res = await gallery_images.findOneAndUpdate(
        { _id: id },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );
      return res.value;
    }

    const result = await pool.query(
      `UPDATE gallery_images 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [updates.title, updates.description, id]
    );
    return result.rows[0];
  }
}

module.exports = new GalleryService();
