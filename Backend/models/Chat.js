const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  prompt: {
    type: String,
    required: true,
    trim: true
  },
  response: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  imageUrl: {
    type: String,
    default: null
  },
  tokens: {
    type: Number,
    default: 0
  },
  model: {
    type: String,
    default: 'claude-3-sonnet-20240229'
  }
}, {
  timestamps: true
});

// Index for better query performance
chatSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);