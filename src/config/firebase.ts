import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Optional: Configure Firestore settings if needed
db.settings({ ignoreUndefinedProperties: true });

export { admin, db };
