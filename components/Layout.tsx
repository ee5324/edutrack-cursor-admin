import React, { useState } from 'react';
import { Menu, X, ClipboardList, Settings, CalendarDays, Trophy, Store, Archive, FlaskConical, LogOut, Map, FileText } from 'lucide-react';
import { isSandbox, isPinBypassActive, setPinBypass } from '../services/sandboxStore';
import type { User } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  archiveCount?: number;
  user?: User | null;
  onSignOut?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, archiveCount, user, onSignOut }) => {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const menuItems = [
    { id: 'calendar', label: '行政行事曆', icon: CalendarDays },
    { id: 'attendance', label: '本土語點名單', icon: ClipboardList },
    { id: 'campus-map', label: '校園平面圖', icon: Map },
    { id: 'awards', label: '頒獎通知', icon: Trophy },
    { id: 'vendors', label: '廠商管理', icon: Store },
    { id: 'exam-papers', label: '考卷存檔', icon: FileText },
    { id: 'archive', label: '事項列檔', icon: Archive, badge: archiveCount },
    { id: 'settings', label: '系統設定', icon: Settings },
  ];

  const navContent = (
    <nav className="flex flex-col gap-0.5 w-full py-3">
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id);
              setIsNavOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full ${
              activeTab === item.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ml-auto">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        );
      })}
      {!isSandbox() && user && onSignOut && (
        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left w-full mt-2"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span className="truncate">登出</span>
        </button>
      )}
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* 左側導覽列（縱向） */}
      <aside
        className={`no-print bg-slate-800 text-white border-r border-slate-700 flex-shrink-0 ${
          isNavOpen
            ? 'fixed inset-y-0 left-0 z-20 w-56 shadow-xl lg:relative lg:shadow-none'
            : 'hidden lg:flex lg:w-56'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700 lg:border-b">
          <span className="font-semibold text-white text-sm">功能選單</span>
          <button
            onClick={() => setIsNavOpen(false)}
            className="lg:hidden p-2 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {navContent}
        </div>
      </aside>

      {/* 手機版：點擊遮罩關閉導覽 */}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setIsNavOpen(false)}
          aria-hidden
        />
      )}

      {/* 右側：Header + 內容區 */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex-shrink-0 h-14 lg:h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-6 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNavOpen(!isNavOpen)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              {isNavOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="text-lg font-semibold text-gray-800">
              {menuItems.find(i => i.id === activeTab)?.label}
            </span>
          </div>
        </header>

        {isSandbox() && (
          <div className="flex-shrink-0 bg-amber-100 border-b border-amber-300 px-4 py-2 flex flex-wrap items-center gap-2 text-amber-800 text-sm no-print">
            <FlaskConical size={18} />
            <span className="font-medium">
              {import.meta.env.VITE_SANDBOX === 'true' ? 'Sandbox 模式' : 'PIN 測試模式'}
            </span>
            <span className="text-amber-700">— 資料僅存於記憶體。</span>
            {isPinBypassActive() && import.meta.env.VITE_SANDBOX !== 'true' && (
              <button
                type="button"
                onClick={() => {
                  setPinBypass(false);
                  window.location.reload();
                }}
                className="ml-auto px-2 py-1 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
              >
                結束測試（回登入）
              </button>
            )}
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 lg:p-8 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
