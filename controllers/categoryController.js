const Category = require('../models/Category');
const Blog = require('../models/Blog');
const slugify = require('slugify');

// @desc    Get all categories with post counts
// @route   GET /api/categories
// @access  Public
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    
    // Append the number of published blogs for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (cat) => {
        const count = await Blog.countDocuments({ category: cat._id, status: 'published' });
        return {
          ...cat.toObject(),
          count,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: categoriesWithStats.length,
      categories: categoriesWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category by slug
// @route   GET /api/categories/:slug
// @access  Public
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const blogCount = await Blog.countDocuments({ category: category._id, status: 'published' });

    res.status(200).json({
      success: true,
      category,
      blogCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a category (Admin only)
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category name.',
      });
    }

    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists.',
      });
    }

    let imageUrl = 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3';
    if (req.file) {
      imageUrl = req.file.path || `/uploads/${req.file.filename}`;
    }

    const slug = slugify(name, { lower: true, strict: true });

    const category = await Category.create({
      name,
      description: description || '',
      image: imageUrl,
      slug,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a category (Admin only)
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    let category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const { name, description } = req.body;

    if (name) {
      category.name = name;
      category.slug = slugify(name, { lower: true, strict: true });
    }
    
    if (description !== undefined) {
      category.description = description;
    }

    if (req.file) {
      category.image = req.file.path || `/uploads/${req.file.filename}`;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      category,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a category (Admin only)
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    // Verify if any blogs are linked to this category
    const blogsLinked = await Blog.countDocuments({ category: category._id });
    if (blogsLinked > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. There are ${blogsLinked} blog posts assigned to it.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
