import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyANX_GCQ1zcZrAcB8ab6YBRioI8JA6T68I",
  authDomain: "scramble-tourney.firebaseapp.com",
  projectId: "scramble-tourney",
  storageBucket: "scramble-tourney.firebasestorage.app",
  messagingSenderId: "996792937386",
  appId: "1:996792937386:web:9a39e82a4e904f956ad9d3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);