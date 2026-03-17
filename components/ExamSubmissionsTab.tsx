import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Unlock, Save, UserPlus, Trash2 } from 'lucide-react';
import type { AllowedUser, ExamAwardsConfig, ExamCampaign, ExamSubmitAllowedUser, ExamSubmission } from '../types';
import {
  createExamCampaign,
  getExamAwardsConfig,
  getExamCampaigns,
  getExamSubmitAllowedUsers,
  getExamSubmissions,
  saveExamAwardsConfig,
  setExamSubmitAllowedUser,
  unlockExamSubmission,
  updateExamCampaign,
} from '../services/api';

interface Props {
  currentAccess: AllowedUser | null;
  currentUserEmail?: string | null;
}

const ExamSubmissionsTab: React.FC<Props> = ({ currentAccess, currentUserEmail }) => {
  const isAdmin = currentAccess?.role === 'admin';

  const [campaigns, setCampaigns] = useState<ExamCampaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const [newCampaign, setNewCampaign] = useState<{ title: string; academicYear: string; semester: string; examNo: string; lockedByDefault: boolean }>({
    title: '',
    academicYear: '114',
    semester: '下學期',
    examNo: '1',
    lockedByDefault: true,
  });

  const [awardsConfig, setAwardsConfig] = useState<ExamAwardsConfig>({ categories: [] });
  const [awardsSaving, setAwardsSaving] = useState(false);

  const [whitelist, setWhitelist] = useState<ExamSubmitAllowedUser[]>([]);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [whitelistLoading, setWhitelistLoading] = useState(false);

  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reloadCampaigns = async () => {
    setCampaignLoading(true);
    setErr(null);
    try {
      const list = await getExamCampaigns();
      setCampaigns(list);
      if (!selectedCampaignId && list.length > 0) setSelectedCampaignId(list[0].id);
    } catch (e: any) {
      setErr(e?.message || '載入段考活動失敗');
    } finally {
      setCampaignLoading(false);
    }
  };

  const reloadAwardsConfig = async () => {
    setErr(null);
    try {
      const cfg = await getExamAwardsConfig();
      setAwardsConfig(cfg);
    } catch (e: any) {
      setErr(e?.message || '載入獎項設定失敗');
    }
  };

  const reloadWhitelist = async () => {
    setWhitelistLoading(true);
    setErr(null);
    try {
      const list = await getExamSubmitAllowedUsers();
      setWhitelist(list);
    } catch (e: any) {
      setErr(e?.message || '載入白名單失敗');
    } finally {
      setWhitelistLoading(false);
    }
  };

  const reloadSubmissions = async (campaignId: string) => {
    setSubmissionsLoading(true);
    setErr(null);
    try {
      const list = await getExamSubmissions(campaignId);
      setSubmissions(list);
    } catch (e: any) {
      setErr(e?.message || '載入提報資料失敗');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    reloadCampaigns();
    reloadAwardsConfig();
    if (isAdmin) reloadWhitelist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCampaignId) reloadSubmissions(selectedCampaignId);
  }, [selectedCampaignId]);

  const addCampaign = async () => {
    if (!isAdmin) return;
    const title = newCampaign.title.trim();
    if (!title) return;
    setErr(null);
    setMsg(null);
    try {
      const created = await createExamCampaign({
        title,
        academicYear: newCampaign.academicYear.trim(),
        semester: newCampaign.semester,
        examNo: newCampaign.examNo.trim(),
        lockedByDefault: newCampaign.lockedByDefault,
        closeAt: null,
      });
      await reloadCampaigns();
      setSelectedCampaignId(created.id);
      setNewCampaign((p) => ({ ...p, title: '' }));
      setMsg('已新增段考活動');
    } catch (e: any) {
      setErr(e?.message || '新增失敗');
    }
  };

  const toggleCampaignLockedDefault = async () => {
    if (!isAdmin || !selectedCampaign) return;
    try {
      await updateExamCampaign(selectedCampaign.id, { lockedByDefault: !selectedCampaign.lockedByDefault });
      await reloadCampaigns();
      setMsg('已更新活動設定');
    } catch (e: any) {
      setErr(e?.message || '更新失敗');
    }
  };

  const saveAwards = async () => {
    if (!isAdmin) return;
    setAwardsSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await saveExamAwardsConfig(awardsConfig);
      setMsg('已儲存獎項設定');
    } catch (e: any) {
      setErr(e?.message || '儲存獎項設定失敗');
    } finally {
      setAwardsSaving(false);
    }
  };

  const addWhitelist = async () => {
    if (!isAdmin) return;
    const email = newWhitelistEmail.trim().toLowerCase();
    if (!email) return;
    setErr(null);
    setMsg(null);
    try {
      await setExamSubmitAllowedUser(email, { enabled: true });
      setNewWhitelistEmail('');
      await reloadWhitelist();
      setMsg('已加入白名單');
    } catch (e: any) {
      setErr(e?.message || '加入白名單失敗');
    }
  };

  const setWhitelistEnabled = async (email: string, enabled: boolean) => {
    if (!isAdmin) return;
    setErr(null);
    try {
      await setExamSubmitAllowedUser(email, { enabled });
      await reloadWhitelist();
    } catch (e: any) {
      setErr(e?.message || '更新白名單失敗');
    }
  };

  const unlockOne = async (id: string) => {
    if (!isAdmin || !currentUserEmail) return;
    setErr(null);
    setMsg(null);
    try {
      await unlockExamSubmission(id, currentUserEmail);
      if (selectedCampaignId) await reloadSubmissions(selectedCampaignId);
      setMsg('已解鎖，導師可重新送出');
    } catch (e: any) {
      setErr(e?.message || '解鎖失敗');
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">段考名單提報</h2>
          <p className="text-sm text-slate-500 mt-1">管理段考活動、獎項細項、對外填報白名單，以及各班提報與解鎖。</p>
        </div>
        <button
          type="button"
          onClick={() => {
            reloadCampaigns();
            reloadAwardsConfig();
            if (isAdmin) reloadWhitelist();
            if (selectedCampaignId) reloadSubmissions(selectedCampaignId);
          }}
          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm inline-flex items-center gap-2"
        >
          <RefreshCw size={16} /> 重新整理
        </button>
      </div>

      {(err || msg) && (
        <div className={`rounded-lg border p-3 text-sm ${err ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {err ?? msg}
        </div>
      )}

      {/* 活動管理 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">段考活動</h3>
          {campaignLoading && <span className="text-xs text-slate-500">載入中…</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm min-w-[16rem]"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {isAdmin && selectedCampaign && (
            <button type="button" onClick={toggleCampaignLockedDefault} className="px-3 py-1.5 rounded text-sm bg-slate-700 text-white hover:bg-slate-800">
              預設{selectedCampaign.lockedByDefault ? '鎖定' : '不鎖定'}
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="border-t pt-3">
            <div className="text-sm font-medium text-slate-700 mb-2">新增活動</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-1.5 text-sm md:col-span-2" placeholder="活動名稱（例：114下 第1次段考）" value={newCampaign.title} onChange={(e) => setNewCampaign((p) => ({ ...p, title: e.target.value }))} />
              <input className="border rounded px-2 py-1.5 text-sm" placeholder="學年（例：114）" value={newCampaign.academicYear} onChange={(e) => setNewCampaign((p) => ({ ...p, academicYear: e.target.value }))} />
              <select className="border rounded px-2 py-1.5 text-sm" value={newCampaign.semester} onChange={(e) => setNewCampaign((p) => ({ ...p, semester: e.target.value }))}>
                <option value="上學期">上學期</option>
                <option value="下學期">下學期</option>
              </select>
              <div className="flex gap-2">
                <input className="border rounded px-2 py-1.5 text-sm w-20" placeholder="次" value={newCampaign.examNo} onChange={(e) => setNewCampaign((p) => ({ ...p, examNo: e.target.value }))} />
                <button type="button" onClick={addCampaign} className="flex-1 px-3 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center gap-1">
                  <Plus size={16} /> 新增
                </button>
              </div>
            </div>
          </div>
        )}
        {!isAdmin && <p className="text-xs text-slate-500">（僅管理者可新增/修改活動設定）</p>}
      </div>

      {/* 獎項設定 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">獎項設定（優異 / 進步 細項）</h3>
          {isAdmin && (
            <button type="button" onClick={saveAwards} disabled={awardsSaving} className="px-3 py-1.5 rounded text-sm bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 inline-flex items-center gap-2">
              <Save size={16} /> {awardsSaving ? '儲存中…' : '儲存'}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">格式：每行一個細項（例：國語、數學…）。</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {awardsConfig.categories.map((cat, idx) => (
            <div key={cat.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <input
                  className="border rounded px-2 py-1 text-sm font-medium"
                  value={cat.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAwardsConfig((p) => {
                      const next = { ...p, categories: [...p.categories] };
                      next.categories[idx] = { ...next.categories[idx], label: v };
                      return next;
                    });
                  }}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAwardsConfig((p) => ({ ...p, categories: p.categories.filter((_, i) => i !== idx) }))}
                    className="text-slate-400 hover:text-red-600"
                    title="刪除分類"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <textarea
                className="w-full border rounded p-2 text-sm min-h-[120px]"
                value={(cat.items ?? []).map((x) => x.label).join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
                  setAwardsConfig((p) => {
                    const next = { ...p, categories: [...p.categories] };
                    next.categories[idx] = {
                      ...next.categories[idx],
                      items: lines.map((label) => ({ id: label, label })),
                    };
                    return next;
                  });
                }}
                disabled={!isAdmin}
              />
            </div>
          ))}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() =>
              setAwardsConfig((p) => ({
                ...p,
                categories: [...p.categories, { id: `cat-${Date.now()}`, label: '新分類', items: [] }],
              }))
            }
            className="px-3 py-1.5 rounded text-sm bg-slate-200 text-slate-700 hover:bg-slate-300 inline-flex items-center gap-2"
          >
            <Plus size={16} /> 新增分類
          </button>
        )}
        {!isAdmin && <p className="text-xs text-slate-500">（僅管理者可編輯獎項設定）</p>}
      </div>

      {/* 白名單管理 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">對外填報白名單（導師）</h3>
          {whitelistLoading && <span className="text-xs text-slate-500">載入中…</span>}
        </div>
        {!isAdmin ? (
          <p className="text-xs text-slate-500">（僅管理者可管理白名單）</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-2 py-1.5 text-sm w-80 max-w-full" placeholder="teacher@example.com" value={newWhitelistEmail} onChange={(e) => setNewWhitelistEmail(e.target.value)} />
              <button type="button" onClick={addWhitelist} className="px-3 py-1.5 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-2">
                <UserPlus size={16} /> 加入
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">啟用</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {whitelist.map((u) => (
                    <tr key={u.email}>
                      <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setWhitelistEnabled(u.email, !u.enabled)}
                          className={`px-2 py-1 rounded text-xs ${u.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                        >
                          {u.enabled ? '啟用' : '停用'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {whitelist.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-slate-500 text-sm" colSpan={2}>
                        尚無白名單
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 提報總覽 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">提報總覽（依班級一筆，最新覆蓋）</h3>
          {submissionsLoading && <span className="text-xs text-slate-500">載入中…</span>}
        </div>
        {!selectedCampaignId ? (
          <p className="text-sm text-slate-500">請先選擇段考活動</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">班級</th>
                  <th className="px-3 py-2 text-left">最後送出</th>
                  <th className="px-3 py-2 text-left">送出者</th>
                  <th className="px-3 py-2 text-left">鎖定</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium">{s.className}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.submittedAt}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.submittedByEmail}</td>
                    <td className="px-3 py-2">{s.locked ? '是' : '否'}</td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin && s.locked && (
                        <button type="button" onClick={() => unlockOne(s.id)} className="px-2 py-1 rounded text-xs bg-amber-600 text-white hover:bg-amber-700 inline-flex items-center gap-1">
                          <Unlock size={14} /> 解鎖
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-slate-500 text-sm" colSpan={5}>
                      尚無提報資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamSubmissionsTab;

