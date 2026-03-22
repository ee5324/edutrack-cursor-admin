import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Save, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { BudgetPlan, BudgetPlanStatus } from '../types';
import { getBudgetPlans, saveBudgetPlan, deleteBudgetPlan } from '../services/api';
import { closeDateAlertLabel } from '../utils/budgetPlanAlerts';

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
  accountingCode: string;
}): string | null {
  if (!p.academicYear.trim()) return '請選擇學年度';
  if (!p.accountingCode.trim()) return '請填寫會計代碼';
  if (!p.closeByDate.trim() || !ISO_DATE.test(p.closeByDate.trim())) return '請填寫有效的計畫結案日期（YYYY-MM-DD）';
  if (!p.closureRequirements.trim()) return '請填寫結案要求';
  return null;
}

interface BudgetPlansTabProps {
  /** 儲存／刪除後通知上層重新計算導覽警示 */
  onDataChanged?: () => void;
}

const BudgetPlansTab: React.FC<BudgetPlansTabProps> = ({ onDataChanged }) => {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState(defaultRocYear);
  const [newPlanYear, setNewPlanYear] = useState(defaultRocYear);
  const [newRow, setNewRow] = useState({
    name: '',
    accountingCode: '',
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
      accountingCode: p.accountingCode ?? '',
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
        accountingCode: String(p.accountingCode).trim(),
        budgetTotal: Number(p.budgetTotal) || 0,
        spentTotal: Number(p.spentTotal) || 0,
        closeByDate: String(p.closeByDate).trim(),
        closureRequirements: String(p.closureRequirements).trim(),
        status: p.status === 'closed' ? 'closed' : 'active',
        note: p.note ?? '',
      });
      await load();
      onDataChanged?.();
      if (!p.id) {
        setNewRow({
          name: '',
          accountingCode: '',
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
      onDataChanged?.();
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setSavingId(null);
    }
  };

  const effectiveNewYear = academicYear.trim() === '' ? newPlanYear : academicYear;

  const canCreate =
    effectiveNewYear.trim() &&
    newRow.accountingCode.trim() &&
    newRow.name.trim() &&
    newRow.closeByDate.trim() &&
    ISO_DATE.test(newRow.closeByDate.trim()) &&
    newRow.closureRequirements.trim();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="text-emerald-600" />
          計畫專案管理
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          以專案方式追蹤核配與支出：<strong>建立後請依執行進度隨時更新「已支出」</strong>，無需一次登錄完。每筆需填
          <strong>會計代碼</strong>、<strong>結案日</strong>與<strong>結案要求</strong>。資料存於{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">edutrack_budget_plans</code>。
        </p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <strong>使用方式：</strong>
        初始建立時可將「已支出」設為 0 或目前已動用金額；之後依請購、核銷或付款進度，開啟本頁編輯該列並儲存即可更新。「已結案」的計畫不會再出現在左側選單的結案警示。
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              會計代碼 <span className="text-red-500">*</span>
            </label>
            <input
              value={newRow.accountingCode}
              onChange={(e) => setNewRow((r) => ({ ...r, accountingCode: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm font-mono"
              placeholder="例：5010-01"
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
          <div className="sm:col-span-2 lg:col-span-4">
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
          <div className="flex items-end lg:col-span-2">
            <button
              type="button"
              disabled={!canCreate || savingId === 'new'}
              onClick={() =>
                handleSave({
                  academicYear: effectiveNewYear,
                  name: newRow.name,
                  accountingCode: newRow.accountingCode,
                  budgetTotal: Number(newRow.budgetTotal) || 0,
                  spentTotal: Number(newRow.spentTotal) || 0,
                  closeByDate: newRow.closeByDate,
                  closureRequirements: newRow.closureRequirements,
                  status: 'active',
                  note: newRow.note,
                })
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
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
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-24">狀態</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-24">學年</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[100px]">計畫</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-28">會計代碼</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-36">結案日</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 w-32">提醒</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[160px]">結案要求</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-24">核配</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-24">已支出</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-24">剩餘</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[100px]">備註</th>
                  <th className="w-24 px-3 py-2"></th>
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

const PlanRow: React.FC<{
  plan: BudgetPlan;
  remaining: number;
  saving: boolean;
  onSave: (p: Partial<BudgetPlan> & { name: string; id?: string }) => void;
  onDelete: () => void;
}> = ({ plan, remaining, saving, onSave, onDelete }) => {
  const [status, setStatus] = useState<BudgetPlanStatus>(plan.status === 'closed' ? 'closed' : 'active');
  const [academicYear, setAcademicYear] = useState(plan.academicYear || '');
  const [name, setName] = useState(plan.name);
  const [accountingCode, setAccountingCode] = useState(plan.accountingCode || '');
  const [budgetTotal, setBudgetTotal] = useState(String(plan.budgetTotal));
  const [spentTotal, setSpentTotal] = useState(String(plan.spentTotal));
  const [closeByDate, setCloseByDate] = useState(plan.closeByDate || '');
  const [closureRequirements, setClosureRequirements] = useState(plan.closureRequirements || '');
  const [note, setNote] = useState(plan.note ?? '');

  useEffect(() => {
    setStatus(plan.status === 'closed' ? 'closed' : 'active');
    setAcademicYear(plan.academicYear || '');
    setName(plan.name);
    setAccountingCode(plan.accountingCode || '');
    setBudgetTotal(String(plan.budgetTotal));
    setSpentTotal(String(plan.spentTotal));
    setCloseByDate(plan.closeByDate || '');
    setClosureRequirements(plan.closureRequirements || '');
    setNote(plan.note ?? '');
  }, [
    plan.id,
    plan.status,
    plan.academicYear,
    plan.name,
    plan.accountingCode,
    plan.budgetTotal,
    plan.spentTotal,
    plan.closeByDate,
    plan.closureRequirements,
    plan.note,
  ]);

  const yearList = useMemo(() => yearOptions(), []);
  const alertText = useMemo(
    () => closeDateAlertLabel({ ...plan, status, closeByDate } as BudgetPlan),
    [plan.id, plan.academicYear, plan.name, plan.accountingCode, plan.budgetTotal, plan.spentTotal, plan.closureRequirements, plan.note, status, closeByDate]
  );

  const rowValid =
    name.trim() &&
    academicYear.trim() &&
    accountingCode.trim() &&
    closeByDate.trim() &&
    ISO_DATE.test(closeByDate.trim()) &&
    closureRequirements.trim();

  const rowTint =
    status === 'closed'
      ? 'opacity-70 bg-slate-50/50'
      : alertText?.includes('逾期')
        ? 'bg-red-50/40 border-l-4 border-l-red-400'
        : alertText
          ? 'bg-amber-50/40 border-l-4 border-l-amber-400'
          : '';

  return (
    <tr className={`hover:bg-slate-50/80 ${rowTint}`}>
      <td className="px-3 py-2 align-top">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BudgetPlanStatus)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
        >
          <option value="active">進行中</option>
          <option value="closed">已結案</option>
        </select>
      </td>
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
          value={accountingCode}
          onChange={(e) => setAccountingCode(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm font-mono"
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
      <td className="px-3 py-2 align-top text-xs">
        {status === 'closed' ? (
          <span className="text-slate-400">—</span>
        ) : alertText ? (
          <span className={`inline-flex items-center gap-1 font-medium ${alertText.includes('逾期') ? 'text-red-700' : 'text-amber-800'}`}>
            <AlertTriangle size={14} className="shrink-0" />
            {alertText}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={closureRequirements}
          onChange={(e) => setClosureRequirements(e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm min-w-[140px]"
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
                status,
                academicYear,
                name,
                accountingCode,
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
