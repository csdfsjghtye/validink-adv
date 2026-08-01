import React, { useState, useEffect } from 'react';
import { db, dbService } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { MessageSquare, CalendarRange, ShieldAlert, Star, Shield, HelpCircle, Sparkles, Search, User } from 'lucide-react';
import { Service, UserProfile } from '../types';
import CustomDialog from './CustomDialog';

interface FeedProps {
  currentTab?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onNavigate: (view: string, params?: any) => void;
  onOpenAuth: () => void;
  currentUserProfile: UserProfile | null;
}

const CATEGORIES = [
  'All',
  'Grammarian',
  'Statistician',
  'Accountant',
  'Research consultation',
  'Research instrument validation'
];

export default function Feed({
  currentTab,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  onNavigate,
  onOpenAuth,
  currentUserProfile
}: FeedProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeFeedTab, setActiveFeedTab] = useState<'about' | 'offerings'>('offerings');

  useEffect(() => {
    if (currentTab === 'explore') {
      setActiveFeedTab('offerings');
    } else if (currentTab === 'home') {
      setActiveFeedTab('about');
    }
  }, [currentTab]);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        const allUsers = await dbService.getAllUserProfiles();
        // filter for completed profiles to make search results highly useful
        setUsers(allUsers.filter(u => u.profileComplete));
      } catch (err) {
        console.error("Error fetching users", err);
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, []);

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

  // 1. Real-time snapshot for services (or fallback in simulated mode)
  useEffect(() => {
    let unsubscribe = () => {};

    if (dbService && !dbService.getServices) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const loadData = async () => {
      try {
        const data = await dbService.getServices(selectedCategory);
        setServices(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching services", err);
        setLoading(false);
      }
    };

    // If using real firebase, listen to changes in real-time, otherwise fetch once
    const useReal = (window as any).VALID_INK_DATABASE_MODE !== 'simulated';
    if (useReal && db) {
      let q = query(
        collection(db, 'services'),
        where('status', '==', 'active')
      );

      if (selectedCategory !== 'All') {
        q = query(
          collection(db, 'services'),
          where('status', '==', 'active'),
          where('category', '==', selectedCategory)
        );
      }

      unsubscribe = onSnapshot(q, async (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Service[];

        // Enrich with provider info
        const enriched: Service[] = await Promise.all(
          list.map(async (s) => {
            const uProfile = await dbService.getUserProfile(s.providerId);
            if (uProfile) {
              return {
                ...s,
                providerName: uProfile.displayName,
                providerHandle: uProfile.handle,
                providerAvatar: uProfile.avatarBase64,
                providerTitle: uProfile.title
              };
            }
            return s;
          })
        );
        // Sort enriched client-side by createdAt descending
        enriched.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setServices(enriched);
        setLoading(false);
      }, (err) => {
        console.error("Firestore Services snapshot error. Falling back.", err);
        loadData();
      });
    } else {
      // simulated mode update loop
      loadData();
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }

    return () => unsubscribe();
  }, [selectedCategory]);

  const handleBookService = async (service: Service) => {
    if (!currentUserProfile) {
      onOpenAuth();
      return;
    }
    if (service.providerId === currentUserProfile.uid) {
      showDialog(
        "Invalid Action",
        "You cannot book your own validation service!",
        "error"
      );
      return;
    }

    showDialog(
      "Confirm Request",
      `Are you sure you want to request the "${service.title}" validation service? The professor must accept before payment.`,
      "confirm",
      async () => {
        setBookingLoadingId(service.id);
        try {
          await dbService.createBooking(service.id, currentUserProfile.uid);
          onNavigate('bookings');
        } catch (err: any) {
          showDialog(
            "Booking Error",
            err.message || 'Failed to request booking.',
            "error"
          );
        } finally {
          setBookingLoadingId(null);
        }
      },
      "Request Booking"
    );
  };

  const handleMessageProvider = (service: Service) => {
    if (!currentUserProfile) {
      onOpenAuth();
      return;
    }
    onNavigate('messages', { partnerId: service.providerId });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetId || !reportReason.trim() || !currentUserProfile) return;

    try {
      setSubmittingReport(true);
      await dbService.createReport(
        currentUserProfile.uid,
        'service',
        reportTargetId,
        reportReason.trim()
      );
      showDialog(
        "Listing Reported",
        "Listing reported successfully. Content validators will inspect this offer.",
        "success"
      );
      setReportTargetId(null);
      setReportReason('');
    } catch (err: any) {
      showDialog(
        "Error Reporting",
        err.message || 'Failed to file report.',
        "error"
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  // Filter local listings by search query
  const queryClean = searchQuery.toLowerCase().trim();
  const filteredServices = services.filter((s) => {
    if (!queryClean) return true;
    return (
      s.title.toLowerCase().includes(queryClean) ||
      s.description.toLowerCase().includes(queryClean) ||
      (s.providerName && s.providerName.toLowerCase().includes(queryClean)) ||
      (s.providerHandle && s.providerHandle.toLowerCase().includes(queryClean))
    );
  });

  const filteredUsers = users.filter((u) => {
    let matchQuery = true;
    if (queryClean) {
      matchQuery = (
        u.displayName.toLowerCase().includes(queryClean) ||
        (u.handle && u.handle.toLowerCase().includes(queryClean)) ||
        (u.title && u.title.toLowerCase().includes(queryClean)) ||
        (u.bio && u.bio.toLowerCase().includes(queryClean))
      );
    }
    
    let matchCategory = true;
    if (selectedCategory !== 'All') {
      const uTitle = (u.title || '').toLowerCase();
      const cat = selectedCategory.toLowerCase();
      
      if (cat === 'grammarian') matchCategory = uTitle.includes('grammarian');
      else if (cat === 'statistician') matchCategory = uTitle.includes('statistician');
      else if (cat === 'accountant') matchCategory = uTitle.includes('accountant');
      else if (cat === 'research consultation') matchCategory = uTitle.includes('consultation') || uTitle.includes('research');
      else if (cat === 'research instrument validation') matchCategory = uTitle.includes('instrument') || uTitle.includes('validation');
    }
    
    return matchQuery && matchCategory;
  });

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] text-left">
      
      {/* Sticky Category Top Nav Bar */}
      <div className="sticky top-0 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] z-20 px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center relative gap-3">
          <h1 className="font-black text-xl tracking-tight flex items-center gap-2 sm:w-1/3">
            Explore Validations
          </h1>

          {/* Centered Search Bar */}
          <div className="relative flex-1 max-w-lg w-full sm:mx-auto">
            <input
              id="search-input-centered"
              type="text"
              placeholder="Search services, skills, or experts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[var(--surface)] text-[var(--text-primary)] pl-9 pr-4 py-2 rounded-full text-xs border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-all font-medium"
            />
            <div className="absolute left-3 top-2.5 text-[var(--text-secondary)]">
              <Search size={13} />
            </div>
          </div>
          <div className="hidden sm:block sm:w-1/3"></div>
        </div>

        {/* Search / Explore Type Tabs */}
        <div className="flex gap-6 border-b border-[var(--border)] -mx-4 px-4 pt-1">
          <button
            onClick={() => setActiveFeedTab('about')}
            className={`pb-2 text-sm font-extrabold relative transition cursor-pointer ${
              activeFeedTab === 'about'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            About us
            {activeFeedTab === 'about' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-lg animate-in slide-in-from-left duration-200" />
            )}
          </button>
          <button
            onClick={() => setActiveFeedTab('offerings')}
            className={`pb-2 text-sm font-extrabold relative transition cursor-pointer ${
              activeFeedTab === 'offerings'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Validation Offerings
            {activeFeedTab === 'offerings' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent)] rounded-t-lg animate-in slide-in-from-left duration-200" />
            )}
          </button>
        </div>

        {/* Categories Pills Row (Only visible for Validation Offerings) */}
        {activeFeedTab === 'offerings' && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-b border-transparent pr-4 w-full">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-5 py-1.5 rounded-full text-xs font-bold shrink-0 transition duration-150 select-none cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[var(--accent)] text-white shadow-md'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--border)]'
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="w-8 shrink-0" />
          </div>
        )}
      </div>

      {/* Main Feed List Container */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {activeFeedTab === 'about' ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 py-2">
            {/* Banner matching Image 1 */}
            <div className="rounded-3xl overflow-hidden border border-[var(--border)] relative h-[250px] sm:h-[300px] w-full flex items-center justify-center shadow-2xs">
               <img 
                 src="/src/assets/images/about_us_workspace_flatlay_1785608449723.jpg" 
                 alt="About ValidInk" 
                 className="absolute inset-0 w-full h-full object-cover" 
               />
               <div className="absolute inset-0 bg-black/10" />
               <div className="relative z-10 flex items-center justify-center gap-3">
                 {/* Circle logo with dark blue ring and red checkmark */}
                 <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[3px] sm:border-[4px] border-[#0b2447] flex items-center justify-center bg-white shadow-md">
                   <div className="text-[#8B1E2F]">
                     <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                       <polyline points="20 6 9 17 4 12"></polyline>
                     </svg>
                   </div>
                 </div>
                 <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm" style={{ color: '#0b2447' }}>
                   Valid<span className="text-[#8B1E2F]">Ink</span>
                 </span>
               </div>
            </div>
            
            {/* Description paragraph matching Image 2 */}
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed text-center max-w-3xl mx-auto px-4 font-medium mt-2">
              <span className="text-[var(--accent)] font-bold">ValidInk</span> is an online platform that connects students with qualified academic professionals for consultation
              and validation services related to research papers, theses, dissertations, feasibility studies, capstone
              projects, and other academic requirements. Students can browse verified professionals, view their expertise,
              ratings, reviews, and services, and choose the one that best fits their needs. Meanwhile, professionals
              subscribe to the platform through monthly or annual plans to offer their services and expand their reach to
              student clients.
            </p>

            {/* Bottom arrow CTA matching Image 2 */}
            <div className="flex flex-col items-center justify-center mt-4">
              <a 
                href="https://validink.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-full flex items-center justify-center transition cursor-pointer shadow-md mb-2 group"
                title="View Validation Offerings"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </a>
              <a 
                href="https://validink.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[var(--text-secondary)] hover:underline cursor-pointer font-bold"
              >
                Learn more
              </a>
            </div>
          </div>
        ) : (
          /* Offerings tab render showing real validation services */
          loading ? (
            <div className="flex flex-col gap-4 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-3 animate-pulse">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--border)] animate-pulse" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-40 bg-[var(--border)] rounded" />
                      <div className="h-3 w-24 bg-[var(--border)] rounded" />
                      <div className="h-3 w-60 bg-[var(--border)] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredServices.length === 0 && (queryClean.length === 0 || filteredUsers.length === 0) ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-[var(--surface)] flex items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] mb-4">
                <Search size={24} />
              </div>
              <h3 className="font-extrabold text-lg text-[var(--text-primary)]">No validation offerings found</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed mt-1.5">
                There are no active validation offerings matching your filter.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
              {queryClean.length > 0 && filteredUsers.map((userProfile) => (
                <article
                  key={userProfile.uid}
                  id={`user-card-${userProfile.uid}`}
                  className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-2xs hover:shadow-xs transition duration-200"
                >
                  <div className="flex gap-4 items-center flex-1 min-w-0">
                    {userProfile.role === 'professor' ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                        <User size={24} />
                      </div>
                    ) : userProfile.avatarBase64 ? (
                      <img
                        src={userProfile.avatarBase64}
                        alt={userProfile.displayName}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border border-[var(--border)] shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--border)] flex items-center justify-center font-black text-[var(--text-secondary)] shrink-0 text-xl">
                        {userProfile.displayName?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <h3 
                        className="font-black text-base text-[var(--text-primary)] leading-tight cursor-pointer hover:underline"
                        onClick={() => onNavigate('profile', { uid: userProfile.uid })}
                      >
                        {userProfile.role === 'professor' ? 'Anonymous Professor' : userProfile.displayName}
                      </h3>
                      
                      <p className="font-extrabold text-xs text-[var(--accent)]">
                        {userProfile.title || 'Grammarian'}
                      </p>
                      
                      {userProfile.bio && (
                        <p className="text-xs text-[var(--text-secondary)] font-medium leading-normal mt-0.5 line-clamp-2">
                          {userProfile.bio}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
                        <span className="bg-[var(--bg)] border border-[var(--border)] px-3 py-1 rounded-full shadow-2xs">
                          {userProfile.stats?.achievementsCount || 0} ACCOMPLISHMENTS
                        </span>
                        <span className="bg-[var(--bg)] border border-[var(--border)] px-3 py-1 rounded-full shadow-2xs">
                          {userProfile.stats?.servicesCount || 0} OFFERINGS
                        </span>
                        <span className="bg-[var(--bg)] border border-[var(--border)] px-3 py-1 rounded-full shadow-2xs">
                          {userProfile.stats?.bookingsCompleted || 0} BOOKINGS COMPLETED
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full sm:w-auto flex items-center justify-end">
                    <button
                      onClick={() => onNavigate('profile', { uid: userProfile.uid })}
                      className="w-full sm:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2.5 px-6 rounded-full transition cursor-pointer shadow-2xs"
                    >
                      View Profile
                    </button>
                  </div>
                </article>
              ))}

              {filteredServices.filter(s => s.status === 'active' || s.status === 'pending').map((service) => {
                const providerUser = users.find(u => u.uid === service.providerId);
                const isProfessor = providerUser?.role === 'professor';

                return (
                  <article
                    key={service.id}
                    id={`service-card-${service.id}`}
                    className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] flex flex-col gap-4 text-left shadow-2xs hover:shadow-xs transition duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3.5 items-center">
                        {isProfessor ? (
                          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                            <User size={20} />
                          </div>
                        ) : service.providerAvatar ? (
                          <img
                            src={service.providerAvatar}
                            alt={service.providerName || 'Provider'}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center font-black text-[var(--text-secondary)] shrink-0 text-lg">
                            {(service.providerName || 'P').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span 
                              className="font-black text-sm text-[var(--text-primary)] hover:underline cursor-pointer"
                              onClick={() => onNavigate('profile', { uid: service.providerId })}
                            >
                              {isProfessor ? 'Anonymous Professor' : (service.providerName || 'Academic Expert')}
                            </span>
                            {!isProfessor && service.providerHandle && (
                              <span className="text-xs text-[var(--text-secondary)]">@{service.providerHandle}</span>
                            )}
                          </div>
                          <p className="font-extrabold text-xs text-[var(--accent)]">
                            {service.providerTitle || service.category || 'Academic Validator'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                      <span className="text-xl font-black text-[var(--text-primary)]">
                        ${service.price}
                      </span>
                      <span className="text-[10px] block text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                        Per Contract
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-extrabold text-base text-[var(--text-primary)] leading-snug">
                      {service.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]/60">
                    <div className="flex items-center gap-2">
                      <span className="bg-[var(--bg)] border border-[var(--border)] px-3 py-1 rounded-full text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider shadow-2xs">
                        {service.category}
                      </span>
                      {service.ratingAvg !== undefined && service.ratingAvg > 0 && (
                        <span className="flex items-center gap-1 bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded-full text-[10px] font-extrabold">
                          <Star size={12} className="fill-[var(--accent)] text-[var(--accent)]" />
                          {service.ratingAvg.toFixed(1)} ({service.ratingCount || 1})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMessageProvider(service)}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] rounded-full transition cursor-pointer"
                        title="Inquire Service"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <button
                        onClick={() => handleBookService(service)}
                        disabled={bookingLoadingId === service.id}
                        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2 px-5 rounded-full transition cursor-pointer shadow-2xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CalendarRange size={14} /> {bookingLoadingId === service.id ? 'Booking...' : 'Book Service'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          )
        )}
      </div>

      {/* Flag reporting modal component */}
      {reportTargetId && currentUserProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[400px] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-lg flex items-center gap-1.5 text-red-500">
              <ShieldAlert size={18} /> Report Listing
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Specify why this listing is incorrect or violates peer safety standards.
            </p>

            <form onSubmit={handleReportSubmit} className="flex flex-col gap-3 mt-4">
              <textarea
                required
                rows={3}
                maxLength={200}
                placeholder="Describe your reasoning..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl focus:border-[var(--accent)] focus:outline-none resize-none font-medium text-[var(--text-primary)]"
              />

              <div className="flex justify-end gap-2 text-xs font-bold mt-1">
                <button
                  type="button"
                  onClick={() => setReportTargetId(null)}
                  className="py-1.5 px-4 rounded-full hover:bg-[var(--surface)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportReason.trim()}
                  className="bg-red-500 hover:opacity-90 text-white py-1.5 px-4 rounded-full transition cursor-pointer disabled:opacity-45"
                >
                  {submittingReport ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom dialog system */}
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
