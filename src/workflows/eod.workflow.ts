import { db } from '../config/firebase';
import { TODO_SHEET_ID } from '../config/secrets';
import { GeminiService } from '../services/gemini.service';
import { SheetsService } from '../services/sheets.service';
import { WhatsAppService } from '../services/whatsapp.service';

export class EODWorkflow {
  static async process(senderId: string, messageText: string, dateStr: string): Promise<void> {
    const docId = `${dateStr}_${senderId}`;
    const dailyLogRef = db.collection('daily_logs').doc(docId);
    
    // First, save the EOD text
    await dailyLogRef.set({
      eod_text: messageText,
      verified: false,
    }, { merge: true });

    // Look up the user's full name in the employees collection
    const employeeDoc = await db.collection('employees').doc(senderId).get();
    if (!employeeDoc.exists) {
      console.warn(`No employee record found for phone number: ${senderId}`);
      return;
    }

    const fullName = employeeDoc.data()?.fullName;
    if (!fullName) return;

    // Fetch the user's To-Do row for today
    const sheetId = TODO_SHEET_ID.value();
    const sheetRowText = await SheetsService.findUserRowForDate(sheetId, 'Form Responses 1', fullName, dateStr);

    if (!sheetRowText) {
      console.warn(`No To-Do sheet row found for ${fullName} on ${dateStr}`);
      // Mark as unverified or status missing
      await dailyLogRef.update({
        sheet_status: 'Missing To-Do Form',
        discrepancy_found: true
      });
      return;
    }

    // Verify with Gemini
    const verification = await GeminiService.verifyEODMatch(messageText, sheetRowText);

    // Update Firestore with the results
    await dailyLogRef.update({
      verified: true,
      discrepancy_found: !verification.match,
    });

    // Send discrepancy notification if needed
    if (!verification.match && verification.discrepancyReason) {
      await WhatsAppService.sendDiscrepancyNotification(senderId, verification.discrepancyReason);
    }
  }
}
