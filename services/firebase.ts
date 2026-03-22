/**
 * Firebase 初始化 (僅用於文字資料儲存，可與其他系統共用同一專案)
 * 所有集合名稱皆加前綴，不與其他系統的 collections 衝突，僅外掛上去
 * 附檔仍使用 Google Drive，經由 GAS 上傳
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getAnalytics, type Analytics } from 'firebase/analytics';

/** 預設 Firebase 專案（與其他系統相同），Vercel 等部署不需再設環境變數；本機可用 .env 覆寫 */
const defaultConfig = {
  apiKey: 'AIzaSyBwlZOsjFegMLwgZn5DhczD_z-y-H2t7g4',
  authDomain: 'jcpsacadamicsubteachpro.firebaseapp.com',
  projectId: 'jcpsacadamicsubteachpro',
  storageBucket: 'jcpsacadamicsubteachpro.firebasestorage.app',
  messagingSenderId: '1054145930017',
  appId: '1:1054145930017:web:774d79061ad1fc2c7e5460',
  measurementId: 'G-R5K71QKQ5X',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId || undefined,
};

/** 集合名稱前綴，與其他系統隔離，預設 edutrack_（可於 .env 設 VITE_FIREBASE_COLLECTION_PREFIX） */
const COLLECTION_PREFIX = (import.meta.env.VITE_FIREBASE_COLLECTION_PREFIX ?? 'edutrack_').replace(/\/$/, '');

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.projectId) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/** 若有設定 VITE_FIREBASE_MEASUREMENT_ID 則回傳 Analytics 實例，供分析使用 */
export function getAnalyticsInstance(): Analytics | null {
  if (!getFirebaseApp() || !firebaseConfig.measurementId) return null;
  if (!analytics) {
    analytics = getAnalytics(app!);
  }
  return analytics;
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
  /** 行政行事曆：每月固定出現的事項規則 */
  MONTHLY_RECURRING_TODOS: `${COLLECTION_PREFIX}monthly_recurring_todos`,
  ALLOWED_USERS: `${COLLECTION_PREFIX}allowed_users`,
  EXAM_PAPERS: `${COLLECTION_PREFIX}exam_papers`,
  EXAM_PAPER_FOLDERS: `${COLLECTION_PREFIX}exam_paper_folders`,
  EXAM_PAPER_CHECKS: `${COLLECTION_PREFIX}exam_paper_checks`,
  LANGUAGE_ELECTIVE: `${COLLECTION_PREFIX}language_elective`,
  /** 系統設定（如選修語言類別），單一 doc settings */
  SYSTEM: `${COLLECTION_PREFIX}system`,
  /** 學期／放假日設定（點名單用），doc id = 學年_學期，如 114_下學期 */
  CALENDAR_SETTINGS: `${COLLECTION_PREFIX}calendar_settings`,
  /** 段考提報：活動 */
  EXAM_CAMPAIGNS: `${COLLECTION_PREFIX}exam_campaigns`,
  /** 段考提報：提報資料（活動×班級，一班一筆） */
  EXAM_SUBMISSIONS: `${COLLECTION_PREFIX}exam_submissions`,
  /** 段考提報：獎項設定（單一 doc exam_awards） */
  EXAM_SYSTEM: `${COLLECTION_PREFIX}exam_system`,
  /** 計畫／預算（核配額、已支出、剩餘追蹤） */
  BUDGET_PLANS: `${COLLECTION_PREFIX}budget_plans`,
  /** 計畫專案代墊紀錄 */
  BUDGET_PLAN_ADVANCES: `${COLLECTION_PREFIX}budget_plan_advances`,
} as const;

/** 供 Firestore 規則使用：目前前綴（若你自訂前綴，規則裡的集合名要一致） */
export const getCollectionPrefix = () => COLLECTION_PREFIX;
