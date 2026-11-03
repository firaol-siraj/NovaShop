import express from 'express';
import {
  getAdminSupportStats,
  getAdminConversations,
  getAdminConversationById,
  createAdminConversation,
  sendAdminReply,
  addAdminInternalNote,
  patchAdminConversation,
  updateConversationStatus,
  assignConversation,
  markConversationUnread,
  archiveOrDeleteConversation,
  getAssigneesList,
  exportConversationsCsv,
  streamSupportEvents,
  triggerInboundPoll,
} from '../controllers/adminSupportController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin', 'staff', 'owner'));

// Real-time SSE stream
router.get('/events', streamSupportEvents);

// Support Stats & Analytics
router.get('/stats', getAdminSupportStats);

// Conversations CRUD & Search
router.get('/conversations', getAdminConversations);
router.post('/conversations', createAdminConversation);
router.get('/conversations/:id', getAdminConversationById);
router.patch('/conversations/:id', patchAdminConversation);
router.delete('/conversations/:id', archiveOrDeleteConversation);

// Messages, Replies & Notes
router.post('/conversations/:id/messages', sendAdminReply);
router.post('/conversations/:id/reply', sendAdminReply);
router.post('/conversations/:id/notes', addAdminInternalNote);
router.post('/conversations/:id/note', addAdminInternalNote);

// Status, Assignee, Unread, Archive/Spam actions
router.patch('/conversations/:id/status', updateConversationStatus);
router.patch('/conversations/:id/assign', assignConversation);
router.patch('/conversations/:id/unread', markConversationUnread);
router.post('/conversations/:id/read', (req, res, next) => {
  req.body.unread = false;
  return markConversationUnread(req, res, next);
});
router.post('/conversations/:id/unread', (req, res, next) => {
  req.body.unread = true;
  return markConversationUnread(req, res, next);
});
router.post('/conversations/:id/archive', (req, res, next) => {
  req.body.action = 'archive';
  return archiveOrDeleteConversation(req, res, next);
});
router.post('/conversations/:id/spam', (req, res, next) => {
  req.body.action = 'spam';
  return archiveOrDeleteConversation(req, res, next);
});

// Assignees & CSV Export
router.get('/assignees', getAssigneesList);
router.get('/export', exportConversationsCsv);

// Inbound Email IMAP Poll Trigger
router.post('/poll-inbound', triggerInboundPoll);

export default router;
