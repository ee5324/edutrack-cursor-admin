/**
 * 考卷存檔：僅白名單內 Google 帳號可上傳、刪除、分享
 * 資料存 Firestore（edutrack_exam_papers），檔案經 GAS 上傳至 Google Drive
 */
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, Share2, Loader2, ShieldCheck, Check } from 'lucide-react';
import type { ExamPaper } from '../types';
import { getExamPapers, saveExamPaper, deleteExamPaper, uploadAttachment } from '../services/api';
import type { User } from 'firebase/auth';

const EXAM_TYPE_OPTIONS = ['期中考', '期末考', '平時考', '複習考', '其他'];

interface ExamPapersTabProps {
  user: User | null;
}

const ExamPapersTab: React.FC<ExamPapersTabProps> = ({ user }) => {
  const [list, setList] = useState<ExamPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await getExamPapers();
      setList(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || '無法載入考卷列表' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.email) return;
    if (file.size > 20 * 1024 * 1024) {
      setMessage({ type: 'error', text: '單檔請勿超過 20MB' });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadResult = await uploadAttachment({
        base64Data: base64,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        prefix: '考卷',
      });
      const fileData = (uploadResult as any)?.file ?? uploadResult;
      if (!fileData?.url) throw new Error('上傳後未取得連結');

      await saveExamPaper({
        fileName: fileData.name || file.name,
        fileUrl: fileData.url,
        mimeType: fileData.mimeType || file.type || 'application/octet-stream',
        fileId: fileData.id,
        uploadedBy: user.email,
        uploadedAt: new Date().toISOString(),
        examType: '期中考',
      });
      setMessage({ type: 'success', text: '已存檔，考卷列表已更新' });
      loadList();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || '上傳或存檔失敗' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: ExamPaper) => {
    if (!confirm(`確定要刪除「${item.fileName}」？此操作無法復原。`)) return;
    try {
      await deleteExamPaper({ id: item.id });
      setMessage({ type: 'success', text: '已刪除' });
      loadList();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || '刪除失敗' });
    }
  };

  const handleShare = async (item: ExamPaper) => {
    try {
      await navigator.clipboard.writeText(item.fileUrl);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setMessage({ type: 'error', text: '無法複製連結' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm font-medium">
              <ShieldCheck size={16} />
              僅白名單帳號可存取
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">考卷存檔</h2>
            <p className="mt-1 text-slate-600 text-sm">
              上傳、刪除與分享皆需通過 Google 登入且在白名單內；檔案存於 Google Drive，連結可分享給有權限者。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.odt,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploading ? '上傳中…' : '上傳考卷'}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <FileText size={18} className="text-slate-600" />
          <span className="font-semibold text-slate-900">已存檔考卷</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            尚無考卷，請點「上傳考卷」新增。
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {list.map((item) => (
              <li key={item.id} className="px-4 py-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{item.fileName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.uploadedBy} · {item.uploadedAt ? new Date(item.uploadedAt).toLocaleString('zh-TW') : ''}
                    {item.examType && ` · ${item.examType}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    開啟
                  </a>
                  <button
                    type="button"
                    onClick={() => handleShare(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    {copiedId === item.id ? <Check size={14} /> : <Share2 size={14} />}
                    {copiedId === item.id ? '已複製' : '複製連結'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ExamPapersTab;
