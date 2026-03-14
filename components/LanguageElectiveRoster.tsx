import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileSpreadsheet, HelpCircle, Download, Users, ChevronDown, ChevronRight, Save, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { LanguageElectiveStudent } from '../types';
import {
  getLanguageElectiveRoster,
  getAllLanguageElectiveRosters,
  buildNameToLanguageFromRosters,
  saveLanguageElectiveRoster,
} from '../services/api';

/** 解析後的名單：班級 -> 座號 -> 姓名 */
type RosterMap = Record<string, Record<string, string>>;

const LANGUAGE_OPTIONS = ['閩南語', '客家語', '原住民族語', '新住民語', '手語', '無／未選'];

function parseRosterFromRows(rows: string[][]): RosterMap {
  const roster: RosterMap = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      if (cell.includes('班') && cell.includes('級')) {
        const className = String(row[j + 1] ?? '').trim();
        if (!className) continue;
        if (!roster[className]) roster[className] = {};
        let rowIdx = i + 2;
        while (rowIdx < rows.length) {
          const targetRow = rows[rowIdx];
          if (!targetRow || targetRow.length <= j) {
            rowIdx++;
            continue;
          }
          const seat = String((targetRow[j - 2] ?? '')).trim();
          const name = String((targetRow[j - 1] ?? '')).trim();
          if (seat.includes('合計') || seat.includes('男')) break;
          if (/^\d+$/.test(seat) && name) roster[className][seat] = name;
          rowIdx++;
        }
      }
    }
  }
  return roster;
}

function rosterMapToStudents(roster: RosterMap, nameToLanguage: Record<string, string>): LanguageElectiveStudent[] {
  const list: LanguageElectiveStudent[] = [];
  const classNames = Object.keys(roster).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const className of classNames) {
    const seats = roster[className];
    const seatNums = Object.keys(seats).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (const seat of seatNums) {
      const name = seats[seat];
      list.push({
        className,
        seat,
        name,
        language: nameToLanguage[name] ?? '無／未選',
      });
    }
  }
  return list;
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  return aoa.map((row) => row.map((c) => (c != null ? String(c).trim() : '')));
}

