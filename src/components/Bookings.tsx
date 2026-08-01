import React, { useState, useEffect } from 'react';
import { sanitizeInput } from '../utils';
import { db, dbService } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { CalendarRange, Star, MessageSquare, CheckCircle, Clock, ShieldAlert, BadgeHelp, CreditCard } from 'lucide-react';
import { Booking, UserProfile } from '../types';
import CustomDialog from './CustomDialog';
import PaymongoModal from './PaymongoModal';

interface BookingsProps {
  onNavigate: (view: string, params?: any) => void;
  currentUserProfile: UserProfile | null;
  onOpenAuth: () => void;
}

export default function Bookings({
  onNavigate,
  currentUserProfile,
  onOpenAuth
}: BookingsProps) {
  const [activeTab, setActiveTab] = useState<'client' | 'provider'>('client');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  // Submit review state
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Payment state
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState<Booking | null>(null);

  // Handle tab switch
  const handleTabChange = (tab: 'client' | 'provider') => {
    if (activeTab === tab) return;
    setBookings([]);
    setLoading(true);
    setActiveTab(tab);
  };

  // 1. Real-time snapshot listener
  useEffect(() => {
    if (!currentUserProfile) {
      setLoading(false);
      return;
    }

    const field = activeTab === 'provider' ? 'providerId' : 'clientId';
    const q = query(
      collection(db, 'bookings'),
      where(field, '==', currentUserProfile.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const rawBookings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Booking[];

        // Enrich bookings with service title, client details, provider details
        const enriched: Booking[] = await Promise.all(
          rawBookings.map(async (b) => {
            const [matchedService, clientProfile, providerProfile] = await Promise.all([
              dbService.getService(b.serviceId),
              dbService.getUserProfile(b.clientId),
              dbService.getUserProfile(b.providerId)
            ]);
            
            const isProviderProfessor = providerProfile?.role === 'professor';

            return {
              ...b,
              serviceTitle: matchedService?.title || 'Validation Service',
              servicePrice: matchedService?.price || 0,
              clientName: clientProfile?.displayName || 'Client User',
              clientHandle: clientProfile?.handle || 'client',
              clientAvatar: clientProfile?.avatarBase64,
              providerName: isProviderProfessor ? 'Anonymous Professor' : (providerProfile?.displayName || 'Validator Expert'),
              providerHandle: isProviderProfessor ? 'professor' : (providerProfile?.handle || 'provider'),
              providerAvatar: isProviderProfessor ? undefined : providerProfile?.avatarBase64
            };
          })
        );

        // Sort enriched client-side by updatedAt descending
        enriched.sort((a, b) => {
          const timeA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0).getTime();
          const timeB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0).getTime();
          return timeB - timeA;
        });

        setBookings(enriched);
      } catch (err) {
        console.error("Snapshot bookings enrich error", err);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Firebase Bookings snapshot error", err);
      // Fallback
      dbService.getBookings(currentUserProfile.uid, activeTab === 'provider').then(setBookings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile, activeTab]);

  const handleUpdateStatus = async (bookingId: string, status: 'accepted' | 'declined' | 'completed' | 'cancelled' | 'paid') => {
    showDialog(
      "Update Contract Status",
      `Are you sure you want to set the status of this validation to ${status}?`,
      "confirm",
      async () => {
        setActionLoadingId(bookingId);
        // Optimistic UI update
        setBookings(prev => prev.map(b => (b.id === bookingId || b.bookingId === bookingId) ? { ...b, status } : b));
        try {
          await dbService.updateBookingStatus(bookingId, status);
        } catch (err: any) {
          // Revert on error (could re-fetch, but typically snapshot will overwrite anyway)
          showDialog(
            "Update Error",
            err.message || 'Failed to update booking state.',
            "error"
          );
        } finally {
          setActionLoadingId(null);
        }
      },
      "Update"
    );
  };

  const handleDirectUpdateStatus = async (bookingId: string, status: 'accepted' | 'declined' | 'completed' | 'cancelled' | 'paid') => {
    setActionLoadingId(bookingId);
    // Optimistic UI update
    setBookings(prev => prev.map(b => (b.id === bookingId || b.bookingId === bookingId) ? { ...b, status } : b));
    try {
      await dbService.updateBookingStatus(bookingId, status);
    } catch (err: any) {
      showDialog(
        "Update Error",
        err.message || 'Failed to update booking state.',
        "error"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReview = (b: Booking) => {
    setReviewBookingId(b.id);
    setReviewRating(5);
    setReviewComment('');
    setReviewError('');
  };

  const handleSubmitReview = async (e: React.FormEvent, booking: Booking) => {
    e.preventDefault();
    const cleanComment = sanitizeInput(reviewComment);
    if (!cleanComment) {
      setReviewError('Please write comments for this review.');
      return;
    }

    setReviewSubmitting(true);
    setReviewError('');

    try {
      await dbService.createReview(
        booking.id,
        booking.serviceId,
        booking.clientId,
        booking.providerId,
        reviewRating,
        cleanComment
      );
      setReviewBookingId(null);
    } catch (err: any) {
      console.error(err);
      setReviewError(err.message || 'Failed to submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 border-r border-[var(--border)] bg-[var(--bg)] h-full">
        <CalendarRange size={48} className="text-[var(--text-secondary)] mb-4 animate-bounce" />
        <h2 className="font-extrabold text-lg text-[var(--text-primary)]">Access Validation Bookings</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 leading-relaxed">
          Sign up or log in to manage active audits, validation requests, and view contract review histories.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold py-2 px-6 rounded-xl text-xs transition cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
      
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--bg)]/90 backdrop-blur-md z-20">
        <h1 className="font-black text-xl tracking-tight flex items-center gap-2">
          <CalendarRange size={18} className="text-[var(--accent)]" /> Service Bookings
        </h1>

        {/* Client vs Provider Subtabs */}
        <div className="flex border-b border-[var(--border)] mt-4">
          <button
            onClick={() => handleTabChange('client')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition ${
              activeTab === 'client'
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            My Booked Audits
          </button>
          <button
            onClick={() => handleTabChange('provider')}
            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider text-center border-b-2 transition ${
              activeTab === 'provider'
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Incoming Jobs
          </button>
        </div>
      </div>

      {/* Bookings List */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs font-bold text-[var(--text-secondary)]">
            Loading bookings...
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 gap-2">
            <Clock size={32} className="text-[var(--text-secondary)]" />
            <span className="font-extrabold text-sm">No bookings found</span>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-relaxed">
              {activeTab === 'client' 
                ? "You haven't requested any peer audits yet. Head to the home explore feed to book an expert."
                : "You don't have any pending or completed validation requests from clients yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bookings.map((b) => {
              const statusColors = {
                pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                accepted: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
                paid: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
                completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                declined: 'bg-red-500/10 text-red-500 border-red-500/20',
                cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
              };

              const partnerName = activeTab === 'provider' ? b.clientName : b.providerName;
              const partnerHandle = activeTab === 'provider' ? b.clientHandle : b.providerHandle;
              const partnerAvatar = activeTab === 'provider' ? b.clientAvatar : b.providerAvatar;

              const isReviewOpen = reviewBookingId === (b.id || b.bookingId);

              return (
                <div
                  key={b.id || b.bookingId}
                  className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] transition flex flex-col gap-3.5 text-left"
                >
                  
                  {/* Status header */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusColors[b.status]}`}>
                      {b.status}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Price: ${b.servicePrice}
                    </span>
                  </div>

                  {/* Service details */}
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-black text-sm text-[var(--text-primary)] tracking-tight">
                      {b.serviceTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      {partnerAvatar ? (
                        <img
                          src={partnerAvatar}
                          alt={partnerName}
                          className="w-7 h-7 rounded-full object-cover border border-[var(--border)]"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--bg)] flex items-center justify-center font-bold text-[10px]">
                          {partnerName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-[var(--text-secondary)] font-semibold">
                        {activeTab === 'provider' ? 'Client' : 'Validator'}: <span className="text-[var(--text-primary)]">@{partnerHandle}</span>
                      </span>
                    </div>
                  </div>

                  {/* Informational Workflow Banners */}
                  {activeTab === 'client' && b.status === 'pending' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2 font-medium">
                      <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-amber-950">Awaiting Professor Acceptance</span>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          The professor must review and accept your book validation request before payment is required. You cannot pay until accepted.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'client' && b.status === 'accepted' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2 font-medium">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-emerald-950">Accepted by Professor — Ready for Payment</span>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          Your validation request was accepted! Complete payment via PayMongo below to begin your audit.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'client' && b.status === 'paid' && (
                    <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs text-indigo-900 flex items-start gap-2 font-medium">
                      <CreditCard size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-indigo-950">Payment Confirmed (PayMongo)</span>
                          {b.transactionId && (
                            <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                              Txn ID: {b.transactionId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-indigo-800 leading-relaxed">
                          Payment verified! The professor is currently performing your academic validation audit.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'provider' && b.status === 'pending' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2 font-medium">
                      <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-amber-950">Validation Request Pending</span>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Review the student's request. Accepting will notify the student and unlock their PayMongo payment.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'provider' && b.status === 'accepted' && (
                    <div className="p-3 bg-sky-50 border border-sky-200/80 rounded-xl text-xs text-sky-900 flex items-start gap-2 font-medium">
                      <Clock size={16} className="text-sky-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-extrabold text-sky-950">Accepted — Waiting for Student Payment</span>
                        <p className="text-[11px] text-sky-800 leading-relaxed">
                          You accepted this contract. Waiting for the student to complete payment via PayMongo.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'provider' && b.status === 'paid' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2 font-medium">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-emerald-950">Payment Received — Active Validation</span>
                          {b.transactionId && (
                            <span className="text-[10px] font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                              Txn ID: {b.transactionId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-emerald-800 leading-relaxed">
                          The student has paid. Perform the validation audit and click "Complete Validation Contract" when done.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions based on role and status */}
                  <div className="flex items-center gap-2 border-t border-[var(--border)]/40 pt-3">
                    <button
                      onClick={() => onNavigate('messages', { partnerId: activeTab === 'provider' ? b.clientId : b.providerId })}
                      className="p-2 bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-xl border border-[var(--border)] transition"
                      title="Send Consultation Message"
                    >
                      <MessageSquare size={14} />
                    </button>

                    {/* Provider Actions */}
                    {activeTab === 'provider' && b.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(b.id || b.bookingId, 'declined')}
                          disabled={actionLoadingId === (b.id || b.bookingId)}
                          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold text-xs py-2 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoadingId === (b.id || b.bookingId) ? 'Updating...' : 'Decline Request'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(b.id || b.bookingId, 'accepted')}
                          disabled={actionLoadingId === (b.id || b.bookingId)}
                          className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoadingId === (b.id || b.bookingId) ? 'Updating...' : 'Accept Contract'}
                        </button>
                      </>
                    )}

                    {activeTab === 'provider' && b.status === 'accepted' && (
                      <span className="flex-1 text-center py-2 text-xs font-bold text-sky-600 bg-sky-500/10 rounded-xl">
                        Waiting for Client Payment
                      </span>
                    )}

                    {activeTab === 'provider' && b.status === 'paid' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id || b.bookingId, 'completed')}
                        disabled={actionLoadingId === (b.id || b.bookingId)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle size={14} /> {actionLoadingId === (b.id || b.bookingId) ? 'Updating...' : 'Complete Validation Contract'}
                      </button>
                    )}

                    {/* Client Actions */}
                    {activeTab === 'client' && b.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id || b.bookingId, 'cancelled')}
                        disabled={actionLoadingId === (b.id || b.bookingId)}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoadingId === (b.id || b.bookingId) ? 'Updating...' : 'Cancel request'}
                      </button>
                    )}

                    {activeTab === 'client' && b.status === 'accepted' && (
                      <button
                        onClick={() => setPendingPaymentBooking(b)}
                        className="flex-1 bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <CreditCard size={14} /> Pay via PayMongo
                      </button>
                    )}

                    {activeTab === 'client' && b.status === 'completed' && !isReviewOpen && (
                      <button
                        onClick={() => handleOpenReview(b)}
                        className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Star size={13} className="fill-white" /> Submit Star Review
                      </button>
                    )}
                  </div>

                  {/* Collapsible Submit Review Section */}
                  {isReviewOpen && (
                    <div className="mt-3 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">
                          Leave Peer Expert Review
                        </span>
                        <button
                          onClick={() => setReviewBookingId(null)}
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>

                      {reviewError && (
                        <span className="text-xs text-red-500 font-bold">{reviewError}</span>
                      )}

                      <form onSubmit={(e) => handleSubmitReview(e, b)} className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Rating</label>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setReviewRating(num)}
                                className="p-0.5"
                              >
                                <Star
                                  size={20}
                                  className={num <= reviewRating ? 'fill-amber-500 text-amber-500' : 'text-[var(--text-secondary)]'}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Review Comment</label>
                          <textarea
                            required
                            rows={3}
                            maxLength={280}
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Write about your peer validation audit experience (e.g. feedback speed, code clarity, quality)..."
                            className="w-full bg-[var(--surface)] border border-[var(--border)] p-2.5 rounded-xl text-xs focus:border-[var(--accent)] focus:outline-none leading-relaxed resize-none text-[var(--text-primary)] font-semibold"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={reviewSubmitting}
                          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2 rounded-xl transition cursor-pointer"
                        >
                          {reviewSubmitting ? 'Submitting Review...' : 'Submit Certified Review'}
                        </button>
                      </form>
                    </div>
                  )}

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

      <PaymongoModal
        isOpen={!!pendingPaymentBooking}
        onClose={() => setPendingPaymentBooking(null)}
        onSuccess={async () => {
          if (pendingPaymentBooking) {
            await dbService.updateBookingStatus(pendingPaymentBooking.id || pendingPaymentBooking.bookingId, 'paid');
            setPendingPaymentBooking(null);
          }
        }}
        amount={pendingPaymentBooking?.servicePrice || 0}
        recipientName={pendingPaymentBooking?.providerName || 'Expert'}
        bookingId={pendingPaymentBooking?.id || pendingPaymentBooking?.bookingId}
      />
    </div>
  );
}
