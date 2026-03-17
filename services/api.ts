/**
 * 統一 API 層
 * - 文字資料：Firebase Firestore（Sandbox 時改為記憶體模擬）
 * - 本土語名單紀錄（課程＋學生）：僅存於 Firestore，不寫入 Google 試算表；GAS 僅負責建立 Drive 點名單檔案。
 * - 附檔／點名單檔案／頒獎 Doc：GAS → Google Drive（Sandbox 時為 mock）
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { getDb, COLLECTIONS } from './firebase';
import { DEFAULT_LANGUAGE_OPTIONS } from '../utils/languageOptions';
import type { Student, AwardRecord, Vendor, ArchiveTask, TodoItem, Attachment, ExamPaper, ExamPaperFolder, ExamPaperCheck, LanguageElectiveStudent, LanguageElectiveRosterDoc, LanguageClassSetting, CalendarSettings } from '../types';
import {
  isSandbox,
  mockGasPost,
  sandboxGetHistory,
  sandboxGetCourseStudents,
  sandboxSaveCourseConfig,
  sandboxGetSemesterData,
  sandboxGetAwardHistory,
  sandboxSaveAwardRecord,
  sandboxGetAllKnownStudents,
  sandboxGetVendors,
  sandboxSaveVendor,
  sandboxDeleteVendor,
  sandboxGetArchiveTasks,
  sandboxSaveArchiveTask,
  sandboxDeleteArchiveTask,
  sandboxGetTodos,
  sandboxSaveTodo,
  sandboxSaveBatchTodos,
  sandboxDeleteTodo,
  sandboxCancelSeries,
  sandboxToggleTodoStatus,
  sandboxGetExamPaperFolders,
  sandboxSaveExamPaperFolder,
  sandboxDeleteExamPaperFolder,
  sandboxGetExamPapers,
  sandboxSaveExamPaper,
  sandboxDeleteExamPaper,
  sandboxGetExamPaperChecks,
  sandboxSetExamPaperCheck,
  sandboxGetLanguageElectiveRoster,
  sandboxGetAllLanguageElectiveRosters,
  sandboxSaveLanguageElectiveRoster,
  sandboxGetLanguageOptions,
  sandboxSaveLanguageOptions,
  sandboxGetCalendarSettings,
} from './sandboxStore';

const GAS_API_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbzWyYHtUbAMIFGBtMtXGvdXuAIiml1pAdf0qKykQ3vzCY5QFdAsMjCoyZ_Znam7oxRC/exec';

async function gasPost(action: string, payload: unknown = {}): Promise<{ success: boolean; data?: any; message?: string }> {
  if (isSandbox()) return mockGasPost(action, payload);
  const res = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

// --- Courses & Students (Firestore) ---

export interface CourseRecord {
  id: string;
  academicYear: string;
  semester: string;
  courseName: string;
  instructor: string;
  classTime: string;
  location: string;
  createdAt: string | unknown;
  fileUrl: string;
  startDate: string;
  endDate: string;
  selectedDays: string;
}

export async function getHistory(): Promise<CourseRecord[]> {
  if (isSandbox()) return sandboxGetHistory() as Promise<CourseRecord[]>;
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.COURSES), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.() ?? data.createdAt;
    return {
      id: d.id,
      academicYear: data.academicYear ?? '',
      semester: data.semester ?? '',
      courseName: data.courseName ?? '',
      instructor: data.instructor ?? '',
      classTime: data.classTime ?? '',
      location: data.location ?? '',
      createdAt,
      fileUrl: data.fileUrl ?? '',
      startDate: data.startDate ?? '',
      endDate: data.endDate ?? '',
      selectedDays: typeof data.selectedDays === 'string' ? data.selectedDays : JSON.stringify(data.selectedDays || []),
    };
  });
}

export async function getCourseStudents(courseId: string): Promise<Pick<Student, 'id' | 'period' | 'className' | 'name'>[]> {
  if (isSandbox()) return sandboxGetCourseStudents(courseId);
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.STUDENTS), where('courseId', '==', courseId))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id ?? '',
      period: data.period ?? '',
      className: data.className ?? '',
      name: data.name ?? '',
    };
  });
}

/** 先呼叫 GAS 建立點名單檔案於 Drive，再將課程與學生寫入 Firestore（不寫入 GS） */
export async function saveCourseConfig(payload: {
  academicYear: string;
  semester: string;
  courseName: string;
  instructorName: string;
  classTime: string;
  location: string;
  startDate?: string;
  endDate?: string;
  selectedDays?: number[];
  students?: Student[];
}): Promise<{ courseId: string; recordCount: number; driveFile?: any; message: string }> {
  if (isSandbox()) return sandboxSaveCourseConfig(payload);
  const db = getDb();
  const courseId = crypto.randomUUID?.() ?? `c-${Date.now()}`;
  let fileUrl = '';

  const driveRes = await gasPost('CREATE_ATTENDANCE_FILE', payload);
  if (driveRes.success && driveRes.data?.url) {
    fileUrl = driveRes.data.url;
  }

  const courseData: DocumentData = {
    academicYear: payload.academicYear ?? '',
    semester: payload.semester ?? '',
    courseName: payload.courseName ?? '',
    instructor: payload.instructorName ?? '',
    classTime: payload.classTime ?? '',
    location: payload.location ?? '',
    createdAt: serverTimestamp(),
    fileUrl,
    startDate: payload.startDate ?? '',
    endDate: payload.endDate ?? '',
    selectedDays: JSON.stringify(payload.selectedDays ?? []),
  };

  if (db) {
    await setDoc(doc(db, COLLECTIONS.COURSES, courseId), courseData);
    const students = payload.students ?? [];
    const studentsRef = collection(db, COLLECTIONS.STUDENTS);
    for (const s of students) {
      await addDoc(studentsRef, {
        courseId,
        id: s.id ?? '',
        period: s.period ?? '',
        className: s.className ?? '',
        name: s.name ?? '',
      });
    }
    return { courseId, recordCount: students.length, driveFile: driveRes.data, message: 'Saved successfully' };
  }

  return { courseId, recordCount: 0, driveFile: driveRes.data, message: 'Firebase not configured' };
}

