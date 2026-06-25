const Blog = require('../models/Blog');
const Category = require('../models/Category');
const User = require('../models/User');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');

// @desc    Get all blogs (with pagination, filtering, search)
// @route   GET /api/blogs
// @access  Public
exports.getAllBlogs = async (req, res, next) => {
  try {
    let queryObject = { status: 'published' }; // Publicly serve published blogs only

    // Filter by Category (supports ID or slug)
    if (req.query.category) {
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        queryObject.category = req.query.category;
      } else {
        const cat = await Category.findOne({ slug: req.query.category });
        if (cat) {
          queryObject.category = cat._id;
        } else {
          return res.status(200).json({
            success: true,
            count: 0,
            pagination: {},
            blogs: [],
          });
        }
      }
    }

    // Filter by Tag
    if (req.query.tag) {
      queryObject.tags = { $in: [new RegExp(`^${req.query.tag}$`, 'i')] };
    }

    // Search bar functionality (title, description, tags)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      queryObject.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } }
      ];
    }

    // Filter by Author
    if (req.query.author) {
      if (mongoose.Types.ObjectId.isValid(req.query.author)) {
        queryObject.author = req.query.author;
      }
    }

    // Build the query
    let query = Blog.find(queryObject)
      .populate('author', 'name avatar bio')
      .populate('category', 'name slug');

    // Sorting
    if (req.query.sort === 'popular') {
      query = query.sort({ views: -1, createdAt: -1 });
    } else if (req.query.sort === 'trending') {
      // Sort by likes array size desc, then views
      query = query.sort({ 'likes.length': -1, views: -1, createdAt: -1 });
    } else {
      query = query.sort({ createdAt: -1 }); // default: latest
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 6;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Blog.countDocuments(queryObject);

    query = query.skip(startIndex).limit(limit);

    // Run query
    const blogs = await Blog.find(queryObject)
      .populate('author', 'name avatar bio')
      .populate('category', 'name slug');

    // Apply sorting in memory for dynamic elements if necessary, but DB sorting is fine
    let sortedBlogs = [...blogs];
    if (req.query.sort === 'popular') {
      sortedBlogs.sort((a, b) => b.views - a.views);
    } else if (req.query.sort === 'trending') {
      sortedBlogs.sort((a, b) => (b.likes ? b.likes.length : 0) - (a.likes ? a.likes.length : 0));
    } else {
      sortedBlogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Slice for page limit manual calculation to guarantee strict order consistency
    const paginatedBlogs = sortedBlogs.slice(startIndex, startIndex + limit);

    // Pagination result metadata
    const pagination = {};
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: paginatedBlogs.length,
      total,
      pagination,
      blogs: paginatedBlogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single blog by slug
// @route   GET /api/blogs/slug/:slug
// @access  Public
exports.getBlogBySlug = async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug })
      .populate('author', 'name avatar bio socialLinks')
      .populate('category', 'name slug description');

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.',
      });
    }

    // Increment view count asynchronously
    blog.views += 1;
    await blog.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new blog post
// @route   POST /api/blogs
// @access  Private
exports.createBlog = async (req, res, next) => {
  try {
    const { title, description, content, category, tags, status } = req.body;

    // Validate category
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required.',
      });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Specified category does not exist.',
      });
    }

    // Process tag array format
    let tagsArray = [];
    if (tags) {
      tagsArray = typeof tags === 'string' 
        ? tags.split(',').map(tag => tag.trim()) 
        : tags;
    }

    let imageUrl = 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    if (req.file) {
      imageUrl = req.file.path || `/uploads/${req.file.filename}`;
    }

    const blog = await Blog.create({
      title,
      description,
      content,
      category,
      tags: tagsArray,
      status: status || 'draft',
      image: imageUrl,
      author: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Blog created successfully.',
      blog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update blog post
// @route   PUT /api/blogs/:id
// @access  Private
exports.updateBlog = async (req, res, next) => {
  try {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.',
      });
    }

    // Confirm ownership or Admin privileges
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this blog post.',
      });
    }

    const { title, description, content, category, tags, status } = req.body;

    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: 'Specified category does not exist.',
        });
      }
      blog.category = category;
    }

    if (title) blog.title = title;
    if (description) blog.description = description;
    if (content) blog.content = content;
    if (status) blog.status = status;

    if (tags) {
      blog.tags = typeof tags === 'string'
        ? tags.split(',').map(tag => tag.trim())
        : tags;
    }

    if (req.file) {
      blog.image = req.file.path || `/uploads/${req.file.filename}`;
    }

    // Save changes
    await blog.save();

    const populatedBlog = await Blog.findById(blog._id)
      .populate('author', 'name avatar')
      .populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Blog post updated successfully.',
      blog: populatedBlog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete blog post
