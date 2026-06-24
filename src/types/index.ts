export interface WebhookPayload {
  senderId: string; // Phone number
  messageText: string;
  timestamp: string;
  isReply: boolean;
  replyToMessageText?: string;
  replyToSenderId?: string;
}

export interface Employee {
  fullName: string;
  // Extracted from doc ID (whatsappId)
}

export interface DailyLog {
  todo_submitted: boolean;
  eod_text: string | null;
  sheet_status: string | null;
  verified: boolean;
  discrepancy_found: boolean;
}

export interface LeaveLog {
  form_submitted: boolean;
}

export interface GeminiVerificationResponse {
  match: boolean;
  discrepancyReason: string;
}
