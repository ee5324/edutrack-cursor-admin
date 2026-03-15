import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, HelpCircle, Download, Users, ChevronDown, ChevronRight, Save, Loader2, Plus, Trash2, Settings2, RefreshCw, Search, BookOpen, Calendar as CalendarIcon, Printer, X, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { LanguageElectiveStudent, LanguageClassSetting, AttendanceTableData, Student } from '../types';
import AttendanceSheet from './AttendanceSheet';
import {
  getLanguageElectiveRoster,
  getAllLanguageElectiveRosters,
  buildNameToLanguageFromRosters,
  saveLanguageElectiveRoster,
} from '../services/api';

/** 解析後的名單：班級 -> 座號 -> 姓名 */
type RosterMap = Record<string, Record<string, string>>;

const LANGUAGE_OPTIONS_KEY = 'edutrack_language_options';
const DEFAULT_LANGUAGE_OPTIONS = ['閩南語', '客家語', '原住民族語', '新住民語', '手語', '無／未選'];

function loadLanguageOptions(): string[] {
  try {
    const raw = localStorage.getItem(LANGUAGE_OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_LANGUAGE_OPTIONS];
}

function saveLanguageOptions(options: string[]) {
  localStorage.setItem(LANGUAGE_OPTIONS_KEY, JSON.stringify(options));
}

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

function rosterMapToStudents(roster: RosterMap, nameToLanguage: Record<string, string>, defaultLanguage: string): LanguageElectiveStudent[] {
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
        language: nameToLanguage[name] ?? defaultLanguage,
        languageClass: undefined,
      });
    }
  }
  return list;
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  return aoa.map((row) => row.map((c) => (c != null ? String(c).trim() : '')));
}

interface LanguageElectiveRosterProps {
  /** 預設檢視：名單編輯（學生名單）或點名單預覽（點名單製作） */
  defaultView?: 'roster' | 'sheets';
  /** 頁面模式：核心名單／查詢／點名單預覽，用於標題與說明 */
  pageMode?: 'roster' | 'query' | 'sheets';
}

