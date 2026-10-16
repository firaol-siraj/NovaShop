import Category from '../models/categoryModel.js';
import Product from '../models/productModel.js';
import ProductVariant from '../models/productVariantModel.js';
import User from '../models/userModel.js';

export const seedFashionData = async () => {
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    throw new Error('Create an administrator with the controlled bootstrap command before seeding fashion data.');
  }

  // 1. Create Core Categories
  const categoriesData = [
    { name: 'Men', slug: 'men', description: 'Men fashion apparel' },
    { name: 'Women', slug: 'women', description: 'Women fashion apparel' },
    { name: 'Kids', slug: 'kids', description: 'Kids fashion apparel' },
    { name: 'T-Shirts', slug: 't-shirts', description: 'Essential tees and tops' },
    { name: 'Shirts', slug: 'shirts', description: 'Button-up and woven shirts' },
    { name: 'Hoodies', slug: 'hoodies', description: 'Fleece hoodies and sweatshirts' },
    { name: 'Jeans', slug: 'jeans', description: 'Denim pants and trousers' },
    { name: 'Dresses', slug: 'dresses', description: 'Midi, maxi, and casual dresses' },
    { name: 'Jackets', slug: 'jackets', description: 'Outerwear and denim coats' },
    { name: 'Shoes', slug: 'shoes', description: 'Sneakers and boots' },
    { name: 'Accessories', slug: 'accessories', description: 'Bags, caps, and leather goods' },
  ];

  const categoryDocs = {};
  for (const cat of categoriesData) {
    let existing = await Category.findOne({ slug: cat.slug });
    if (!existing) {
      existing = await Category.create(cat);
    }
    categoryDocs[cat.slug] = existing;
  }

  // Set parent relations
  if (categoryDocs['t-shirts'] && categoryDocs['men']) {
    categoryDocs['t-shirts'].parent = categoryDocs['men']._id;
    await categoryDocs['t-shirts'].save();
  }

  // 2. Create Realistic Fashion Products with Variants
  const fashionProducts = [
    {
      name: 'Essential Organic Cotton Tee',
      slug: 'essential-organic-cotton-tee',
      brand: 'NovaShop',
      category: categoryDocs['t-shirts']._id,
      gender: 'men',
      price: 34.0,
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85',
      images: [
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=85',
        'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=900&q=85',
      ],
      description: 'Crafted from 100% heavy organic cotton for a relaxed fit.',
      material: '100% Organic Cotton',
      careInstructions: 'Machine wash cold with like colors',
      fit: 'Relaxed',
      variants: [
        { size: 'S', color: { name: 'Black', hex: '#000000' }, stock: 15, sku: 'NOV-TEE-BLK-S' },
        { size: 'M', color: { name: 'Black', hex: '#000000' }, stock: 25, sku: 'NOV-TEE-BLK-M' },
        { size: 'L', color: { name: 'Black', hex: '#000000' }, stock: 20, sku: 'NOV-TEE-BLK-L' },
        { size: 'M', color: { name: 'Cream', hex: '#F5F5DC' }, stock: 18, sku: 'NOV-TEE-CRM-M' },
      ],
    },
    {
      name: 'Nova Heavyweight Oversized Hoodie',
      slug: 'nova-heavyweight-oversized-hoodie',
      brand: 'NovaShop',
      category: categoryDocs['hoodies']._id,
      gender: 'unisex',
      price: 88.0,
      image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=85',
      images: [
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=85',
        'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=900&q=85',
      ],
      description: 'Ultra-soft 450gsm heavyweight fleece hoodie with dropped shoulders.',
      material: '80% Cotton, 20% Polyester Fleece',
      careInstructions: 'Machine wash cold, tumble dry low',
      fit: 'Oversized',
      variants: [
        { size: 'S', color: { name: 'Navy', hex: '#000080' }, stock: 10, sku: 'NOV-HOOD-NVY-S' },
        { size: 'M', color: { name: 'Navy', hex: '#000080' }, stock: 14, sku: 'NOV-HOOD-NVY-M' },
        { size: 'L', color: { name: 'Navy', hex: '#000080' }, stock: 8, sku: 'NOV-HOOD-NVY-L' },
        { size: 'XL', color: { name: 'Gray', hex: '#808080' }, stock: 12, sku: 'NOV-HOOD-GRY-XL' },
      ],
    },
    {
      name: 'Relaxed Tapered Selvedge Denim',
      slug: 'relaxed-tapered-selvedge-denim',
      brand: 'NovaShop',
      category: categoryDocs['jeans']._id,
      gender: 'men',
      price: 110.0,
      image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85',
      images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=85'],
      description: 'Japanese raw selvedge denim tailored with a relaxed rise and subtle taper.',
      material: '100% Raw Cotton Denim',
      careInstructions: 'Hand wash cold, hang dry',
      fit: 'Relaxed Tapered',
      variants: [
        { size: 'S', color: { name: 'Indigo', hex: '#4B0082' }, stock: 8, sku: 'NOV-JEAN-IND-S' },
        { size: 'M', color: { name: 'Indigo', hex: '#4B0082' }, stock: 12, sku: 'NOV-JEAN-IND-M' },
        { size: 'L', color: { name: 'Indigo', hex: '#4B0082' }, stock: 6, sku: 'NOV-JEAN-IND-L' },
      ],
    },
  ];

  for (const pData of fashionProducts) {
    let existingProd = await Product.findOne({ slug: pData.slug });
    if (!existingProd) {
      const { variants, ...prodFields } = pData;
      existingProd = await Product.create({
        ...prodFields,
        user: admin._id,
      });

      let totalStock = 0;
      for (const v of variants) {
        totalStock += v.stock;
        await ProductVariant.create({
          product: existingProd._id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
          image: existingProd.image,
        });
      }
      existingProd.countInStock = totalStock;
      await existingProd.save();
    }
  }

  console.log('[Seed]: Fashion categories, products, and variants seeded successfully');
};
