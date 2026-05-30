const mongoose = require('mongoose');
const slugify = require('slugify');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
  },
  description: {
    type: String,
    required: [true, 'Please add a short description'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Please add article content'],
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please specify a category'],
  },
  tags: [
    {
      type: String,
      trim: true,
    }
  ],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  readTime: {
    type: Number,
    default: 1,
  }
}, {
  timestamps: true,
});

// Create slug and readTime before saving
blogSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true }) + '-' + Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  if (this.isModified('content')) {
    // Estimate reading time: ~200 words per minute
    const wordsCount = this.content.trim().split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordsCount / 200));
  }
  
  next();
});

module.exports = mongoose.model('Blog', blogSchema);
