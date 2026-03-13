import React from 'react';

// 定義核心資料結構

// 學生資料 (新版，符合矩陣表格需求)
export interface Student {
  id: string; // A欄: 編號
  period: string; // B欄: 上課時間(節次)
  className: string; // C欄: 班級
  name: string; // D欄: 姓名
}

// 獲獎學生資料
export interface AwardStudent {
  className: string;
  name: string;
  awardName: string;
}

/** 頒獎 Doc 輸出選項（給 GAS / 整併用） */
export interface AwardExportOptions {
  /** true = 低中高分年級整併為一份「總通知單」Doc；false = 維持每年級段各一份 */
  mergeNotificationSingleDoc?: boolean;
  /** true = 低中高分年級整併為一份「總表」Doc；false = 維持每年級段各一份 */
  mergeSummarySingleDoc?: boolean;
  /** 整併時自訂檔名前綴（可選） */
  mergedDocTitleSuffix?: string;
}

// 頒獎紀錄資料
export interface AwardRecord {
  id?: string;
  date: string;
  time?: string; // 新增：頒獎時間
  title: string;
  students: AwardStudent[];
  createdAt?: string;
  /** 輸出 Google Doc 時的整併等細節（選填） */
  exportOptions?: AwardExportOptions;
}

// 課程資料
export interface Course {
  id: string;
  name: string; 
  instructor: string; 
  location: string; 
  dayOfWeek: number; 
  period: number; 
  studentIds: string[]; 
}

// 新版點名單資料結構 (矩陣式)
export interface AttendanceTableData {
  academicYear: string; // 學年
  semester: string; // 學期
  courseName: string; // 課程名稱 (OO語)
  instructorName: string; // 授課教師姓名
  classTime: string; // C3: 上課時間
  location: string; // C4: 上課地點
  dates: Date[]; // E5開始的日期列
  students: Student[]; // A6開始的學生列
}

// 聯絡人資訊
export interface Contact {
  name: string;
  role: string;
  phone: string;
  note?: string;
}

// 附件資訊 (新)
export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

// 待辦事項資料結構
export interface TodoItem {
  id: string;
  academicYear: string; // 新增: 學年 (控制系列活動範圍)
  date: string; // YYYY-MM-DD
  title: string;
  type: string; // 行政, 教學, 會議, 輪值...
  period?: 'full' | 'am' | 'pm'; // 新增: 時段 (用於輪值: 全日, 上午, 下午)
  status: 'pending' | 'done' | 'cancelled';
  priority: 'High' | 'Medium' | 'Low';
  seriesId?: string; // 關聯ID (保留供系統內部使用，但主要邏輯轉向 topic)
  topic?: string; // 新增: 系列主題 (如: 科展, 語文競賽)
  officialDocs?: string[]; // 新增: 公文文號列表
  contacts: Contact[]; // 聯絡人列表
  commonContacts?: Contact[]; // 新增: 系列共用聯絡人列表
  attachments: Attachment[]; // 個別附件列表
  commonAttachments?: Attachment[]; // 新增: 系列共用附件列表
  memo?: string;
}

// 廠商資料結構 (新)
export interface Vendor {
  id: string;
  name: string; // 廠商名稱
  category: string; // 類別 (印刷, 遊覽車, 用品...)
  contactPerson: string; // 聯絡人
  phone: string; // 電話
  email: string; // Email
  lineId: string; // LINE ID
  address: string; // 地址
  note: string; // 備註
  relatedTasks: string[]; // 關聯業務 (例如: 運動會, 畢業典禮)
  qrcodeUrl?: string; // 聯繫方式 QR Code 圖片網址或 data URL (base64)
}

// 舊版相容 (如果還需要) - 可以考慮移除或保留作為過渡
export interface AttendanceSheetData {
  date: Date;
  course: Course;
  students: Student[];
}

// 事項列檔資料結構 (新)
export interface ArchiveTask {
  id: string;
  title: string; // 事項名稱 (如: 本土語補助申請)
  month: string; // 月份 (YYYY-MM)
  isPrinted: boolean; // 是否已列印
  isNotified: boolean; // 是否已通知
  notes: string; // 備註
  updatedAt: string; // 最後更新時間
}

/** 考卷存檔（僅白名單用戶可存取） */
/** 考卷資料夾（用於分類） */
export interface ExamPaperFolder {
  id: string;
  name: string;
  order: number; // 顯示順序，數字越小越前面
}

/** 考卷檢核項目（年級 × 領域，可手動打勾） */
export interface ExamPaperCheck {
  grade: string; // 1～6
  domain: string; // 領域，如 國語、數學
  checked: boolean;
}

export interface ExamPaper {
  id: string;
  folderId?: string | null; // 所屬資料夾 id，空為未分類
  title?: string; // 選填標題，例如「114-1 三年級國語期中考」
  grade?: string; // 年級，如 1～6（用於排序與顯示一年級～六年級）
  domain?: string; // 領域，如 國語、數學（用於檢核區塊）
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileId?: string; // Drive file id，方便日後刪除
  schoolYear?: string; // 學年，如 114
  semester?: string; // 學期，如 上學期、下學期
  examType?: string; // 期中考、期末考、平時考 等
  uploadedBy: string; // 上傳者 email
  uploadedAt: string; // ISO 字串
}

export interface AllowedUser {
  email: string;
  enabled: boolean;
  role: 'admin' | 'member';
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type NotificationType = 'success' | 'error' | 'info';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  content: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'danger' | 'warning' | 'success';
}