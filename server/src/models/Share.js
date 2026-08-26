const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    permission: {
      type: String,
      enum: ['READ', 'WRITE'],
      required: true,
      // Note: OWNER is never stored as a Share record — ownership lives on
      // the File document itself (ownerId). A Share always represents
      // access granted TO someone who is NOT the owner.
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// A user can only have ONE share record per file — sharing again just updates it
shareSchema.index({ fileId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Share', shareSchema);