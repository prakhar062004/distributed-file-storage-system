const File = require('../models/File');
const Share = require('../models/Share');

const PERMISSION_RANK = { READ: 1, WRITE: 2, OWNER: 3 };

/**
 * Determines the effective permission level a user has on a file, or null
 * if they have no access at all. Checks ownership first (cheapest, most
 * common case), then falls back to an explicit Share record.
 */
const getEffectivePermission = async (fileId, userId) => {
  const file = await File.findById(fileId);
  if (!file) return null;

  if (file.ownerId.toString() === userId.toString()) {
    return 'OWNER';
  }

  const share = await Share.findOne({ fileId, userId });
  return share ? share.permission : null;
};

/**
 * Returns true if the user's permission meets or exceeds the required level.
 */
const hasPermission = async (fileId, userId, requiredLevel) => {
  const permission = await getEffectivePermission(fileId, userId);
  if (!permission) return false;
  return PERMISSION_RANK[permission] >= PERMISSION_RANK[requiredLevel];
};

module.exports = { getEffectivePermission, hasPermission, PERMISSION_RANK };