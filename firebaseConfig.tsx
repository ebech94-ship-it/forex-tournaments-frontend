import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCIJOFPPjifvF8ePE97aswm06PDMJe0Ju4",
  authDomain: "forex-tournaments-arena.firebaseapp.com",
  projectId: "forex-tournaments-arena",
  storageBucket: "forex-tournaments-arena.firebasestorage.app",
  messagingSenderId: "895363795197",
  appId: "1:895363795197:web:04d948c27271c4b1611694",
  measurementId: "G-T9WK3PZRNV"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ✅ Export for use in other files
export { app, auth, db, storage };