const LanguageElectiveRoster: React.FC<LanguageElectiveRosterProps> = ({ defaultView = 'roster', pageMode: pageModeProp }) => {
  const pageMode = pageModeProp ?? (defaultView === 'sheets' ? 'sheets' : 'roster');
  const [academicYear, setAcademicYear] = useState('114');
  const [students, setStudents] = useState<LanguageElectiveStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [languageOptions, setLanguageOptions] = useState<string[]>(() => loadLanguageOptions());
  const [batchLanguage, setBatchLanguage] = useState(() => loadLanguageOptions()[0] ?? '閩南語');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [exampleTableOpen, setExampleTableOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [languageOptionsOpen, setLanguageOptionsOpen] = useState(false);
  const [newLanguageInput, setNewLanguageInput] = useState('');
  const [inheriting, setInheriting] = useState(false);
  /** 本 session 內手動改過選修語言的列索引，繼承時不覆蓋 */
  const [manualEditIndices, setManualEditIndices] = useState<Set<number>>(new Set());
  /** 搜尋：姓名或座號（空白則顯示全部） */
  const [searchQuery, setSearchQuery] = useState('');
  /** 語言班別設定：教室、時間、教師（與名單一併儲存） */
  const [languageClassSettings, setLanguageClassSettings] = useState<LanguageClassSetting[]>([]);
  const [languageClassSettingsOpen, setLanguageClassSettingsOpen] = useState(false);
  /** 批次設定語言班別時選的班別 */
  const [batchLanguageClass, setBatchLanguageClass] = useState('');
  /** 點名單：學期、日期（與點名單製作相同邏輯） */
  const [semester, setSemester] = useState('下學期');
  const [dates, setDates] = useState<Date[]>([]);
  const [dateInput, setDateInput] = useState('');
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState('');
  const [genDayOfWeek, setGenDayOfWeek] = useState('1');
  /** 檢視模式：名單編輯 | 點名單預覽 */
  const [activeView, setActiveView] = useState<'roster' | 'sheets'>(defaultView);
  const [datesSettingOpen, setDatesSettingOpen] = useState(false);

  const hasRoster = students.length > 0;
  const languageClassNames = useMemo(() => languageClassSettings.map((s) => s.name), [languageClassSettings]);

  /** 依搜尋條件篩選，保留原始索引供勾選／編輯 */
  const filteredWithIndex = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students.map((s, i) => ({ s, i }));
    return students
      .map((s, i) => ({ s, i }))
      .filter(
        ({ s }) =>
          s.name.toLowerCase().includes(q) ||
          s.seat === searchQuery.trim() ||
          String(s.seat).includes(q)
      );
  }, [students, searchQuery]);

  /** 依班級分區（班級名稱自然排序），每區為 { className, rows: { s, i }[] } */
  const groupedByClass = useMemo(() => {
    const map = new Map<string, { s: LanguageElectiveStudent; i: number }[]>();
    for (const { s, i } of filteredWithIndex) {
      const list = map.get(s.className) ?? [];
      list.push({ s, i });
      map.set(s.className, list);
    }
    const classNames = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return classNames.map((className) => ({
      className,
      rows: (map.get(className) ?? []).sort((a, b) => parseInt(a.s.seat, 10) - parseInt(b.s.seat, 10)),
    }));
  }, [filteredWithIndex]);
  const defaultLanguage = languageOptions[0] ?? '無／未選';

  const addLanguageOption = () => {
    const v = newLanguageInput.trim();
    if (!v || languageOptions.includes(v)) return;
    const next = [...languageOptions, v];
    setLanguageOptions(next);
    saveLanguageOptions(next);
    setNewLanguageInput('');
  };

  const removeLanguageOption = (opt: string) => {
    if (languageOptions.length <= 1) return;
    const next = languageOptions.filter((o) => o !== opt);
    setLanguageOptions(next);
    saveLanguageOptions(next);
    if (batchLanguage === opt) setBatchLanguage(next[0] ?? '');
  };

  useEffect(() => {
    if (languageOptions.length && !languageOptions.includes(batchLanguage)) setBatchLanguage(languageOptions[0]);
  }, [languageOptions]);

  const loadSavedRoster = useCallback(async () => {
    setLoadingRoster(true);
    setError(null);
    try {
      const doc = await getLanguageElectiveRoster(academicYear);
      if (doc?.students?.length) setStudents(doc.students);
      else setStudents([]);
      setLanguageClassSettings(doc?.languageClassSettings ?? []);
      setManualEditIndices(new Set());
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

        const prevYear = String(parseInt(academicYear, 10) - 1);
        const allRosters = await getAllLanguageElectiveRosters();
        const prevRoster = allRosters.find((r) => r.academicYear === prevYear);
        const nameToLanguage = prevRoster ? buildNameToLanguageFromRosters([prevRoster]) : {};
        const defaultLang = languageOptions[0] ?? '無／未選';
        const list = rosterMapToStudents(roster, nameToLanguage, defaultLang);
        setStudents(list);
        setManualEditIndices(new Set());
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
    setManualEditIndices((prev) => new Set(prev).add(index));
    setStudents((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], language };
      return next;
    });
  };

  const updateStudentLanguageClass = (index: number, languageClass: string) => {
    setStudents((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], languageClass: languageClass || undefined };
      return next;
    });
  };

  const addLanguageClassSetting = () => {
    setLanguageClassSettings((prev) => [
      ...prev,
      { id: `lc-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: '', classroom: '', time: '', teacher: '' },
    ]);
  };

  const updateLanguageClassSetting = (id: string, field: keyof LanguageClassSetting, value: string) => {
    setLanguageClassSettings((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeLanguageClassSetting = (id: string) => {
    setLanguageClassSettings((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAddDate = () => {
    if (dateInput) {
      const d = new Date(dateInput);
      if (!isNaN(d.getTime())) {
        setDates((prev) => [...prev, d].sort((a, b) => a.getTime() - b.getTime()));
        setDateInput('');
      }
    }
  };

  const handleRemoveDate = (index: number) => {
    setDates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateDates = () => {
    if (!genStartDate || !genEndDate) return;
    const start = new Date(genStartDate);
    const end = new Date(genEndDate);
    const targetDay = parseInt(genDayOfWeek, 10);
    const newDates: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() === targetDay) newDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    setDates((prev) => {
      const combined = [...prev, ...newDates];
      const unique = Array.from(new Set(combined.map((d) => d.getTime()))).map((t) => new Date(t));
      return unique.sort((a, b) => a.getTime() - b.getTime());
    });
  };

  /** 依語言班別產生點名單資料（格式與點名單製作相同） */
  const sheetDataList = useMemo((): AttendanceTableData[] => {
    const list: AttendanceTableData[] = [];
    const defaultPeriod = '第一節';
    for (const setting of languageClassSettings) {
      const name = setting.name?.trim();
      if (!name) continue;
      const rosterStudents = students
        .filter((s) => (s.languageClass ?? '').trim() === name)
        .sort((a, b) => {
          const c = a.className.localeCompare(b.className, undefined, { numeric: true });
          return c !== 0 ? c : parseInt(a.seat, 10) - parseInt(b.seat, 10);
        });
      if (rosterStudents.length === 0) continue;
      const sheetStudents: Student[] = rosterStudents.map((s, i) => ({
        id: String(i + 1),
        period: defaultPeriod,
        className: s.className,
        name: s.name,
      }));
      list.push({
        academicYear,
        semester: semester.includes('學期') ? semester : `${semester}學期`,
        courseName: name,
        instructorName: setting.teacher ?? '',
        classTime: setting.time ?? '',
        location: setting.classroom ?? '',
        dates,
        students: sheetStudents,
      });
    }
    return list;
  }, [academicYear, semester, languageClassSettings, students, dates]);

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
    setManualEditIndices((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((i) => next.add(i));
      return next;
    });
    setStudents((prev) =>
      prev.map((s, i) => (selectedIds.has(i) ? { ...s, language: batchLanguage } : s))
    );
    setSelectedIds(new Set());
  };

  /** 依姓名從「上一學年度」繼承選修語言；已手動改過的列不覆蓋 */
  const handleInheritLanguages = async () => {
    if (students.length === 0) return;
    setInheriting(true);
    setError(null);
    try {
      const prevYear = String(parseInt(academicYear, 10) - 1);
      const allRosters = await getAllLanguageElectiveRosters();
      const prevRoster = allRosters.find((r) => r.academicYear === prevYear);
      const nameToLanguage = prevRoster ? buildNameToLanguageFromRosters([prevRoster]) : {};
      const matched = Object.keys(nameToLanguage).length;
      setStudents((prev) =>
        prev.map((s, i) => ({
          ...s,
          language: manualEditIndices.has(i) ? s.language : (nameToLanguage[s.name] ?? s.language),
        }))
      );
      if (matched === 0) setError(`${prevYear} 學年無名單可繼承，或姓名皆無對應。`);
      else setError(null);
    } catch (e: any) {
      setError(e?.message || '繼承失敗');
    } finally {
      setInheriting(false);
    }
  };

  const handleSave = async () => {
    if (students.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await saveLanguageElectiveRoster(academicYear, students, languageClassSettings);
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
          {pageMode === 'roster' ? <Users className="text-blue-600" /> : pageMode === 'sheets' ? <FileText className="text-blue-600" /> : <Search className="text-blue-600" />}
          {pageMode === 'roster' ? '學生名單' : pageMode === 'sheets' ? '點名單製作' : '學生查詢'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {pageMode === 'roster' && (
            <>核心名單：在此建置學年名單、選修語言與語言班別並儲存，建置成功後即可於「點名單製作」快速渲染點名單、於「頒獎通知」從名單拖曳加入受獎學生。</>
          )}
          {pageMode === 'query' && (
            <>依學年載入名單後可搜尋學生（姓名或座號），依班級分區檢視；選修語言為其中一項維度，可在此檢視或編輯並儲存。</>
          )}
          {pageMode === 'sheets' && (
            <>依語言班別渲染點名單，教室／時間／教師由學生名單之語言班別設定帶入。名單與班別請先於「學生名單」建置。</>
          )}
        </p>
      </div>

      {/* 查詢區：學年、學期 + 載入名單 + 搜尋 + 快速渲染 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">學期</label>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="上學期">上學期</option>
              <option value="下學期">下學期</option>
            </select>
          </div>
          <button
            type="button"
            onClick={loadSavedRoster}
            disabled={loadingRoster}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1"
          >
            {loadingRoster ? <Loader2 size={14} className="animate-spin" /> : null}
            載入名單
          </button>
          {hasRoster && (
            <div className="flex items-center gap-2 ml-auto">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋姓名或座號…"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-blue-300"
              />
              {searchQuery.trim() && (
                <span className="text-xs text-slate-500">符合 {filteredWithIndex.length} 人</span>
              )}
            </div>
          )}
        </div>
        {hasRoster && sheetDataList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'roster' ? 'sheets' : 'roster')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              <FileText size={16} />
              {activeView === 'roster' ? '快速渲染點名單' : '返回名單編輯'}
            </button>
            {activeView === 'sheets' && (
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-800 no-print">
                <Printer size={16} /> 列印全部
              </button>
            )}
          </div>
        )}
      </div>

      {/* 點名單預覽（快速渲染：依語言班別，格式與點名單製作相同） */}
      {activeView === 'sheets' && (
        <div className="space-y-6 pb-20">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center no-print">
            <div className="text-sm text-blue-800">
              <strong>點名單預覽</strong> — 依語言班別共 {sheetDataList.length} 張，教室／時間／教師已從語言班別設定帶入。
            </div>
            <button type="button" onClick={() => window.print()} className="flex items-center bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900">
              <Printer size={18} className="mr-2" /> 列印
            </button>
          </div>
          {sheetDataList.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg text-amber-800 text-sm">
              <p className="font-medium mb-1">尚無可渲染的點名單。</p>
              <p>請先至「<strong>學生名單</strong>」建立名單、設定語言班別（教室／時間／教師）與點名單日期，再回到「點名單製作」或於學生名單頁點「快速渲染點名單」。</p>
            </div>
          )}
          {sheetDataList.map((data, idx) => (
            <div key={idx} className="break-before-page">
              <AttendanceSheet data={data} />
            </div>
          ))}
        </div>
      )}

      {activeView === 'roster' && (
        <>
      {/* 進階：管理語言類別（選修語言維度之選項） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setLanguageOptionsOpen(!languageOptionsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <Settings2 size={18} />
            管理語言類別（選修語言維度）
          </span>
          {languageOptionsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {languageOptionsOpen && (
          <div className="p-4 pt-0 space-y-3">
            <p className="text-sm text-slate-600">選修語言下拉選單由此管理，至少保留一項。新增後會即時套用。</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newLanguageInput}
                onChange={(e) => setNewLanguageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguageOption())}
                placeholder="輸入新類別名稱"
                className="border rounded px-3 py-1.5 text-sm w-40"
              />
              <button
                type="button"
                onClick={addLanguageOption}
                disabled={!newLanguageInput.trim() || languageOptions.includes(newLanguageInput.trim())}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={14} /> 新增
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {languageOptions.map((opt) => (
                <li
                  key={opt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-sm"
                >
                  <span>{opt}</span>
                  <button
                    type="button"
                    onClick={() => removeLanguageOption(opt)}
                    disabled={languageOptions.length <= 1}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="刪除此類別"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 語言班別設定：教室、時間、教師（與名單一併儲存） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setLanguageClassSettingsOpen(!languageClassSettingsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen size={18} />
            語言班別設定（教室、時間、教師）
          </span>
          {languageClassSettingsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {languageClassSettingsOpen && (
          <div className="p-4 pt-0 space-y-3">
            <p className="text-sm text-slate-600">
              新增班別名稱後，學生名單中可選擇「語言班別」；此處可記錄各班別的教室、上課時間、授課教師，與名單一併儲存。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">班別名稱</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">教室</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">時間</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">教師</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {languageClassSettings.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateLanguageClassSetting(row.id, 'name', e.target.value)}
                          placeholder="例：閩南語A"
                          className="border rounded px-2 py-1 w-full max-w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.classroom ?? ''}
                          onChange={(e) => updateLanguageClassSetting(row.id, 'classroom', e.target.value)}
                          placeholder="教室"
                          className="border rounded px-2 py-1 w-full max-w-[100px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.time ?? ''}
                          onChange={(e) => updateLanguageClassSetting(row.id, 'time', e.target.value)}
                          placeholder="例：週一 08:00"
                          className="border rounded px-2 py-1 w-full max-w-[120px]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.teacher ?? ''}
                          onChange={(e) => updateLanguageClassSetting(row.id, 'teacher', e.target.value)}
                          placeholder="教師"
                          className="border rounded px-2 py-1 w-full max-w-[100px]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => removeLanguageClassSetting(row.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="刪除此班別"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addLanguageClassSetting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300"
            >
              <Plus size={14} /> 新增班別
            </button>
          </div>
        )}
      </div>

      {/* 點名單日期設定（與點名單製作相同邏輯） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setDatesSettingOpen(!datesSettingOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <CalendarIcon size={18} />
            點名單日期設定
          </span>
          {datesSettingOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {datesSettingOpen && (
          <div className="p-4 pt-0 space-y-3">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-bold text-blue-800 text-sm mb-2">批次生成（每週固定）</h4>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} className="border rounded p-1 text-sm" />
                <input type="date" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} className="border rounded p-1 text-sm" />
                <select value={genDayOfWeek} onChange={(e) => setGenDayOfWeek(e.target.value)} className="border rounded p-1 text-sm">
                  <option value="1">週一</option>
                  <option value="2">週二</option>
                  <option value="3">週三</option>
                  <option value="4">週四</option>
                  <option value="5">週五</option>
                  <option value="6">週六</option>
                  <option value="0">週日</option>
                </select>
              </div>
              <button type="button" onClick={handleGenerateDates} className="w-full bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700">
                生成日期
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">手動加入日期</label>
              <div className="flex gap-2">
                <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="flex-1 border rounded p-2 text-sm" />
                <button type="button" onClick={handleAddDate} className="bg-slate-700 text-white px-4 rounded text-sm hover:bg-slate-800">加入</button>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">已選日期（{dates.length}）</p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {dates.map((d, i) => (
                  <span key={i} className="bg-slate-100 border border-slate-300 px-2 py-1 rounded text-sm flex items-center">
                    {d.toLocaleDateString('zh-TW')}
                    <button type="button" onClick={() => handleRemoveDate(i)} className="ml-2 text-slate-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {dates.length === 0 && <span className="text-slate-400 text-sm">尚未設定日期</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 進階：名單來源與格式說明（可收合） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setFormatOpen(!formatOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <HelpCircle size={18} />
            名單來源與 Excel / CSV 格式說明
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

      {/* 名單來源：上傳 Excel（建立/更新查詢名單） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
          <Upload className="w-9 h-9 text-slate-400 mb-2" />
          <span className="text-sm font-medium text-slate-600">上傳 Excel 或 CSV 班級名單（建立或更新核心名單，會依姓名繼承選修語言）</span>
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
              查詢結果：{academicYear} 學年（{students.length} 人）
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
                onClick={handleInheritLanguages}
                disabled={inheriting || students.length === 0}
                title="依姓名從上一學年度帶入選修語言；已手動改過的會保留不覆蓋"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-sm disabled:opacity-50"
              >
                {inheriting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                依姓名繼承過往學年
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
              {languageOptions.map((opt) => (
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
            {languageClassNames.length > 0 && (
              <>
                <select
                  value={batchLanguageClass}
                  onChange={(e) => setBatchLanguageClass(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">— 語言班別 —</option>
                  {languageClassNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!batchLanguageClass || selectedIds.size === 0) return;
                    setStudents((prev) =>
                      prev.map((s, i) =>
                        selectedIds.has(i) ? { ...s, languageClass: batchLanguageClass } : s
                      )
                    );
                    setSelectedIds(new Set());
                  }}
                  disabled={selectedIds.size === 0 || !batchLanguageClass}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  將選取學生設為上述班別
                </button>
              </>
            )}
          </div>

          <p className="mb-2 text-sm text-slate-600">
            以下依班級分區顯示；<strong>選修語言</strong>為其中一項維度，可在此編輯並儲存。
          </p>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-200 rounded-lg">
            {groupedByClass.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {searchQuery.trim() ? '無符合條件的學生' : '尚無名單'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {groupedByClass.map(({ className, rows }) => (
                  <div key={className} className="bg-white">
                    <div className="sticky top-0 z-10 bg-slate-100 px-4 py-2 font-semibold text-slate-800 border-b border-slate-200">
                      {className} 班（{rows.length} 人）
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-2 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={rows.every(({ i }) => selectedIds.has(i)) && rows.length > 0}
                              onChange={() => {
                                const allSelected = rows.every(({ i }) => selectedIds.has(i));
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  rows.forEach(({ i }) => (allSelected ? next.delete(i) : next.add(i)));
                                  return next;
                                });
                              }}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">座號</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">姓名</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">選修語言</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-600">語言班別</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map(({ s, i }) => (
                          <tr key={`${s.className}-${s.seat}-${i}`} className="hover:bg-slate-50">
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(i)}
                                onChange={() => toggleSelect(i)}
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-600">{s.seat}</td>
                            <td className="px-3 py-2 text-slate-700">{s.name}</td>
                            <td className="px-3 py-2">
                              <select
                                value={s.language}
                                onChange={(e) => updateStudentLanguage(i, e.target.value)}
                                className="border rounded px-2 py-1 text-sm w-full max-w-[140px]"
                              >
                                {(() => {
                                  const opts = new Set(languageOptions);
                                  if (s.language && !opts.has(s.language)) opts.add(s.language);
                                  return Array.from(opts).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ));
                                })()}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={s.languageClass ?? ''}
                                onChange={(e) => updateStudentLanguageClass(i, e.target.value)}
                                className="border rounded px-2 py-1 text-sm w-full max-w-[120px]"
                              >
                                <option value="">—</option>
                                {languageClassNames.map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                                {s.languageClass && !languageClassNames.includes(s.languageClass) && (
                                  <option value={s.languageClass}>{s.languageClass}</option>
                                )}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default LanguageElectiveRoster;
