import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { ALL_SECRETS } from './config/secrets';
import { WebhookController } from './controllers/webhook.controller';
import { MorningSyncJob } from './jobs/morning.sync';
import { EveningSyncJob } from './jobs/evening.sync';

// Webhook HTTPS Trigger for WhatsApp messages
export const onMessage = onRequest(
  { secrets: ALL_SECRETS },
  async (req, res) => {
    logger.info('Received WhatsApp webhook payload', { body: req.body });
    await WebhookController.handleOnMessage(req, res);
  }
);

// Scheduled Morning Sync: Runs daily at 10:00 AM in Asia/Kolkata timezone
export const morningSync = onSchedule(
  {
    schedule: '0 10 * * *',
    timeZone: 'Asia/Kolkata',
    secrets: ALL_SECRETS,
  },
  async (event) => {
    logger.info('Starting Morning Sync Job');
    await MorningSyncJob.execute();
    logger.info('Completed Morning Sync Job');
  }
);

// Scheduled Evening Sync: Runs daily at 5:30 PM (17:30) in Asia/Kolkata timezone
export const eveningSync = onSchedule(
  {
    schedule: '30 17 * * *',
    timeZone: 'Asia/Kolkata',
    secrets: ALL_SECRETS,
  },
  async (event) => {
    logger.info('Starting Evening Sync Job');
    await EveningSyncJob.execute();
    logger.info('Completed Evening Sync Job');
  }
);
