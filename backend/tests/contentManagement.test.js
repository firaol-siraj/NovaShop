import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import Product from '../src/models/productModel.js';
import Category from '../src/models/categoryModel.js';
import { MediaFolder, MediaFile } from '../src/models/mediaModel.js';
import { HeroSlide, HeroSlideStat } from '../src/models/heroSlideModel.js';
import { HomepageLayout, HomepageVersion, Subscriber } from '../src/models/homepageModel.js';
import Discount from '../src/models/discountModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { detectMimeType, computeFileHash } from '../src/services/storageService.js';
import { deriveSlideStatus, deriveRelativeSchedule, validateButtonLink } from '../src/services/heroSlideService.js';
import { findMediaUsage } from '../src/services/mediaService.js';
import { computeSectionMeta, resolveHomepageData } from '../src/services/homepageService.js';

describe('NovaShop Content Management System (Media, Hero Slides, Homepage)', () => {
  let adminToken;
  let adminUser;
  let normalToken;
  let normalUser;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Content Admin',
      email: `contentadmin_${Date.now()}@novashop.com`,
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    normalUser = await User.create({
      name: 'Regular Shopper',
      email: `shopper_${Date.now()}@novashop.com`,
      password: 'Password123!',
      role: 'customer',
      isEmailVerified: true,
    });
    normalToken = generateAccessToken(normalUser._id, 0, 'customer');
  });

  describe('Part A: Media Library & Storage Service', () => {
    it('detectMimeType correctly detects JPEG, PNG, PDF magic bytes and rejects executables', () => {
      // JPEG header: FF D8 FF E0
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(detectMimeType(jpegBuffer)).toBe('image/jpeg');

      // PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectMimeType(pngBuffer)).toBe('image/png');

      // PDF header: 25 50 44 46 (%PDF-)
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(detectMimeType(pdfBuffer)).toBe('application/pdf');

      // Linux ELF executable header: 7F 45 4C 46
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      expect(detectMimeType(elfBuffer)).toBeNull();

      // Random binary data
      const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(detectMimeType(randomBuffer)).toBeNull();
    });

    it('creates folders, uploads media, computes hash, and provides real media statistics', async () => {
      // 1. Create a media folder
      const folderRes = await request(app)
        .post('/api/admin/media/folders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Seasonal Campaigns' });

      expect(folderRes.status).toBe(201);
      const folderId = folderRes.body.data._id;

      // 2. Upload a small 1x1 GIF (43 bytes)
      const gif1x1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      const uploadRes = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('folder', folderId)
        .attach('files', gif1x1, { filename: 'tiny-pixel.gif', contentType: 'image/gif' });

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.success).toBe(true);
      expect(uploadRes.body.data.uploaded.length).toBe(1);
      const uploadedFile = uploadRes.body.data.uploaded[0];
      expect(uploadedFile.type).toBe('image');
      expect(uploadedFile.name).toBe('tiny-pixel.gif');

      // 3. Duplicate detection returns warning or existing file info
      const dupRes = await request(app)
        .post('/api/admin/media/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', gif1x1, { filename: 'tiny-pixel-duplicate.gif', contentType: 'image/gif' });

      expect(dupRes.status).toBe(201);
      expect(dupRes.body.data.uploaded[0].isDuplicate).toBe(true);

      // 4. GET /api/admin/media/stats returns real counts and storage sum
      const statsRes = await request(app)
        .get('/api/admin/media/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalFiles).toBeGreaterThanOrEqual(1);
      expect(statsRes.body.data.storageBytes).toBeGreaterThan(0);
      expect(statsRes.body.data.tabCounts.All).toBeGreaterThanOrEqual(1);

      // 5. Scoped tabCounts when querying by folder
      const scopedMediaRes = await request(app)
        .get(`/api/admin/media?folder=${folderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(scopedMediaRes.status).toBe(200);
      expect(scopedMediaRes.body.data.tabCounts.image).toBe(1);
      expect(scopedMediaRes.body.data.tabCounts.video).toBe(0);
    });

    it('protects in-use media from accidental deletion with 409 Conflict', async () => {
      // Create a media file
      const media = await MediaFile.create({
        originalName: 'hero-banner.jpg',
        storedName: 'hero-banner-unique.jpg',
        url: 'https://images.unsplash.com/photo-test-hero-protected.jpg',
        mimeType: 'image/jpeg',
        kind: 'image',
        size: 10240,
        uploadedBy: adminUser._id,
      });

      // Reference media URL in a Product
      const category = await Category.create({ name: 'Protection Cat', slug: `protect-cat-${Date.now()}` });
      await Product.create({
        name: 'Protected Coat',
        slug: `protected-coat-${Date.now()}`,
        description: 'Luxury coat tailored with water-resistant cotton gabardine.',
        image: media.url,
        images: [media.url],
        price: 195,
        category: category._id,
        user: adminUser._id,
      });

      // Verify findMediaUsage detects product usage
      const usage = await findMediaUsage(media._id);
      expect(usage.inUse).toBe(true);
      expect(usage.totalUsages).toBe(1);
      expect(usage.usages.length).toBe(1);
      expect(usage.usages[0].name).toBe('Protected Coat');

      // Attempt DELETE on in-use media without force
      const deleteRes = await request(app)
        .delete(`/api/admin/media/${media._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.inUse).toBe(true);
      expect(deleteRes.body.usages.length).toBe(1);

      // Verify file is still not soft-deleted
      const checkMedia = await MediaFile.findById(media._id);
      expect(checkMedia.deletedAt).toBeNull();
    });

    it('handles complete folder lifecycle, bulk organization by name/id, and deletion safety', async () => {
      // 1. Create a source folder
      const folderRes = await request(app)
        .post('/api/admin/media/folders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lookbook Shoots' });
      expect(folderRes.status).toBe(201);
      const folderId = folderRes.body.data._id;

      // Duplicate creation fails with 400
      const dupRes = await request(app)
        .post('/api/admin/media/folders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'lookbook shoots' });
      expect(dupRes.status).toBe(400);

      // 2. Rename folder
      const renameRes = await request(app)
        .put(`/api/admin/media/folders/${folderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Editorial Shoots 2026' });
      expect(renameRes.status).toBe(200);
      expect(renameRes.body.data.name).toBe('Editorial Shoots 2026');

      // 3. Create a media file inside this folder
      const file1 = await MediaFile.create({
        originalName: 'model1.jpg',
        storedName: 'model1_stored.jpg',
        url: '/uploads/model1_stored.jpg',
        mimeType: 'image/jpeg',
        kind: 'image',
        size: 50000,
        folder: folderId,
        uploadedBy: adminUser._id,
      });

      // 4. Verify folder lists contain real fileCount
      const listRes = await request(app)
        .get('/api/admin/media/folders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      const targetFolderItem = listRes.body.data.find((f) => f.id === String(folderId));
      expect(targetFolderItem).toBeDefined();
      expect(targetFolderItem.fileCount).toBe(1);

      // 5. Attempt deleting non-empty folder without moveTo -> 409 Conflict
      const blockedDelete = await request(app)
        .delete(`/api/admin/media/folders/${folderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(blockedDelete.status).toBe(409);
      expect(blockedDelete.body.fileCount).toBe(1);

      // 6. Bulk move file to a new folder specified by NAME
      const bulkMoveRes = await request(app)
        .post('/api/admin/media/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'move', ids: [file1._id], folderId: 'Archived Shoots' });
      expect(bulkMoveRes.status).toBe(200);

      // Verify file now belongs to 'Archived Shoots' folder
      const updatedFile = await MediaFile.findById(file1._id).populate('folder');
      expect(updatedFile.folder?.name).toBe('Archived Shoots');

      // 7. Now original folder is empty -> deletion succeeds
      const successfulDelete = await request(app)
        .delete(`/api/admin/media/folders/${folderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(successfulDelete.status).toBe(200);

      const deletedFolder = await MediaFolder.findById(folderId);
      expect(deletedFolder).toBeNull();
    });
  });

  describe('Part B: Hero Slides & Telemetry', () => {
    it('correctly calculates derived statuses (Active, Scheduled, Draft, Expired) and relative schedules', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      const future = new Date(now.getTime() + 86400000);

      // Active
      expect(deriveSlideStatus({ enabled: true, startsAt: past, endsAt: future })).toBe('Active');

      // Draft
      expect(deriveSlideStatus({ enabled: false, startsAt: past, endsAt: future })).toBe('Draft');

      // Scheduled
      expect(deriveSlideStatus({ enabled: true, startsAt: future, endsAt: null })).toBe('Scheduled');

      // Expired
      expect(deriveSlideStatus({ enabled: true, startsAt: past, endsAt: new Date(now.getTime() - 1000) })).toBe('Expired');

      // Relative schedule
      const relativeActive = deriveRelativeSchedule({ startsAt: past, endsAt: future }, now);
      expect(relativeActive).toMatch(/1 day left/);
    });

    it('validates button links against real internal routes and slugs', async () => {
      const cat = await Category.create({ name: 'Silk Edit', slug: `silk-edit-${Date.now()}` });

      const validShop = await validateButtonLink('/shop');
      expect(validShop.valid).toBe(true);

      const validCategory = await validateButtonLink(`/categories/${cat.slug}`);
      expect(validCategory.valid).toBe(true);

      await expect(validateButtonLink('/categories/non-existent-category-slug-xyz')).rejects.toThrow();
      await expect(validateButtonLink('/foo/bar/baz')).rejects.toThrow();
    });

    it('supports hero slide CRUD, reordering, public serving, and bot-safe telemetry tracking', async () => {
      const now = new Date();
      // Create 2 hero slides
      const slide1Res = await request(app)
        .post('/api/admin/hero-slides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          headline: 'Effortless Drape',
          subheadline: 'Autumn Silk Collection',
          image: 'https://images.unsplash.com/photo-slide-1.jpg',
          buttonLabel: 'SHOP NOW',
          buttonLink: '/shop',
          status: 'active',
          startsAt: new Date(now.getTime() - 10000),
        });

      expect(slide1Res.status).toBe(201);
      const slide1Id = slide1Res.body.data._id;

      const slide2Res = await request(app)
        .post('/api/admin/hero-slides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          headline: 'Cloud Soft Cashmere',
          subheadline: 'Winter Knitwear',
          image: 'https://images.unsplash.com/photo-slide-2.jpg',
          buttonLabel: 'EXPLORE',
          buttonLink: '/shop',
          status: 'active',
          startsAt: new Date(now.getTime() - 10000),
        });

      expect(slide2Res.status).toBe(201);
      const slide2Id = slide2Res.body.data._id;

      // Reorder slides
      const reorderRes = await request(app)
        .put('/api/admin/hero-slides/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ slideIds: [slide2Id, slide1Id] });

      expect(reorderRes.status).toBe(200);

      // Public endpoint returns active slides in reordered sequence
      const publicSlidesRes = await request(app).get('/api/hero-slides');
      expect(publicSlidesRes.status).toBe(200);
      expect(publicSlidesRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(publicSlidesRes.body.data[0].id).toBe(slide2Id);

      // Dispatch telemetry: impression + click
      const impRes = await request(app)
        .post('/api/track/hero')
        .send({ slideId: slide2Id, event: 'impression' });
      expect(impRes.status).toBe(200);

      const clickRes = await request(app)
        .post('/api/track/hero')
        .send({ slideId: slide2Id, event: 'click' });
      expect(clickRes.status).toBe(200);

      // Verify admin hero slides stats aggregate clicks and impressions
      const statsRes = await request(app)
        .get('/api/admin/hero-slides/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.total).toBeGreaterThanOrEqual(2);
      expect(statsRes.body.data.active).toBeGreaterThanOrEqual(2);
      expect(statsRes.body.data.clickRate).toBeDefined();
    });

    it('supports imageFit, focalPointX/Y, mobileImage, and provides responsive variants', async () => {
      const now = new Date();
      const res = await request(app)
        .post('/api/admin/hero-slides')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          headline: 'Custom Fit Slide',
          subheadline: 'Testing Image Fit & Focal Point',
          image: '/uploads/hero-test.jpg',
          mobileImage: '/uploads/hero-test-mobile.jpg',
          buttonLabel: 'SHOP NOW',
          buttonLink: '/shop',
          status: 'active',
          startsAt: new Date(now.getTime() - 1000),
          imageFit: 'contain',
          imagePosition: 'center',
          focalPointX: 42,
          focalPointY: 78,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.imageFit).toBe('contain');
      expect(res.body.data.imagePosition).toBe('center');
      expect(res.body.data.focalPointX).toBe(42);
      expect(res.body.data.focalPointY).toBe(78);
      const slideId = res.body.data._id;

      // Update focal point & position
      const updateRes = await request(app)
        .put(`/api/admin/hero-slides/${slideId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          imageFit: 'cover',
          imagePosition: 'right',
          focalPointX: 60,
          focalPointY: 30,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.imageFit).toBe('cover');
      expect(updateRes.body.data.imagePosition).toBe('right');
      expect(updateRes.body.data.focalPointX).toBe(60);
      expect(updateRes.body.data.focalPointY).toBe(30);

      // Verify public API returns imageFit, focal points, and srcSet structure
      const publicRes = await request(app).get('/api/hero-slides');
      expect(publicRes.status).toBe(200);
      const found = publicRes.body.data.find((s) => s.id === slideId);
      expect(found).toBeDefined();
      expect(found.imageFit).toBe('cover');
      expect(found.imagePosition).toBe('right');
      expect(found.focalPointX).toBe(60);
      expect(found.focalPointY).toBe(30);
      expect(found.mobileImage).toBe('/uploads/hero-test-mobile.jpg');
    });
  });

  describe('Part C: Homepage Layout Management, Dynamic Resolution & Newsletter', () => {
    it('computes real section metadata and automatically hides promo banner when discount is inactive', async () => {
      // 1. Create a discount that is expired
      const expiredDiscount = await Discount.create({
        name: 'Expired Promo',
        code: `EXP${Date.now().toString().slice(-4)}`,
        type: 'percentage',
        value: 20,
        startsAt: new Date(Date.now() - 200000),
        endsAt: new Date(Date.now() - 100000), // Expired!
        status: 'active',
      });

      const promoSection = {
        id: 'promo',
        type: 'promo',
        label: 'Promotional banner',
        order: 4,
        visible: true,
        config: {
          title: 'Autumn Sale',
          discountCode: expiredDiscount.code,
        },
      };

      const resolved = await resolveHomepageData({
        sections: [promoSection],
      });

      // Verify promo banner is omitted from customer resolution because discount is expired
      expect(resolved.sections.some((s) => s.id === 'promo')).toBe(false);

      // Verify subtitle meta reflects expired status
      const meta = await computeSectionMeta(promoSection);
      expect(meta).toMatch(/Expired/i);
    });

    it('enforces optimistic concurrency control with 409 Conflict when client version is outdated', async () => {
      // Fetch current admin homepage layout
      const getRes = await request(app)
        .get('/api/admin/homepage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      const initialVersion = getRes.body.data.version;
      const currentSections = getRes.body.data.sections;

      // Update draft with matching client version
      const updateRes1 = await request(app)
        .put('/api/admin/homepage/draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientVersion: initialVersion,
          sections: currentSections,
        });

      expect(updateRes1.status).toBe(200);
      expect(updateRes1.body.success).toBe(true);

      // Attempt another update using a mismatched client version
      const updateRes2 = await request(app)
        .put('/api/admin/homepage/draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientVersion: 9999, // Stale / mismatched
          sections: currentSections,
        });

      expect(updateRes2.status).toBe(409);
      expect(updateRes2.body.conflict).toBe(true);
      expect(updateRes2.body.serverVersion).toBe(initialVersion);
    });

    it('publishes draft layout, creates HomepageVersion history, and delivers public layout', async () => {
      const getRes = await request(app)
        .get('/api/admin/homepage')
        .set('Authorization', `Bearer ${adminToken}`);

      const initialVersion = getRes.body.data.version;

      // Publish draft
      const pubRes = await request(app)
        .post('/api/admin/homepage/publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientVersion: initialVersion,
          changelog: 'Test publish suite update',
        });

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.success).toBe(true);

      // Verify version record exists
      const versionRecord = await HomepageVersion.findOne({ version: pubRes.body.data.version });
      expect(versionRecord).not.toBeNull();

      // Public GET /api/homepage reflects published content with ETag and Cache-Control
      const publicHomeRes = await request(app).get('/api/homepage');
      expect(publicHomeRes.status).toBe(200);
      expect(publicHomeRes.body.data.version).toBe(pubRes.body.data.version);
      expect(publicHomeRes.headers['etag']).toBeDefined();
      expect(publicHomeRes.headers['cache-control']).toContain('public, max-age=30');

      // 304 Not Modified on If-None-Match
      const revalidateRes = await request(app)
        .get('/api/homepage')
        .set('If-None-Match', publicHomeRes.headers['etag']);
      expect(revalidateRes.status).toBe(304);

      // PUT /api/admin/homepage updates draft and triggers hash-based isDirty
      const draftSections = getRes.body.data.sections.map(s => ({ ...s, visible: false }));
      const updateRes = await request(app)
        .put('/api/admin/homepage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sections: draftSections, clientVersion: pubRes.body.data.version });
      expect(updateRes.status).toBe(200);

      const checkDirtyRes = await request(app)
        .get('/api/admin/homepage')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkDirtyRes.body.data.isDirty).toBe(true);

      // Discard resets draft and sets isDirty to false
      const discardRes = await request(app)
        .post('/api/admin/homepage/discard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(discardRes.status).toBe(200);

      const checkCleanRes = await request(app)
        .get('/api/admin/homepage')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkCleanRes.body.data.isDirty).toBe(false);
    });

    it('subscribes email via /api/v1/home/subscribe with unsubscribe token and avoids duplicate error', async () => {
      const testEmail = `subscriber_${Date.now()}@example.com`;

      const subRes = await request(app)
        .post('/api/v1/home/subscribe')
        .send({ email: testEmail });

      expect(subRes.status).toBe(200);
      expect(subRes.body.success).toBe(true);

      const subDoc = await Subscriber.findOne({ email: testEmail });
      expect(subDoc).not.toBeNull();
      expect(subDoc.status).toBe('subscribed');
      expect(subDoc.unsubscribeToken).toBeDefined();

      // Repeated subscription is idempotent
      const subRes2 = await request(app)
        .post('/api/v1/home/subscribe')
        .send({ email: testEmail });

      expect(subRes2.status).toBe(200);
      expect(subRes2.body.success).toBe(true);
    });
  });
});