export async function getSemesterData(payload: { academicYear: string; semester: string }) {
  if (isSandbox()) return sandboxGetSemesterData(payload);
  const all = await getHistory();
  const target = all.filter(
    (c) => String(c.academicYear) === String(payload.academicYear) && String(c.semester) === String(payload.semester)
  );
  const result = await Promise.all(
    target.map(async (c) => ({
      academicYear: c.academicYear,
      semester: c.semester,
      courseName: c.courseName,
      instructor: c.instructor,
      classTime: c.classTime,
      location: c.location,
      students: await getCourseStudents(c.id),
    }))
  );
  result.sort((a, b) => a.courseName.localeCompare(b.courseName));
  return result;
}

/** 從 Spreadsheet URL 匯入（仍由 GAS 讀取；Sandbox 時回傳模擬資料） */
export async function importFromSpreadsheet(payload: { url: string }) {
  if (isSandbox()) {
    const res = await mockGasPost('IMPORT_FROM_URL', payload);
    if (!res.success) throw new Error(res.message || 'Import failed');
    return (res.data?.data ?? res.data) as { academicYear: string; semester: string; courseName: string; instructorName: string; classTime: string; location: string; students: any[] };
  }
  const res = await gasPost('IMPORT_FROM_URL', payload);
  if (!res.success) throw new Error(res.message || 'Import failed');
  return (res.data?.data ?? res.data) as { academicYear: string; semester: string; courseName: string; instructorName: string; classTime: string; location: string; students: any[] };
}

// --- Awards (Firestore) ---

export async function getAwardHistory(): Promise<AwardRecord[]> {
  if (isSandbox()) return sandboxGetAwardHistory();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AWARDS), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.() ?? data.createdAt;
    const dateStr = data.date?.toDate?.() ? data.date.toDate().toISOString().slice(0, 10) : (data.date ?? '');
    return {
      id: d.id,
      date: dateStr,
      title: data.title ?? '',
      students: Array.isArray(data.students) ? data.students : [],
      createdAt,
    };
  });
}

