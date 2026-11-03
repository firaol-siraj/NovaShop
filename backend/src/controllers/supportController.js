import asyncHandler from '../utils/asyncHandler.js';
import * as supportService from '../services/supportService.js';

export const createSupportTicket = asyncHandler(async (req, res) => {
  const { name, email, order, message, topic } = req.body;
  const userId = req.user?._id;

  const result = await supportService.createCustomerTicket({
    name,
    email,
    order,
    message,
    topic: topic || 'General',
    userId,
  });

  res.status(201).json({
    status: 'success',
    message: 'Your inquiry has been received. Our team will contact you shortly.',
    data: result,
  });
});

export const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getCustomerTickets(req.user);

  res.status(200).json({
    status: 'success',
    data: tickets,
  });
});
