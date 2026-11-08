import rateLimit from 'express-rate-limit';
import { antiAbuseConfig } from '../config/antiAbuse.js';

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const reportSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many report submissions from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const classificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.firebaseUser.uid,
  message: { error: 'Too many classification requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many translation requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
export const guestReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: antiAbuseConfig.guestReportsPerHour,
  message: { error: 'Too many guest reports from this network. Please try again later or sign in.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const guestClassificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many classification requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});