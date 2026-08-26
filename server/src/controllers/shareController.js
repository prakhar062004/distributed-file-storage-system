const File = require('../models/File');
const Share = require('../models/Share');
const User = require('../models/User');

// @desc    Share a file with another user
// @route   POST /api/files/:fileId/share
const shareFile = async (req, res, next) => {
  try {
    const { email, permission } = req.body;

    if (!email || !permission) {
      return res.status(400).json({ success: false, error: 'email and permission are required' });
    }

    if (!['READ', 'WRITE'].includes(permission)) {
      return res.status(400).json({ success: false, error: 'permission must be READ or WRITE' });
    }

    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Only the actual owner can manage sharing — not even WRITE-level users
    if (file.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the file owner can manage sharing' });
    }

    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'No user found with that email' });
    }

    if (targetUser._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot share a file with yourself' });
    }

    // Upsert: update existing share if one exists, otherwise create it
    const share = await Share.findOneAndUpdate(
      { fileId: file._id, userId: targetUser._id },
      { permission, grantedBy: req.user.id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, share });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke a user's access to a file
// @route   DELETE /api/files/:fileId/share/:userId
const revokeShare = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the file owner can manage sharing' });
    }

    await Share.deleteOne({ fileId: file._id, userId: req.params.userId });

    res.status(200).json({ success: true, message: 'Access revoked' });
  } catch (error) {
    next(error);
  }
};

// @desc    List everyone a file is shared with
// @route   GET /api/files/:fileId/shares
const listShares = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    if (file.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the file owner can view sharing details' });
    }

    const shares = await Share.find({ fileId: file._id }).populate('userId', 'name email');

    res.status(200).json({ success: true, shares });
  } catch (error) {
    next(error);
  }
};

// @desc    List files shared WITH the current user (by others)
// @route   GET /api/files/shared-with-me
const listSharedWithMe = async (req, res, next) => {
  try {
    const shares = await Share.find({ userId: req.user.id }).populate('fileId');

    const files = shares
      .filter((s) => s.fileId) // guard against a share pointing at a deleted file
      .map((s) => ({
        ...s.fileId.toObject(),
        myPermission: s.permission,
      }));

    res.status(200).json({ success: true, files });
  } catch (error) {
    next(error);
  }
};

module.exports = { shareFile, revokeShare, listShares, listSharedWithMe };