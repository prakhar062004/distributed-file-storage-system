const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
  {
    chunkId: {
      type: String,
      required: true,
      unique: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    checksum: {
      type: String,
      required: true,
    },
    storageLocations: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

// Compound index: we always query "all chunks for file X, in order"
chunkSchema.index({ fileId: 1, chunkIndex: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);