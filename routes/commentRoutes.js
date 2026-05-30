const express = require('express');
const {
  getBlogComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/blog/:blogId', getBlogComments);

// Protected routes
router.post('/', protect, addComment);
router.put('/:id', protect, updateComment);
router.delete('/:id', protect, deleteComment);
router.put('/:id/like', protect, toggleCommentLike);

module.exports = router;
