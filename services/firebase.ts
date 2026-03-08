/**
 * Firebase 初始化 (僅用於文字資料儲存，可與其他系統共用同一專案)
 * 所有集合名稱皆加前綴，不與其他系統的 collections 衝突，僅外掛上去
 * 附檔仍使用 Google Drive，經由 GAS 上傳
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** 集合名稱前綴，與其他系統隔離，預設 edutrack_（可於 .env 設 VITE_FIREBASE_COLLECTION_PREFIX） */
const COLLECTION_PREFIX = (import.meta.env.VITE_FIREBASE_COLLECTION_PREFIX ?? 'edutrack_').replace(/\/$/, '');

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.projectId) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb(): Firestore | null {
  if (!getFirebaseApp()) return null;
  if (!db) {
    db = getFirestore(app!);
  }
  return db;
}

export function getAuthInstance(): Auth | null {
  if (!getFirebaseApp()) return null;
  if (!auth) {
    auth = getAuth(app!);
  }
  return auth;
}

/** 本系統專用集合（皆帶前綴，不影響其他系統） */
export const COLLECTIONS = {
  COURSES: `${COLLECTION_PREFIX}courses`,
  STUDENTS: `${COLLECTION_PREFIX}students`,
  AWARDS: `${COLLECTION_PREFIX}awards`,
  VENDORS: `${COLLECTION_PREFIX}vendors`,
  ARCHIVE: `${COLLECTION_PREFIX}archive`,
  TODOS: `${COLLECTION_PREFIX}todos`,
} as const;

/** 供 Firestore 規則使用：目前前綴（若你自訂前綴，規則裡的集合名要一致） */
export const getCollectionPrefix = () => COLLECTION_PREFIX;