export async function saveAwardRecord(payload: { date: string; title: string; students: any[] }) {
  if (isSandbox()) return sandboxSaveAwardRecord(payload);
  const db = getDb();
  const id = crypto.randomUUID?.() ?? `a-${Date.now()}`;
  if (db) {
    await setDoc(doc(db, COLLECTIONS.AWARDS, id), {
      date: payload.date,
      title: payload.title,
      students: payload.students ?? [],
      createdAt: serverTimestamp(),
    });
  }
  return { success: true, id };
}

/** 取得已知學生名單（從 Firestore 課程學生 + 頒獎紀錄彙總） */
export async function getAllKnownStudents(): Promise<{ className: string; name: string }[]> {
  if (isSandbox()) return sandboxGetAllKnownStudents();
  const db = getDb();
  if (!db) return [];
  const map = new Map<string, { className: string; name: string }>();
  const add = (className: string, name: string) => {
    if (!className || !name) return;
    const key = `${className}_${name}`;
    if (!map.has(key)) map.set(key, { className, name });
  };

  const studentsSnap = await getDocs(collection(db, COLLECTIONS.STUDENTS));
  studentsSnap.docs.forEach((d) => {
    const data = d.data();
    add(String(data.className ?? ''), String(data.name ?? ''));
  });
  const awardsSnap = await getDocs(collection(db, COLLECTIONS.AWARDS));
  awardsSnap.docs.forEach((d) => {
    const students = d.data().students;
    if (Array.isArray(students)) students.forEach((s: any) => add(s.className, s.name));
  });

  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className, undefined, { numeric: true });
    return a.name.localeCompare(b.name);
  });
  return result;
}

/** 產生頒獎通知 Doc（GAS → Google Drive） */
export async function createAwardDocs(payload: AwardRecord) {
  const res = await gasPost('CREATE_AWARD_DOCS', payload);
  if (!res.success) throw new Error(res.message);
  return res.data ?? res;
}

export async function createAwardSummaryDocs(payload: AwardRecord) {
  const res = await gasPost('CREATE_AWARD_SUMMARY_DOCS', payload);
  if (!res.success) throw new Error(res.message);
  return res.data ?? res;
}

// --- Vendors (Firestore) ---

export async function getVendors(): Promise<Vendor[]> {
  if (isSandbox()) return sandboxGetVendors();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, COLLECTIONS.VENDORS));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? '',
      category: data.category ?? '',
      contactPerson: data.contactPerson ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      lineId: data.lineId ?? '',
      address: data.address ?? '',
      note: data.note ?? '',
      relatedTasks: Array.isArray(data.relatedTasks) ? data.relatedTasks : [],
      qrcodeUrl: data.qrcodeUrl ?? '',
    };
  });
}

export async function saveVendor(payload: Partial<Vendor> & { name: string }) {
  if (isSandbox()) return sandboxSaveVendor(payload);
  const db = getDb();
  const id = payload.id ?? (crypto.randomUUID?.() ?? `v-${Date.now()}`);
  const data: DocumentData = {
    name: payload.name ?? '',
    category: payload.category ?? '',
    contactPerson: payload.contactPerson ?? '',
    phone: payload.phone ?? '',
    email: payload.email ?? '',
    lineId: payload.lineId ?? '',
    address: payload.address ?? '',
    note: payload.note ?? '',
    relatedTasks: payload.relatedTasks ?? [],
    qrcodeUrl: payload.qrcodeUrl ?? '',
  };
  if (db) {
    await setDoc(doc(db, COLLECTIONS.VENDORS, id), data);
  }
  return { success: true, id };
}

export async function deleteVendor(payload: { id: string }) {
  if (isSandbox()) return sandboxDeleteVendor(payload);
  const db = getDb();
  if (db) await deleteDoc(doc(db, COLLECTIONS.VENDORS, payload.id));
  return { success: true };
}

// --- Archive (Firestore) ---

