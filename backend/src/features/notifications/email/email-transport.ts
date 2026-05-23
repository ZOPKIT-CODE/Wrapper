import axios from 'axios';
import nodemailer from 'nodemailer';
import 'dotenv/config';
import Logger from '../../../utils/logger.js';

export const BREVO_API_URL = 'https://api.brevo.com/v3';
export const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || 'noreply@wrapper.app';
export const senderName = process.env.BREVO_SENDER_NAME || process.env.SMTP_FROM_NAME || 'Wrapper';

Logger.log('info', 'general', 'emailTransport', 'Email configuration', {
  senderEmail,
  senderName,
  brevoApiUrl: BREVO_API_URL,
  hasApiKey: !!process.env.BREVO_API_KEY
});

// Create axios instance for Brevo API
export const brevoClient = axios.create({
  baseURL: BREVO_API_URL,
  headers: {
    'api-key': process.env.BREVO_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

export type EmailProvider = 'brevo' | 'smtp' | 'demo';

export interface SendEmailParams {
  to: Array<{ email: string; name?: string }> | { email: string; name?: string } | string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: unknown[];
}

export { nodemailer };
