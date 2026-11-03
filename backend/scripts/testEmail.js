import '../src/config/env.js';
import { verifyTransporter, sendEmail, diagnoseSmtpError } from '../src/services/emailService.js';

// Accept recipient from CLI arg (e.g. npm run email:test -- someone@example.com)
const targetEmail = (process.argv[2] || process.env.TEST_EMAIL || process.env.EMAIL_USER || 'test@example.com').trim();

// Strip any spaces from EMAIL_PASS (common when copying 4x4 Gmail App Passwords)
if (process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = process.env.EMAIL_PASS.replace(/\s+/g, '');
}

const rawPass = process.env.EMAIL_PASS || '';
const maskedPass = rawPass ? `${'*'.repeat(Math.max(0, rawPass.length - 4))}${rawPass.slice(-4)}` : '(not set)';
const isSandbox = process.env.EMAIL_MODE === 'sandbox';

console.log('====================================================');
console.log('          NovaShop Email Delivery Diagnostics       ');
console.log('====================================================');
console.log(`Target Recipient : ${targetEmail}`);
console.log(`Active Mode      : ${isSandbox ? 'SANDBOX (Mailtrap Dev Mode)' : 'REAL SMTP (Gmail / Production)'}`);
console.log(`EMAIL_HOST       : ${isSandbox ? (process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io') : (process.env.EMAIL_HOST || 'smtp.gmail.com')}`);
console.log(`EMAIL_PORT       : ${isSandbox ? (process.env.MAILTRAP_PORT || '2525') : (process.env.EMAIL_PORT || '465')}`);
console.log(`EMAIL_SECURE     : ${isSandbox ? 'false' : (process.env.EMAIL_SECURE || 'true')}`);
console.log(`EMAIL_USER       : ${process.env.EMAIL_USER || '(not set)'}`);
console.log(`EMAIL_PASS       : ${maskedPass} (${rawPass.length} chars)`);
console.log(`FROM_NAME        : ${process.env.FROM_NAME || 'NovaShop'}`);
console.log(`EMAIL_FROM       : ${process.env.EMAIL_FROM || `"${process.env.FROM_NAME || 'NovaShop'}" <${process.env.EMAIL_USER || 'noreply@novashop.com'}>`}`);
console.log('----------------------------------------------------');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function run() {
  if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
    console.error(`\n❌ Invalid recipient email address: "${targetEmail}"`);
    console.error('Usage: npm run email:test -- someone@example.com');
    process.exit(1);
  }

  console.log('[1/2] Verifying SMTP transporter connection...');
  const isVerified = await verifyTransporter();

  if (!isVerified) {
    console.error('\n❌ SMTP Transporter Verification FAILED.');
    console.error('\nActionable Troubleshooting Steps:');
    console.error('1. Gmail SMTP (Recommended):');
    console.error('   - Ensure 2-Step Verification is turned ON in your Google Account: https://myaccount.google.com/security');
    console.error('   - Generate a 16-character App Password at: https://myaccount.google.com/apppasswords (App Name: "NovaShop")');
    console.error('   - Set in backend/.env:');
    console.error('       EMAIL_HOST=smtp.gmail.com');
    console.error('       EMAIL_PORT=465');
    console.error('       EMAIL_SECURE=true');
    console.error('       EMAIL_USER=your-actual-email@gmail.com');
    console.error('       EMAIL_PASS=your16charpassword (spaces are automatically stripped)');
    console.error('       FROM_NAME=NovaShop');
    console.error('       EMAIL_FROM="NovaShop <your-actual-email@gmail.com>"');
    console.error('2. Error 535 / 534:');
    console.error('   - Your normal Google login password WILL NOT WORK. You MUST use an App Password.');
    console.error('3. Mailtrap Sandbox (Virtual Testing Only - Never delivers to real inboxes):');
    console.error('   - Set EMAIL_MODE=sandbox if you intentionally want to trap emails inside https://mailtrap.io.');
    process.exit(1);
  }

  console.log('\n[2/2] Transporter handshake successful. Sending test message...');
  const result = await sendEmail({
    to: targetEmail,
    subject: `NovaShop: SMTP Delivery Test [${new Date().toLocaleTimeString()}]`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid rgba(27,24,22,0.1);">
        <div style="background: #1B1816; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #FDFBF7; font-family: Georgia, serif; font-size: 22px; letter-spacing: 0.16em;">NOVASHOP</h1>
        </div>
        <div style="padding: 32px 28px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; background: #227B51; color: #FFFFFF; font-size: 22px;">✓</span>
          </div>
          <h2 style="font-family: Georgia, serif; color: #1B1816; margin-top: 0; text-align: center;">SMTP Delivery Test Successful</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #4A4441;">
            Congratulations! If you received this email, your NovaShop transactional email pipeline is correctly connected to Gmail SMTP and delivering messages to real customer inboxes.
          </p>
          <div style="background: #F9F5F0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; line-height: 1.6; color: #3A3532;">
            <strong>Test Details:</strong><br>
            Recipient: <code>${targetEmail}</code><br>
            Timestamp: ${new Date().toISOString()}<br>
            Host: ${process.env.EMAIL_HOST || 'smtp.gmail.com'}:${process.env.EMAIL_PORT || '465'}<br>
            Sender: ${process.env.FROM_NAME || 'NovaShop'} &lt;${process.env.EMAIL_USER}&gt;
          </div>
          <p style="font-size: 12px; color: #7A726C; margin: 0;">
            NovaShop Atelier & Concierge · Addis Ababa, Ethiopia
          </p>
        </div>
      </div>
    `,
    text: `NovaShop: SMTP Delivery Test\n\nCongratulations! Outbound transactional email delivery is functioning properly.\nRecipient: ${targetEmail}\nTimestamp: ${new Date().toISOString()}`,
    type: 'admin_test',
    statusCategory: 'security',
  });

  if (result.success) {
    console.log(`\n✅ Email successfully dispatched to: ${targetEmail}`);
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Subject: NovaShop: SMTP Delivery Test [${new Date().toLocaleTimeString()}]`);
    console.log('Check your recipient inbox (and spam/promotions tab) for the email.');
    process.exit(0);
  } else {
    console.error(`\n❌ Failed to dispatch email to ${targetEmail}`);
    console.error(`Error: ${result.error}`);
    const diag = diagnoseSmtpError({ message: result.error });
    if (diag.guidance) {
      console.error(`\nResolution Guide: ${diag.guidance}`);
    }
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\nUnexpected script error:', err.message);
  process.exit(1);
});
