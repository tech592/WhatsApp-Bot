import { db } from '../config/firebase';
import { TODO_SHEET_ID, LEAVE_SHEET_ID } from '../config/secrets';
import { SheetsService } from '../services/sheets.service';
import { WhatsAppService } from '../services/whatsapp.service';

export class EveningSyncJob {
  static async execute(): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    
    const employeesSnapshot = await db.collection('employees').get();
    const todoSheetId = TODO_SHEET_ID.value();
    const leaveSheetId = LEAVE_SHEET_ID.value();

    for (const doc of employeesSnapshot.docs) {
      const whatsappId = doc.id;
      const fullName = doc.data()?.fullName;
      
      if (!fullName) continue;

      // 1. Check if they are on leave
      const leaveRow = await SheetsService.findUserRowForDate(leaveSheetId, 'Form Responses 1', fullName, dateStr);
      if (leaveRow) {
        // Employee is on leave today, skip EOD reminder
        continue;
      }

      // 2. Check Daily Log for EOD Text
      const logDocId = `${dateStr}_${whatsappId}`;
      const logDoc = await db.collection('daily_logs').doc(logDocId).get();
      
      const hasEOD = logDoc.exists && !!(logDoc.data()?.eod_text);

      // 3. Check if To-Do Form was submitted (either in DB or Sheets)
      let hasTodo = logDoc.exists && !!(logDoc.data()?.todo_submitted);
      if (!hasTodo) {
        // Fallback to checking the sheet directly
        const todoRow = await SheetsService.findUserRowForDate(todoSheetId, 'Form Responses 1', fullName, dateStr);
        if (todoRow) {
          hasTodo = true;
          await db.collection('daily_logs').doc(logDocId).set({ todo_submitted: true }, { merge: true });
        }
      }

      // If missing either EOD or Todo (and not on leave), send reminder
      if (!hasEOD || !hasTodo) {
        await WhatsAppService.sendEveningEODReminder(whatsappId);
      }
    }
  }
}
