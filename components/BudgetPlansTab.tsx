import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, Save, Loader2, RefreshCw } from 'lucide-react';
import type { BudgetPlan } from '../types';
import { getBudgetPlans, saveBudgetPlan, deleteBudgetPlan } from '../services/api';

const fmtMoney = (n: number) =>
  n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const BudgetPlansTab: React.FC = () => {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({ name: '', budgetTotal: '', spentTotal: '0', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getBudgetPlans();
      setPlans(list);
    } catch (e: any) {
      setError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (p: Partial<BudgetPlan> & { name: string; id?: string }) => {
    const id = p.id ?? 'new';
    setSavingId(id);
    setError(null);
    try {
      await saveBudgetPlan({
        id: p.id,
        name: p.name.trim(),
        budgetTotal: Number(p.budgetTotal) || 0,
        spentTotal: Number(p.spentTotal) || 0,
        note: p.note ?? '',
      });
      await load();
      if (!p.id) setNewRow({ name: '', budgetTotal: '', spentTotal: '0', note: '' });
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="text-emerald-600" />
          計畫預算
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          建立各項計畫的核配額度與已支出，剩餘金額由系統自動計算。資料儲存於 Firebase（<code className="text-xs bg-slate-100 px-1 rounded">edutrack_budget_plans</code>）。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 disabled:opacity-50"
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
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">計畫名稱</label>
            <input
              value={newRow.name}
              onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
              className="w-full border rounded-lg px-2 py-1.5 text-sm"
              placeholder="例：本土語補助"
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
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              disabled={!newRow.name.trim() || savingId === 'new'}
              onClick={() =>
                handleSave({
                  name: newRow.name,
                  budgetTotal: Number(newRow.budgetTotal) || 0,
                  spentTotal: Number(newRow.spentTotal) || 0,
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
          <h2 className="text-sm font-semibold text-slate-800">計畫列表</h2>
        </div>
        {loading && plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" /> 載入中…
          </div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">尚無計畫，請先新增一筆。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[140px]">計畫名稱</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">核配額度</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">已支出</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-700 w-28">剩餘</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-700 min-w-[160px]">備註</th>
                  <th className="w-32 px-3 py-2"></th>
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

/** 單列可編輯，避免整表 re-render 時失去焦點：仍用受控但拆成子元件 */
const PlanRow: React.FC<{
  plan: BudgetPlan;
  remaining: number;
  saving: boolean;
  onSave: (p: Partial<BudgetPlan> & { name: string; id?: string }) => void;
  onDelete: () => void;
}> = ({ plan, remaining, saving, onSave, onDelete }) => {
  const [name, setName] = useState(plan.name);
  const [budgetTotal, setBudgetTotal] = useState(String(plan.budgetTotal));
  const [spentTotal, setSpentTotal] = useState(String(plan.spentTotal));
  const [note, setNote] = useState(plan.note ?? '');

  useEffect(() => {
    setName(plan.name);
    setBudgetTotal(String(plan.budgetTotal));
    setSpentTotal(String(plan.spentTotal));
    setNote(plan.note ?? '');
  }, [plan.id, plan.name, plan.budgetTotal, plan.spentTotal, plan.note]);

  return (
    <tr className="hover:bg-slate-50/80">
      <td className="px-3 py-2 align-top">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
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
            disabled={saving || !name.trim()}
            onClick={() =>
              onSave({
                id: plan.id,
                name,
                budgetTotal: Number(budgetTotal) || 0,
                spentTotal: Number(spentTotal) || 0,
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
