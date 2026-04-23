// firebase-messaging-sw.js
// Handles push notifications when the app is in the background or closed.
// This file MUST stay at public/firebase-messaging-sw.js (served at the root).
//
// IMPORTANT: Fill in your Firebase project config below.
// These are PUBLIC values (not secrets) — safe to commit.
// Find them at: Firebase console → Project Settings → General → Your apps

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDsL1u7PE54HXiUffYWwzEf-Y5aIzTqqCw',
  authDomain:        'shcp-health.firebaseapp.com',
  projectId:         'shcp-health',
  storageBucket:     'shcp-health.firebasestorage.app',
  messagingSenderId: '451876371340',
  appId:             '1:451876371340:web:2df704e0fa1b4afb6bf4a9',
});

const messaging = firebase.messaging();

// Handles messages when the browser tab is closed or in the background
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'SHCP Notification', {
    body:  body  ?? '',
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    data:  payload.data,
  });
});
