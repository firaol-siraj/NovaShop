import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import User from '../src/models/userModel.js';
import EmailLog from '../src/models/emailLogModel.js';
import AuditLog from '../src/models/auditLogModel.js';
import { generateAccessToken } from '../src/utils/generateToken.js';
import { setTransporter, resetTransporter } from '../src/services/emailService.js';
import { detectAndProcessBounce } from '../src/workers/supportEmailWorker.js';

describe('Admin Customer Email Deliverability & Logging Suite', () => {
  let adminUser;
  let adminToken;
  let targetCustomer;

  beforeEach(async () => {
    resetTransporter();
    await EmailLog.deleteMany({});
    await AuditLog.deleteMany({});
    await User.deleteMany({ email: { $in: ['emailadmin@novashop.com', 'testclient@novashop.com', 'firusiraj00@gmail.com'] } });

    adminUser = await User.create({
      name: 'Email Admin',
      email: 'emailadmin@novashop.com',
      password: 'Password123!',
      role: 'admin',
      adminRole: 'owner',
      isVerified: true,
    });
    adminToken = generateAccessToken(adminUser._id, 0, 'admin');

    targetCustomer = await User.create({
      name: 'Firu Siraj',
      email: 'firusiraj00@gmail.com',
      password: 'TemporaryInvited123!',
      status: 'invited',
      isVerified: false,
      inviteToken: crypto.createHash('sha256').update('old-secret-token').digest('hex'),
      inviteExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  afterEach(() => {
    resetTransporter();
  });

  it('1. Acceptance: records status="sent" ONLY when Nodemailer accepts recipient', async () => {
    const mockSendMail = jest.fn().mockResolvedValue({
      accepted: ['firusiraj00@gmail.com'],
      rejected: [],
      response: '250 2.0.0 OK 1730193820 abc-smtp.gmail.com',
      messageId: '<test-msg-123@novashop.com>',
    });

    setTransporter({
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post(`/api/v1/admin/customers/${targetCustomer._id}/email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Important update regarding your account',
        message: 'Hello Firu, your order is ready for pickup.',
        idempotencyKey: 'test-idemp-001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify only ONE email was sent and logged
    const logs = await EmailLog.find({ to: 'firusiraj00@gmail.com' });
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.status).toBe('sent');
    expect(log.accepted).toContain('firusiraj00@gmail.com');
    expect(log.rejected.length).toBe(0);
    expect(log.messageId).toBe('<test-msg-123@novashop.com>');
    expect(log.smtpResponse).toContain('250 2.0.0 OK');

    // Verify AuditLog was created
    const auditLogs = await AuditLog.find({ targetEntityId: targetCustomer._id.toString() });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('2. Rejection: records status="failed" when Nodemailer rejects recipient', async () => {
    const mockSendMail = jest.fn().mockResolvedValue({
      accepted: [],
      rejected: ['firusiraj00@gmail.com'],
      response: '550 5.1.1 The email account that you tried to reach does not exist.',
      messageId: '<test-msg-rejected@novashop.com>',
    });

    setTransporter({
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post(`/api/v1/admin/customers/${targetCustomer._id}/email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Rejection test subject',
        message: 'This email should be rejected by mock SMTP.',
        idempotencyKey: 'test-idemp-002',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);

    const logs = await EmailLog.find({ to: 'firusiraj00@gmail.com' });
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.status).toBe('failed');
    expect(log.rejected).toContain('firusiraj00@gmail.com');
    expect(log.error).toMatch(/rejected/i);
  });

  it('3. Double submit: deduplicates rapid duplicate sends and sends only ONE email', async () => {
    const mockSendMail = jest.fn().mockResolvedValue({
      accepted: ['firusiraj00@gmail.com'],
      rejected: [],
      response: '250 2.0.0 OK 1730193821 abc-smtp.gmail.com',
      messageId: '<test-msg-dedupe@novashop.com>',
    });

    setTransporter({
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    });

    // First request
    const res1 = await request(app)
      .post(`/api/v1/admin/customers/${targetCustomer._id}/email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Double click test',
        message: 'Testing deduplication.',
        idempotencyKey: 'idemp-double-click-999',
      });

    expect(res1.status).toBe(200);

    // Immediate second request with identical idempotencyKey
    const res2 = await request(app)
      .post(`/api/v1/admin/customers/${targetCustomer._id}/email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Double click test',
        message: 'Testing deduplication.',
        idempotencyKey: 'idemp-double-click-999',
      });

    expect(res2.status).toBe(200);

    // Mock sendMail must have been called only ONCE
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    // Only ONE log in database
    const logs = await EmailLog.find({ to: 'firusiraj00@gmail.com' });
    expect(logs.length).toBe(1);
  });

  it('4. Resend invite: generates new token, updates expiry, and logs customer_invite', async () => {
    const mockSendMail = jest.fn().mockResolvedValue({
      accepted: ['firusiraj00@gmail.com'],
      rejected: [],
      response: '250 2.0.0 OK 1730193822 abc-smtp.gmail.com',
      messageId: '<test-msg-invite@novashop.com>',
    });

    setTransporter({
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    });

    const oldTokenHash = targetCustomer.inviteToken;

    const res = await request(app)
      .post(`/api/v1/admin/customers/${targetCustomer._id}/resend-invite`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify customer in database has a new inviteToken and extended expiry
    const updated = await User.findById(targetCustomer._id);
    expect(updated.inviteToken).toBeDefined();
    expect(updated.inviteToken).not.toBe(oldTokenHash);
    expect(new Date(updated.inviteExpires).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);

    // Verify email was sent and logged
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const inviteLogs = await EmailLog.find({ to: 'firusiraj00@gmail.com', type: 'customer_invite' });
    expect(inviteLogs.length).toBe(1);
    expect(inviteLogs[0].status).toBe('sent');
  });

  it('5. Bounce detection: updates matching EmailLog to "bounced" with bounceReason', async () => {
    // First, create a sent EmailLog
    const initialLog = await EmailLog.create({
      to: 'bouncedcustomer@gmail.com',
      subject: 'Account activation notice',
      type: 'customer_invite',
      status: 'sent',
      messageId: '<initial-msg-id@novashop.com>',
      accepted: ['bouncedcustomer@gmail.com'],
      createdAt: new Date(),
    });

    // Simulate incoming DSN / Mail Delivery Subsystem bounce notification
    const parsedBounceEmail = {
      from: {
        value: [{ address: 'mailer-daemon@googlemail.com', name: 'Mail Delivery Subsystem' }],
      },
      subject: 'Delivery Status Notification (Failure)',
      text: `** Address not found **
Your message wasn't delivered to bouncedcustomer@gmail.com because the address couldn't be found, or is unable to receive mail.
The response from the remote server was:
550 5.1.1 The email account that you tried to reach does not exist.`,
    };

    const handled = await detectAndProcessBounce(parsedBounceEmail);
    expect(handled).toBe(true);

    // Verify EmailLog was updated to 'bounced'
    const updatedLog = await EmailLog.findById(initialLog._id);
    expect(updatedLog.status).toBe('bounced');
    expect(updatedLog.bounceReason).toMatch(/550|Address not found/i);
  });
});
