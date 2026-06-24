import { db } from '../config/firebase';
import { LEAVE_SHEET_ID } from '../config/secrets';
import { SheetsService } from '../services/sheets.service';
import { WhatsAppService } from '../services/whatsapp.service';

export class LeaveWorkflow {
  /**
   * Processes a leave notification triggered by the manager.
   * Extracts the employee's name/ID from the reply context or text.
   */
  static async process(mentionedEmployeeFullName: string, employeePhoneId: string, dateStr: string): Promise<void> {
    const docId = `${dateStr}_${employeePhoneId}`;
    const leaveLogRef = db.collection('leave_logs').doc(docId);

    // Check if a leave form exists
    const sheetId = LEAVE_SHEET_ID.value();
    const sheetRowText = await SheetsService.findUserRowForDate(sheetId, 'Form Responses 1', mentionedEmployeeFullName, dateStr);

    if (sheetRowText) {
      // Form exists
      await leaveLogRef.set({
        form_submitted: true,
      }, { merge: true });
    } else {
      // No form submitted
      await leaveLogRef.set({
        form_submitted: false,
      }, { merge: true });

      // Notify user to submit the form
      await WhatsAppService.sendLeaveFormReminder(employeePhoneId);
    }
  }
}
