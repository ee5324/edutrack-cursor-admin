import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Plus, Trash2, Save, Loader2, RefreshCw, Link2 } from 'lucide-react';
import type { BudgetPlan, BudgetPlanAdvance, BudgetAdvanceStatus } from '../types';
import { getBudgetPlans, getBudgetPlanAdvances, saveBudgetPlanAdvance, deleteBudgetPlanAdvance } from '../services/api';
import { periodKindLabel } from '../utils/budgetPlanPeriod';

const fmtMoney = (n: number) =>
  n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STATUS_LABEL: Record<BudgetAdvanceStatus, string> = {
  outstanding: '待歸還／沖銷',
  settled: '已核銷或歸還',
  cancelled: '作廢',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function planLabel(p: BudgetPlan): string {
  const k = periodKindLabel(p.periodKind);
  return `${p.name}（${k} ${p.academicYear} · ${p.accountingCode || '—'}）`;
}

const BudgetAdvancesTab: React.FC = () => {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [advances, setAdvances] = useState<BudgetPlanAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterPlanId, setFilterPlanId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | BudgetAdvanceStatus>('');
  const [newRow, setNewRow] = useState({
    budgetPlanId: '',
    amount: '',
    advanceDate: new Date().toISOString().slice(0, 10),
    title: '',
    paidBy: '',
    status: 'outstanding' as BudgetAdvanceStatus,
    memo: '',
  });

  const planById = useMemo(() => {
    const m = new Map<string, BudgetPlan>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pList, aList] = await Promise.all([getBudgetPlans(undefined), getBudgetPlanAdvances()]);
      setPlans(pList);
      setAdvances(aList);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredAdvances = useMemo(() => {
    let rows = advances;
    if (filterPlanId.trim()) rows = rows.filter((a) => a.budgetPlanId === filterPlanId.trim());
    if (filterStatus) rows = rows.filter((a) => a.status === filterStatus);
    return rows;
  }, [advances, filterPlanId, filterStatus]);

  const summary = useMemo(() => {
    const outstanding = filteredAdvances.filter((a) => a.status === 'outstanding');
    const totalOut = outstanding.reduce((s, a) => s + a.amount, 0);
    const byPlan = new Map<string, number>();
    for (const a of outstanding) {
      byPlan.set(a.budgetPlanId, (byPlan.get(a.budgetPlanId) ?? 0) + a.amount);
    }
    return { totalOut, byPlan, outstandingCount: outstanding.length };
  }, [filteredAdvances]);

  const handleAdd = async () => {
    if (!newRow.budgetPlanId.trim()) {
      setError('請選擇計畫專案（標明代墊來自哪一筆計畫）');
      return;
    }
    if (!newRow.title.trim()) {
      setError('請填寫摘要說明');
      return;
    }
    if (!newRow.advanceDate.trim() || !ISO_DATE.test(newRow.advanceDate.trim())) {
      setError('請填寫有效代墊日期（YYYY-MM-DD）');
      return;
    }
    const amt = Number(newRow.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('請填寫大於 0 的代墊金額');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBudgetPlanAdvance({
        budgetPlanId: newRow.budgetPlanId.trim(),
        amount: amt,
        advanceDate: newRow.advanceDate.trim(),
        title: newRow.title.trim(),
        paidBy: newRow.paidBy.trim(),
        status: newRow.status,
        memo: newRow.memo.trim(),
      });
      setNewRow({
        budgetPlanId: newRow.budgetPlanId,
        amount: '',
        advanceDate: new Date().toISOString().slice(0, 10),
        title: '',
        paidBy: '',
        status: 'outstanding',
        memo: '',
      });
      await load();
    } catch (e: any) {
      setError(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRow = async (row: BudgetPlanAdvance, patch: Partial<BudgetPlanAdvance>) => {
    setSaving(true);
    setError(null);
    try {
      await saveBudgetPlanAdvance({
        id: row.id,
        budgetPlanId: row.budgetPlanId,
        amount: patch.amount !== undefined ? patch.amount : row.amount,
        advanceDate: patch.advanceDate !== undefined ? patch.advanceDate : row.advanceDate,
        title: patch.title !== undefined ? patch.title : row.title,
        paidBy: patch.paidBy !== undefined ? patch.paidBy : row.paidBy,
        status: patch.status !== undefined ? patch.status : row.status,
        memo: patch.memo !== undefined ? patch.memo : row.memo,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定刪除此筆代墊紀錄？')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteBudgetPlanAdvance({ id });
      await load();
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="text-amber-600" size={28} />
            計畫代墊紀錄
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            記錄暫時代墊金額並<strong>連結計畫專案</strong>，方便追蹤該筆代墊是從哪一個計畫預算脈絡支出、是否已核銷歸還。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          重新載入
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2">{error}</div>
      )}

      {/* 摘要 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="text-xs font-medium text-amber-900/80 uppercase tracking-wide">待歸還／沖銷（篩選後）</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">${fmtMoney(summary.totalOut)}</div>
          <div className="text-xs text-amber-800 mt-1">{summary.outstandingCount} 筆</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
          <div className="text-xs font-medium text-slate-500 mb-2">依計畫彙總（待歸還，篩選後）</div>
          {summary.byPlan.size === 0 ? (
            <p className="text-sm text-slate-400">無待歸還項目</p>
          ) : (
            <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
              {[...summary.byPlan.entries()].map(([pid, amt]) => {
                const p = planById.get(pid);
                return (
                  <li key={pid} className="flex justify-between gap-2">
                    <span className="text-slate-700 truncate">{p ? p.name : pid}</span>
                    <span className="font-medium text-slate-900 shrink-0">${fmtMoney(amt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 新增 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Plus size={18} className="text-slate-600" />
          <h2 className="font-semibold text-slate-800">新增代墊</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Link2 size={12} className="inline mr-1" />
              計畫專案（代墊所屬預算來源）<span className="text-red-500">*</span>
            </label>
            <select
              value={newRow.budgetPlanId}
              onChange={(e) => setNewRow((r) => ({ ...r, budgetPlanId: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">— 請選擇 —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planLabel(p)}
                  {p.status === 'closed' ? '（已結案）' : ''}
                </option>
              ))}
            </select>
            {plans.length === 0 && !loading && (
              <p className="text-xs text-amber-700 mt-1">請先到「計畫專案」建立計畫後再新增代墊。</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">代墊金額（元）*</label>
            <input
              type="number"
              min={1}
              step={1}
              value={newRow.amount}
              onChange={(e) => setNewRow((r) => ({ ...r, amount: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="例如 1500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">代墊日期 *</label>
            <input
              type="date"
              value={newRow.advanceDate}
              onChange={(e) => setNewRow((r) => ({ ...r, advanceDate: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">狀態</label>
            <select
              value={newRow.status}
              onChange={(e) => setNewRow((r) => ({ ...r, status: e.target.value as BudgetAdvanceStatus }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              {(Object.keys(STATUS_LABEL) as BudgetAdvanceStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">摘要說明 *</label>
            <input
              value={newRow.title}
              onChange={(e) => setNewRow((r) => ({ ...r, title: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="例：競賽報名費、材料代買"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">代墊人／對象（選填）</label>
            <input
              value={newRow.paidBy}
              onChange={(e) => setNewRow((r) => ({ ...r, paidBy: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">備註（選填）</label>
            <input
              value={newRow.memo}
              onChange={(e) => setNewRow((r) => ({ ...r, memo: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex justify-end">
            <button
              type="button"
              disabled={saving || plans.length === 0}
              onClick={() => void handleAdd()}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              儲存代墊紀錄
            </button>
          </div>
        </div>
      </div>

      {/* 篩選與列表 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
          <h2 className="font-semibold text-slate-800">紀錄列表</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={filterPlanId}
              onChange={(e) => setFilterPlanId(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">全部計畫</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodKindLabel(p.periodKind)} {p.academicYear} · {p.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus((e.target.value || '') as '' | BudgetAdvanceStatus)}
              className="border border-slate-300 rounded-lg px-2 py-1.5"
            >
              <option value="">全部狀態</option>
              {(Object.keys(STATUS_LABEL) as BudgetAdvanceStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-amber-500" size={32} />
          </div>
        ) : filteredAdvances.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">尚無代墊紀錄或無符合篩選的項目</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">日期</th>
                  <th className="px-3 py-2 font-semibold">計畫專案</th>
                  <th className="px-3 py-2 font-semibold">摘要</th>
                  <th className="px-3 py-2 font-semibold text-right">金額</th>
                  <th className="px-3 py-2 font-semibold">狀態</th>
                  <th className="px-3 py-2 font-semibold w-28">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAdvances.map((row) => {
                  const p = planById.get(row.budgetPlanId);
                  const missingPlan = !p;
                  return (
                    <tr key={row.id} className={missingPlan ? 'bg-amber-50/50' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap align-top">
                        <input
                          type="date"
                          defaultValue={row.advanceDate}
                          key={`d-${row.id}-${row.updatedAt}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== row.advanceDate && ISO_DATE.test(v)) void handleUpdateRow(row, { advanceDate: v });
                          }}
                          disabled={saving}
                          className="border border-slate-200 rounded px-1 py-0.5 text-xs max-w-[9.5rem]"
                        />
                      </td>
                      <td className="px-3 py-2 align-top min-w-[10rem]">
                        <select
                          defaultValue={row.budgetPlanId}
                          key={`p-${row.id}-${row.updatedAt}`}
                          onChange={(e) => void handleUpdateRow(row, { budgetPlanId: e.target.value })}
                          disabled={saving}
                          className="w-full border border-slate-200 rounded px-1 py-1 text-xs"
                        >
                          {missingPlan && (
                            <option value={row.budgetPlanId}>（原計畫已不存在）</option>
                          )}
                          {plans.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.name}
                            </option>
                          ))}
                        </select>
                        {p && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {periodKindLabel(p.periodKind)} {p.academicYear} · {p.accountingCode || '—'}
                          </div>
                        )}
                        {missingPlan && <div className="text-[10px] text-amber-700">原計畫已刪除，請改掛其他計畫</div>}
                      </td>
                      <td className="px-3 py-2 align-top min-w-[8rem]">
                        <input
                          defaultValue={row.title}
                          key={`t-${row.id}-${row.updatedAt}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== row.title) void handleUpdateRow(row, { title: v });
                          }}
                          disabled={saving}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                        {row.paidBy ? (
                          <div className="text-[10px] text-slate-500 mt-0.5">代墊：{row.paidBy}</div>
                        ) : null}
                        {row.memo ? <div className="text-[10px] text-slate-400 mt-0.5">{row.memo}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          defaultValue={row.amount}
                          key={`a-${row.id}-${row.updatedAt}`}
                          onBlur={(e) => {
                            const n = Math.max(0, Number(e.target.value) || 0);
                            if (n > 0 && n !== row.amount) void handleUpdateRow(row, { amount: n });
                          }}
                          disabled={saving}
                          className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-right"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            void handleUpdateRow(row, { status: e.target.value as BudgetAdvanceStatus })
                          }
                          disabled={saving}
                          className="w-full min-w-[7rem] border border-slate-200 rounded px-1 py-1 text-xs"
                        >
                          {(Object.keys(STATUS_LABEL) as BudgetAdvanceStatus[]).map((k) => (
                            <option key={k} value={k}>
                              {STATUS_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDelete(row.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
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

export default BudgetAdvancesTab;
