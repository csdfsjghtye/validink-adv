import React, { useState, useEffect } from 'react';
import { db, dbService, auth, isRealFirebaseActive } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Bell, MessageSquare, CalendarPlus, BadgeCheck, Star, ShieldX, HelpCircle, Trash2, CreditCard } from 'lucide-react';
import { Notification, UserProfile } from '../types';
import CustomDialog from './CustomDialog';

interface NotificationsProps {
  onNavigate: (view: string, params?: any) => void;
  currentUserProfile: UserProfile | null;
  onOpenAuth: () => void;
}

export default function Notifications({
  onNavigate,
  currentUserProfile,
  onOpenAuth
}: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'confirm' | 'error' | 'success';
    confirmLabel?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showDialog = (
    title: string,
    message: string,
    type: 'info' | 'confirm' | 'error' | 'success' = 'info',
    onConfirm?: () => void,
    confirmLabel?: string
  ) => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type,
      confirmLabel,
      onConfirm: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      }
    });
  };

  const closeDialog = () => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  };

  // 1. Real-time snapshot listener
  useEffect(() => {
    const user = auth?.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = dbService.listenNotifications(user.uid, (notifs) => {
      // Sort client-side by createdAt descending
      const sorted = [...notifs].sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setNotifications(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAsRead = async (notif: Notification) => {
    const user = auth?.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'notifications', notif.id);
      await updateDoc(docRef, { read: true });

      // Navigate appropriately
      if (notif.type === 'new_message' && notif.payload.conversationId) {
        const parts = notif.payload.conversationId.split('_');
        const partnerId = parts.find(id => id !== user.uid);
        onNavigate('messages', { partnerId });
      } else if (notif.type === 'booking_request' || notif.type === 'booking_accepted' || notif.type === 'booking_declined' || notif.type === 'booking_paid') {
        onNavigate('bookings');
      } else if (notif.type === 'review_received') {
        onNavigate('profile', { uid: user.uid });
      }
    } catch (err) {
      console.error("Error marking notification as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const user = auth?.currentUser;
    if (!user) return;

    try {
      const colRef = collection(db, 'users', user.uid, 'notifications');
      const snap = await getDocs(colRef);
      
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        if (!d.data().read) {
          batch.update(d.ref, { read: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all notifications read", err);
    }
  };

  const getNotifDetails = (notif: Notification) => {
    const icons = {
      new_message: <MessageSquare size={16} className="text-sky-500" />,
      booking_request: <CalendarPlus size={16} className="text-amber-500" />,
      booking_accepted: <BadgeCheck size={16} className="text-emerald-500" />,
      booking_declined: <ShieldX size={16} className="text-red-500" />,
      booking_paid: <CreditCard size={16} className="text-emerald-500" />,
      review_received: <Star size={16} className="text-amber-500 fill-amber-500" />,
      achievement_validated: <BadgeCheck size={16} className="text-[var(--validated)]" />
    };

    const messages = {
      new_message: `${notif.payload.senderName || 'Someone'} sent you a direct consultation message.`,
      booking_request: `${notif.payload.senderName || 'A client'} requested a validation service audit.`,
      booking_accepted: `Your validation service audit request was accepted by the provider!`,
      booking_declined: `Your validation audit request was declined by the provider.`,
      booking_paid: `Payment confirmed via PayMongo for validation service!`,
      review_received: `${notif.payload.senderName || 'A client'} left you a peer validation rating review.`,
      achievement_validated: `Your professional peer achievement was endorsed and validated!`
    };

    return {
      icon: icons[notif.type] || <HelpCircle size={16} />,
      message: messages[notif.type] || 'New application alert received.'
    };
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 border-r border-[var(--border)] bg-[var(--bg)] h-full">
        <Bell size={48} className="text-[var(--text-secondary)] mb-4 animate-bounce" />
        <h2 className="font-extrabold text-lg text-[var(--text-primary)]">Access Your Notifications</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 leading-relaxed">
          Sign up or log in to view and manage your real-time booking alerts, direct consultations, and peer validation updates.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-black py-2.5 px-6 rounded-xl text-xs transition cursor-pointer shadow-xs"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--bg)]/90 backdrop-blur-md z-20">
        <div>
          <h1 className="font-black text-xl tracking-tight flex items-center gap-2">
            <Bell size={18} className="text-[var(--accent)]" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wider mt-0.5 block">
              {unreadCount} unread alerts
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => {
                showDialog(
                  "Clear All Notifications",
                  "Are you sure you want to clear all your notifications? This cannot be undone.",
                  "confirm",
                  async () => {
                    try {
                      const user = auth?.currentUser;
                      if (!user) return;
                      await dbService.clearAllNotifications(user.uid);
                      if (!isRealFirebaseActive()) {
                        setNotifications([]);
                      }
                    } catch (err) {
                      console.error("Error clearing notifications", err);
                    }
                  },
                  "Clear All"
                );
              }}
              className="text-xs font-bold text-red-500 hover:underline cursor-pointer animate-in fade-in duration-150"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs font-bold text-[var(--text-secondary)]">
            Loading alerts...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 gap-2">
            <div className="w-12 h-12 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-secondary)] mb-2">
              <Bell size={20} />
            </div>
            <span className="font-extrabold text-sm">Quiet for now</span>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">
              When clients book your services, endorse your achievements, or send consultation messages, you'll see alerts here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const { icon, message } = getNotifDetails(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n)}
                  className={`flex gap-3 items-center p-4 rounded-xl border transition text-left cursor-pointer group relative ${
                    n.read
                      ? 'bg-[var(--surface)]/30 border-[var(--border)]/60 text-[var(--text-secondary)]'
                      : 'bg-[var(--surface)] border-[var(--accent)]/30 text-[var(--text-primary)] shadow-xs relative'
                  }`}
                >
                  {!n.read && (
                    <span className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
                  )}
                  
                  <div className={`p-2 rounded-lg ${n.read ? 'bg-[var(--bg)]' : 'bg-[var(--accent)]/10'} shrink-0`}>
                    {icon}
                  </div>

                  <div className="flex-1 flex flex-col gap-0.5 animate-in fade-in duration-150">
                    <p className={`text-xs leading-relaxed font-semibold ${n.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                      {message}
                    </p>
                    <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                      {new Date(n.createdAt?.seconds * 1000 || n.createdAt).toLocaleDateString()} at {new Date(n.createdAt?.seconds * 1000 || n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Delete individual notification */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showDialog(
                        "Delete Notification",
                        "Are you sure you want to delete this notification?",
                        "confirm",
                        async () => {
                          try {
                            const user = auth?.currentUser;
                            if (!user) return;
                            await dbService.deleteNotification(user.uid, n.id);
                            if (!isRealFirebaseActive()) {
                              setNotifications(notifications.filter(x => x.id !== n.id));
                            }
                          } catch (err) {
                            console.error("Error deleting notification", err);
                          }
                        },
                        "Delete"
                      );
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--bg)] rounded-lg text-red-500 transition shrink-0 cursor-pointer"
                    title="Delete notification"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CustomDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        confirmLabel={dialogConfig.confirmLabel}
        onConfirm={dialogConfig.onConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