// @route   DELETE /api/blogs/:id
// @access  Private
exports.deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.',
      });
    }

    // Confirm ownership or Admin privileges
    if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this blog post.',
      });
    }

    // Clear associated comments
    await Comment.deleteMany({ blog: blog._id });

    // Delete post
    await Blog.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Blog post and all associated comments deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle blog post like
// @route   PUT /api/blogs/:id/like
// @access  Private
exports.toggleBlogLike = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.',
      });
    }

    const index = blog.likes.indexOf(req.user.id);
    let isLiked = false;

    if (index === -1) {
      blog.likes.push(req.user.id);
      isLiked = true;
    } else {
      blog.likes.splice(index, 1);
    }

    await blog.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      likesCount: blog.likes.length,
      isLiked,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get User Dashboard statistics & blogs
// @route   GET /api/blogs/dashboard/stats
// @access  Private
exports.getUserDashboardStats = async (req, res, next) => {
  try {
    // Fetch author's own blogs
    const authoredBlogs = await Blog.find({ author: req.user.id })
      .populate('category', 'name slug')
      .populate('author', 'name avatar bio')
      .sort({ createdAt: -1 });

    // Fetch blogs shared by this user
    const sharedBlogIds = (await User.findById(req.user.id)).sharedBlogs || [];
    const sharedBlogs = await Blog.find({ _id: { $in: sharedBlogIds } })
      .populate('category', 'name slug')
      .populate('author', 'name avatar bio')
      .sort({ createdAt: -1 });

    // Combine and mark shared blogs
    const blogs = [
      ...authoredBlogs.map(b => ({ ...b.toObject(), isSharedByMe: false })),
      ...sharedBlogs.map(b => ({ ...b.toObject(), isSharedByMe: true })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalBlogs = authoredBlogs.length;
    const publishedBlogs = authoredBlogs.filter(b => b.status === 'published').length;
    const draftBlogs = totalBlogs - publishedBlogs;
    const totalViews = authoredBlogs.reduce((sum, b) => sum + (b.views || 0), 0);
    const totalLikes = authoredBlogs.reduce((sum, b) => sum + (b.likes ? b.likes.length : 0), 0);

    res.status(200).json({
      success: true,
      stats: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        totalViews,
        totalLikes,
      },
      blogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get platform global metrics & blogs (Admin Dashboard)
// @route   GET /api/blogs/admin/stats
// @access  Private/Admin
exports.getAdminDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({});
    const blogs = await Blog.find({})
      .populate('author', 'name email avatar')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    const totalBlogs = blogs.length;
    const totalViews = blogs.reduce((sum, b) => sum + (b.views || 0), 0);
    const totalCategories = await Category.countDocuments({});

    // Dynamic stats: blogs by category
    const categories = await Category.find({});
    const categoryStats = await Promise.all(
      categories.map(async (cat) => {
        const count = await Blog.countDocuments({ category: cat._id });
        return {
          name: cat.name,
          count,
        };
      })
    );

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalBlogs,
        totalViews,
        totalCategories,
      },
      categoryStats,
      blogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share a blog to user's feed (track share, don't create new blog)
// @route   POST /api/blogs/:id/share
// @access  Private
exports.shareBlogToFeed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate blog ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog ID' });
    }

    // Get the original blog
    const blog = await Blog.findById(id)
      .populate('author', 'name avatar bio email')
      .populate('category', 'name slug');
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    // Check if user has already shared this blog
    if (blog.sharedBy && blog.sharedBy.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You have already shared this blog',
      });
    }

    // Add user to blog's sharedBy array
    if (!blog.sharedBy) {
      blog.sharedBy = [];
    }
    blog.sharedBy.push(userId);
    await blog.save();

    // Add blog to user's sharedBlogs array
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { sharedBlogs: id } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Blog shared to your feed successfully',
      blog,
      isShared: true,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a blog share (unshare from user's feed)
// @route   DELETE /api/blogs/:id/share
// @access  Private
exports.removeShareFromFeed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validate blog ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog ID' });
    }

    // Get the blog
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    // Remove user from blog's sharedBy array
    if (blog.sharedBy) {
      blog.sharedBy = blog.sharedBy.filter(id => id.toString() !== userId.toString());
      await blog.save();
    }

    // Remove blog from user's sharedBlogs array
    await User.findByIdAndUpdate(
      userId,
      { $pull: { sharedBlogs: id } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Blog share removed successfully',
    });
  } catch (error) {
    next(error);
  }
};
