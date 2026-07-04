const express = require('express');
const {
  getAllBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  toggleBlogLike,
  getUserDashboardStats,
  getAdminDashboardStats,
  shareBlogToFeed,
  removeShareFromFeed,
} = require('../controllers/blogController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Protected dashboard/stats routes (Placed first to avoid parameterized route matching conflicts)
router.get('/dashboard/stats', protect, getUserDashboardStats);
router.get('/admin/stats', protect, authorize('admin'), getAdminDashboardStats);

// Public routes
router.get('/', getAllBlogs);
router.get('/slug/:slug', getBlogBySlug);

// Private operations (Create, Edit, Delete, Like)
router.post('/', protect, upload.single('image'), createBlog);
router.put('/:id', protect, upload.single('image'), updateBlog);
router.delete('/:id', protect, deleteBlog);
router.put('/:id/like', protect, toggleBlogLike);
router.post('/:id/share', protect, shareBlogToFeed);
router.delete('/:id/share', protect, removeShareFromFeed);

module.exports = router;