export async function getArchiveTasks(): Promise<ArchiveTask[]> {
  if (isSandbox()) return sandboxGetArchiveTasks();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ARCHIVE), orderBy('updatedAt', 'desc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? '';
    return {
      id: d.id,
      title: data.title ?? '',
      month: data.month ?? '',
      isPrinted: data.isPrinted === true,
      isNotified: data.isNotified === true,
      notes: data.notes ?? '',
      updatedAt,
    };
  });
}

export async function saveArchiveTask(payload: Partial<ArchiveTask> & { title: string; month: string }) {
  if (isSandbox()) return sandboxSaveArchiveTask(payload);
  const db = getDb();
  const id = payload.id ?? (crypto.randomUUID?.() ?? `ar-${Date.now()}`);
  const now = new Date().toISOString();
  const data: DocumentData = {
    title: payload.title,
    month: payload.month,
    isPrinted: payload.isPrinted ?? false,
    isNotified: payload.isNotified ?? false,
    notes: payload.notes ?? '',
    updatedAt: now,
  };
  if (db) {
    await setDoc(doc(db, COLLECTIONS.ARCHIVE, id), data);
  }
  return { success: true, id };
}

export async function deleteArchiveTask(payload: { id: string }) {
  if (isSandbox()) return sandboxDeleteArchiveTask(payload);
  const db = getDb();
  if (db) await deleteDoc(doc(db, COLLECTIONS.ARCHIVE, payload.id));
  return { success: true };
}

// --- Todos (Firestore) ---

function todoToDoc(t: Partial<TodoItem>): DocumentData {
  return {
    date: t.date ?? '',
    title: t.title ?? '',
    type: t.type ?? 'task',
    status: t.status ?? 'pending',
    priority: t.priority ?? 'Medium',
    seriesId: t.seriesId ?? '',
    contacts: t.contacts ?? [],
    memo: t.memo ?? '',
    createdAt: t.createdAt ?? new Date().toISOString(),
    academicYear: t.academicYear ?? '114',
    attachments: (t.attachments ?? []).filter((x): x is Attachment => Boolean(x?.url)),
    commonAttachments: (t.commonAttachments ?? []).filter((x): x is Attachment => Boolean(x?.url)),
    officialDocs: t.officialDocs ?? [],
    topic: t.topic ?? '',
    commonContacts: t.commonContacts ?? [],
    period: t.period ?? 'full',
  };
}

export async function getTodos(): Promise<TodoItem[]> {
  if (isSandbox()) return sandboxGetTodos();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.TODOS), orderBy('date', 'asc'))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt;
    return {
      id: d.id,
      academicYear: data.academicYear ?? '114',
      date: data.date ?? '',
      title: data.title ?? '',
      type: data.type ?? 'task',
      status: data.status ?? 'pending',
      priority: data.priority ?? 'Medium',
      seriesId: data.seriesId,
      topic: data.topic ?? '',
      officialDocs: Array.isArray(data.officialDocs) ? data.officialDocs : [],
      contacts: Array.isArray(data.contacts) ? data.contacts : [],
      commonContacts: Array.isArray(data.commonContacts) ? data.commonContacts : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      commonAttachments: Array.isArray(data.commonAttachments) ? data.commonAttachments : [],
      memo: data.memo ?? '',
      createdAt: createdAt,
      period: data.period ?? 'full',
    } as TodoItem;
  });
}

export async function saveTodo(payload: Partial<TodoItem> & { date: string; title: string; type: string }) {
  if (isSandbox()) return sandboxSaveTodo(payload as any);
  const db = getDb();
  const id = payload.id ?? (crypto.randomUUID?.() ?? `t-${Date.now()}`);
  const topic = (payload.topic ?? '').trim();
  const seriesId = payload.seriesId ?? (payload as any).isSeries ? id : '';

  const docData = {
    ...todoToDoc(payload),
    seriesId: payload.seriesId ?? seriesId,
    topic,
    academicYear: payload.academicYear ?? '114',
    period: payload.period ?? 'full',
  };

  if (db) {
    await setDoc(doc(db, COLLECTIONS.TODOS, id), { ...docData, id });
    if (topic) {
      const all = await getDocs(
        query(
          collection(db, COLLECTIONS.TODOS),
          where('topic', '==', topic),
          where('academicYear', '==', payload.academicYear ?? '114')
        )
      );
      const batchData = { commonAttachments: docData.commonAttachments, commonContacts: docData.commonContacts };
      for (const d of all.docs) {
        if (d.id !== id) await updateDoc(d.ref, batchData);
      }
    }
  }
  return { success: true, message: 'Saved successfully', seriesId };
}

