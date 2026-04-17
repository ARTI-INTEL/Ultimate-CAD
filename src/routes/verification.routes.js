import { Router } from 'express';
import pool from '../db.js';
import { verifyUser } from '../middleware/auth.middleware.js';
import nodemailer from 'nodemailer';

const router = Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /verification/send
router.post('/send', verifyUser, async (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });

  try {
    const [rows] = await pool.query(
      'SELECT email FROM users WHERE iduser = ?',
      [req.user.iduser]
    );
    const email = rows[0]?.email;
    if (!email)
      return res.status(400).json({ error: 'No email address on file. Please add one in Account Settings first.' });

    // Remove old unused codes for this user+action
    await pool.query(
      'DELETE FROM verification_codes WHERE user_id = ? AND action = ? AND used = 0',
      [req.user.iduser, action]
    );

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      'INSERT INTO verification_codes (user_id, code, action, expires_at) VALUES (?, ?, ?, ?)',
      [req.user.iduser, code, action, expiresAt]
    );

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Ultimate CAD" <noreply@ultimatecad.com>',
        to: email,
        subject: 'Ultimate CAD – Verification Code',
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
        html: `<p>Your verification code is: <strong style="font-size:1.4em;letter-spacing:0.15em">${code}</strong></p>
               <p>This code expires in 10 minutes.</p>
               <p style="color:#888">If you did not request this, ignore this email.</p>`,
      });
    } else {
      // Dev fallback — no SMTP configured
      console.log(`[DEV] Verification code for ${email} (${action}): ${code}`);
    }

    // Return masked email so frontend can show "sent to ab***@gmail.com"
    const masked = email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);
    res.json({ success: true, maskedEmail: masked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// POST /verification/verify
router.post('/verify', verifyUser, async (req, res) => {
  const { code, action } = req.body;
  if (!code || !action) return res.status(400).json({ error: 'code and action are required' });

  try {
    const [rows] = await pool.query(
      `SELECT * FROM verification_codes
       WHERE user_id = ? AND code = ? AND action = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.iduser, code.trim(), action]
    );

    if (!rows.length)
      return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });

    await pool.query('UPDATE verification_codes SET used = 1 WHERE id = ?', [rows[0].id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during verification.' });
  }
});

export default router;