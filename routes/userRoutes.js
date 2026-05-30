const express = require('express');
const {
  getUserProfile,
  updateProfile,
  toggleBookmark,
  getBookmarks,
  getAllUsers,
  deleteUser,
  updateUserRole,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/profile/:id', getUserProfile);

// Protected routes (Logged in users)
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/bookmark/:blogId', protect, toggleBookmark);
router.get('/bookmarks', protect, getBookmarks);

// Admin-only routes
router.get('/', protect, authorize('admin'), getAllUsers);
router.delete('/:id', protect, authorize('admin'), deleteUser);
router.put('/:id/role', protect, authorize('admin'), updateUserRole);

module.exports = router;