export async function saveBatchTodos(payload: { todos: Partial<TodoItem>[] }) {
  if (isSandbox()) return sandboxSaveBatchTodos(payload);
  const db = getDb();
  const todos = payload.todos ?? [];
  if (!db || todos.length === 0) return { success: false, message: 'No data to save' };
  for (const todo of todos) {
    const id = todo.id ?? (crypto.randomUUID?.() ?? `t-${Date.now()}`);
    await setDoc(doc(db, COLLECTIONS.TODOS, id), {
      id,
      date: todo.date ?? '',
      title: todo.title ?? '',
      type: todo.type ?? 'duty',
      status: todo.status ?? 'pending',
      priority: todo.priority ?? 'Medium',
      seriesId: '',
      contacts: [],
      memo: todo.memo ?? '',
      createdAt: new Date().toISOString(),
      academicYear: todo.academicYear ?? '114',
      attachments: [],
      commonAttachments: [],
      officialDocs: [],
      topic: '',
      commonContacts: [],
      period: todo.period ?? 'full',
    });
  }
  return { success: true, message: `Batch saved ${todos.length} items` };
}

export async function deleteTodo(payload: { id: string }) {
  if (isSandbox()) return sandboxDeleteTodo(payload);
  const db = getDb();
  if (db) await deleteDoc(doc(db, COLLECTIONS.TODOS, payload.id));
  return { success: true };
}

export async function cancelSeries(payload: { seriesId?: string; topic?: string; pivotDate: string; academicYear?: string }) {
  if (isSandbox()) return sandboxCancelSeries(payload);
  const db = getDb();
  if (!db) return { success: true, message: 'Series cancelled' };
  const pivot = new Date(payload.pivotDate);
  const all = await getDocs(collection(db, COLLECTIONS.TODOS));
  const targetTopic = (payload.topic ?? '').trim();
  for (const d of all.docs) {
    const data = d.data();
    const rowTopic = (data.topic ?? '').trim();
    const rowYear = data.academicYear ?? '114';
    const match = targetTopic ? rowTopic === targetTopic : (payload.seriesId && data.seriesId === payload.seriesId);
    if (match && (!payload.academicYear || String(rowYear) === String(payload.academicYear))) {
      const rowDate = new Date(data.date);
      if (rowDate >= pivot) await updateDoc(d.ref, { status: 'cancelled' });
    }
  }
  return { success: true, message: 'Series cancelled' };
}

export async function toggleTodoStatus(payload: { id: string; newStatus: TodoItem['status'] }) {
  if (isSandbox()) return sandboxToggleTodoStatus(payload);
  const db = getDb();
  if (!db) return { success: true };
  await updateDoc(doc(db, COLLECTIONS.TODOS, payload.id), { status: payload.newStatus });
  return { success: true };
}

/** 附檔上傳：仍經由 GAS 寫入 Google Drive */
export async function uploadAttachment(payload: { base64Data: string; name: string; mimeType: string; prefix?: string }) {
  const res = await gasPost('UPLOAD_ATTACHMENT', payload);
  if (!res.success) throw new Error(res.message);
  return res.data ?? res;
}

// --- Exam Paper Folders（考卷資料夾）---
export async function getExamPaperFolders(): Promise<ExamPaperFolder[]> {
  if (isSandbox()) return sandboxGetExamPaperFolders();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.EXAM_PAPER_FOLDERS), orderBy('order', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamPaperFolder));
}

export async function saveExamPaperFolder(payload: Omit<ExamPaperFolder, 'id'> & { id?: string }) {
  if (isSandbox()) return sandboxSaveExamPaperFolder(payload);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  const id = payload.id ?? doc(collection(db, COLLECTIONS.EXAM_PAPER_FOLDERS)).id;
  const row: DocumentData = {
    name: payload.name,
    order: payload.order ?? 0,
    parentId: payload.parentId ?? null,
    driveFolderUrl: payload.driveFolderUrl ?? null,
  };
  await setDoc(doc(db, COLLECTIONS.EXAM_PAPER_FOLDERS, id), row, { merge: true });
  return { success: true, id };
}

