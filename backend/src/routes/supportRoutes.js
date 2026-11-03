import express from 'express';
import { createSupportTicket, getMyTickets } from '../controllers/supportController.js';
import { protect, protectOptional } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public or optional customer session
router.post('/contact', protectOptional, createSupportTicket);

// Customer-only tickets list
router.get('/my-tickets', protect, getMyTickets);

export default router;