const LanguageElectiveRoster: React.FC = () => {
  const [academicYear, setAcademicYear] = useState('114');
  const [students, setStudents] = useState<LanguageElectiveStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLanguage, setBatchLanguage] = useState('閩南語');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [exampleTableOpen, setExampleTableOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const hasRoster = students.length > 0;

  const loadSavedRoster = useCallback(async () => {
    setLoadingRoster(true);
    setError(null);
    try {
      const doc = await getLanguageElectiveRoster(academicYear);
      if (doc?.students?.length) setStudents(doc.students);
      else setStudents([]);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoadingRoster(false);
    }
  }, [academicYear]);

  useEffect(() => {
    loadSavedRoster();
  }, [loadSavedRoster]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);

    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const raw = evt.target?.result;
        let rows: string[][];

        if (isCsv && typeof raw === 'string') {
          rows = raw.split(/\r?\n/).map((line) => line.split(',').map((c) => c.trim()));
        } else if (!isCsv && raw) {
          const wb = XLSX.read(raw, { type: 'binary' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = sheetToRows(sheet);
        } else {
          setError('無法讀取檔案');
          return;
        }

        const roster = parseRosterFromRows(rows);
        const classCount = Object.keys(roster).length;
        if (classCount === 0) {
          setError('未偵測到符合格式的「班級」區塊，請確認 Excel/CSV 格式。');
          return;
        }

        const allRosters = await getAllLanguageElectiveRosters();
        const nameToLanguage = buildNameToLanguageFromRosters(allRosters);
        const list = rosterMapToStudents(roster, nameToLanguage);
        setStudents(list);
        setSelectedIds(new Set());
      } catch (err: any) {
        setError(err?.message || '解析失敗');
      }
    };

    if (isCsv) reader.readAsText(file, 'utf-8');
    else reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const updateStudentLanguage = (index: number, language: string) => {
    setStudents((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], language };
      return next;
    });
  };

  const toggleSelect = (index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map((_, i) => i)));
  };

  const applyBatchLanguage = () => {
    if (selectedIds.size === 0) return;
    setStudents((prev) =>
      prev.map((s, i) => (selectedIds.has(i) ? { ...s, language: batchLanguage } : s))
    );
    setSelectedIds(new Set());
  };

  const handleSave = async () => {
    if (students.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await saveLanguageElectiveRoster(academicYear, students);
    } catch (e: any) {
      setError(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const downloadJson = () => {
    const roster: Record<string, Record<string, string>> = {};
    students.forEach((s) => {
      if (!roster[s.className]) roster[s.className] = {};
      roster[s.className][s.seat] = `${s.name}（${s.language}）`;
    });
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `language_elective_${academicYear}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-blue-600" />
          學生語言選修登錄
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          上傳 Excel 班級名單後，可依姓名繼承過往學年選修語言、手動修改或批次調整，並儲存至 Firebase。（以學年計，不分上下學期）
        </p>
      </div>

      {/* 學年度 + 載入已儲存（以學年計，不分上下學期） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">學年度</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-20 border rounded px-2 py-1.5 text-sm"
            placeholder="114"
          />
        </div>
        <button
          type="button"
          onClick={loadSavedRoster}
          disabled={loadingRoster}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1"
        >
          {loadingRoster ? <Loader2 size={14} className="animate-spin" /> : null}
          載入已儲存名單
        </button>
      </div>

      {/* Excel 格式說明（可收合） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormatOpen(!formatOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <HelpCircle size={18} />
            Excel / CSV 檔案格式說明
          </span>
          {formatOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {formatOpen && (
          <div className="p-4 pt-0 space-y-3 text-sm text-slate-700">
            <p className="font-medium text-slate-800">請提供符合下列規則的試算表，系統會自動辨識「班級」區塊並擷取座號、姓名；上傳後會依「姓名」繼承過往學年選修語言。</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>表頭：某一儲存格同時包含「班」與「級」，其<strong>右側一格</strong>為班級名稱。</li>
              <li>座號：班級欄的<strong>左邊第 2 欄</strong>；姓名：<strong>左邊第 1 欄</strong>。</li>
              <li>學生列：從班級列起<strong>下方第 2 列</strong>開始；座號為數字、姓名有內容才列入。</li>
              <li>區塊結束：座號欄出現「合計」或「男」即結束該班。</li>
            </ul>
            <p className="text-slate-500">支援 .csv、.xlsx、.xls；CSV 請用 UTF-8。</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setExampleTableOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300"
              >
                {exampleTableOpen ? '收起範例' : '看範例表格'}
              </button>
              {exampleTableOpen && (
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 inline-block">
                  <p className="text-xs text-slate-500 mb-2">範例（擷取後會得到：101 班 座號 1 王小明、2 李小華）</p>
                  <table className="text-xs border-collapse border border-slate-300">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 bg-slate-100 font-medium">座號</td>
                        <td className="border border-slate-300 px-2 py-1 bg-slate-100 font-medium">姓名</td>
                        <td className="border border-slate-300 px-2 py-1 bg-amber-100 font-medium">班級</td>
                        <td className="border border-slate-300 px-2 py-1 bg-slate-100 font-medium">101</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">1</td>
                        <td className="border border-slate-300 px-2 py-1">王小明</td>
                        <td className="border border-slate-300 px-2 py-1" colSpan={2} />
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1">2</td>
                        <td className="border border-slate-300 px-2 py-1">李小華</td>
                        <td className="border border-slate-300 px-2 py-1" colSpan={2} />
                      </tr>
                      <tr>
                        <td className="border border-slate-300 px-2 py-1 text-slate-500">合計</td>
                        <td className="border border-slate-300 px-2 py-1" colSpan={3} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 上傳 Excel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
          <Upload className="w-9 h-9 text-slate-400 mb-2" />
          <span className="text-sm font-medium text-slate-600">上傳 Excel 或 CSV 班級名單（會依姓名繼承選修語言）</span>
          <span className="text-xs text-slate-400 mt-1">.csv / .xlsx / .xls</span>
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFile} />
        </label>
        {fileName && <p className="mt-3 text-sm text-slate-500 flex items-center gap-2"><FileSpreadsheet size={14} /> {fileName}</p>}
        {error && <div className="mt-3 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      </div>

      {/* 名單表格：手動修改 + 批次 */}
      {hasRoster && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {academicYear} 學年（{students.length} 人）
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadJson}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
              >
                <Download size={14} />
                下載 JSON
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                儲存至 Firebase
              </button>
            </div>
          </div>

          {/* 批次調整 */}
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              className="text-sm font-medium text-amber-800 hover:underline"
            >
              {selectedIds.size === students.length ? '取消全選' : '全選'}
            </button>
            <span className="text-amber-700 text-sm">已選 {selectedIds.size} 人</span>
            <select
              value={batchLanguage}
              onChange={(e) => setBatchLanguage(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBatchLanguage}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
            >
              將選取學生設為上述語言
            </button>
          </div>

          <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-2 py-2 w-10 text-center">
                    <input type="checkbox" checked={selectedIds.size === students.length && students.length > 0} onChange={selectAll} />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">班級</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">座號</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">姓名</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">選修語言</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s, i) => (
                  <tr key={`${s.className}-${s.seat}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(i)}
                        onChange={() => toggleSelect(i)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{s.className}</td>
                    <td className="px-3 py-2 text-slate-600">{s.seat}</td>
                    <td className="px-3 py-2 text-slate-700">{s.name}</td>
                    <td className="px-3 py-2">
                      <select
                        value={s.language}
                        onChange={(e) => updateStudentLanguage(i, e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-full max-w-[140px]"
                      >
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageElectiveRoster;
