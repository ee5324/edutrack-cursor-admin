/**
 * 統一 API 層
 * - 文字資料：Firebase Firestore（Sandbox 時改為記憶體模擬）
 * - 附檔／點名單檔案／頒獎 Doc：GAS → Google Drive（Sandbox 時為 mock）
 */
import {
  collection,
  doc,
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
import type { Student, AwardRecord, Vendor, ArchiveTask, TodoItem, Attachment } from '../types';
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

/** 先呼叫 GAS 建立點名單檔案於 Drive，再將課程與學生寫入 Firestore */
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

// --- Setup (GAS：檢查 Drive 等；Sandbox 時回傳說明) ---
export async function setupSystem() {
  const res = await gasPost('SETUP', {});
  return res;
}
