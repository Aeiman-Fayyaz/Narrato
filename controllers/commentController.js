const Comment = require('../models/Comment');
const Blog = require('../models/Blog');

// @desc    Get comments for a specific blog post
// @route   GET /api/comments/blog/:blogId
// @access  Public
exports.getBlogComments = async (req, res, next) => {
  try {
    const comments = await Comment.find({ blog: req.params.blogId })
      .populate('user', 'name avatar role')
      .sort({ createdAt: 1 }); // Ascending order for chat-like thread reading

    res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a comment or nested reply
// @route   POST /api/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const { blogId, content, parentComment } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Comment content cannot be empty.',
      });
    }

    const blogExists = await Blog.findById(blogId);
    if (!blogExists) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found.',
      });
    }

    // If it is a reply, verify parent comment exists
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found.',
        });
      }
    }

    const comment = await Comment.create({
      user: req.user.id,
      blog: blogId,
      content,
      parentComment: parentComment || null,
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'name avatar role');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      comment: populatedComment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
      });
    }

    // Verify ownership
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this comment.',
      });
    }

    comment.content = content;
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate('user', 'name avatar role');

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully.',
      comment: populatedComment,
    });
  } catch (error) {
    next(error);
  }
};

// Recursive helper to clean up nested replies from DB
const deleteNestedReplies = async (commentId) => {
  const childReplies = await Comment.find({ parentComment: commentId });
  for (const reply of childReplies) {
    await deleteNestedReplies(reply._id);
    await Comment.findByIdAndDelete(reply._id);
  }
};

// @desc    Delete a comment and its child replies
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
      });
    }

    // Verify ownership or Admin privileges
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment.',
      });
    }

    // Delete nested replies recursively
    await deleteNestedReplies(comment._id);

    // Delete the root comment
    await Comment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Comment and all replies deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle comment like
// @route   PUT /api/comments/:id/like
// @access  Private
exports.toggleCommentLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found.',
      });
    }

    const index = comment.likes.indexOf(req.user.id);
    let isLiked = false;

    if (index === -1) {
      comment.likes.push(req.user.id);
      isLiked = true;
    } else {
      comment.likes.splice(index, 1);
    }

    await comment.save();

    res.status(200).json({
      success: true,
      likesCount: comment.likes.length,
      isLiked,
    });
  } catch (error) {
    next(error);
  }
};
