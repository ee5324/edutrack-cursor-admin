import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Users, ChevronDown, ChevronRight, Save, Loader2, RefreshCw, Search } from 'lucide-react';
import type { LanguageElectiveStudent, LanguageClassSetting } from '../types';
import {
  getLanguageElectiveRoster,
  getAllLanguageElectiveRosters,
  buildNameToLanguageFromRosters,
  saveLanguageElectiveRoster,
} from '../services/api';
import { loadLanguageOptions } from '../utils/languageOptions';

const LanguageElectiveRoster: React.FC = () => {
  const [academicYear, setAcademicYear] = useState('114');
  const [students, setStudents] = useState<LanguageElectiveStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [languageOptions, setLanguageOptions] = useState<string[]>(() => loadLanguageOptions());
  const [batchLanguage, setBatchLanguage] = useState(() => loadLanguageOptions()[0] ?? '閩南語');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [inheriting, setInheriting] = useState(false);
  /** 本 session 內手動改過選修語言的列索引，繼承時不覆蓋 */
  const [manualEditIndices, setManualEditIndices] = useState<Set<number>>(new Set());
  /** 搜尋：姓名或座號（空白則顯示全部） */
  const [searchQuery, setSearchQuery] = useState('');
  /** 班級篩選：下拉選單，空白＝全部 */
  const [classFilter, setClassFilter] = useState('');
  /** 選修語言篩選：下拉選單，空白＝全部 */
  const [languageFilter, setLanguageFilter] = useState('');
  /** 語言班別設定（僅讀取，供下拉與儲存時帶入；編輯請至「點名單製作」頁） */
  const [languageClassSettings, setLanguageClassSettings] = useState<LanguageClassSetting[]>([]);
  /** 批次設定語言班別時選的班別 */
  const [batchLanguageClass, setBatchLanguageClass] = useState('');

  const hasRoster = students.length > 0;
  const classNames = useMemo(
    () => Array.from(new Set(students.map((s) => s.className))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [students]
  );
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

  /** 依班級篩選後再分區 */
  const filteredByClass = useMemo(() => {
    if (!classFilter.trim()) return filteredWithIndex;
    return filteredWithIndex.filter(({ s }) => s.className === classFilter);
  }, [filteredWithIndex, classFilter]);

  /** 依選修語言篩選 */
  const filteredByLanguage = useMemo(() => {
    if (!languageFilter.trim()) return filteredByClass;
    return filteredByClass.filter(({ s }) => (s.language ?? '') === languageFilter);
  }, [filteredByClass, languageFilter]);

  /** 依班級分區（班級名稱自然排序），每區為 { className, rows: { s, i }[] } */
  const groupedByClass = useMemo(() => {
    const map = new Map<string, { s: LanguageElectiveStudent; i: number }[]>();
    for (const { s, i } of filteredByLanguage) {
      const list = map.get(s.className) ?? [];
      list.push({ s, i });
      map.set(s.className, list);
    }
    const names = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return names.map((className) => ({
      className,
      rows: (map.get(className) ?? []).sort((a, b) => parseInt(a.s.seat, 10) - parseInt(b.s.seat, 10)),
    }));
  }, [filteredByLanguage]);
  const defaultLanguage = languageOptions[0] ?? '無／未選';

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
      const nameKey = (name: string) => (name && String(name).trim()) || '';
      setStudents((prev) =>
        prev.map((s, i) => ({
          ...s,
          language: manualEditIndices.has(i) ? s.language : (nameToLanguage[nameKey(s.name)] ?? s.language),
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
      const doc = await getLanguageElectiveRoster(academicYear);
      const latestSettings = doc?.languageClassSettings ?? languageClassSettings;
      await saveLanguageElectiveRoster(academicYear, students, latestSettings);
      setLanguageClassSettings(latestSettings);
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
          學生名單
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          學年名單之編輯、查詢、儲存；可設定選修語言與語言班別。名單來源請至「系統設定」以 Excel/CSV 上傳（每年約一次）；語言班別之教室、時間、教師請至「點名單製作」頁設定。建置完成後可於「點名單製作」產出點名單、於「頒獎通知」從名單拖曳加入受獎學生。
        </p>
      </div>

      {/* 學年 + 載入名單 + 搜尋 */}
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
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">班級</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[5rem] focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">全部</option>
                  {classNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">選修語言</label>
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm min-w-[6rem] focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">全部</option>
                  {languageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Search size={16} className="text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋姓名或座號…"
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-blue-300"
                />
                {(searchQuery.trim() || classFilter || languageFilter) && (
                  <span className="text-xs text-slate-500">符合 {filteredByLanguage.length} 人</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 名單表格：手動修改 + 批次 */}
      {hasRoster && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {academicYear} 學年名單（{students.length} 人）
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
                {(searchQuery.trim() || classFilter || languageFilter) ? '無符合條件的學生' : '尚無名單'}
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
    </div>
  );
};

export default LanguageElectiveRoster;
