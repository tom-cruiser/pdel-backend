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
      console.log('[GalleryService] ID type:', typeof id);
      console.log('[GalleryService] ID value:', JSON.stringify(id));
      
      // List all images to compare
      const allImages = await gallery_images.find({}).limit(3).toArray();
      console.log('[GalleryService] Sample _ids in database:');
      allImages.forEach((img, idx) => {
        console.log(`  [${idx}] _id:`, img._id, 'type:', typeof img._id, 'match:', img._id === id);
      });
      
      // First, check if the image exists
      const existing = await gallery_images.findOne({ _id: id });
      console.log('[GalleryService] Existing image found:', existing ? 'YES' : 'NO');
      
      if (!existing) {
        console.log('[GalleryService] Image does not exist in database');
        return null;
      }
      
      // The id passed from frontend is actually the _id in MongoDB
      const res = await gallery_images.findOneAndDelete({ _id: id });
      
      console.log('[GalleryService] Delete operation completed');
      console.log('[GalleryService] Delete result.ok:', res.ok);
      console.log('[GalleryService] Delete result.value:', res.value ? 'FOUND' : 'NULL');
      
      if (res.value) {
        console.log('[GalleryService] Successfully deleted image');
        
        // TODO: Also delete from ImageKit if needed
        // Extract fileId from image_url and delete from ImageKit
        
        return { ...res.value, id: res.value._id };
      }
      
      console.log('[GalleryService] Delete failed - no value returned');
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
