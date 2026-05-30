const User = require('../models/User');
const Blog = require('../models/Blog');

// @desc    Get user profile (public)
// @route   GET /api/users/profile/:id
// @access  Public
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    // Get total published blogs count
    const postCount = await Blog.countDocuments({
      author: user._id,
      status: 'published',
    });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        socialLinks: user.socialLinks,
        createdAt: user.createdAt,
        role: user.role,
      },
      postCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Prepare fields to update
    const { name, bio, github, twitter, website } = req.body;
    
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    
    // Parse social links if supplied
    if (user.socialLinks) {
      if (github !== undefined) user.socialLinks.github = github;
      if (twitter !== undefined) user.socialLinks.twitter = twitter;
      if (website !== undefined) user.socialLinks.website = website;
    } else {
      user.socialLinks = {
        github: github || '',
        twitter: twitter || '',
        website: website || '',
      };
    }

    // Manage profile avatar upload if present
    if (req.file) {
      user.avatar = req.file.path || `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle save/bookmark blog
// @route   PUT /api/users/bookmark/:blogId
// @access  Private
exports.toggleBookmark = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const blogId = req.params.blogId;

    // Verify blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found.',
      });
    }

    const index = user.savedBlogs.indexOf(blogId);
    let message = '';

    if (index === -1) {
      // Add bookmark
      user.savedBlogs.push(blogId);
      message = 'Blog bookmarked successfully.';
    } else {
      // Remove bookmark
      user.savedBlogs.splice(index, 1);
      message = 'Blog removed from bookmarks.';
    }

    await user.save();

    res.status(200).json({
      success: true,
      message,
      savedBlogs: user.savedBlogs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookmarked blogs
// @route   GET /api/users/bookmarks
// @access  Private
exports.getBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'savedBlogs',
      populate: { path: 'author', select: 'name avatar' },
    });

    res.status(200).json({
      success: true,
      bookmarks: user.savedBlogs,
    });
  } catch (error) {
    next(error);
  }
};

// ================= ADMIN CONTROLLERS =================

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    
    // Supplement each user profile with their post counts
    const usersWithStats = await Promise.all(
      users.map(async (usr) => {
        const postsCount = await Blog.countDocuments({ author: usr._id });
        return {
          ...usr.toObject(),
          postsCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      users: usersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Delete all blogs authored by this user
    await Blog.deleteMany({ author: user._id });
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User account and all related blog posts successfully deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid role: user or admin.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role successfully updated to ${role}.`,
      user,
    });
  } catch (error) {
    next(error);
  }
};
