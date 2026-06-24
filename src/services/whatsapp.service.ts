import { WHATSAPP_API_URL } from '../config/secrets';

export class WhatsAppService {
  /**
   * Sends a message to a specific WhatsApp phone number via the configured wrapper API.
   * This assumes the API accepts a JSON payload with `to` and `text`.
   */
  static async sendMessage(toPhoneNumber: string, text: string): Promise<boolean> {
    const apiUrl = WHATSAPP_API_URL.value();

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any authorization headers required by your custom wrapper here
        },
        body: JSON.stringify({
          to: toPhoneNumber,
          text: text,
        }),
      });

      if (!response.ok) {
        console.error(`WhatsApp Service error: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  static async sendDiscrepancyNotification(toPhoneNumber: string, reason: string): Promise<boolean> {
    const text = `⚠️ *EOD Discrepancy Found*\n\nYour recent EOD report has a discrepancy with your morning To-Do list:\n_${reason}_\n\nPlease clarify or update your report.`;
    return this.sendMessage(toPhoneNumber, text);
  }

  static async sendLeaveFormReminder(toPhoneNumber: string): Promise<boolean> {
    const text = `ℹ️ *Leave Request Notice*\n\nYour manager has noted you are on leave today. Please ensure you submit the official Leave Form here: [INSERT FORM URL]`;
    return this.sendMessage(toPhoneNumber, text);
  }

  static async sendMorningTodoReminder(toPhoneNumber: string): Promise<boolean> {
    const text = `⏰ *Morning Reminder*\n\nPlease submit your morning To-Do list for today.`;
    return this.sendMessage(toPhoneNumber, text);
  }

  static async sendEveningEODReminder(toPhoneNumber: string): Promise<boolean> {
    const text = `⏰ *Evening Reminder*\n\nPlease submit your EOD status or ensure your forms are filled out for today.`;
    return this.sendMessage(toPhoneNumber, text);
  }
}