export async function deleteExamPaperFolder(payload: { id: string }) {
  if (isSandbox()) return sandboxDeleteExamPaperFolder(payload);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  await deleteDoc(doc(db, COLLECTIONS.EXAM_PAPER_FOLDERS, payload.id));
  return { success: true };
}

// --- Exam Papers（考卷存檔，僅白名單用戶可存取）---
export async function getExamPapers(): Promise<ExamPaper[]> {
  if (isSandbox()) return sandboxGetExamPapers();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.EXAM_PAPERS), orderBy('uploadedAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamPaper));
}

export async function saveExamPaper(payload: Omit<ExamPaper, 'id'> & { id?: string }) {
  if (isSandbox()) return sandboxSaveExamPaper(payload);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  const id = payload.id ?? doc(collection(db, COLLECTIONS.EXAM_PAPERS)).id;
  const row: DocumentData = {
    folderId: payload.folderId ?? null,
    title: payload.title ?? '',
    grade: payload.grade ?? null,
    domain: payload.domain ?? null,
    fileName: payload.fileName,
    fileUrl: payload.fileUrl,
    mimeType: payload.mimeType ?? 'application/octet-stream',
    fileId: payload.fileId ?? null,
    schoolYear: payload.schoolYear ?? null,
    semester: payload.semester ?? null,
    examType: payload.examType ?? null,
    authorTeacherName: payload.authorTeacherName ?? null,
    authorTeacherNote: payload.authorTeacherNote ?? null,
    uploadedBy: payload.uploadedBy,
    uploadedAt: payload.uploadedAt || new Date().toISOString(),
  };
  await setDoc(doc(db, COLLECTIONS.EXAM_PAPERS, id), row, { merge: true });
  return { success: true, id };
}

export async function deleteExamPaper(payload: { id: string }) {
  if (isSandbox()) return sandboxDeleteExamPaper(payload);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  await deleteDoc(doc(db, COLLECTIONS.EXAM_PAPERS, payload.id));
  return { success: true };
}

// --- Exam Paper Checks（年級 × 領域檢核，可編輯）---
function examPaperCheckId(grade: string, domain: string) {
  return `${grade}-${domain}`;
}

export async function getExamPaperChecks(): Promise<ExamPaperCheck[]> {
  if (isSandbox()) return sandboxGetExamPaperChecks();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, COLLECTIONS.EXAM_PAPER_CHECKS));
  return snap.docs.map((d) => d.data() as ExamPaperCheck);
}

export async function setExamPaperCheck(payload: { grade: string; domain: string; checked: boolean }) {
  if (isSandbox()) return sandboxSetExamPaperCheck(payload);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  const id = examPaperCheckId(payload.grade, payload.domain);
  await setDoc(
    doc(db, COLLECTIONS.EXAM_PAPER_CHECKS, id),
    { grade: payload.grade, domain: payload.domain, checked: payload.checked },
    { merge: true }
  );
  return { success: true };
}

// --- 系統設定（選修語言類別）：存於 Firestore，遺失時從名單彙整 ---
const SYSTEM_SETTINGS_DOC_ID = 'settings';

