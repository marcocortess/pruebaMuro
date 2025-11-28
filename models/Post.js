// models/Post.js
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280
    },
    likes: {
      type: Number,
      default: 0
    },
    reposts: {
      type: Number,
      default: 0
    },
    comments: [CommentSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', PostSchema);
