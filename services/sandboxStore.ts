/**
 * Sandbox 模式：記憶體內模擬 Firestore + GAS
 * 用於本地體驗程式流程，無需 Firebase / GAS 設定
 */
import type { Student, AwardRecord, Vendor, ArchiveTask, TodoItem, Attachment, ExamPaper, ExamPaperFolder, ExamPaperCheck, LanguageElectiveRosterDoc, LanguageClassSetting, CalendarSettings } from '../types';
import { DEFAULT_LANGUAGE_OPTIONS } from '../utils/languageOptions';

export interface SandboxCourseRecord {
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

const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// --- In-memory store (seed 一些範例資料) ---
const store = {
  courses: [
    {
      id: 'sandbox-course-1',
      academicYear: '114',
      semester: '上學期',
      courseName: '閩南語',
      instructor: '王老師',
      classTime: '週一 08:00-08:40',
      location: '視聽教室',
      createdAt: new Date().toISOString(),
      fileUrl: 'https://docs.google.com/spreadsheets/d/sandbox-demo/edit',
      startDate: '2025-09-01',
      endDate: '2026-01-20',
      selectedDays: '[1]',
    },
  ] as SandboxCourseRecord[],
  students: [
    { courseId: 'sandbox-course-1', id: '1', period: '第一節', className: '301', name: '王小明' },
    { courseId: 'sandbox-course-1', id: '2', period: '第一節', className: '301', name: '李小華' },
    { courseId: 'sandbox-course-1', id: '3', period: '第二節', className: '302', name: '張小美' },
  ] as { courseId: string; id: string; period: string; className: string; name: string }[],
  awards: [
    {
      id: 'sandbox-award-1',
      date: '2025-10-15',
      title: '語文競賽頒獎',
      students: [{ className: '301', name: '王小明', awardName: '作文第一名' }],
      createdAt: new Date().toISOString(),
    },
  ] as (AwardRecord & { id: string })[],
  vendors: [
    {
      id: 'sandbox-v-1',
      name: '範例印刷廠',
      category: '印刷',
      contactPerson: '陳經理',
      phone: '07-1234567',
      email: 'print@example.com',
      lineId: '',
      address: '高雄市前鎮區範例路 1 號',
      note: 'Sandbox 示範',
      relatedTasks: ['運動會'],
    },
  ] as Vendor[],
  archive: [
    {
      id: 'sandbox-ar-1',
      title: '本土語補助申請',
      month: '2025-10',
      isPrinted: false,
      isNotified: false,
      notes: 'Sandbox 示範事項',
      updatedAt: new Date().toISOString(),
    },
  ] as ArchiveTask[],
  todos: [
    {
      id: 'sandbox-t-1',
      academicYear: '114',
      date: new Date().toISOString().slice(0, 10),
      title: 'Sandbox 示範待辦',
      type: 'task',
      status: 'pending',
      priority: 'Medium',
      seriesId: '',
      topic: '',
      officialDocs: [],
      contacts: [],
      commonContacts: [],
      attachments: [],
      commonAttachments: [],
      memo: '此為 Sandbox 模式，資料僅存於記憶體',
      createdAt: new Date().toISOString(),
      period: 'full',
    },
  ] as TodoItem[],
  examPapers: [] as ExamPaper[],
  examPaperFolders: [] as ExamPaperFolder[],
  examPaperChecks: [] as ExamPaperCheck[],
  languageElective: {} as Record<string, LanguageElectiveRosterDoc>,
  systemSettings: { languageOptions: [] as string[] },
  calendarSettings: {} as Record<string, CalendarSettings>,
};

// --- Courses & Students ---
export function sandboxGetHistory(): Promise<SandboxCourseRecord[]> {
  return Promise.resolve([...store.courses].sort((a, b) => (b.createdAt as string).localeCompare((a.createdAt as string) || '')));
}

export function sandboxGetCourseStudents(courseId: string): Promise<Pick<Student, 'id' | 'period' | 'className' | 'name'>[]> {
  const list = store.students.filter((s) => s.courseId === courseId);
  return Promise.resolve(list.map((s) => ({ id: s.id, period: s.period, className: s.className, name: s.name })));
}

export function sandboxSaveCourseConfig(payload: {
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
  const courseId = uid();
  const fileUrl = 'https://docs.google.com/spreadsheets/d/sandbox-' + courseId + '/edit';
  store.courses.unshift({
    id: courseId,
    academicYear: payload.academicYear ?? '',
    semester: payload.semester ?? '',
    courseName: payload.courseName ?? '',
    instructor: payload.instructorName ?? '',
    classTime: payload.classTime ?? '',
    location: payload.location ?? '',
    createdAt: new Date().toISOString(),
    fileUrl,
    startDate: payload.startDate ?? '',
    endDate: payload.endDate ?? '',
    selectedDays: JSON.stringify(payload.selectedDays ?? []),
  });
  const students = payload.students ?? [];
  students.forEach((s) => {
    store.students.push({
      courseId,
      id: s.id ?? uid(),
      period: s.period ?? '',
      className: s.className ?? '',
      name: s.name ?? '',
    });
  });
  return Promise.resolve({
    courseId,
    recordCount: students.length,
    driveFile: { url: fileUrl, id: 'sandbox-file-' + courseId, path: 'Sandbox/點名單' },
    message: 'Saved successfully (Sandbox)',
  });
}

export function sandboxGetSemesterData(payload: { academicYear: string; semester: string }) {
  return sandboxGetHistory().then((all) => {
    const target = all.filter(
      (c) => String(c.academicYear) === String(payload.academicYear) && String(c.semester) === String(payload.semester)
    );
    return Promise.all(
      target.map(async (c) => ({
        academicYear: c.academicYear,
        semester: c.semester,
        courseName: c.courseName,
        instructor: c.instructor,
        classTime: c.classTime,
        location: c.location,
        students: await sandboxGetCourseStudents(c.id),
      }))
    ).then((result) => {
      result.sort((a, b) => a.courseName.localeCompare(b.courseName));
      return result;
    });
  });
}

// --- Awards ---
export function sandboxGetAwardHistory(): Promise<AwardRecord[]> {
  const list = [...store.awards].sort((a, b) => (b.createdAt as string).localeCompare((a.createdAt as string) || ''));
  return Promise.resolve(
    list.map((a) => ({ id: a.id, date: a.date, title: a.title, students: a.students, createdAt: a.createdAt }))
  );
}

export function sandboxSaveAwardRecord(payload: { date: string; title: string; students: any[] }) {
  const id = uid();
  store.awards.unshift({
    id,
    date: payload.date,
    title: payload.title,
    students: payload.students ?? [],
    createdAt: new Date().toISOString(),
  });
  return Promise.resolve({ success: true, id });
}

export function sandboxGetAllKnownStudents(): Promise<{ className: string; name: string }[]> {
  const map = new Map<string, { className: string; name: string }>();
  store.students.forEach((s) => {
    if (s.className && s.name) map.set(`${s.className}_${s.name}`, { className: s.className, name: s.name });
  });
  store.awards.forEach((a) => {
    (a.students || []).forEach((s: any) => {
      if (s.className && s.name) map.set(`${s.className}_${s.name}`, { className: s.className, name: s.name });
    });
  });
  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className, undefined, { numeric: true });
    return a.name.localeCompare(b.name);
  });
  return Promise.resolve(result);
}

