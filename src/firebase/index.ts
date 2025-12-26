'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (getApps().length) {
    return getSdks(getApp());
  }

  let firebaseApp;
  // When in development, always use the explicit config object.
  // In production, App Hosting automatically provides the configuration.
  if (process.env.NODE_ENV === 'development') {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    try {
      // Try to initialize from App Hosting's environment variables in production.
      firebaseApp = initializeApp();
    } catch (e) {
      console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      // Fallback for production if auto-init fails for some reason.
      firebaseApp = initializeApp(firebaseConfig);
    }
  }

  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';