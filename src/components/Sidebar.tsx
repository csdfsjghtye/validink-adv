import React from 'react';
import { Home, Compass, Bell, Mail, CalendarRange, User, LogOut, Plus, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  unreadNotifications: boolean;
  unreadMessages: boolean;
  user: any;
  onLogout: () => void;
  onOpenCompose: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  unreadNotifications,
  unreadMessages,
  user,
  onLogout,
  onOpenCompose
}: SidebarProps) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home, badge: false },
    { id: 'explore', label: 'Explore', icon: Compass, badge: false },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Messages', icon: Mail, badge: unreadMessages },
    { id: 'bookings', label: 'Bookings', icon: CalendarRange, badge: false },
    { id: 'profile', label: 'Profile', icon: User, badge: false }
  ];

  return (
    <aside className="hidden md:flex flex-col justify-between h-full sticky top-0 px-2 lg:px-4 py-4 border-r border-[var(--border)] max-w-[275px] w-full items-center lg:items-stretch">
      <div className="flex flex-col gap-6 w-full items-center lg:items-stretch">
        {/* Branding Title */}
        <div className="flex items-center justify-center lg:justify-start gap-2 px-1 lg:px-3 py-2 cursor-pointer w-full" onClick={() => setCurrentTab('home')}>
          {/* Custom high-fidelity inline vector logo replicating user's uploaded logo */}
          <svg className="w-9 h-9 shrink-0 shadow-xs" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" stroke="#17253D" strokeWidth="5.5" />
            <circle cx="60" cy="60" r="43" stroke="#17253D" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
            {/* Checkmark legs matching the logo checkmark */}
            <path d="M37 58 L54 75" stroke="#17253D" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M54 75 L86 40" stroke="#8B1E2F" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-black text-xl tracking-tight hidden lg:block text-[var(--text-primary)]">
            Valid<span className="text-[var(--accent)]">Ink</span>
          </span>
        </div>

        {/* Navigation Feed Links */}
        <nav className="flex flex-col gap-1 w-full items-center lg:items-stretch">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center justify-center lg:justify-start gap-4 px-3 lg:px-4 py-3 rounded-full text-lg font-bold transition-all duration-200 hover:bg-[var(--surface)] text-left relative w-12 h-12 lg:w-full lg:h-auto ${
                  isActive ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-primary)]'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon size={22} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--accent)] rounded-full border-2 border-[var(--bg)] animate-pulse" />
                  )}
                </div>
                <span className="hidden lg:block truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Publish Action Button */}
        {user?.role === 'professor' && (
          <button
            id="btn-sidebar-publish"
            onClick={onOpenCompose}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-full flex items-center justify-center gap-2 transition-all duration-200 shadow-md w-12 h-12 lg:py-3.5 lg:px-6 lg:w-full lg:h-auto mt-2 cursor-pointer shrink-0"
            title="Offer Service"
          >
            <Plus size={20} className="stroke-[3px] shrink-0" />
            <span className="hidden lg:block">Offer Service</span>
          </button>
        )}
      </div>

      {/* User Info & Database Mode Toggle footer */}
      <div className="flex flex-col gap-4 w-full items-center lg:items-stretch">
        {/* User Card */}
        {user && (
          <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-2 p-1.5 lg:p-2 rounded-2xl lg:rounded-full hover:bg-[var(--surface)] transition duration-200 w-full">
            <div className="flex items-center justify-center lg:justify-start gap-3 cursor-pointer overflow-hidden" onClick={() => setCurrentTab('profile')}>
              {user.avatarBase64 ? (
                <img
                  src={user.avatarBase64}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-[var(--border)] shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--surface)] flex items-center justify-center font-bold border border-[var(--border)] text-[var(--text-secondary)] shrink-0">
                  {user.displayName?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden lg:flex flex-col text-left overflow-hidden">
                <span className="font-bold text-sm truncate">{user.displayName}</span>
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  @{user.handle || 'setup_profile'}
                </span>
              </div>
            </div>
            
            <button
              id="btn-sidebar-logout"
              onClick={onLogout}
              title="Logout"
              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition duration-200 text-[var(--text-secondary)] cursor-pointer shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