function collectLanguageOptionsFromRosters(rosters: { students?: { language?: string }[] }[]): string[] {
  const set = new Set<string>(DEFAULT_LANGUAGE_OPTIONS);
  rosters.forEach((r) => {
    (r.students ?? []).forEach((s) => {
      const v = (s.language ?? '').trim();
      if (v) set.add(v);
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-TW'));
}

/** 取得選修語言類別：Firebase 有則回傳；無或空則從各學年名單彙整後寫入 Firebase 並回傳，確保不再消失 */
export async function getLanguageOptions(forceRefresh = false): Promise<string[]> {
  if (isSandbox()) return sandboxGetLanguageOptions();
  const db = getDb();
  if (!db) return [...DEFAULT_LANGUAGE_OPTIONS];
  if (!forceRefresh && languageOptionsCache.length > 0) return [...languageOptionsCache];
  const ref = doc(db, COLLECTIONS.SYSTEM, SYSTEM_SETTINGS_DOC_ID);
  const snap = await getDoc(ref);
  const data = snap.data();
  const stored = Array.isArray(data?.languageOptions) ? data.languageOptions : [];
  if (stored.length > 0) {
    languageOptionsCache = stored;
    return [...stored];
  }
  const rosters = await getAllLanguageElectiveRosters();
  const merged = collectLanguageOptionsFromRosters(rosters);
  await setDoc(ref, { languageOptions: merged, updatedAt: serverTimestamp() }, { merge: true });
  languageOptionsCache = merged;
  return [...merged];
}

let languageOptionsCache: string[] = [];

/** 儲存選修語言類別至 Firebase */
export async function saveLanguageOptionsToFirebase(options: string[]): Promise<void> {
  if (isSandbox()) return sandboxSaveLanguageOptions(options);
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  const ref = doc(db, COLLECTIONS.SYSTEM, SYSTEM_SETTINGS_DOC_ID);
  const list = options.length > 0 ? options : [...DEFAULT_LANGUAGE_OPTIONS];
  await setDoc(ref, { languageOptions: list, updatedAt: serverTimestamp() }, { merge: true });
  languageOptionsCache = list;
}

/** 從各學年名單彙整出所有出現過的語言，與目前設定做聯集後寫回 Firebase，並回傳新列表（用於「從名單恢復」） */
export async function mergeLanguageOptionsFromRosters(): Promise<string[]> {
  const rosters = await getAllLanguageElectiveRosters();
  const fromRosters = collectLanguageOptionsFromRosters(rosters);
  const current = await getLanguageOptions(true);
  const merged = Array.from(new Set([...current, ...fromRosters])).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  await saveLanguageOptionsToFirebase(merged);
  return merged;
}

// --- 學生語言選修登錄 (Language Elective) ---
/** 以學年為 doc id（不分上下學期） */
function languageElectiveDocId(academicYear: string) {
  return academicYear;
}

export async function getLanguageElectiveRoster(academicYear: string): Promise<LanguageElectiveRosterDoc | null> {
  if (isSandbox()) return sandboxGetLanguageElectiveRoster(academicYear);
  const db = getDb();
  if (!db) return null;
  const docSnap = await getDoc(doc(db, COLLECTIONS.LANGUAGE_ELECTIVE, languageElectiveDocId(academicYear)));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    academicYear: String(data.academicYear ?? academicYear),
    semester: data.semester ?? '',
    students: Array.isArray(data.students) ? data.students : [],
    languageClassSettings: Array.isArray(data.languageClassSettings) ? data.languageClassSettings : undefined,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
  };
}

export async function getAllLanguageElectiveRosters(): Promise<LanguageElectiveRosterDoc[]> {
  if (isSandbox()) return sandboxGetAllLanguageElectiveRosters();
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, COLLECTIONS.LANGUAGE_ELECTIVE));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        academicYear: String(data.academicYear ?? d.id),
        semester: data.semester ?? '',
        students: Array.isArray(data.students) ? data.students : [],
        languageClassSettings: Array.isArray(data.languageClassSettings) ? data.languageClassSettings : undefined,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt,
      };
    })
    .sort((a, b) => parseInt(b.academicYear, 10) - parseInt(a.academicYear, 10));
}

// --- 學期／放假日設定 (點名單用) ---
const calendarSettingsDocId = (academicYear: string, semester: string) => `${academicYear}_${semester}`;