// --- Vendors ---
export function sandboxGetVendors(): Promise<Vendor[]> {
  return Promise.resolve([...store.vendors]);
}

export function sandboxSaveVendor(payload: Partial<Vendor> & { name: string }) {
  const id = payload.id ?? uid();
  const idx = store.vendors.findIndex((v) => v.id === id);
  const row = {
    id,
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
  if (idx >= 0) store.vendors[idx] = row as Vendor;
  else store.vendors.push(row);
  return Promise.resolve({ success: true, id });
}

export function sandboxDeleteVendor(payload: { id: string }) {
  store.vendors = store.vendors.filter((v) => v.id !== payload.id);
  return Promise.resolve({ success: true });
}

// --- Exam Paper Folders ---
export function sandboxGetExamPaperFolders(): Promise<ExamPaperFolder[]> {
  return Promise.resolve([...store.examPaperFolders].sort((a, b) => a.order - b.order));
}

export function sandboxSaveExamPaperFolder(payload: Omit<ExamPaperFolder, 'id'> & { id?: string }) {
  const id = payload.id ?? uid();
  const row: ExamPaperFolder = {
    id,
    name: payload.name,
    order: payload.order ?? 0,
    parentId: payload.parentId ?? undefined,
    driveFolderUrl: payload.driveFolderUrl ?? undefined,
  };
  const idx = store.examPaperFolders.findIndex((f) => f.id === id);
  if (idx >= 0) store.examPaperFolders[idx] = row;
  else store.examPaperFolders.push(row);
  return Promise.resolve({ success: true, id });
}

export function sandboxDeleteExamPaperFolder(payload: { id: string }) {
  store.examPaperFolders = store.examPaperFolders.filter((f) => f.id !== payload.id);
  return Promise.resolve({ success: true });
}

// --- Exam Papers ---
export function sandboxGetExamPapers(): Promise<ExamPaper[]> {
  return Promise.resolve([...store.examPapers].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
}

export function sandboxSaveExamPaper(payload: Omit<ExamPaper, 'id'> & { id?: string }) {
  const id = payload.id ?? uid();
  const row: ExamPaper = {
    id,
    folderId: payload.folderId ?? undefined,
    title: payload.title ?? '',
    grade: payload.grade,
    domain: payload.domain,
    fileName: payload.fileName,
    fileUrl: payload.fileUrl,
    mimeType: payload.mimeType ?? 'application/octet-stream',
    fileId: payload.fileId,
    schoolYear: payload.schoolYear,
    semester: payload.semester,
    examType: payload.examType,
    authorTeacherName: payload.authorTeacherName,
    authorTeacherNote: payload.authorTeacherNote,
    uploadedBy: payload.uploadedBy,
    uploadedAt: payload.uploadedAt ?? new Date().toISOString(),
  };
  const idx = store.examPapers.findIndex((e) => e.id === id);
  if (idx >= 0) store.examPapers[idx] = row;
  else store.examPapers.push(row);
  return Promise.resolve({ success: true, id });
}

export function sandboxDeleteExamPaper(payload: { id: string }) {
  store.examPapers = store.examPapers.filter((e) => e.id !== payload.id);
  return Promise.resolve({ success: true });
}

// --- Exam Paper Checks ---
export function sandboxGetExamPaperChecks(): Promise<ExamPaperCheck[]> {
  return Promise.resolve([...store.examPaperChecks]);
}

export function sandboxSetExamPaperCheck(payload: { grade: string; domain: string; checked: boolean }) {
  const idx = store.examPaperChecks.findIndex(
    (c) => c.grade === payload.grade && c.domain === payload.domain
  );
  const row: ExamPaperCheck = {
    grade: payload.grade,
    domain: payload.domain,
    checked: payload.checked,
  };
  if (idx >= 0) store.examPaperChecks[idx] = row;
  else store.examPaperChecks.push(row);
  return Promise.resolve({ success: true });
}

// --- 學生語言選修登錄 ---
export function sandboxGetLanguageElectiveRoster(academicYear: string): Promise<LanguageElectiveRosterDoc | null> {
  const doc = store.languageElective[academicYear];
  return Promise.resolve(doc ?? null);
}

export function sandboxGetAllLanguageElectiveRosters(): Promise<LanguageElectiveRosterDoc[]> {
  return Promise.resolve(Object.values(store.languageElective));
}

export function sandboxSaveLanguageElectiveRoster(
  academicYear: string,
  students: { className: string; seat: string; name: string; language: string; languageClass?: string }[],
  languageClassSettings?: LanguageClassSetting[]
): Promise<void> {
  store.languageElective[academicYear] = {
    academicYear,
    students,
    languageClassSettings,
    updatedAt: new Date().toISOString(),
  };
  return Promise.resolve();
}

// --- 學期／放假日設定 (點名單用) ---
export function sandboxGetCalendarSettings(academicYear: string, semester: string): Promise<CalendarSettings | null> {
  const key = `${academicYear}_${semester}`;
  const doc = store.calendarSettings[key];
  return Promise.resolve(doc ?? null);
}

// --- 系統設定（選修語言類別）---
function collectLanguageOptionsFromRosters(): string[] {
  const set = new Set<string>(DEFAULT_LANGUAGE_OPTIONS);
  Object.values(store.languageElective).forEach((doc) => {
    (doc.students ?? []).forEach((s) => {
      const v = (s.language ?? '').trim();
      if (v) set.add(v);
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-TW'));
}

export function sandboxGetLanguageOptions(): Promise<string[]> {
  const existing = store.systemSettings.languageOptions;
  if (Array.isArray(existing) && existing.length > 0) return Promise.resolve([...existing]);
  const merged = collectLanguageOptionsFromRosters();
  store.systemSettings.languageOptions = merged;
  return Promise.resolve(merged);
}

export function sandboxSaveLanguageOptions(options: string[]): Promise<void> {
  store.systemSettings.languageOptions = options.length ? [...options] : [...DEFAULT_LANGUAGE_OPTIONS];
  return Promise.resolve();
}

// --- Archive ---
export function sandboxGetArchiveTasks(): Promise<ArchiveTask[]> {
  return Promise.resolve([...store.archive].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export function sandboxSaveArchiveTask(payload: Partial<ArchiveTask> & { title: string; month: string }) {
  const id = payload.id ?? uid();
  const idx = store.archive.findIndex((a) => a.id === id);
  const row: ArchiveTask = {
    id,
    title: payload.title,
    month: payload.month,
    isPrinted: payload.isPrinted ?? false,
    isNotified: payload.isNotified ?? false,
    notes: payload.notes ?? '',
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) store.archive[idx] = row;
  else store.archive.unshift(row);
  return Promise.resolve({ success: true, id });
}

export function sandboxDeleteArchiveTask(payload: { id: string }) {
  store.archive = store.archive.filter((a) => a.id !== payload.id);
  return Promise.resolve({ success: true });
}

// --- Todos ---
export function sandboxGetTodos(): Promise<TodoItem[]> {
  return Promise.resolve([...store.todos].sort((a, b) => a.date.localeCompare(b.date)));
}

export function sandboxSaveTodo(payload: Partial<TodoItem> & { date: string; title: string; type: string }) {
  const id = payload.id ?? uid();
  const topic = (payload.topic ?? '').trim();
  const doc = {
    id,
    academicYear: payload.academicYear ?? '114',
    date: payload.date,
    title: payload.title ?? '',
    type: payload.type ?? 'task',
    status: payload.status ?? 'pending',
    priority: payload.priority ?? 'Medium',
    seriesId: payload.seriesId ?? '',
    topic,
    officialDocs: payload.officialDocs ?? [],
    contacts: payload.contacts ?? [],
    commonContacts: payload.commonContacts ?? [],
    attachments: (payload.attachments ?? []).filter((x): x is Attachment => Boolean(x?.url)),
    commonAttachments: (payload.commonAttachments ?? []).filter((x): x is Attachment => Boolean(x?.url)),
    memo: payload.memo ?? '',
    createdAt: (payload.createdAt as string) ?? new Date().toISOString(),
    period: payload.period ?? 'full',
  };
  const idx = store.todos.findIndex((t) => t.id === id);
  if (idx >= 0) store.todos[idx] = doc as TodoItem;
  else store.todos.push(doc as TodoItem);
  if (topic) {
    store.todos.forEach((t) => {
      if (t.topic === topic && t.academicYear === (payload.academicYear ?? '114') && t.id !== id) {
        t.commonAttachments = doc.commonAttachments;
        t.commonContacts = doc.commonContacts;
      }
    });
  }
  return Promise.resolve({ success: true, message: 'Saved successfully', seriesId: doc.seriesId });
}

export function sandboxSaveBatchTodos(payload: { todos: Partial<TodoItem>[] }) {
  const todos = payload.todos ?? [];
  todos.forEach((todo) => {
    const id = todo.id ?? uid();
    store.todos.push({
      id,
      academicYear: todo.academicYear ?? '114',
      date: todo.date ?? '',
      title: todo.title ?? '',
      type: (todo.type as any) ?? 'duty',
      status: (todo.status as any) ?? 'pending',
      priority: (todo.priority as any) ?? 'Medium',
      seriesId: '',
      topic: '',
      officialDocs: [],
      contacts: [],
      commonContacts: [],
      attachments: [],
      commonAttachments: [],
      memo: todo.memo ?? '',
      createdAt: new Date().toISOString(),
      period: (todo.period as any) ?? 'full',
    } as TodoItem);
  });
  return Promise.resolve({ success: true, message: `Batch saved ${todos.length} items` });
}

export function sandboxDeleteTodo(payload: { id: string }) {
  store.todos = store.todos.filter((t) => t.id !== payload.id);
  return Promise.resolve({ success: true });
}

export function sandboxCancelSeries(payload: {
  seriesId?: string;
  topic?: string;
  pivotDate: string;
  academicYear?: string;
}) {
  const pivot = new Date(payload.pivotDate);
  const targetTopic = (payload.topic ?? '').trim();
  store.todos.forEach((t) => {
    const match = targetTopic
      ? t.topic === targetTopic
      : !!(payload.seriesId && t.seriesId === payload.seriesId);
    if (match && (!payload.academicYear || String(t.academicYear) === String(payload.academicYear))) {
      if (new Date(t.date) >= pivot) t.status = 'cancelled';
    }
  });
  return Promise.resolve({ success: true, message: 'Series cancelled' });
}

export function sandboxToggleTodoStatus(payload: { id: string; newStatus: TodoItem['status'] }) {
  const t = store.todos.find((x) => x.id === payload.id);
  if (t) t.status = payload.newStatus;
  return Promise.resolve({ success: true });
}

// --- Mock GAS (附檔 / 點名單 / 頒獎 Doc / 匯入 / Setup) ---
export function mockGasPost(
  action: string,
  payload: unknown
): Promise<{ success: boolean; data?: any; message?: string }> {
  const base = 'https://drive.google.com/sandbox-mock/';
  switch (action) {
    case 'CREATE_ATTENDANCE_FILE':
      return Promise.resolve({
        success: true,
        data: { url: base + 'attendance-' + uid(), id: 'mock-file-' + uid(), path: 'Sandbox/點名單' },
      });
    case 'UPLOAD_ATTACHMENT': {
      const p = payload as { name?: string; prefix?: string };
      const name = p.prefix ? `【${p.prefix}】${p.name}` : p.name;
      return Promise.resolve({
        success: true,
        data: {
          success: true,
          file: { id: 'mock-att-' + uid(), name: name || 'file', url: base + 'file/' + uid(), mimeType: 'application/octet-stream' },
        },
      });
    }
    case 'CREATE_AWARD_DOCS':
    case 'CREATE_AWARD_SUMMARY_DOCS':
      return Promise.resolve({
        success: true,
        data: {
          success: true,
          docs: [
            { category: '低年級', url: base + 'award-doc-1', name: '[頒獎] Sandbox 示範 - 低年級' },
            { category: '中年級', url: base + 'award-doc-2', name: '[頒獎] Sandbox 示範 - 中年級' },
          ],
        },
      });
    case 'IMPORT_FROM_URL':
      return Promise.resolve({
        success: true,
        data: {
          data: {
            academicYear: '114',
            semester: '上學期',
            courseName: '匯入示範課程',
            instructorName: '匯入教師',
            classTime: '週二 09:00',
            location: '教室A',
            students: [
              { id: '1', period: '第一節', className: '401', name: '匯入學生一' },
              { id: '2', period: '第一節', className: '401', name: '匯入學生二' },
            ],
          },
        },
      });
    case 'SETUP':
      return Promise.resolve({
        success: true,
        data: {
          logs: [
            '✅ Sandbox 模式：資料庫為記憶體模擬。',
            '✅ 附檔／點名單／頒獎 Doc 為模擬連結，未實際寫入 Google Drive。',
            '✅ 可正常操作以了解程式流程，切換正式環境請關閉 VITE_SANDBOX。',
          ],
        },
      });
    default:
      return Promise.resolve({ success: true, data: null });
  }
}

/** 測試階段 PIN：輸入後與 Sandbox 相同快速進入（僅 DEV 有效，勿用於正式站） */
export const TEST_PIN = '5012';
const PIN_BYPASS_STORAGE_KEY = 'edutrack_pin_bypass_ok';
/** 登入頁是否顯示 PIN 區塊（存在 localStorage，系統設定可切換） */
const PIN_UI_ENABLED_KEY = 'edutrack_pin_ui_enabled';

/** 是否於登入頁顯示 PIN 快速登入（僅 DEV；預設 true，關閉後寫入 '0'） */
export function isPinUiEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const v = localStorage.getItem(PIN_UI_ENABLED_KEY);
    if (v === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function setPinUiEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PIN_UI_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isPinBypassActive(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return sessionStorage.getItem(PIN_BYPASS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 設定／清除 PIN 測試登入（僅 DEV） */
export function setPinBypass(active: boolean): void {
  if (!import.meta.env.DEV) return;
  try {
    if (active) sessionStorage.setItem(PIN_BYPASS_STORAGE_KEY, '1');
    else sessionStorage.removeItem(PIN_BYPASS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isSandbox(): boolean {
  if (import.meta.env.VITE_SANDBOX === 'true') return true;
  return isPinBypassActive();
}
