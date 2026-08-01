import React, { useState, useEffect } from 'react';
import { db, dbService, auth, isRealFirebaseActive } from '../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, getDocs } from 'firebase/firestore';
import { User, Shield, Briefcase, PlusCircle, Star, BadgeCheck, Edit3, MessageCircle, Eye, Camera, Check, Trash2 } from 'lucide-react';
import { UserProfile, Service, Review, Achievement } from '../types';
import { compressImage } from '../utils';
import CustomDialog from './CustomDialog';

interface ProfileProps {
  profileId: string;
  onNavigate: (view: string, params?: any) => void;
  currentUserProfile: UserProfile | null;
  onUpdateCurrentUserProfile: (profile: UserProfile) => void;
  onOpenAuth: () => void;
}

export default function Profile({
  profileId,
  onNavigate,
  currentUserProfile,
  onUpdateCurrentUserProfile,
  onOpenAuth
}: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeSubtab, setActiveSubtab] = useState<'services' | 'achievements' | 'reviews'>('services');

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

  // Profile Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTheme, setEditTheme] = useState<'light' | 'dim' | 'lightsout'>('light');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // New Achievement state
  const [isAddingAchievement, setIsAddingAchievement] = useState(false);
  const [newAchTitle, setNewAchTitle] = useState('');
  const [newAchDesc, setNewAchDesc] = useState('');
  const [newAchProof, setNewAchProof] = useState('');
  const [newAchLoading, setNewAchLoading] = useState(false);

  // Selected achievement critique & detail modal state
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [newCritiqueText, setNewCritiqueText] = useState('');
  const [submittingCritique, setSubmittingCritique] = useState(false);

  const isMe = currentUserProfile?.uid === profileId;

  const parseDate = (timestamp: any) => {
    if (!timestamp) return new Date();
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [hasPaidBooking, setHasPaidBooking] = useState(false);

  useEffect(() => {
    if (!currentUserProfile || !profileId || currentUserProfile.uid === profileId) return;

    if (currentUserProfile.role === 'professor') {
      // Professors can be messaged, but wait, the rule says "Students cannot message professor unless payment has been done".
      // What about a professor messaging a student? Let's just require a paid booking between the two in any direction.
      const checkBookings = async () => {
        try {
          if (!isRealFirebaseActive() || !db) {
            setHasPaidBooking(true);
            return;
          }
          const q = query(
            collection(db, 'bookings'),
            where('providerUid', '==', currentUserProfile.uid),
            where('clientUid', '==', profileId),
            where('status', 'in', ['paid', 'completed'])
          );
          const snapshot = await getDocs(q);
          setHasPaidBooking(!snapshot.empty);
        } catch (e) {
          console.error(e);
        }
      };
      checkBookings();
    } else {
      const checkBookings = async () => {
        try {
          if (!isRealFirebaseActive() || !db) {
            setHasPaidBooking(true);
            return;
          }
          const q = query(
            collection(db, 'bookings'),
            where('clientUid', '==', currentUserProfile.uid),
            where('providerUid', '==', profileId),
            where('status', 'in', ['paid', 'completed'])
          );
          const snapshot = await getDocs(q);
          setHasPaidBooking(!snapshot.empty);
        } catch (e) {
          console.error(e);
        }
      };
      checkBookings();
    }
  }, [currentUserProfile, profileId]);

  // 1. Fetch profile details
  useEffect(() => {
    if (!profileId) return;

    setLoading(true);
    if (isRealFirebaseActive() && db) {
      const unsubUser = onSnapshot(doc(db, 'users', profileId), (docSnap) => {
        if (docSnap.exists()) {
          const uProfile = docSnap.data() as UserProfile;
          setProfile(uProfile);
          
          // Pre-fill edit fields
          setEditName(uProfile.displayName);
          setEditTitle(uProfile.title);
          setEditBio(uProfile.bio);
          setEditTheme(uProfile.themePreference || 'light');
          setEditAvatar(uProfile.avatarBase64 || '');
          setEditBanner(uProfile.bannerBase64 || '');
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, (err) => {
        console.error(err);
        // Fallback
        dbService.getUserProfile(profileId).then(setProfile);
        setLoading(false);
      });

      return () => unsubUser();
    } else {
      dbService.getUserProfile(profileId).then((uProfile) => {
        if (uProfile) {
          setProfile(uProfile);
          setEditName(uProfile.displayName);
          setEditTitle(uProfile.title);
          setEditBio(uProfile.bio);
          setEditTheme(uProfile.themePreference || 'light');
          setEditAvatar(uProfile.avatarBase64 || '');
          setEditBanner(uProfile.bannerBase64 || '');
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    }
  }, [profileId]);

  // 2. Fetch Services published by this user
  useEffect(() => {
    if (!profileId) return;

    if (isRealFirebaseActive() && db) {
      const q = query(
        collection(db, 'services'),
        where('providerId', '==', profileId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const srvs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Service[];
        const filtered = srvs.filter(s => ['active', 'pending', 'booked'].includes(s.status));
        setServices(filtered);
      }, (err) => {
        console.error(err);
      });

      return () => unsubscribe();
    } else {
      const loadServices = () => {
        dbService.getServicesByProvider(profileId).then(srvs => {
          const filtered = srvs.filter(s => ['active', 'pending', 'booked'].includes(s.status));
          setServices(filtered);
        });
      };
      loadServices();
      const interval = setInterval(loadServices, 3000);
      return () => clearInterval(interval);
    }
  }, [profileId]);

  // 3. Fetch Achievements listed on this profile
  useEffect(() => {
    if (!profileId) return;

    if (isRealFirebaseActive() && db) {
      const q = query(
        collection(db, 'users', profileId, 'achievements'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const achs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Achievement[];
        setAchievements(achs);
      }, (err) => {
        console.error(err);
        // Fallback
        dbService.getAchievements(profileId).then(setAchievements);
      });

      return () => unsubscribe();
    } else {
      const loadAchievements = () => {
        dbService.getAchievements(profileId).then(setAchievements);
      };
      loadAchievements();
      const interval = setInterval(loadAchievements, 3000);
      return () => clearInterval(interval);
    }
  }, [profileId]);

  // 4. Fetch Reviews submitted for this validator
  useEffect(() => {
    if (!profileId) return;

    if (isRealFirebaseActive() && db) {
      const q = query(
        collection(db, 'reviews'),
        where('targetId', '==', profileId)
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const revs = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          })) as Review[];

          // Fetch author names and handles
          const enriched: Review[] = [];
          for (const r of revs) {
            const author = await dbService.getUserProfile(r.authorId);
            enriched.push({
              ...r,
              authorName: author?.displayName || 'Reviewer',
              authorAvatar: author?.avatarBase64,
              authorHandle: author?.handle || 'reviewer'
            });
          }

          // Sort client-side by createdAt descending
          enriched.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          setReviews(enriched);
        } catch (e) {
          console.error(e);
        }
      }, (err) => {
        console.error(err);
        dbService.getReviews(profileId).then(setReviews);
      });

      return () => unsubscribe();
    } else {
      const loadReviews = () => {
        dbService.getReviews(profileId).then(setReviews);
      };
      loadReviews();
      const interval = setInterval(loadReviews, 3000);
      return () => clearInterval(interval);
    }
  }, [profileId]);

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !editName.trim() || !editTitle.trim()) return;

    setEditLoading(true);
    try {
      const updatedData: Partial<UserProfile> = {
        displayName: editName.trim(),
        title: editTitle.trim(),
        bio: editBio.trim(),
        themePreference: editTheme,
        avatarBase64: editAvatar,
        bannerBase64: editBanner
      };

      await dbService.updateUserProfile(profile.uid, updatedData);
      
      if (isMe) {
        onUpdateCurrentUserProfile({
          ...currentUserProfile!,
          ...updatedData
        });
      }
      setIsEditing(false);
    } catch (err) {
      console.error("Error editing profile", err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newAchTitle.trim() || !newAchDesc.trim()) return;

    setNewAchLoading(true);
    try {
      await dbService.addAchievement(profile.uid, newAchTitle.trim(), newAchDesc.trim(), newAchProof);
      setIsAddingAchievement(false);
      setNewAchTitle('');
      setNewAchDesc('');
      setNewAchProof('');
    } catch (err) {
      console.error(err);
    } finally {
      setNewAchLoading(false);
    }
  };

  const handleEndorseAchievement = async (achId: string) => {
    if (!currentUserProfile) {
      onOpenAuth();
      return;
    }
    if (currentUserProfile.uid === profileId) {
      showDialog(
        "Invalid Action",
        "You cannot endorse your own achievement!",
        "error"
      );
      return;
    }

    try {
      await dbService.endorseAchievement(profileId, achId, currentUserProfile.uid);
      
      // Also send real-time notification to achievement owner
      await dbService.createNotification(profileId, 'achievement_validated', {
        achievementId: achId,
        senderId: currentUserProfile.uid,
        senderName: currentUserProfile.displayName
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePostCritique = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) {
      onOpenAuth();
      return;
    }
    if (!selectedAchievement) return;
    if (!newCritiqueText.trim()) return;

    setSubmittingCritique(true);
    try {
      await dbService.addAchievementCritique(
        profileId,
        selectedAchievement.id,
        currentUserProfile.uid,
        currentUserProfile.displayName,
        currentUserProfile.handle,
        currentUserProfile.avatarBase64,
        newCritiqueText.trim()
      );

      // Add to local state of selected achievement to show immediately
      const mockCritique = {
        id: `crit_${Date.now()}`,
        authorId: currentUserProfile.uid,
        authorName: currentUserProfile.displayName,
        authorHandle: currentUserProfile.handle,
        authorAvatar: currentUserProfile.avatarBase64 || '',
        text: newCritiqueText.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedAchievement = {
        ...selectedAchievement,
        critiques: [...(selectedAchievement.critiques || []), mockCritique]
      };

      setSelectedAchievement(updatedAchievement);

      // Also update the main achievements array state so it persists in the subtab view
      setAchievements(prev => prev.map(a => a.id === selectedAchievement.id ? updatedAchievement : a));

      setNewCritiqueText('');
    } catch (err: any) {
      showDialog(
        "Critique Error",
        err.message || "Failed to submit achievement critique.",
        "error"
      );
    } finally {
      setSubmittingCritique(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 200, 200);
      setEditAvatar(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 800, 300);
      setEditBanner(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProofSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 400);
      setNewAchProof(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    showDialog(
      "Delete Validation Service",
      "Are you sure you want to delete and archive this validation service offering?",
      "confirm",
      async () => {
        try {
          await dbService.deleteService(serviceId, profileId);
          setServices(prev => prev.filter(s => s.id !== serviceId));
        } catch (err: any) {
          showDialog(
            "Delete Error",
            err.message || "Failed to delete validation service offering.",
            "error"
          );
        }
      },
      "Delete"
    );
  };

  const handleBookValidation = async (service: Service) => {
    if (!currentUserProfile) {
      onOpenAuth();
      return;
    }
    if (service.providerId === currentUserProfile.uid) {
      showDialog("Invalid Action", "You cannot book your own validation service!", "error");
      return;
    }

    showDialog(
      "Confirm Request",
      `Are you sure you want to request the "${service.title}" validation service? The professor must accept before payment.`,
      "confirm",
      async () => {
        try {
          await dbService.createBooking(service.id, currentUserProfile.uid);
          showDialog("Request Sent", "The validation request has been sent and is awaiting the professor's acceptance.", "success");
        } catch (err: any) {
          showDialog("Booking Error", err.message || "Failed to finalize the booking.", "error");
        }
      },
      "Request Booking"
    );
  };

  if (!profileId) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 border-r border-[var(--border)] bg-[var(--bg)] h-full animate-in fade-in duration-200">
        <User size={48} className="text-[var(--text-secondary)] mb-4 animate-bounce" />
        <h2 className="font-extrabold text-lg text-[var(--text-primary)]">Access Your Professional Profile</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 leading-relaxed">
          Sign up or log in to view and edit your professional validation profile, certifications, and active contract offerings.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-bold text-[var(--text-secondary)] border-r border-[var(--border)] bg-[var(--bg)]">
        Loading Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 h-full border-r border-[var(--border)] bg-[var(--bg)]">
        <User size={48} className="text-[var(--text-secondary)] mb-4" />
        <h2 className="font-extrabold text-lg text-[var(--text-primary)]">Profile Not Found</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">
          The requested profile page does not exist or may have been deleted.
        </p>
        <button
          onClick={() => onNavigate('feed')}
          className="mt-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold py-2 px-6 rounded-xl text-xs transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)] pb-12">
      
      {/* 1. Header Hero Banner */}
      <div className="h-44 bg-[var(--surface)] relative overflow-hidden shrink-0 border-b border-[var(--border)]">
        {profile.bannerBase64 ? (
          <img
            src={profile.bannerBase64}
            alt="Profile Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-r from-[var(--accent)]/10 to-[var(--accent)]/30" />
        )}
      </div>

      {/* 2. Personal Info Box */}
      <div className="px-5 relative flex flex-col gap-3">
        
        {/* Large Avatar Overlay */}
        <div className="absolute -top-14 left-5">
          {profile.role === 'professor' && !isMe ? (
            <div className="w-24 h-24 rounded-full bg-[var(--surface)] border-4 border-[var(--bg)] shadow-md flex items-center justify-center text-[var(--text-secondary)]">
              <User size={32} />
            </div>
          ) : profile.avatarBase64 ? (
            <img
              src={profile.avatarBase64}
              alt={profile.displayName}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full object-cover border-4 border-[var(--bg)] bg-[var(--bg)] shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[var(--surface)] border-4 border-[var(--bg)] shadow-md flex items-center justify-center font-black text-3xl text-[var(--text-secondary)]">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Action Button Row */}
        <div className="flex justify-end pt-3 h-11">
          {isMe ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 border border-[var(--border)] rounded-full text-xs font-black hover:bg-[var(--surface)] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={13} /> Edit Profile
            </button>
          ) : (
            hasPaidBooking ? (
              <button
                onClick={() => onNavigate('messages', { partnerId: profile.uid })}
                className="px-5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-full text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle size={13} /> Chat
              </button>
            ) : (
              <button
                disabled
                className="px-5 py-1.5 bg-[var(--border)] text-[var(--text-secondary)] rounded-full text-xs font-extrabold transition flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                title="You must have a paid validation contract to message this user."
              >
                <MessageCircle size={13} /> Chat Locked
              </button>
            )
          )}
        </div>

        {/* Text Titles */}
        <div className="flex flex-col text-left mt-1">
          <h1 className="font-black text-xl tracking-tight leading-none flex items-center gap-1.5">
            {profile.role === 'professor' && !isMe ? 'Anonymous Professor' : profile.displayName}
            {achievements.length > 0 && (
              <Shield size={16} className="text-[var(--validated)] fill-[var(--validated)]/10 shrink-0" />
            )}
          </h1>
          {!(profile.role === 'professor' && !isMe) && (
            <span className="text-xs text-[var(--text-secondary)] mt-0.5 font-bold">@{profile.handle}</span>
          )}
          <p className="text-sm font-extrabold text-[var(--accent)] mt-1.5 flex items-center gap-1">
            <Briefcase size={14} /> {profile.title || 'Peer Reviewer'}
          </p>
          <p className="text-xs text-[var(--text-primary)] mt-2 leading-relaxed font-semibold whitespace-pre-wrap max-w-xl">
            {profile.bio || 'This peer expert has not set a custom bio description yet.'}
          </p>
        </div>

        {/* Profile Statistics metrics banner */}
        <div className="flex items-center gap-6 py-1.5 text-xs font-bold text-[var(--text-secondary)] border-y border-[var(--border)]/40 mt-3">
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-primary)] font-black">{services.length}</span> Active Offers
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-primary)] font-black">{profile.stats?.bookingsCompleted || 0}</span> Audits Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[var(--text-primary)] font-black">{achievements.length}</span> Accomplishments
          </span>
        </div>
      </div>

      {/* 3. Navigation Subtabs row */}
      <div className="flex border-b border-[var(--border)] mt-4">
        {['services', 'achievements', 'reviews'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubtab(tab as any)}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition select-none cursor-pointer ${
              activeSubtab === tab
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab === 'services' && 'Services Offered'}
            {tab === 'achievements' && 'Certified Achievements'}
            {tab === 'reviews' && 'Peer Reviews'}
          </button>
        ))}
      </div>

      {/* 4. Tab Content Area */}
      <div className="p-4 flex flex-col gap-4">
        
        {/* SERVICES OFFERED TAB */}
        {activeSubtab === 'services' && (
          <div className="flex flex-col gap-3">
            {services.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-[var(--text-secondary)]">
                {isMe ? 'You have no active service listings. Offer a new service listing from the left sidebar!' : 'This provider is not hosting active service offers right now.'}
              </div>
            ) : (
              services.map((srv) => (
                <div key={srv.id} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] transition text-left flex flex-col gap-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full border border-[var(--accent)]/20">
                      {srv.category}
                    </span>
                    <span className="text-sm font-black text-[var(--text-primary)]">${srv.price}</span>
                  </div>
                  <h3 className="font-black text-sm text-[var(--text-primary)] leading-tight">{srv.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold">{srv.description}</p>
                  
                  {isMe ? (
                    <button
                      onClick={() => handleDeleteService(srv.id)}
                      className="self-end mt-2 text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                    >
                      Delete Offer
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBookValidation(srv)}
                      className="self-end mt-1 px-4 py-1.5 bg-[var(--text-primary)] text-[var(--bg)] font-bold text-xs rounded-lg hover:opacity-90 cursor-pointer"
                    >
                      Book Validation
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* PEER ACHIEVEMENTS TAB */}
        {activeSubtab === 'achievements' && (
          <div className="flex flex-col gap-4">
            
            {/* Add accomplishment triggers */}
            {isMe && !isAddingAchievement && (
              <button
                onClick={() => setIsAddingAchievement(true)}
                className="w-full py-3.5 border border-dashed border-[var(--border)] rounded-2xl flex items-center justify-center gap-2 hover:bg-[var(--surface)] transition text-xs font-black text-[var(--accent)] cursor-pointer"
              >
                <PlusCircle size={15} /> Add Peer Accomplishment
              </button>
            )}

            {/* Accomplishment Add Panel form */}
            {isAddingAchievement && (
              <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col gap-4 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs uppercase text-[var(--text-secondary)] tracking-wider">
                    Add New Certified Accomplishment
                  </h3>
                  <button
                    onClick={() => setIsAddingAchievement(false)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleAddAchievement} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Achievement Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Meta Certified Senior Native Developer"
                      value={newAchTitle}
                      onChange={(e) => setNewAchTitle(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Accomplishment Description & Proof explanation</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe your achievement, credential, or experience. Explain where peers can double check this validation proof..."
                      value={newAchDesc}
                      onChange={(e) => setNewAchDesc(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] p-3 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none leading-relaxed resize-none"
                    />
                  </div>

                  {/* Proof upload */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase flex items-center justify-between">
                      <span>Certification Media Proof (Base64)</span>
                      <span className="text-[8px] font-normal lowercase text-[var(--text-secondary)]">Certificate image, badge, or scan</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="px-4 py-2 bg-[var(--bg)] border border-[var(--border)] hover:bg-[var(--border)]/10 text-[var(--text-primary)] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition">
                        <Camera size={13} /> Select Image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofSelect}
                          className="hidden"
                        />
                      </label>
                      {newAchProof && (
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                          <Check size={12} /> Image uploaded successfully
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={newAchLoading}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2.5 rounded-xl transition mt-1 cursor-pointer"
                  >
                    {newAchLoading ? 'Adding...' : 'Post Certified Accomplishment'}
                  </button>
                </form>
              </div>
            )}

            {/* Achievements rendering list */}
            {achievements.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
                This user has not uploaded peer validation achievements yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {achievements.map((ach) => {
                  const currentUid = auth?.currentUser?.uid;
                  const hasEndorsed = ach.validatedBy?.includes(currentUid || '');
                  return (
                    <div
                      key={ach.id}
                      onClick={() => setSelectedAchievement(ach)}
                      className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-xs transition-all duration-200 text-left flex flex-col justify-between gap-4 cursor-pointer group relative"
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-8 h-8 rounded-full bg-[var(--validated)]/10 text-[var(--validated)] flex items-center justify-center border border-[var(--validated)]/20 shrink-0">
                            <BadgeCheck size={18} />
                          </div>
                          {isMe && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                showDialog(
                                  "Delete Peer Accomplishment",
                                  "Are you sure you want to delete this peer accomplishment?",
                                  "confirm",
                                  async () => {
                                    try {
                                      await dbService.deleteAchievement(profileId, ach.id);
                                      setAchievements(prev => prev.filter(a => a.id !== ach.id));
                                    } catch (e: any) {
                                      showDialog(
                                        "Delete Error",
                                        e.message || "Failed to delete peer accomplishment.",
                                        "error"
                                      );
                                    }
                                  },
                                  "Delete"
                                );
                              }}
                              className="text-[var(--text-secondary)] hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition shrink-0 cursor-pointer"
                              title="Delete accomplishment"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div>
                          <h3 className="font-black text-sm text-[var(--text-primary)] leading-snug tracking-tight group-hover:text-[var(--accent)] transition duration-150">
                            {ach.title}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold mt-1 line-clamp-3">
                            {ach.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--border)]/40 flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                        <div className="flex items-center gap-2">
                          <span className="bg-[var(--bg)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            {ach.validatedBy?.length || 0} Endorsement{ach.validatedBy?.length === 1 ? '' : 's'}
                          </span>
                          <span className="bg-[var(--bg)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                            {ach.critiques?.length || 0} Critique{ach.critiques?.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <span className="text-[var(--accent)] group-hover:underline flex items-center gap-0.5 font-black uppercase tracking-wide">
                          Audit & Critique →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* PEER REVIEWS TAB */}
        {activeSubtab === 'reviews' && (
          <div className="flex flex-col gap-3">
            {reviews.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-[var(--text-secondary)]">
                This validator expert has not received peer reviews yet. Complete validation jobs to earn certified recommendations!
              </div>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-left flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex gap-2 items-center cursor-pointer"
                      onClick={() => onNavigate('profile', { uid: rev.authorId })}
                    >
                      {rev.authorAvatar ? (
                        <img
                          src={rev.authorAvatar}
                          alt={rev.authorName}
                          className="w-7 h-7 rounded-full object-cover border border-[var(--border)]"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--bg)] flex items-center justify-center font-bold text-[10px]">
                          {rev.authorName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-[var(--text-primary)] font-bold">
                        {rev.authorName} <span className="text-[var(--text-secondary)] text-[10px]">@{rev.authorHandle}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < rev.rating ? 'fill-amber-500 stroke-amber-500' : 'text-[var(--text-secondary)]'}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-semibold whitespace-pre-wrap">
                    "{rev.comment}"
                  </p>
                  
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] self-end uppercase">
                    {new Date(rev.createdAt?.seconds * 1000 || rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Profile Editing Modal Overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[420px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
            
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="font-extrabold text-sm text-[var(--text-primary)]">Edit Profile Settings</span>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-secondary)] rounded-full transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleEditProfile} className="p-5 overflow-y-auto max-h-[75vh] flex flex-col gap-4">
              
              {/* Select avatar/banner */}
              <div className="flex justify-between items-center bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)]">
                <div className="flex flex-col gap-1 items-center">
                  <div className="relative">
                    {editAvatar ? (
                      <img src={editAvatar} alt="edit avatar" className="w-12 h-12 rounded-full object-cover border border-[var(--border)]" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[var(--bg)] flex items-center justify-center font-bold text-xs">A</div>
                    )}
                    <label className="absolute -bottom-1 -right-1 p-1 bg-[var(--accent)] text-white rounded-full border border-[var(--bg)] cursor-pointer">
                      <Camera size={10} />
                      <input type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                    </label>
                  </div>
                  <span className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Avatar</span>
                </div>

                <div className="flex flex-col gap-1 items-center">
                  <div className="relative">
                    {editBanner ? (
                      <img src={editBanner} alt="edit banner" className="w-24 h-12 object-cover rounded border border-[var(--border)]" />
                    ) : (
                      <div className="w-24 h-12 bg-[var(--bg)] rounded border border-[var(--border)]" />
                    )}
                    <label className="absolute -bottom-1 -right-1 p-1 bg-[var(--accent)] text-white rounded-full border border-[var(--bg)] cursor-pointer">
                      <Camera size={10} />
                      <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden" />
                    </label>
                  </div>
                  <span className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Banner Image</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase">Expert Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase">Bio Statement</label>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none leading-relaxed resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase">Interface Color Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {['light', 'dim', 'lightsout'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditTheme(t as any)}
                      className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition ${
                        editTheme === t
                          ? 'bg-[var(--accent)] text-white border-transparent'
                          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--border)]/10 text-[var(--text-primary)]'
                      }`}
                    >
                      {t === 'lightsout' ? 'Lights Out' : t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={editLoading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold text-xs py-2.5 rounded-xl transition mt-2 cursor-pointer"
              >
                {editLoading ? 'Saving...' : 'Save Settings'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Redesigned Detailed Achievement & Peer Critique Modal */}
      {selectedAchievement && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 text-left my-8 animate-in fade-in zoom-in-95 duration-200 relative max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--validated)]/10 text-[var(--validated)] flex items-center justify-center border border-[var(--validated)]/20 shrink-0">
                  <BadgeCheck size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-[var(--text-primary)] leading-tight">
                    {selectedAchievement.title}
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-0.5 uppercase tracking-wider">
                    Accomplishment Proof Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAchievement(null);
                  setNewCritiqueText('');
                }}
                className="text-xs font-black text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 hover:bg-[var(--surface)] rounded-md transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 text-xs max-h-[60vh] no-scrollbar">
              
              {/* Media Proof Preview */}
              {selectedAchievement.mediaBase64 ? (
                <div className="flex flex-col gap-1.5 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                  <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Certification Document Proof:</span>
                  <img
                    src={selectedAchievement.mediaBase64}
                    alt={selectedAchievement.title}
                    className="w-full h-auto max-h-56 object-contain rounded-lg border border-[var(--border)] bg-black/5"
                  />
                </div>
              ) : (
                <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)] text-center text-[var(--text-secondary)] font-semibold italic">
                  No visual document uploaded. This peer-validated accomplishment relies on direct professional reference and linked credentials.
                </div>
              )}

              {/* Description */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Accomplishment Description:</span>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed font-semibold whitespace-pre-wrap bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border)]">
                  {selectedAchievement.description}
                </p>
              </div>

              {/* Endorsements summary & Button */}
              <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Peer Endorsements ({selectedAchievement.validatedBy?.length || 0}):</span>
                  {selectedAchievement.validatedBy && selectedAchievement.validatedBy.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedAchievement.validatedBy.map((uid) => (
                        <button
                          key={uid}
                          onClick={() => {
                            setSelectedAchievement(null);
                            onNavigate('profile', { uid });
                          }}
                          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-0.5 rounded-md text-[10px] text-[var(--accent)] font-bold hover:underline"
                        >
                          @{uid.substring(0, 8)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[var(--text-secondary)] font-semibold italic mt-0.5">No peer endorsements yet. Be the first to validate!</p>
                  )}
                </div>

                {!isMe && (
                  <button
                    onClick={() => handleEndorseAchievement(selectedAchievement.id)}
                    disabled={selectedAchievement.validatedBy?.includes(currentUserProfile?.uid || '')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                      selectedAchievement.validatedBy?.includes(currentUserProfile?.uid || '')
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] cursor-pointer'
                    }`}
                  >
                    {selectedAchievement.validatedBy?.includes(currentUserProfile?.uid || '')
                      ? '✓ Endorsed'
                      : 'Endorse & Validate'}
                  </button>
                )}
              </div>

              {/* Peer Critiques Log */}
              <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)]/40">
                <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider flex items-center gap-1.5">
                  Peer Critiques & Evaluations ({selectedAchievement.critiques?.length || 0})
                </span>

                {selectedAchievement.critiques && selectedAchievement.critiques.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {selectedAchievement.critiques.map((crit) => (
                      <div key={crit.id} className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col gap-1 text-left">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => { setSelectedAchievement(null); onNavigate('profile', { uid: crit.authorId }); }}>
                            {crit.authorAvatar ? (
                              <img src={crit.authorAvatar} alt={crit.authorName} className="w-5 h-5 rounded-full object-cover border border-[var(--border)]" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[var(--bg)] flex items-center justify-center font-bold text-[8px] border border-[var(--border)]">
                                {crit.authorName?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-extrabold text-[11px] hover:underline">{crit.authorName}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">@{crit.authorHandle}</span>
                          </div>
                          <span className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">
                            {parseDate(crit.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-primary)] leading-relaxed font-semibold whitespace-pre-wrap mt-0.5">
                          {crit.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-[var(--surface)] rounded-xl border border-[var(--border)] border-dashed text-[var(--text-secondary)] font-semibold italic">
                    No peer critiques or comments have been published yet. Peer experts can post their criticisms below.
                  </div>
                )}

                {/* Critique Composer */}
                {currentUserProfile ? (
                  <form onSubmit={handlePostCritique} className="flex flex-col gap-2 mt-2">
                    <span className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider">Write a Peer Critique:</span>
                    <textarea
                      required
                      rows={2}
                      maxLength={300}
                      placeholder="Publish your audit, critique, or peer verification notes of this accomplishment proof..."
                      value={newCritiqueText}
                      onChange={(e) => setNewCritiqueText(e.target.value)}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] p-2.5 rounded-xl text-xs font-semibold focus:border-[var(--accent)] focus:outline-none leading-relaxed resize-none text-[var(--text-primary)]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingCritique || !newCritiqueText.trim()}
                        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-4 rounded-lg transition disabled:opacity-50"
                      >
                        {submittingCritique ? 'Posting...' : 'Publish Critique'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center text-[var(--text-secondary)] font-bold">
                    <button onClick={() => { setSelectedAchievement(null); onOpenAuth(); }} className="text-[var(--accent)] hover:underline">
                      Sign in or create account
                    </button> to write a professional critique.
                  </div>
                )}

              </div>

            </div>

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
