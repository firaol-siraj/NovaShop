import mongoose from 'mongoose';
import { MediaFile, MediaFolder } from '../models/mediaModel.js';
import {
  findMediaUsage,
  getMediaStatistics,
  recomputeAllMediaUsage,
  formatBytes,
} from '../services/mediaService.js';
import { uploadMediaBuffer } from '../services/storageService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/admin/media
 * Paginated media files list with filtering, searching, and tab counts
 */
export const getAdminMediaList = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
  const skip = (page - 1) * limit;

  const {
    search,
    kind,
    folder,
    usage,
    dateFrom,
    dateTo,
    sort = 'newest',
  } = req.query;

  const filter = { deletedAt: null };

  // Search by filename or altText
  if (search && search.trim()) {
    const cleanSearch = search.trim();
    filter.$or = [
      { originalName: { $regex: cleanSearch, $options: 'i' } },
      { altText: { $regex: cleanSearch, $options: 'i' } },
    ];
  }

  // Kind filter ('image', 'video', 'document')
  if (kind && kind !== 'All') {
    filter.kind = kind.toLowerCase();
  }

  // Folder filter
  if (folder && folder !== 'All folders') {
    if (mongoose.Types.ObjectId.isValid(folder)) {
      filter.folder = folder;
    } else {
      const folderDoc = await MediaFolder.findOne({
        name: { $regex: new RegExp(`^${folder.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (folderDoc) {
        filter.folder = folderDoc._id;
      } else {
        filter.folder = new mongoose.Types.ObjectId();
      }
    }
  }

  // Usage filter ('Used', 'Unused')
  if (usage && usage !== 'All files') {
    if (usage.toLowerCase() === 'used') {
      filter.usageCount = { $gt: 0 };
    } else if (usage.toLowerCase() === 'unused') {
      filter.usageCount = 0;
    }
  }

  // Date filters
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  // Sort direction
  let sortObj = { createdAt: -1 };
  if (sort === 'oldest') sortObj = { createdAt: 1 };
  else if (sort === 'size_desc') sortObj = { size: -1 };
  else if (sort === 'size_asc') sortObj = { size: 1 };
  else if (sort === 'name_asc') sortObj = { originalName: 1 };
  else if (sort === 'name_desc') sortObj = { originalName: -1 };

  const baseFilterForTabs = { deletedAt: null };
  if (filter.folder) {
    baseFilterForTabs.folder = filter.folder;
  }

  const [files, totalCount, stats, folderImagesCount, folderVideosCount, folderDocsCount, folderAllCount] = await Promise.all([
    MediaFile.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('folder', 'name')
      .lean(),
    MediaFile.countDocuments(filter),
    getMediaStatistics(),
    filter.folder ? MediaFile.countDocuments({ ...baseFilterForTabs, kind: 'image' }) : null,
    filter.folder ? MediaFile.countDocuments({ ...baseFilterForTabs, kind: 'video' }) : null,
    filter.folder ? MediaFile.countDocuments({ ...baseFilterForTabs, kind: 'document' }) : null,
    filter.folder ? MediaFile.countDocuments(baseFilterForTabs) : null,
  ]);

  const tabCounts = filter.folder
    ? {
        all: folderAllCount,
        image: folderImagesCount,
        video: folderVideosCount,
        document: folderDocsCount,
      }
    : stats.tabCounts;

  const formattedFiles = files.map((file) => ({
    id: String(file._id),
    _id: String(file._id),
    name: file.originalName,
    storedName: file.storedName,
    url: file.url,
    thumbnailUrl: file.thumbnailUrl || file.url,
    type: file.kind,
    mimeType: file.mimeType,
    dims: file.width && file.height ? `${file.width} × ${file.height}` : null,
    width: file.width || null,
    height: file.height || null,
    variants: file.variants || [],
    size: formatBytes(file.size),
    rawSize: file.size,
    duration: file.duration || null,
    folder: file.folder?.name || 'All folders',
    folderId: file.folder?._id || null,
    usage: file.usageCount > 0 ? 'Used' : 'Unused',
    usageCount: file.usageCount || 0,
    altText: file.altText || '',
    createdAt: file.createdAt,
    hash: file.hash,
  }));

  res.status(200).json({
    success: true,
    data: {
      files: formattedFiles,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      limit,
      tabCounts,
    },
  });
});

/**
 * GET /api/admin/media/stats
 * Real stats cards values
 */
export const getAdminMediaStats = asyncHandler(async (req, res) => {
  const stats = await getMediaStatistics();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * POST /api/admin/media/upload
 * Multiple files upload with validation, duplicate detection, and thumbnail generation
 */
export const uploadAdminMedia = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files || files.length === 0) {
    throw new ApiError(400, 'Please select at least one file to upload.');
  }

  let folderId = null;
  if (req.body.folder && req.body.folder !== 'All folders' && req.body.folder !== 'null' && req.body.folder !== 'root') {
    if (mongoose.Types.ObjectId.isValid(req.body.folder)) {
      folderId = req.body.folder;
    } else {
      let folderDoc = await MediaFolder.findOne({
        name: { $regex: new RegExp(`^${req.body.folder.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (!folderDoc) {
        folderDoc = await MediaFolder.create({ name: req.body.folder.trim() });
      }
      folderId = folderDoc._id;
    }
  }

  const uploadedResults = [];
  const errors = [];

  for (const file of files) {
    try {
      const storageResult = await uploadMediaBuffer({
        buffer: file.buffer,
        originalName: file.originalname,
      });

      // Duplicate detection
      const existingHash = await MediaFile.findOne({
        hash: storageResult.hash,
        deletedAt: null,
      }).lean();

      const mediaRecord = await MediaFile.create({
        ...storageResult,
        folder: folderId,
        uploadedBy: req.user?._id || null,
      });

      uploadedResults.push({
        id: String(mediaRecord._id),
        name: mediaRecord.originalName,
        url: mediaRecord.url,
        thumbnailUrl: mediaRecord.thumbnailUrl,
        type: mediaRecord.kind,
        size: formatBytes(mediaRecord.size),
        width: mediaRecord.width || null,
        height: mediaRecord.height || null,
        variants: mediaRecord.variants || [],
        isDuplicate: Boolean(existingHash),
        duplicateOf: existingHash ? existingHash.originalName : null,
      });
    } catch (uploadErr) {
      errors.push({
        name: file.originalname,
        error: uploadErr.message,
      });
    }
  }

  res.status(errors.length > 0 && uploadedResults.length === 0 ? 400 : 201).json({
    success: uploadedResults.length > 0,
    data: {
      uploaded: uploadedResults,
      errors,
    },
  });
});

/**
 * GET /api/admin/media/folders
 */
export const getMediaFolders = asyncHandler(async (req, res) => {
  const folders = await MediaFolder.find({}).sort({ name: 1 }).lean();

  // Aggregate active file count per folder
  const countsAgg = await MediaFile.aggregate([
    { $match: { deletedAt: null, folder: { $ne: null } } },
    { $group: { _id: '$folder', count: { $sum: 1 } } },
  ]);

  const countsMap = new Map();
  countsAgg.forEach((item) => {
    countsMap.set(String(item._id), item.count);
  });

  const foldersWithCounts = folders.map((f) => ({
    ...f,
    id: String(f._id),
    fileCount: countsMap.get(String(f._id)) || 0,
    count: countsMap.get(String(f._id)) || 0,
  }));

  res.status(200).json({
    success: true,
    data: foldersWithCounts,
  });
});

/**
 * POST /api/admin/media/folders
 */
export const createMediaFolder = asyncHandler(async (req, res) => {
  const { name, parent = null } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, 'Folder name is required.');
  }

  const cleanName = name.trim().replace(/\s+/g, ' ');
  let parentId = null;
  if (parent && mongoose.Types.ObjectId.isValid(parent)) {
    parentId = parent;
  } else if (parent && parent !== 'root' && parent !== 'null') {
    const parentDoc = await MediaFolder.findOne({
      name: { $regex: new RegExp(`^${String(parent).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (parentDoc) parentId = parentDoc._id;
  }

  const existing = await MediaFolder.findOne({
    name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    parent: parentId,
  });

  if (existing) {
    if (req.query.upsert === 'true' || req.body?.upsert === true) {
      return res.status(200).json({
        success: true,
        message: 'Folder already exists.',
        data: existing,
      });
    }
    throw new ApiError(400, `A folder named "${cleanName}" already exists.`);
  }

  try {
    const folder = await MediaFolder.create({
      name: cleanName,
      parent: parentId,
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully.',
      data: folder,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(400, `A folder named "${cleanName}" already exists.`);
    }
    throw err;
  }
});

/**
 * PUT /api/admin/media/folders/:id
 * Rename folder or reassign parent
 */
export const updateMediaFolder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, parent } = req.body;

  let folder = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    folder = await MediaFolder.findById(id);
  } else {
    folder = await MediaFolder.findOne({ name: id });
  }

  if (!folder) {
    throw new ApiError(404, 'Folder not found.');
  }

  if (name !== undefined) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      throw new ApiError(400, 'Folder name cannot be empty.');
    }

    const parentId = parent !== undefined
      ? (parent && mongoose.Types.ObjectId.isValid(parent) ? parent : null)
      : folder.parent;

    const existing = await MediaFolder.findOne({
      _id: { $ne: folder._id },
      name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      parent: parentId,
    });

    if (existing) {
      throw new ApiError(400, `A folder named "${cleanName}" already exists.`);
    }

    folder.name = cleanName;
  }

  if (parent !== undefined) {
    let parentId = null;
    if (parent && mongoose.Types.ObjectId.isValid(parent)) {
      parentId = parent;
    } else if (parent && parent !== 'root' && parent !== 'null') {
      const parentDoc = await MediaFolder.findOne({ name: parent });
      if (parentDoc) parentId = parentDoc._id;
    }
    if (parentId && String(parentId) === String(folder._id)) {
      throw new ApiError(400, 'A folder cannot be its own parent.');
    }
    folder.parent = parentId;
  }

  await folder.save();

  res.status(200).json({
    success: true,
    message: 'Folder updated successfully.',
    data: folder,
  });
});

/**
 * DELETE /api/admin/media/folders/:id
 * Delete folder: only when empty or when moving contained files to destination
 */
export const deleteMediaFolder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const moveTo = req.query.moveTo || req.body?.moveTo || req.query.moveToFolderId || req.body?.moveToFolderId;

  let folder = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    folder = await MediaFolder.findById(id);
  } else {
    folder = await MediaFolder.findOne({ name: id });
  }

  if (!folder) {
    throw new ApiError(404, 'Folder not found.');
  }

  const activeFilesCount = await MediaFile.countDocuments({ folder: folder._id, deletedAt: null });

  if (activeFilesCount > 0) {
    if (!moveTo) {
      return res.status(409).json({
        success: false,
        message: `Folder "${folder.name}" contains ${activeFilesCount} file(s). Specify a destination folder or delete files first.`,
        fileCount: activeFilesCount,
      });
    }

    let targetFolderId = null;
    if (moveTo && moveTo !== 'root' && moveTo !== 'null' && moveTo !== 'All folders') {
      if (mongoose.Types.ObjectId.isValid(moveTo)) {
        targetFolderId = moveTo;
      } else {
        let targetDoc = await MediaFolder.findOne({
          name: { $regex: new RegExp(`^${String(moveTo).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
        if (!targetDoc) {
          targetDoc = await MediaFolder.create({ name: String(moveTo).trim() });
        }
        targetFolderId = targetDoc._id;
      }
    }

    await MediaFile.updateMany(
      { folder: folder._id, deletedAt: null },
      { $set: { folder: targetFolderId } }
    );
  }

  await MediaFolder.updateMany({ parent: folder._id }, { $set: { parent: null } });
  await MediaFolder.findByIdAndDelete(folder._id);

  res.status(200).json({
    success: true,
    message: `Folder "${folder.name}" deleted successfully.`,
  });
});

/**
 * GET /api/admin/media/:id/usage
 */
export const getMediaFileUsage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const usageInfo = await findMediaUsage(id);

  res.status(200).json({
    success: true,
    data: usageInfo,
  });
});

/**
 * PATCH /api/admin/media/:id
 * Rename, update alt text, or move to folder
 */
export const updateMediaFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, altText, folder } = req.body;

  const file = await MediaFile.findOne({ _id: id, deletedAt: null });
  if (!file) {
    throw new ApiError(404, 'Media file not found.');
  }

  if (name !== undefined && name.trim()) {
    file.originalName = name.trim();
  }
  if (altText !== undefined) {
    file.altText = altText.trim();
  }
  if (folder !== undefined) {
    let resolvedFolder = null;
    if (folder && folder !== 'All folders' && folder !== 'root' && folder !== 'null') {
      if (mongoose.Types.ObjectId.isValid(folder)) {
        resolvedFolder = folder;
      } else {
        let folderDoc = await MediaFolder.findOne({
          name: { $regex: new RegExp(`^${String(folder).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
        if (!folderDoc) {
          folderDoc = await MediaFolder.create({ name: String(folder).trim() });
        }
        resolvedFolder = folderDoc._id;
      }
    }
    file.folder = resolvedFolder;
  }

  await file.save();

  res.status(200).json({
    success: true,
    message: 'Media file updated successfully.',
    data: file,
  });
});

/**
 * DELETE /api/admin/media/:id
 * Soft delete with in-use safety check
 */
export const deleteMediaFile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true' || req.body?.force === true;

  const file = await MediaFile.findOne({ _id: id, deletedAt: null });
  if (!file) {
    throw new ApiError(404, 'Media file not found.');
  }

  const usageInfo = await findMediaUsage(file.url);
  if (usageInfo.inUse && !force) {
    return res.status(409).json({
      success: false,
      message: `File "${file.originalName}" is currently used in ${usageInfo.totalUsages} place(s).`,
      inUse: true,
      usages: usageInfo.usages,
    });
  }

  file.deletedAt = new Date();
  await file.save();

  res.status(200).json({
    success: true,
    message: `File "${file.originalName}" deleted successfully.`,
  });
});

/**
 * POST /api/admin/media/bulk
 * Bulk move or delete
 */
export const bulkMediaActions = asyncHandler(async (req, res) => {
  const { action, ids, folderId } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'Please select files to process.');
  }

  if (action === 'delete') {
    const force = req.body.force === true;
    let blockedCount = 0;
    const deletedIds = [];

    for (const id of ids) {
      const file = await MediaFile.findOne({ _id: id, deletedAt: null });
      if (!file) continue;

      const usageInfo = await findMediaUsage(file.url);
      if (usageInfo.inUse && !force) {
        blockedCount++;
      } else {
        file.deletedAt = new Date();
        await file.save();
        deletedIds.push(id);
      }
    }

    return res.status(200).json({
      success: true,
      message: `${deletedIds.length} files deleted.${blockedCount > 0 ? ` ${blockedCount} file(s) skipped because they are in active use.` : ''}`,
      deletedCount: deletedIds.length,
      blockedCount,
    });
  }

  if (action === 'move') {
    let destFolder = null;
    if (folderId && folderId !== 'All folders' && folderId !== 'root' && folderId !== 'null') {
      if (mongoose.Types.ObjectId.isValid(folderId)) {
        destFolder = folderId;
      } else {
        let folderDoc = await MediaFolder.findOne({
          name: { $regex: new RegExp(`^${String(folderId).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
        if (!folderDoc) {
          folderDoc = await MediaFolder.create({ name: String(folderId).trim() });
        }
        destFolder = folderDoc._id;
      }
    }

    await MediaFile.updateMany(
      { _id: { $in: ids }, deletedAt: null },
      { $set: { folder: destFolder } }
    );

    return res.status(200).json({
      success: true,
      message: `${ids.length} files moved.`,
      folderId: destFolder,
    });
  }

  throw new ApiError(400, `Unsupported action: ${action}`);
});

/**
 * POST /api/admin/media/recompute-usage
 */
export const recomputeUsageEndpoint = asyncHandler(async (req, res) => {
  const result = await recomputeAllMediaUsage();
  res.status(200).json({
    success: true,
    message: `Usage successfully recomputed for ${result.updatedCount} files.`,
    data: result,
  });
});

export default {
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
};
