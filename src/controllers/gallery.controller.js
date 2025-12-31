const galleryService = require("../services/gallery.service");
const imagekitService = require("../services/imagekit.service");
const { formatResponse } = require("../utils/helpers");

const galleryController = {
  async getAllImages(req, res, next) {
    try {
      const images = await galleryService.getAllImages();
      res.json(formatResponse(true, images));
    } catch (error) {
      next(error);
    }
  },

  async getImageById(req, res, next) {
    try {
      const image = await galleryService.getImageById(req.params.id);
      if (!image) {
        return res
          .status(404)
          .json(formatResponse(false, null, "Image not found"));
      }
      res.json(formatResponse(true, image));
    } catch (error) {
      next(error);
    }
  },

  async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json(formatResponse(false, null, "No image file provided"));
      }

      const image = await galleryService.uploadAndCreateImage(
        req.file,
        req.body,
        req.profile.id
      );

      res
        .status(201)
        .json(formatResponse(true, image, "Image uploaded successfully"));
    } catch (error) {
      next(error);
    }
  },

  async updateImage(req, res, next) {
    try {
      const image = await galleryService.updateImage(req.params.id, req.body);
      if (!image) {
        return res
          .status(404)
          .json(formatResponse(false, null, "Image not found"));
      }
      res.json(formatResponse(true, image, "Image updated successfully"));
    } catch (error) {
      next(error);
    }
  },

  async deleteImage(req, res, next) {
    try {
      console.log('[GalleryController] Delete request for image id:', req.params.id);
      console.log('[GalleryController] User:', req.user?.email);
      
      const image = await galleryService.deleteImage(req.params.id);
      
      if (!image) {
        console.log('[GalleryController] Image not found, returning 404');
        return res
          .status(404)
          .json(formatResponse(false, null, "Image not found"));
      }
      
      console.log('[GalleryController] Image deleted successfully');
      res.json(formatResponse(true, null, "Image deleted successfully"));
    } catch (error) {
      console.error('[GalleryController] Error deleting image:', error);
      next(error);
    }
  },

  async getAuthParameters(req, res, next) {
    try {
      const authParams = imagekitService.getAuthParameters();
      res.json(formatResponse(true, authParams));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = galleryController;
