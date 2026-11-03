import asyncHandler from '../utils/asyncHandler.js';
import * as supportService from '../services/supportService.js';
import { registerSSEClient } from '../services/supportEventService.js';
import { pollInboundEmailsOnce } from '../workers/supportEmailWorker.js';

export const getAdminSupportStats = asyncHandler(async (req, res) => {
  const range = req.query.range || '7d';
  const stats = await supportService.getSupportStats(range);
  res.status(200).json({
    status: 'success',
    data: stats,
  });
});

export const getAdminConversations = asyncHandler(async (req, res) => {
  const result = await supportService.getAdminConversations(req.query);

  res.status(200).json({
    status: 'success',
    data: result.items,
    counts: result.counts,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

export const getAdminConversationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conversation = await supportService.getAdminConversationById(id);

  res.status(200).json({
    status: 'success',
    data: conversation,
  });
});

export const createAdminConversation = asyncHandler(async (req, res) => {
  const newConv = await supportService.createAdminConversation(req.user, req.body);

  res.status(201).json({
    status: 'success',
    message: 'New support conversation started and email dispatched',
    data: newConv,
  });
});

export const sendAdminReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, body, attachments, resolveAfterSending } = req.body;

  const updatedConversation = await supportService.sendAdminReply(id, req.user, {
    content: content || body,
    attachments,
    resolveAfterSending: Boolean(resolveAfterSending),
  });

  res.status(200).json({
    status: 'success',
    message: resolveAfterSending ? 'Reply sent and conversation resolved' : 'Reply sent successfully to customer',
    data: updatedConversation,
  });
});

export const addAdminInternalNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, body } = req.body;

  const updatedConversation = await supportService.addInternalNote(id, req.user, {
    content: content || body,
  });

  res.status(200).json({
    status: 'success',
    message: 'Internal note saved (only visible to staff)',
    data: updatedConversation,
  });
});

export const patchAdminConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await supportService.patchConversation(id, req.body);

  res.status(200).json({
    status: 'success',
    message: 'Conversation updated successfully',
    data: updated,
  });
});

export const updateConversationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const updated = await supportService.updateConversationStatus(id, status);

  res.status(200).json({
    status: 'success',
    message: `Conversation marked as ${status}`,
    data: updated,
  });
});

export const assignConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignee = req.body.assignedTo || req.body.assignee || req.body.assigneeId;

  const updated = await supportService.assignConversation(id, assignee);

  res.status(200).json({
    status: 'success',
    message: `Conversation assigned to ${assignee || 'Me'}`,
    data: updated,
  });
});

export const markConversationUnread = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const unread = req.body.unread !== undefined ? req.body.unread : true;

  const updated = await supportService.markConversationUnread(id, unread);

  res.status(200).json({
    status: 'success',
    message: unread ? 'Conversation marked as unread' : 'Conversation marked as read',
    data: updated,
  });
});

export const archiveOrDeleteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const action = req.body.action || (req.method === 'DELETE' ? 'delete' : 'archive');

  const result = await supportService.archiveOrDeleteConversation(id, action);

  res.status(200).json({
    status: 'success',
    message: result.message,
    data: result.conversation,
  });
});

export const getAssigneesList = asyncHandler(async (req, res) => {
  const assignees = await supportService.getAvailableAssignees();

  res.status(200).json({
    status: 'success',
    data: assignees,
  });
});

export const exportConversationsCsv = asyncHandler(async (req, res) => {
  const csv = await supportService.exportSupportDataCsv();

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="novashop-support-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200).send(csv);
});

export const streamSupportEvents = (req, res) => {
  registerSSEClient(req, res, req.user);
};

export const triggerInboundPoll = asyncHandler(async (req, res) => {
  const result = await pollInboundEmailsOnce();

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
