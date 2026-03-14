import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfjXL8H274JvczbZfgMN2zYDVgosCMd-s",
  authDomain: "whatdoubuy.firebaseapp.com",
  projectId: "whatdoubuy",
  storageBucket: "whatdoubuy.firebasestorage.app",
  messagingSenderId: "638115613241",
  appId: "1:638115613241:web:8ed56bf8161288a4761be8",
  measurementId: "G-GCTQH8EHGH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
