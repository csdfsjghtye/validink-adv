import React, { useState, useEffect } from 'react';
import { auth, db, dbService } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

import { Home, Bell, CalendarRange, Mail, User, Plus, LogOut, AlertCircle, CheckCircle2, X, RefreshCw, ShieldCheck } from 'lucide-react';

// Subcomponents
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import Bookings from './components/Bookings';
import Messages from './components/Messages';
import Notifications from './components/Notifications';
import Profile from './components/Profile';
import AuthModal from './components/AuthModal';
import ComposeModal from './components/ComposeModal';

import { UserProfile } from './types';

// Custom hash parser helper
function parseHash() {
  const hash = window.location.hash || '#/';
  const path = hash.substring(1); // remove '#'
  
  if (path === '/' || path === '') {
    return { view: 'home', params: {} };
  }
  
  if (path.startsWith('/profile/')) {
    const uid = path.replace('/profile/', '');
    return { view: 'profile', params: { uid } };
  }

  if (path.startsWith('/messages/')) {
    const partnerId = path.replace('/messages/', '');
    return { view: 'messages', params: { partnerId } };
  }

  // Handle support for 'explore', 'bookings', 'notifications', 'profile'
  return { view: path.replace('/', ''), params: {} };
}

export default function App() {
  // Navigation tabs list: 'home', 'explore', 'notifications', 'messages', 'bookings', 'profile'
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [activeParams, setActiveParams] = useState<any>({});
  
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<'light' | 'dim' | 'lightsout'>('light');

  // Modal open states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);

  // Unread indicators
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(false);

  // Search & Filters (coordinated with Sidebar/RightSidebar)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Payment Verification Toast & Loading States
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [paymentToast, setPaymentToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // 1. Hash-based client Router coordination
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash();
      setCurrentTab(parsed.view);
      setActiveParams(parsed.params);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // initial parse

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Simple navigation wrapper that matches the expected Sidebar tab ID to Hash redirection
  const handleSetTab = (tab: string) => {
    if (tab === 'home') {
      window.location.hash = '#/';
    } else if (tab === 'profile') {
      window.location.hash = `#/profile/${currentUserProfile?.uid || ''}`;
    } else {
      window.location.hash = `#/${tab}`;
    }
  };

  // Profile selection redirection helper
  const handleSelectProfileId = (uid: string) => {
    window.location.hash = `#/profile/${uid}`;
  };

  // Direct redirection trigger helper (e.g. from buttons/cards)
  const handleDirectNavigate = (view: string, params: any = {}) => {
    if (view === 'feed' || view === 'home') {
      window.location.hash = '#/';
    } else if (view === 'profile') {
      window.location.hash = `#/profile/${params.uid}`;
    } else if (view === 'messages' && params.partnerId) {
      window.location.hash = `#/messages/${params.partnerId}`;
    } else {
      window.location.hash = `#/${view}`;
    }
  };

  // 2. Auth status coordination
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch users profile doc
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setCurrentUserProfile(profileData);
          setTheme(profileData.themePreference || 'light');
          if (!profileData.profileComplete) {
            setAuthModalOpen(true);
          } else {
            setAuthModalOpen(false);
          }
        } else {
          // If auth exists but firestore profile does not, force AuthOnboarding wizard
          setCurrentUserProfile(null);
          setAuthModalOpen(true);
        }
      } else {
        setCurrentUserProfile(null);
        // Clear unread counts
        setUnreadNotifications(false);
        setUnreadMessages(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Listen to unread notifications and messages
  useEffect(() => {
    if (!currentUserProfile) return;

    const notifsRef = collection(db, 'users', currentUserProfile.uid, 'notifications');
    
    // Unread general notifications
    const qNotifs = query(notifsRef, where('read', '==', false));
    const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
      setUnreadNotifications(!snapshot.empty);
    }, (err) => {
      console.warn('Notification snapshot error:', err);
    });

    // Unread message notifications proxy
    const qMsgs = query(notifsRef, where('read', '==', false), where('type', '==', 'new_message'));
    const unsubMsgs = onSnapshot(qMsgs, (snapshot) => {
      setUnreadMessages(!snapshot.empty);
    }, (err) => {
      console.warn('Messages snapshot error:', err);
    });

    return () => {
      unsubNotifs();
      unsubMsgs();
    };
  }, [currentUserProfile]);

  // 4. Color theme selector effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle Paymongo Redirect URL parameters with server-side API verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const bookingId = params.get('bookingId');
    const sessionId = params.get('session_id');

    if (!paymentStatus) return;

    // 1. If user cancelled or clicked back on PayMongo checkout
    if (paymentStatus === 'cancel') {
      setPaymentToast({
        type: 'info',
        message: 'Payment was cancelled or exited on PayMongo. Your booking status remains unchanged.'
      });
      // Clear query string cleanly
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }

    // 2. If PayMongo redirected with payment=success
    if (paymentStatus === 'success' && bookingId) {
      const verifyAndCompletePayment = async () => {
        setPaymentVerifying(true);
        try {
          if (!sessionId) {
            throw new Error('Missing PayMongo session ID for payment verification.');
          }

          const res = await fetch('/api/paymongo/verify-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, bookingId })
          });

          const data = await res.json();

          if (data.success && data.verified) {
            await dbService.updateBookingStatus(bookingId, 'paid');
            setPaymentToast({
              type: 'success',
              message: 'Payment verified successfully with PayMongo! Your validation service is now paid.'
            });
          } else {
            setPaymentToast({
              type: 'error',
              message: data.error || data.message || 'Payment verification failed: Transaction was not completed or verified by PayMongo.'
            });
          }
        } catch (err: any) {
          console.error('Failed to verify PayMongo payment:', err);
          setPaymentToast({
            type: 'error',
            message: err.message || 'Payment verification failed. Transaction was not marked as paid.'
          });
        } finally {
          setPaymentVerifying(false);
          // Clear query string cleanly
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
      };

      verifyAndCompletePayment();
    }
  }, [currentUserProfile]);

  const handleChangeTheme = async (newTheme: 'light' | 'dim' | 'lightsout') => {
    setTheme(newTheme);
    if (currentUserProfile) {
      try {
        const userRef = doc(db, 'users', currentUserProfile.uid);
        await updateDoc(userRef, { themePreference: newTheme });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.hash = '#/';
    } catch (e) {
      console.error(e);
    }
  };

  // Helper helper to update profile after edit
  const handleUpdateProfile = (profile: UserProfile) => {
    setCurrentUserProfile(profile);
    setTheme(profile.themePreference || 'light');
  };

  return (
    <div className="h-[100dvh] w-full bg-[var(--bg)] text-[var(--text-primary)] flex flex-col items-center selection:bg-[var(--accent)]/25 transition-colors duration-200 overflow-hidden">
      
      {/* Payment Toast / Verification Banner */}
      {paymentVerifying && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-white border border-emerald-500 text-emerald-900 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <RefreshCw size={20} className="animate-spin text-emerald-600 shrink-0" />
          <div className="text-xs font-semibold">
            <p className="font-bold">Verifying Payment...</p>
            <p className="text-emerald-700">Checking transaction status securely with PayMongo API.</p>
          </div>
        </div>
      )}

      {paymentToast && !paymentVerifying && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-200 ${
          paymentToast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : paymentToast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-gray-800 text-white'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {paymentToast.type === 'success' && <CheckCircle2 size={18} className="shrink-0" />}
            {paymentToast.type === 'error' && <AlertCircle size={18} className="shrink-0" />}
            {paymentToast.type === 'info' && <AlertCircle size={18} className="shrink-0 text-blue-300" />}
            <span>{paymentToast.message}</span>
          </div>
          <button
            onClick={() => setPaymentToast(null)}
            className="p-1 hover:bg-white/20 rounded-full transition shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}
      
      {/* Mobile Top Header (only visible on small screens < md) */}
      <header className="md:hidden w-full shrink-0 sticky top-0 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSetTab('home')}>
          {/* Custom high-fidelity inline vector logo replicating user's uploaded logo */}
          <svg className="w-8 h-8 shrink-0 shadow-xs" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="50" stroke="#17253D" strokeWidth="5.5" />
            <circle cx="60" cy="60" r="43" stroke="#17253D" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
            <path d="M37 58 L54 75" stroke="#17253D" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M54 75 L86 40" stroke="#8B1E2F" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-black text-lg tracking-tight text-[var(--text-primary)]">
            Valid<span className="text-[var(--accent)]">Ink</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {currentUserProfile ? (
            <>
              <button
                onClick={() => handleSetTab('profile')}
                className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border)] shrink-0"
              >
                {currentUserProfile.avatarBase64 ? (
                  <img
                    src={currentUserProfile.avatarBase64}
                    alt={currentUserProfile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--surface)] flex items-center justify-center font-bold text-xs text-[var(--text-secondary)]">
                    {currentUserProfile.displayName?.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 hover:bg-red-500/10 hover:text-red-500 text-[var(--text-secondary)] rounded-lg transition duration-200 cursor-pointer shrink-0"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-black px-3.5 py-1.5 rounded-full text-xs transition"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-5xl flex relative flex-1 overflow-hidden">
        
        {/* Left column sidebar (sticky, hidden on smaller screens < md) */}
        <div className="hidden md:flex flex-col h-full w-16 lg:w-64 shrink-0 relative z-30 overflow-y-auto no-scrollbar border-l border-[var(--border)]">
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={handleSetTab}
            unreadNotifications={unreadNotifications}
            unreadMessages={unreadMessages}
            user={currentUserProfile}
            onLogout={handleLogout}
            onOpenCompose={() => {
              if (!currentUserProfile) {
                setAuthModalOpen(true);
              } else {
                setComposeModalOpen(true);
              }
            }}
          />
        </div>

        {/* Center Main area (feeds, bookings, message threads, profiles) */}
        <main className="flex-1 w-full h-full md:border-r border-[var(--border)] bg-[var(--bg)] pb-20 md:pb-0 relative overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full min-h-full flex flex-col"
            >
              {(currentTab === 'home' || currentTab === 'explore') && (
                <Feed
                  currentTab={currentTab}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  onNavigate={handleDirectNavigate}
                  onOpenAuth={() => setAuthModalOpen(true)}
                  currentUserProfile={currentUserProfile}
                />
              )}

              {currentTab === 'bookings' && (
                <Bookings
                  onNavigate={handleDirectNavigate}
                  currentUserProfile={currentUserProfile}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}

              {currentTab === 'messages' && (
                <Messages
                  partnerIdFromParam={activeParams.partnerId}
                  onNavigate={handleDirectNavigate}
                  currentUserProfile={currentUserProfile}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}

              {currentTab === 'notifications' && (
                <Notifications
                  onNavigate={handleDirectNavigate}
                  currentUserProfile={currentUserProfile}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}

              {currentTab === 'profile' && (
                <Profile
                  profileId={activeParams.uid || currentUserProfile?.uid || ''}
                  onNavigate={handleDirectNavigate}
                  currentUserProfile={currentUserProfile}
                  onUpdateCurrentUserProfile={handleUpdateProfile}
                  onOpenAuth={() => setAuthModalOpen(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg)]/95 backdrop-blur-md border-t border-[var(--border)] py-2.5 px-3 flex items-center justify-around z-30 shadow-lg">
        {[
          { id: 'home', label: 'Home', icon: Home, badge: false },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
          { id: 'messages', label: 'Messages', icon: Mail, badge: unreadMessages },
          { id: 'bookings', label: 'Bookings', icon: CalendarRange, badge: false },
          { id: 'profile', label: 'Profile', icon: User, badge: false }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSetTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition relative ${
                isActive ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--accent)] rounded-full border border-[var(--bg)] animate-pulse" />
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Floating Action Button (FAB) on mobile - positioned bottom left as requested */}
      {currentUserProfile?.role === 'professor' && (currentTab === 'home' || currentTab === 'explore') && (
        <button
          onClick={() => {
            if (!currentUserProfile) {
              setAuthModalOpen(true);
            } else {
              setComposeModalOpen(true);
            }
          }}
          className="md:hidden fixed bottom-[84px] left-5 w-14 h-14 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 z-40 cursor-pointer"
          title="Offer Service"
        >
          <Plus size={28} className="stroke-[3px]" />
        </button>
      )}

      {/* Auth register/login panel modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={(force) => {
          if (!force && auth.currentUser && (!currentUserProfile || !currentUserProfile.profileComplete)) {
            return;
          }
          setAuthModalOpen(false);
        }}
        onSuccess={() => {
          // Trigger reload/state updates safely
        }}
      />

      {/* Create service offer post modal */}
      {composeModalOpen && currentUserProfile && (
        <ComposeModal
          user={currentUserProfile}
          onClose={() => setComposeModalOpen(false)}
          onSuccess={() => {
            setComposeModalOpen(false);
            setSelectedCategory('All');
            setCurrentTab('home');
          }}
        />
      )}
    </div>
  );
}

// Inline helper for updateDoc
async function updateDoc(ref: any, data: any) {
  const { updateDoc: fbUpdateDoc } = await import('firebase/firestore');
  return fbUpdateDoc(ref, data);
}
