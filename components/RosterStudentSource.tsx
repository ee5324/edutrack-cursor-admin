/**
 * 語言選修名單來源：可拖曳學生至頒獎通知／本土語點名單
 * 與學生語言選修登錄整合，供其他功能從名單拖曳加入
 */
import React, { useState, useEffect } from 'react';
import { Users, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { getLanguageElectiveRoster } from '../services/api';
import type { LanguageElectiveStudent } from '../types';

export const ROSTER_DRAG_TYPE = 'application/x-edutrack-roster-student';

export interface RosterStudentSourceProps {
  /** 學年度，用於載入該學年語言選修名單 */
  academicYear: string;
  /** 是否預設收合 */
  defaultCollapsed?: boolean;
  /** 標題旁說明（選填） */
  hint?: string;
}

export const RosterStudentSource: React.FC<RosterStudentSourceProps> = ({
  academicYear,
  defaultCollapsed = true,
  hint,
}) => {
  const [open, setOpen] = useState(!defaultCollapsed);
  const [students, setStudents] = useState<LanguageElectiveStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!academicYear.trim()) {
      setStudents([]);
      return;
    }
    setLoading(true);
    getLanguageElectiveRoster(academicYear)
      .then((doc) => {
        setStudents(doc?.students ?? []);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [academicYear]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100"
      >
        <span className="font-medium text-slate-800 flex items-center gap-2 text-sm">
          <Users size={16} />
          從語言選修名單拖曳加入
          {hint && <span className="text-slate-500 font-normal">{hint}</span>}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              {academicYear ? `${academicYear} 學年尚無名單，請先至「學生名單」建置名單。` : '請選擇學年度'}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-slate-600">班級</th>
                    <th className="px-2 py-1.5 text-left font-medium text-slate-600">姓名</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, i) => (
                    <tr
                      key={`${s.className}-${s.seat}-${s.name}-${i}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(ROSTER_DRAG_TYPE, JSON.stringify({ className: s.className, name: s.name }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="cursor-grab active:cursor-grabbing hover:bg-slate-50"
                    >
                      <td className="px-2 py-1.5 font-medium text-slate-800">{s.className}</td>
                      <td className="px-2 py-1.5 text-slate-700">{s.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RosterStudentSource;
