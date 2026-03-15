import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import AllowedUsersManager from './components/AllowedUsersManager';
import LanguageElectiveRoster from './components/LanguageElectiveRoster';
import TodoCalendar from './components/TodoCalendar';
import CampusMap from './components/CampusMap';
import AwardGenerator from './AwardGenerator'; 
import VendorManager from './VendorManager';
import ExamPapersTab from './components/ExamPapersTab';
import ArchiveManager from './ArchiveManager';
import { Settings, Database, CheckCircle, AlertTriangle, Loader2, Archive, Copy, ShieldCheck, KeyRound } from 'lucide-react';
import { setupSystem, getArchiveTasks } from './services/api';
import { migrateSheetToFirebase } from './services/migrateSheetToFirebase';
import { onAuthStateChanged, signOut } from './services/auth';
import { isSandbox, isPinBypassActive, isPinUiEnabled, setPinUiEnabled, setPinBypass, TEST_PIN } from './services/sandboxStore';
import type { User } from 'firebase/auth';
import type { AllowedUser } from './types';
import { getAllowedUser } from './services/allowedUsers';

interface SettingsTabProps {
    currentUser: User | null;
    currentAccess: AllowedUser | null;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ currentUser, currentAccess }) => {
    const isDev = import.meta.env.DEV;
    const [pinUiEnabled, setPinUiEnabledState] = useState(() => isPinUiEnabled());
    const [pinBypassActive, setPinBypassActiveState] = useState(() => isPinBypassActive());

    const togglePinUi = (enabled: boolean) => {
        setPinUiEnabled(enabled);
        setPinUiEnabledState(enabled);
    };

    const exitPinBypass = () => {
        setPinBypass(false);
        setPinBypassActiveState(false);
        window.location.reload();
    };

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string[], raw?: string } | null>(null);
    const [migrating, setMigrating] = useState(false);
    const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string; counts: any; errors: string[] } | null>(null);

    const handleSetup = async () => {
        setIsLoading(true);
        setStatus(null);
        setMigrateResult(null);
        try {
            const res = await setupSystem();
            if (res.success && res.data?.logs) {
                setStatus({ type: 'success', msg: res.data.logs });
            } else {
                setStatus({ type: 'error', msg: ['設定失敗', res.message || ''] });
            }
        } catch (e: any) {
            setStatus({ type: 'error', msg: ['連線錯誤', e.message] });
        } finally {
            setIsLoading(false);
        }
    };

    const handleMigrate = async () => {
        if (!confirm('確定要將 Google Sheet 的資料一鍵搬運到 Firebase？此操作會寫入目前 Firebase 專案的 edutrack_* 集合，不會清除既有 Firestore 資料，但可能產生重複（可之後手動整理）。')) return;
        setMigrating(true);
        setStatus(null);
        setMigrateResult(null);
        try {
            const result = await migrateSheetToFirebase();
            setMigrateResult(result);
        } catch (e: any) {
            setMigrateResult({ success: false, message: e.message, counts: {}, errors: [e.message] });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-10 space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <Settings className="mr-2" /> 系統設定
            </h2>

            {/* 測試 PIN 開關（僅開發模式顯示） */}
            {isDev && (
                <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="bg-amber-100 p-3 rounded-full">
                            <KeyRound className="w-6 h-6 text-amber-700" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">測試 PIN 快速登入</h3>
                            <p className="text-gray-500 text-sm mt-1">
                                開發模式下可用 PIN <code className="bg-gray-100 px-1 rounded">{TEST_PIN}</code> 快速進入 Sandbox 流程。在此開關登入頁是否顯示 PIN 區塊；正式 build 不會出現此功能。
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 pl-0 sm:pl-[4.5rem]">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={pinUiEnabled}
                                onClick={() => togglePinUi(!pinUiEnabled)}
                                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${pinUiEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${pinUiEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                            <span className="text-sm font-medium text-gray-800">
                                登入頁顯示 PIN 快速登入
                            </span>
                        </label>
                        <span className="text-sm text-gray-500">
                            目前 PIN 測試模式：
                            <strong className={pinBypassActive ? 'text-amber-700' : 'text-gray-600'}>
                                {pinBypassActive ? '已開啟' : '未開啟'}
                            </strong>
                        </span>
                    </div>
                    {pinBypassActive && import.meta.env.VITE_SANDBOX !== 'true' && (
                        <div className="mt-4 pl-0 sm:pl-[4.5rem]">
                            <button
                                type="button"
                                onClick={exitPinBypass}
                                className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                            >
                                結束 PIN 測試並回到登入
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 一鍵搬運：Google Sheet → Firebase */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="bg-amber-100 p-3 rounded-full">
                        <Archive className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">一鍵搬運：Google Sheet → Firebase</h3>
                        <p className="text-gray-500 text-sm mt-1">
                            從目前綁定 GAS 的 Google 試算表讀取課程、學生、頒獎、廠商、事項列檔、待辦，寫入 Firebase Firestore（edutrack_* 集合）。請先關閉 Sandbox、設定好 .env 的 Firebase 與 GAS 網址。
                        </p>
                    </div>
                </div>
                {migrateResult && (
                    <div className={`mb-6 p-4 rounded-md text-sm ${migrateResult.success ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                        <h4 className="font-bold flex items-center mb-2">
                            {migrateResult.success ? <CheckCircle size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
                            {migrateResult.message}
                        </h4>
                        {migrateResult.counts && Object.keys(migrateResult.counts).length > 0 && (
                            <p className="mt-1">課程 {migrateResult.counts.courses}、學生 {migrateResult.counts.students}、頒獎 {migrateResult.counts.awards}、廠商 {migrateResult.counts.vendors}、事項列檔 {migrateResult.counts.archive}、待辦 {migrateResult.counts.todos}</p>
                        )}
                        {migrateResult.errors && migrateResult.errors.length > 0 && (
                            <ul className="list-disc pl-5 mt-2 space-y-1 text-amber-700">
                                {migrateResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                                {migrateResult.errors.length > 10 && <li>…共 {migrateResult.errors.length} 筆</li>}
                            </ul>
                        )}
                    </div>
                )}
                <button
                    onClick={handleMigrate}
                    disabled={migrating}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                    {migrating ? <Loader2 className="animate-spin mr-2" size={18} /> : <Copy size={18} className="mr-2" />}
                    {migrating ? '搬運中...' : '一鍵搬運到 Firebase'}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="bg-blue-100 p-3 rounded-full">
                        <Database className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">初始化系統資料庫</h3>
                        <p className="text-gray-500 text-sm mt-1">
                            此操作將在您的 Google Drive 建立必要的資料夾結構 (EduTrack_點名單封存) 
                            以及檢查 Google Sheets 資料庫的欄位結構 (含行事曆、頒獎紀錄、廠商管理擴充功能)。
                        </p>
                    </div>
                </div>

                {status && (
                    <div className={`mb-6 p-4 rounded-md text-sm ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        <h4 className="font-bold flex items-center mb-2">
                            {status.type === 'success' ? <CheckCircle size={16} className="mr-2" /> : <AlertTriangle size={16} className="mr-2" />}
                            {status.type === 'success' ? '設定完成' : '發生錯誤'}
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {status.msg.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                    </div>
                )}

                <button
                    onClick={handleSetup}
                    disabled={isLoading}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 disabled:opacity-50 transition-colors"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {isLoading ? '系統設定中...' : '開始快速設定'}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="bg-violet-100 p-3 rounded-full">
                        <ShieldCheck className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Google 登入白名單</h3>
                        <p className="text-gray-500 text-sm mt-1">
                            使用 Firestore 的 <code>edutrack_allowed_users</code> 集合管理可登入帳號。第一次請先到 Firebase Console 手動建立一位管理員文件，之後即可在系統內新增、停用或移除名單。
                        </p>
                    </div>
                </div>
                <AllowedUsersManager
                    currentUserEmail={currentUser?.email}
                    canManage={currentAccess?.role === 'admin' && currentAccess.enabled}
                />
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [archiveCount, setArchiveCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessUser, setAccessUser] = useState<AllowedUser | null>(null);
  const [loginError, setLoginError] = useState('');

  // 監聽登入狀態（Sandbox 模式不檢查登入）
  useEffect(() => {
    if (isSandbox()) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => { unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (isSandbox()) {
      setAccessLoading(false);
      setAccessUser(null);
      setLoginError('');
      return;
    }

    if (!user?.email) {
      setAccessLoading(false);
      setAccessUser(null);
      return;
    }

    let cancelled = false;
    const verifyAccess = async () => {
      setAccessLoading(true);
      try {
        const allowedUser = await getAllowedUser(user.email!);
        if (cancelled) return;

        if (!allowedUser || !allowedUser.enabled) {
          setAccessUser(null);
          setLoginError(`帳號 ${user.email} 尚未加入登入白名單，請聯絡管理員。`);
          await signOut();
          return;
        }

        setAccessUser(allowedUser);
        setLoginError('');
      } catch (error: any) {
        if (cancelled) return;
        setAccessUser(null);
        setLoginError(error?.message || '無法驗證登入白名單');
        await signOut();
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    };

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Fetch archive count when logged in
  useEffect(() => {
    if (isSandbox() || user) {
      const fetchArchiveCount = async () => {
        try {
          const data = await getArchiveTasks();
          const pendingCount = data.filter(t => !t.isPrinted || !t.isNotified).length;
          setArchiveCount(pendingCount);
        } catch (e) {
          console.error('Failed to fetch archive count', e);
        }
      };
      fetchArchiveCount();
    }
  }, [user]);

  const renderContent = () => {
    switch (activeTab) {
      case 'calendar':
        return <TodoCalendar />;
      case 'student-roster':
        return <LanguageElectiveRoster defaultView="roster" pageMode="roster" />;
      case 'language-elective':
        return <LanguageElectiveRoster defaultView="roster" pageMode="query" />;
      case 'attendance':
        return <LanguageElectiveRoster defaultView="sheets" pageMode="sheets" />;
      case 'campus-map':
        return <CampusMap />;
      case 'awards':
        return <AwardGenerator />;
      case 'vendors':
        return <VendorManager />;
      case 'exam-papers':
        return <ExamPapersTab user={user} />;
      case 'archive':
        return <ArchiveManager onTasksChange={setArchiveCount} />;
      case 'settings':
        return <SettingsTab currentUser={user} currentAccess={accessUser} />;
      default:
        return <TodoCalendar />;
    }
  };

  if (authLoading || (!isSandbox() && user && accessLoading)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (!isSandbox() && !user) {
    return <Login externalError={loginError} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      archiveCount={archiveCount}
      user={user}
      onSignOut={() => signOut()}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;