import { db } from '../config/firebase';
import { WhatsAppService } from '../services/whatsapp.service';

export class MorningSyncJob {
  static async execute(): Promise<void> {
    const dateStr = new Date().toISOString().split('T')[0];
    
    // We get all employees
    const employeesSnapshot = await db.collection('employees').get();
    
    for (const doc of employeesSnapshot.docs) {
      const whatsappId = doc.id;
      const logDocId = `${dateStr}_${whatsappId}`;
      
      const logRef = db.collection('daily_logs').doc(logDocId);
      const logDoc = await logRef.get();
      
      let hasTodo = false;
      if (logDoc.exists) {
        hasTodo = logDoc.data()?.todo_submitted === true;
      }
      
      // We assume todo_submitted is set to true by another webhook process when they submit the google form
      // If we don't have it, remind them
      if (!hasTodo) {
        await WhatsAppService.sendMorningTodoReminder(whatsappId);
      }
    }
  }
}
