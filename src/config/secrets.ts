import { defineSecret } from 'firebase-functions/params';

export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
export const GOOGLE_SHEETS_SERVICE_ACCOUNT = defineSecret('GOOGLE_SHEETS_SERVICE_ACCOUNT');
export const TODO_SHEET_ID = defineSecret('TODO_SHEET_ID');
export const LEAVE_SHEET_ID = defineSecret('LEAVE_SHEET_ID');
export const WHATSAPP_API_URL = defineSecret('WHATSAPP_API_URL');
export const WHATSAPP_MANAGER_PHONE = defineSecret('WHATSAPP_MANAGER_PHONE');

export const ALL_SECRETS = [
  GEMINI_API_KEY,
  GOOGLE_SHEETS_SERVICE_ACCOUNT,
  TODO_SHEET_ID,
  LEAVE_SHEET_ID,
  WHATSAPP_API_URL,
  WHATSAPP_MANAGER_PHONE
];
