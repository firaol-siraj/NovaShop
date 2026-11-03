import Category from '../models/categoryModel.js';
import Product from '../models/productModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { clearCachePattern } from '../utils/clearCache.js';

// Helper to generate a clean URL slug from category name
const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');

// @desc    Fetch all categories
// @route   GET /api/v1/categories
// @access  Public
export const getCategories = asyncHandler(async (req, res, next) => {
  const categories = await Category.find({})
    .populate('children')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Fetch single category by ID or Slug
// @route   GET /api/v1/categories/:id
// @access  Public
export const getCategoryById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  const query = isObjectId ? { _id: id } : { slug: id.toLowerCase() };
  const category = await Category.findOne(query).populate('children');

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

// @desc    Create a category
// @route   POST /api/v1/categories
// @access  Private/Admin
export const createCategory = asyncHandler(async (req, res, next) => {
  const { name, slug, description, image, parent } = req.body;

  const categorySlug = slug ? slugify(slug) : slugify(name);

  const existingCategory = await Category.findOne({
    $or: [{ name }, { slug: categorySlug }],
  });

  if (existingCategory) {
    return next(
      new ApiError(400, 'A category with this name or slug already exists')
    );
  }

  let parentId = null;
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) {
      return next(new ApiError(404, 'Parent category not found'));
    }
    parentId = parentCategory._id;
  }

  const category = await Category.create({
    name,
    slug: categorySlug,
    description: description || '',
    image: image || '',
    parent: parentId,
  });

  await clearCachePattern('categories');
  await clearCachePattern('products');

  res.status(201).json({
    success: true,
    data: category,
  });
});

// @desc    Update a category
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
export const updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  const { name, slug, description, image, parent } = req.body;

  if (name && name !== category.name) {
    const nameExists = await Category.findOne({ name, _id: { $ne: category._id } });
    if (nameExists) {
      return next(new ApiError(400, 'Category name already taken'));
    }
    category.name = name;
  }

  if (slug || name) {
    const newSlug = slug ? slugify(slug) : slugify(category.name);
    const slugExists = await Category.findOne({
      slug: newSlug,
      _id: { $ne: category._id },
    });
    if (slugExists) {
      return next(new ApiError(400, 'Category slug already taken'));
    }
    category.slug = newSlug;
  }

  if (description !== undefined) category.description = description;
  if (image !== undefined) category.image = image;

  if (parent !== undefined) {
    if (parent === null || parent === '') {
      category.parent = null;
    } else {
      if (parent.toString() === category._id.toString()) {
        return next(new ApiError(400, 'Category cannot be its own parent'));
      }
      const parentCat = await Category.findById(parent);
      if (!parentCat) {
        return next(new ApiError(404, 'Parent category not found'));
      }
      category.parent = parentCat._id;
    }
  }

  const updatedCategory = await category.save();
  await clearCachePattern('categories');
  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    data: updatedCategory,
  });
});

// @desc    Delete a category
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  // Check if any products reference this category
  const productsCount = await Product.countDocuments({ category: category._id });
  if (productsCount > 0) {
    return next(
      new ApiError(
        400,
        `Cannot delete category. It is referenced by ${productsCount} product(s).`
      )
    );
  }

  await category.deleteOne();
  await clearCachePattern('categories');
  await clearCachePattern('products');

  res.status(200).json({
    success: true,
    message: 'Category removed successfully',
  });
});
