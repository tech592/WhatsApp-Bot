import { Request, Response } from 'express';
import { WHATSAPP_MANAGER_PHONE } from '../config/secrets';
import { WebhookPayload } from '../types';
import { EODWorkflow } from '../workflows/eod.workflow';
import { LeaveWorkflow } from '../workflows/leave.workflow';

export class WebhookController {
  static async handleOnMessage(req: Request, res: Response): Promise<void> {
    try {
      const payload: WebhookPayload = req.body;
      
      if (!payload || !payload.senderId || !payload.messageText) {
        res.status(400).send('Invalid payload');
        return;
      }

      const { senderId, messageText, isReply, replyToSenderId } = payload;
      const messageLower = messageText.toLowerCase();

      // Get current date string (YYYY-MM-DD)
      const dateStr = new Date().toISOString().split('T')[0];

      // Logic 1: Leave Verification
      // Triggered if the manager replies to a user's message saying "on leave"
      const managerPhone = WHATSAPP_MANAGER_PHONE.value();
      if (senderId === managerPhone && isReply && messageLower.includes('on leave')) {
        // In a real scenario, we might need to parse the employee name from the reply context
        // For simplicity, we assume we know the target employee's phone number via replyToSenderId
        if (replyToSenderId) {
          // Dummy name look up or passing null if name isn't directly known, 
          // the LeaveWorkflow would ideally look up by ID instead.
          // We will pass the target employee ID.
          await LeaveWorkflow.process('Unknown Name', replyToSenderId, dateStr);
        }
        res.status(200).send('Processed Leave');
        return;
      }

      // Logic 2: EOD Verification
      // Triggered if the message contains EOD markers
      if (messageLower.includes('eod') || messageLower.includes('status')) {
        await EODWorkflow.process(senderId, messageText, dateStr);
        res.status(200).send('Processed EOD');
        return;
      }

      res.status(200).send('Message ignored');
    } catch (error) {
      console.error('Error handling webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}
