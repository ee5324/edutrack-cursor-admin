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

// 頒獎紀錄資料
export interface AwardRecord {
  id?: string;
  date: string;
  time?: string; // 新增：頒獎時間
  title: string;
  students: AwardStudent[];
  createdAt?: string;
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