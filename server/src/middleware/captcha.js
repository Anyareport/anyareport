export async function verifyCaptcha(req, res, next) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const token = req.body.captchaToken;

  if (!secret || secret.includes('your-recaptcha')) {
    console.warn('[CAPTCHA] Secret key not configured — skipping verification');
    return next();
  }

  if (!token) {
    return res.status(400).json({ error: 'CAPTCHA token required' });
  }

  try {
    const params = new URLSearchParams({
      secret,
      response: token,
    });
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await response.json();

    if (!data.success || (data.score !== undefined && data.score < 0.5)) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
    next();
  } catch (err) {
    console.error('[CAPTCHA] Verification error:', err.message);
    return res.status(500).json({ error: 'CAPTCHA verification service error' });
  }
}
