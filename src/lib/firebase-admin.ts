import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            clientEmail: import.meta.env.VITE_FIREBASE_CLIENT_EMAIL,
            privateKey: import.meta.env.VITE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

export const adminDb = admin.firestore(); 