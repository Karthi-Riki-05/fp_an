'use strict';

// Lazy-require nodemailer so the backend doesn't crash on startup if the
// package isn't installed yet (e.g. freshly pulled before `npm install`).
let _nodemailer = null;
function loadNodemailer() {
  if (_nodemailer) return _nodemailer;
  try {
    _nodemailer = require('nodemailer');
  } catch {
    throw new Error('nodemailer is not installed — run `npm install` in the backend container');
  }
  return _nodemailer;
}

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const nodemailer = loadNodemailer();
  _transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'mailhog',
    port: Number(process.env.MAIL_PORT || 1025),
    secure: false,
    auth: process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
      : undefined,
  });
  return _transporter;
}

async function sendConfirmationEmail({ toEmail, toName, confirmUrl }) {
  const from = `"${process.env.MAIL_FROM_NAME || 'FP Analyzer'}" <${process.env.MAIL_FROM || 'noreply@fpanalyzer.se'}>`;
  await getTransporter().sendMail({
    from,
    to: `"${toName}" <${toEmail}>`,
    subject: 'Confirm your FP Analyzer account',
    text: [
      `Hello ${toName},`,
      '',
      'An account has been created for you on FP Analyzer by the Super Administrator.',
      'Please confirm your email address by visiting the link below:',
      '',
      confirmUrl,
      '',
      'If you did not expect this email, you can ignore it.',
      '',
      '— FP Analyzer',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Confirm your FP Analyzer account</h2>
        <p>Hello <strong>${toName}</strong>,</p>
        <p>An account has been created for you on FP Analyzer by the Super Administrator.</p>
        <p>Please confirm your email address:</p>
        <p style="margin:24px 0">
          <a href="${confirmUrl}"
             style="background:#01b9d0;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;display:inline-block">
            Confirm Account
          </a>
        </p>
        <p style="font-size:12px;color:#888">
          Or copy this link into your browser:<br>
          <a href="${confirmUrl}">${confirmUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:11px;color:#aaa">FP Analyzer — Flow Process Sweden AB</p>
      </div>
    `,
  });
}

/**
 * One-time-password email — used by the mobile reset-password and
 * demo-signup flows. The 6-digit code lives in Redis with a 10-minute
 * TTL (see services/otp.service.js); this just delivers it.
 */
async function sendOtpEmail({ toEmail, toName, code, purpose }) {
  const from = `"${process.env.MAIL_FROM_NAME || 'FP Analyzer'}" <${process.env.MAIL_FROM || 'noreply@fpanalyzer.se'}>`;
  const subject = purpose === 'registration'
    ? 'Your FP Analyzer signup code'
    : 'Your FP Analyzer password reset code';
  const intro = purpose === 'registration'
    ? 'Use this code to complete your FP Analyzer signup:'
    : 'Use this code to reset your FP Analyzer password:';
  await getTransporter().sendMail({
    from,
    to: toName ? `"${toName}" <${toEmail}>` : toEmail,
    subject,
    text: `${intro}\n\n  ${code}\n\nThe code is valid for 10 minutes.\nIf you did not request it, ignore this email.\n\n— FP Analyzer`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#01b9d0">${subject}</h2>
        <p>${intro}</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#f6f6f6;padding:18px;text-align:center;border-radius:6px;margin:18px 0">${code}</div>
        <p style="color:#666;font-size:13px">Valid for 10 minutes. If you didn't request this, ignore the email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="font-size:11px;color:#aaa">FP Analyzer — Flow Process Sweden AB</p>
      </div>`,
  });
}

module.exports = { sendConfirmationEmail, sendOtpEmail };
