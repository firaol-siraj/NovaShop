import express from 'express';
import multer from 'multer';
import {
  getAdminMediaList,
  getAdminMediaStats,
  uploadAdminMedia,
  getMediaFolders,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  getMediaFileUsage,
  updateMediaFile,
  deleteMediaFile,
  bulkMediaActions,
  recomputeUsageEndpoint,
} from '../controllers/adminMediaController.js';

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB buffer limit per file
});

const router = express.Router();

// Stats
router.get('/stats', getAdminMediaStats);

// Folders
router.route('/folders')
  .get(getMediaFolders)
  .post(createMediaFolder);

router.route('/folders/:id')
  .put(updateMediaFolder)
  .patch(updateMediaFolder)
  .delete(deleteMediaFolder);

// Usage recompute
router.post('/recompute-usage', recomputeUsageEndpoint);

// Bulk actions
router.post('/bulk', bulkMediaActions);

// Upload multiple
router.post('/upload', uploadMemory.array('files', 20), uploadAdminMedia);

// Single file operations
router.route('/:id')
  .patch(updateMediaFile)
  .delete(deleteMediaFile);

router.get('/:id/usage', getMediaFileUsage);

// Main list
router.get('/', getAdminMediaList);

export default router;
