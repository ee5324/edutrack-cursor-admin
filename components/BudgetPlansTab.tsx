import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Save, Loader2, RefreshCw } from 'lucide-react';
import type { BudgetPlan } from '../types';
import { getBudgetPlans, saveBudgetPlan, deleteBudgetPlan } from '../services/api';

const fmtMoney = (n: number) =>
  n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** 民國學年（與校務慣用一致） */
function defaultRocYear(): string {
  return String(new Date().getFullYear() - 1911);
}

function yearOptions(): string[] {
  const end = parseInt(defaultRocYear(), 10) + 2;
  const start = Math.min(end - 12, 108);
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateBudgetRequired(p: {
  academicYear: string;
  closeByDate: string;
  closureRequirements: string;
}): string | null {
  if (!p.academicYear.trim()) return '請選擇學年度';
  if (!p.closeByDate.trim() || !ISO_DATE.test(p.closeByDate.trim())) return '請填寫有效的計畫結案日期（YYYY-MM-DD）';
  if (!p.closureRequirements.trim()) return '請填寫結案要求';
  return null;
}

const BudgetPlansTab: React.FC = () => {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState(defaultRocYear);
  /** 在「全部學年」檢視時，新增計畫用的學年度 */
  const [newPlanYear, setNewPlanYear] = useState(defaultRocYear);
  const [newRow, setNewRow] = useState({
    name: '',
    budgetTotal: '',
    spentTotal: '0',
    closeByDate: '',
    closureRequirements: '',
    note: '',
  });

  const yearList = useMemo(() => yearOptions(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getBudgetPlans(academicYear.trim() === '' ? undefined : academicYear);
      setPlans(list);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (p: Partial<BudgetPlan> & { name: string; id?: string }) => {
    const ve = validateBudgetRequired({
      academicYear: p.academicYear ?? '',
      closeByDate: p.closeByDate ?? '',
      closureRequirements: p.closureRequirements ?? '',
    });
    if (ve) {
      setError(ve);
      return;
    }

    const id = p.id ?? 'new';
    setSavingId(id);
    setError(null);
    try {
      await saveBudgetPlan({
        id: p.id,
        academicYear: String(p.academicYear).trim(),
        name: p.name.trim(),
        budgetTotal: Number(p.budgetTotal) || 0,
        spentTotal: Number(p.spentTotal) || 0,
        closeByDate: String(p.closeByDate).trim(),
        closureRequirements: String(p.closureRequirements).trim(),
        note: p.note ?? '',
      });
      await load();
      if (!p.id) {
        setNewRow({
          name: '',
          budgetTotal: '',
          spentTotal: '0',
          closeByDate: '',
          closureRequirements: '',
          note: '',
        });
      }
    } catch (e: any) {
      setError(e?.message || '儲存失敗');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定刪除計畫「${name}」？`)) return;
    setSavingId(id);
    setError(null);
    try {
      await deleteBudgetPlan({ id });
      await load();
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setSavingId(null);
    }
  };

  const effectiveNewYear = academicYear.trim() === '' ? newPlanYear : academicYear;

  const canCreate =
    effectiveNewYear.trim() &&
    newRow.name.trim() &&
    newRow.closeByDate.trim() &&
    ISO_DATE.test(newRow.closeByDate.trim()) &&
    newRow.closureRequirements.trim();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="text-emerald-600" />
          計畫預算
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          依<strong>學年度</strong>管理各項計畫核配額度與已支出；每筆計畫需填寫<strong>計畫結案時間</strong>與<strong>結案要求</strong>。資料儲存於 Firebase（
          <code className="text-xs bg-slate-100 px-1 rounded">edutrack_budget_plans</code>）。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">學年度</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm min-w-[10rem] bg-white"
          >
            <option value="">全部學年（含未指定學年之舊資料）</option>
            {yearList.map((y) => (
              <option key={y} value={y}>
                {y} 學年度
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500 flex-1 min-w-[12rem] pb-1">
          切換學年度會篩選列表。選「全部學年」時可看到未帶學年的舊資料；新增計畫請在表單內選學年度。
        </p>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          重新載入
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Plus size={16} />
          新增計畫
          {academicYear.trim() !== '' ? `（${academicYear} 學年度）` : ''}
        </h2>
        {academicYear.trim() === '' && (
          <div className="max-w-xs">
            <label className="block text-xs text-slate-500 mb-1">新增計畫所屬學年度</label>
            <select
              value={newPlanYear}
              onChange={(e) => setNewPlanYear(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white"
            >
              {yearList.map((y) => (
                <option key={y} value={y}>
                  {y} 學年度
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">計畫名稱</label>
            <input
              value={newRow.name}
              onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              placeholder="例：本土語補助"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              計畫結案時間 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newRow.closeByDate}
              onChange={(e) => setNewRow((r) => ({ ...r, closeByDate: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs text-slate-500 mb-1">
              結案要求 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={newRow.closureRequirements}
              onChange={(e) => setNewRow((r) => ({ ...r, closureRequirements: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm min-h-[72px]"
              placeholder="例：完成經費核銷、繳交成果報告、上傳結案簡報…"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">核配額度（元）</label>
            <input
              type="number"
              min={0}
              step={1}
              value={newRow.budgetTotal}
              onChange={(e) => setNewRow((r) => ({ ...r, budgetTotal: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">已支出（元）</label>
            <input
              type="number"
              min={0}
              step={1}
              value={newRow.spentTotal}
              onChange={(e) => setNewRow((r) => ({ ...r, spentTotal: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!canCreate || savingId === 'new'}
              onClick={() =>
                handleSave({
                  academicYear: effectiveNewYear,
                  name: newRow.name,
                  budgetTotal: Number(newRow.budgetTotal) || 0,
                  spentTotal: Number(newRow.spentTotal) || 0,
                  closeByDate: newRow.closeByDate,
                  closureRequirements: newRow.closureRequirements,
                  note: newRow.note,
                })
              }
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingId === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              建立
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">備註（選填）</label>
          <input
            value={newRow.note}
            onChange={(e) => setNewRow((r) => ({ ...r, note: e.target.value }))}
            className="w-full border rounded-lg px-2 py-1.5 text-sm"
            placeholder="說明或文號…"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-800">
            計畫列表{academicYear.trim() !== '' ? `（${academicYear} 學年度）` : '（全部學年）'}
          </h2>
        </div>
        {loading && plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> 載入中…
          </div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">此學年度尚無計畫，請先新增一筆。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-24">學年度</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[120px]">計畫名稱</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-36">結案時間</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[180px]">結案要求</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">核配額度</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">已支出</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">剩餘</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[120px]">備註</th>
                  <th className="w-28 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((p) => {
                  const remaining = (p.budgetTotal ?? 0) - (p.spentTotal ?? 0);
                  return (
                    <PlanRow
                      key={p.id}
                      plan={p}
                      remaining={remaining}
                      saving={savingId === p.id}
                      onSave={handleSave}
                      onDelete={() => handleDelete(p.id, p.name)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/** 單列可編輯 */
const PlanRow: React.FC<{
  plan: BudgetPlan;
  remaining: number;
  saving: boolean;
  onSave: (p: Partial<BudgetPlan> & { name: string; id?: string }) => void;
  onDelete: () => void;
}> = ({ plan, remaining, saving, onSave, onDelete }) => {
  const [academicYear, setAcademicYear] = useState(plan.academicYear || '');
  const [name, setName] = useState(plan.name);
  const [budgetTotal, setBudgetTotal] = useState(String(plan.budgetTotal));
  const [spentTotal, setSpentTotal] = useState(String(plan.spentTotal));
  const [closeByDate, setCloseByDate] = useState(plan.closeByDate || '');
  const [closureRequirements, setClosureRequirements] = useState(plan.closureRequirements || '');
  const [note, setNote] = useState(plan.note ?? '');

  useEffect(() => {
    setAcademicYear(plan.academicYear || '');
    setName(plan.name);
    setBudgetTotal(String(plan.budgetTotal));
    setSpentTotal(String(plan.spentTotal));
    setCloseByDate(plan.closeByDate || '');
    setClosureRequirements(plan.closureRequirements || '');
    setNote(plan.note ?? '');
  }, [
    plan.id,
    plan.academicYear,
    plan.name,
    plan.budgetTotal,
    plan.spentTotal,
    plan.closeByDate,
    plan.closureRequirements,
    plan.note,
  ]);

  const yearList = useMemo(() => yearOptions(), []);
  const rowValid =
    name.trim() &&
    academicYear.trim() &&
    closeByDate.trim() &&
    ISO_DATE.test(closeByDate.trim()) &&
    closureRequirements.trim();

  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-3 py-2 align-top">
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        >
          {yearList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="date"
          value={closeByDate}
          onChange={(e) => setCloseByDate(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={closureRequirements}
          onChange={(e) => setClosureRequirements(e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm min-w-[160px]"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number"
          min={0}
          step={1}
          value={budgetTotal}
          onChange={(e) => setBudgetTotal(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number"
          min={0}
          step={1}
          value={spentTotal}
          onChange={(e) => setSpentTotal(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-right"
        />
      </td>
      <td className="px-3 py-2 align-top text-right font-medium tabular-nums">
        <span className={remaining < 0 ? 'text-red-600' : 'text-slate-800'}>{fmtMoney(remaining)}</span>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving || !rowValid}
            onClick={() =>
              onSave({
                id: plan.id,
                academicYear,
                name,
                budgetTotal: Number(budgetTotal) || 0,
                spentTotal: Number(spentTotal) || 0,
                closeByDate,
                closureRequirements,
                note,
              })
            }
            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
            title="儲存"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40"
            title="刪除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default BudgetPlansTab;
