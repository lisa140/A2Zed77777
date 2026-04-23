import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Debug: Log configuration status (only in development)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("🔥 Firebase Config Check:", {
    apiKey: firebaseConfig.apiKey ? "✓ Loaded" : "✗ Missing",
    authDomain: firebaseConfig.authDomain ? "✓ Loaded" : "✗ Missing",
    projectId: firebaseConfig.projectId ? "✓ Loaded" : "✗ Missing",
    allConfigured: Object.values(firebaseConfig).every(Boolean),
  });
}

// Validate that all required config values are present
const missingVars = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(
    ([key]) =>
      `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`
  );

if (missingVars.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingVars.join(", ")}. ` +
      `Please check your .env.local file at the project root.`
  );
}

// Initialize Firebase (prevent multiple instances)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Optional: Customize Google provider
googleProvider.setCustomParameters({
  prompt: "select_account", // Always show account picker
});

export default app;