export async function getCalendarSettings(academicYear: string, semester: string): Promise<CalendarSettings | null> {
  if (isSandbox()) return sandboxGetCalendarSettings(academicYear, semester);
  const db = getDb();
  if (!db) return null;

  // 1) 優先讀取本系統的前綴集合：edutrack_calendar_settings/{學年_學期}
  const docSnap = await getDoc(doc(db, COLLECTIONS.CALENDAR_SETTINGS, calendarSettingsDocId(academicYear, semester)));
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      academicYear: String(data.academicYear ?? academicYear),
      semester: String(data.semester ?? semester),
      startDate: data.startDate != null ? String(data.startDate) : undefined,
      endDate: data.endDate != null ? String(data.endDate) : undefined,
      holidays: Array.isArray(data.holidays) ? data.holidays.map((h: any) => String(h)) : undefined,
    };
  }

  // 2) 相容既有主系統：system/settings（semesterStart, semesterEnd）與 system/holidays
  //    注意：此路徑不帶 edutrack_ 前綴，與本系統其他集合不同。
  const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
  if (!settingsSnap.exists()) return null;
  const settings = settingsSnap.data() as any;
  const startDate = settings?.semesterStart != null ? String(settings.semesterStart) : undefined;
  const endDate = settings?.semesterEnd != null ? String(settings.semesterEnd) : undefined;

  let holidays: string[] | undefined = undefined;
  const holidaysSnap = await getDoc(doc(db, 'system', 'holidays'));
  if (holidaysSnap.exists()) {
    const h = holidaysSnap.data() as any;
    if (Array.isArray(h?.holidays)) holidays = h.holidays.map((x: any) => String(x));
    else if (Array.isArray(h?.dates)) holidays = h.dates.map((x: any) => String(x));
    else if (h && typeof h === 'object') {
      // 可能以 { "2026-02-28": true, ... } 或 { "2026-02-28": "和平紀念日", ... } 形式存放
      holidays = Object.keys(h).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    }
  }

  return {
    academicYear: String(academicYear),
    semester: String(semester),
    startDate,
    endDate,
    holidays,
  };
}

/** 依姓名繼承：從過往學期名單取得「姓名 → 選修語言」對照（同一姓名取最近一筆）；姓名以 trim 比對。 */
export function buildNameToLanguageFromRosters(rosters: LanguageElectiveRosterDoc[]): Record<string, string> {
  const nameToLang: Record<string, string> = {};
  for (const r of rosters) {
    for (const s of r.students || []) {
      const name = (s.name && String(s.name).trim()) || '';
      const lang = s.language != null ? String(s.language).trim() : '';
      if (name) nameToLang[name] = lang;
    }
  }
  return nameToLang;
}

/** Firestore 不接受 undefined，寫入前將學生與班別設定中的 undefined 轉為可序列化值 */
function sanitizeLanguageElectivePayload(
  students: LanguageElectiveStudent[],
  languageClassSettings?: LanguageClassSetting[]
) {
  const studentsPayload = students.map((s) => ({
    className: s.className ?? '',
    seat: s.seat ?? '',
    name: s.name ?? '',
    language: s.language ?? '',
    languageClass: s.languageClass ?? null,
  }));
  const settingsPayload =
    languageClassSettings?.map((s) => ({
      id: s.id ?? '',
      name: s.name ?? '',
      classroom: s.classroom ?? null,
      time: s.time ?? null,
      teacher: s.teacher ?? null,
    })) ?? undefined;
  return { studentsPayload, settingsPayload };
}

export async function saveLanguageElectiveRoster(
  academicYear: string,
  students: LanguageElectiveStudent[],
  languageClassSettings?: LanguageClassSetting[]
): Promise<void> {
  if (isSandbox()) {
    await sandboxSaveLanguageElectiveRoster(academicYear, students, languageClassSettings);
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Firebase 未初始化');
  const id = languageElectiveDocId(academicYear);
  const { studentsPayload, settingsPayload } = sanitizeLanguageElectivePayload(students, languageClassSettings);
  const payload: Record<string, unknown> = {
    academicYear,
    students: studentsPayload,
    updatedAt: serverTimestamp(),
  };
  if (settingsPayload !== undefined) payload.languageClassSettings = settingsPayload;
  await setDoc(doc(db, COLLECTIONS.LANGUAGE_ELECTIVE, id), payload, { merge: true });
}

// --- Setup (GAS：檢查 Drive 等；Sandbox 時回傳說明) ---
export async function setupSystem() {
  const res = await gasPost('SETUP', {});
  return res;
}
