import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword as fbSignIn,
  createUserWithEmailAndPassword as fbCreateUser,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy, 
  onSnapshot, 
  runTransaction,
  deleteDoc,
  Timestamp,
  limit
} from 'firebase/firestore';
import { UserProfile, Service, Booking, Review, Notification, Conversation, Message, Report, Achievement } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyCaCunGU0tY9cHxgZprJLHfCN3JnpM4yKk",
  authDomain: "validink-main.firebaseapp.com",
  projectId: "validink-main",
  storageBucket: "validink-main.firebasestorage.app",
  messagingSenderId: "1035358637986",
  appId: "1:1035358637986:web:09eea90c419c8c5804acfb"
};

export let app;
export let auth: any = null;
export let db: any = null;
let useRealFirebase = true;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);
  useRealFirebase = true;
  console.log("Firebase initialized successfully in Real Mode.");
} catch (error) {
  console.warn("Firebase initialization failed or config has issues.", error);
  useRealFirebase = true;
}

export function isRealFirebaseActive(): boolean {
  return true;
}

export function setDatabaseMode(mode: 'real' | 'simulated') {
  // Simulator removed
}

// ==========================================
// LOCAL SIMULATED STORAGE ENGINE & SEED DATA
// ==========================================

const MOCK_USERS_KEY = 'valid_ink_mock_users';
const MOCK_HANDLES_KEY = 'valid_ink_mock_handles';
const MOCK_SERVICES_KEY = 'valid_ink_mock_services';
const MOCK_BOOKINGS_KEY = 'valid_ink_mock_bookings';
const MOCK_REVIEWS_KEY = 'valid_ink_mock_reviews';
const MOCK_CONVERSATIONS_KEY = 'valid_ink_mock_conversations';
const MOCK_MESSAGES_KEY = 'valid_ink_mock_messages';
const MOCK_NOTIFICATIONS_KEY = 'valid_ink_mock_notifications';
const MOCK_BLOCKS_KEY = 'valid_ink_mock_blocks';
const MOCK_ACHIEVEMENTS_KEY = 'valid_ink_mock_achievements';
const CURRENT_MOCK_USER_ID_KEY = 'valid_ink_current_mock_uid';

// Sample Seed Avatars & Images
const JANE_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80";
const JOHN_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";
const ALICE_AVATAR = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80";

const JANE_BANNER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80";
const JOHN_BANNER = "https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&auto=format&fit=crop&q=80";
const ALICE_BANNER = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80";

function getLocalJSON<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
}

function setLocalJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Initial seed function for rich marketplace experience
export function initializeMockDatabase() {
  if (!localStorage.getItem(MOCK_USERS_KEY)) {
    const seedUsers: Record<string, UserProfile> = {
      'jane_uid': {
        uid: 'jane_uid',
        displayName: 'Jane Doe',
        handle: 'janed',
        title: 'Senior React Architect & Auditor',
        bio: 'Ex-Google Staff Engineer. I specialize in React/Next.js codebase validation, high-performance tuning, and clean security audits. Let\'s make your code production-ready!',
        avatarBase64: JANE_AVATAR,
        bannerBase64: JANE_BANNER,
        profileComplete: true,
        themePreference: 'dim',
        stats: { servicesCount: 2, bookingsCompleted: 34, achievementsCount: 3 },
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      },
      'john_uid': {
        uid: 'john_uid',
        displayName: 'John Smith',
        handle: 'john_codes',
        title: 'Full-Stack Security Specialist',
        bio: 'Securing web applications and certifying penetration tests. Helping startups build reliable architectures without vulnerable points. 100+ projects reviewed.',
        avatarBase64: JOHN_AVATAR,
        bannerBase64: JOHN_BANNER,
        profileComplete: true,
        themePreference: 'light',
        stats: { servicesCount: 2, bookingsCompleted: 18, achievementsCount: 2 },
        createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
      },
      'alice_uid': {
        uid: 'alice_uid',
        displayName: 'Alice Carter',
        handle: 'alice_edits',
        title: 'Academic & Copywriting Editor',
        bio: 'PhD in Linguistics. Helping tech writers, researchers, and creators refine their pitches, essays, and documentation for elite clarity.',
        avatarBase64: ALICE_AVATAR,
        bannerBase64: ALICE_BANNER,
        profileComplete: true,
        themePreference: 'lightsout',
        stats: { servicesCount: 1, bookingsCompleted: 45, achievementsCount: 2 },
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      }
    };
    setLocalJSON(MOCK_USERS_KEY, seedUsers);

    const seedHandles = {
      'janed': 'jane_uid',
      'john_codes': 'john_uid',
      'alice_edits': 'alice_uid'
    };
    setLocalJSON(MOCK_HANDLES_KEY, seedHandles);

    const seedServices: Service[] = [
      {
        id: 'srv_jane_1',
        providerId: 'jane_uid',
        providerName: 'Jane Doe',
        providerHandle: 'janed',
        providerAvatar: JANE_AVATAR,
        providerTitle: 'Senior React Architect & Auditor',
        title: 'React & TypeScript High-Performance Codebase Audit',
        description: 'I will analyze your entire frontend repository. You will receive a detailed performance audit, memory leak analysis, clean file structures suggestions, and custom advice to boost load times and maintainability. Backed by 10+ years of high-volume UI scaling experience.',
        category: 'Code Review',
        price: 99,
        status: 'active',
        ratingAvg: 4.9,
        ratingCount: 24,
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'srv_jane_2',
        providerId: 'jane_uid',
        providerName: 'Jane Doe',
        providerHandle: 'janed',
        providerAvatar: JANE_AVATAR,
        providerTitle: 'Senior React Architect & Auditor',
        title: 'Architecture Review & Custom UI System Validation',
        description: 'Stuck planning a scalable component system? Send me your mockups, Figma files, or preliminary folder structures. I will write a structural design spec blueprint defining optimal state propagation, headless library selections, and design token setups.',
        category: 'Design Feedback',
        price: 150,
        status: 'active',
        ratingAvg: 4.8,
        ratingCount: 10,
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'srv_john_1',
        providerId: 'john_uid',
        providerName: 'John Smith',
        providerHandle: 'john_codes',
        providerAvatar: JOHN_AVATAR,
        providerTitle: 'Full-Stack Security Specialist',
        title: 'Express & Node.js Endpoint Security Pen-Testing',
        description: 'Validate your backend endpoints against OWASP Top 10 vulnerabilities. I will check for SQL injection risk, CSRF bypasses, token validity verification flaws, and database race conditions. You get a fully-certified PDF checklist to share with stakeholders.',
        category: 'Code Review',
        price: 120,
        status: 'active',
        ratingAvg: 5.0,
        ratingCount: 15,
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'srv_alice_1',
        providerId: 'alice_uid',
        providerName: 'Alice Carter',
        providerHandle: 'alice_edits',
        providerAvatar: ALICE_AVATAR,
        providerTitle: 'Academic & Copywriting Editor',
        title: 'Technical Resume & Cover Letter Premium Polishing',
        description: 'Stand out in FAANG screening. I will optimize your technical descriptions for high impact, correct grammatical layouts, and alignment with ATS keyword parsers. Includes 1-on-1 text consulting and 2 structural drafts.',
        category: 'Resume Review',
        price: 65,
        status: 'active',
        ratingAvg: 4.9,
        ratingCount: 45,
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
      }
    ];
    setLocalJSON(MOCK_SERVICES_KEY, seedServices);

    const seedAchievements: Record<string, Achievement[]> = {
      'jane_uid': [
        {
          id: 'ach_jane_1',
          title: 'Validated Senior Frontend Expert',
          description: 'Officially audited and verified as ex-Google Staff engineer with master level React experience.',
          validatedBy: ['alice_uid'],
          createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString()
        },
        {
          id: 'ach_jane_2',
          title: '30+ Successful Validations',
          description: 'Provided exemplary codebase auditing services to over thirty registered startups.',
          validatedBy: [],
          createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
        }
      ],
      'john_uid': [
        {
          id: 'ach_john_1',
          title: 'Certified Pentester (OSCP)',
          description: 'Credentials and OSCP verification proof uploaded and audited.',
          validatedBy: ['jane_uid'],
          createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
        }
      ],
      'alice_uid': [
        {
          id: 'ach_alice_1',
          title: 'Ivy League Academic Editor',
          description: 'Verified Columbia University PhD graduate with extensive journal review history.',
          validatedBy: ['jane_uid', 'john_uid'],
          createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
        }
      ]
    };
    setLocalJSON(MOCK_ACHIEVEMENTS_KEY, seedAchievements);

    const seedReviews: Review[] = [
      {
        id: 'rev_1',
        bookingId: 'bk_1',
        serviceId: 'srv_jane_1',
        authorId: 'john_uid',
        targetId: 'jane_uid',
        rating: 5,
        comment: 'Jane provided an incredibly detailed report! Pointed out three major re-render loops that completely saved our dashboard performance.',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        authorName: 'John Smith',
        authorAvatar: JOHN_AVATAR,
        authorHandle: 'john_codes'
      },
      {
        id: 'rev_2',
        bookingId: 'bk_2',
        serviceId: 'srv_alice_1',
        authorId: 'jane_uid',
        targetId: 'alice_uid',
        rating: 5,
        comment: 'Brilliant editor. She refactored my publication cover letter so that it flowed beautifully and had high confidence.',
        createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        authorName: 'Jane Doe',
        authorAvatar: JANE_AVATAR,
        authorHandle: 'janed'
      }
    ];
    setLocalJSON(MOCK_REVIEWS_KEY, seedReviews);

    // Initial Empty Bookings, Conversations, Messages, Notifications
    setLocalJSON(MOCK_BOOKINGS_KEY, []);
    setLocalJSON(MOCK_CONVERSATIONS_KEY, []);
    setLocalJSON(MOCK_MESSAGES_KEY, {});
    setLocalJSON(MOCK_NOTIFICATIONS_KEY, {});
    setLocalJSON(MOCK_BLOCKS_KEY, {});
  }
}

// ==========================================
// AUTHENTICATION SERVICE WRAPPER
// ==========================================

export const authService = {
  onAuthStateChanged: (callback: (user: any) => void) => {
    if (useRealFirebase && auth) {
      return fbOnAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          // Fetch complete profile from Firestore
          const profileDocRef = doc(db, 'users', fbUser.uid);
          const profileSnap = await getDoc(profileDocRef);
          if (profileSnap.exists()) {
            callback({
              uid: fbUser.uid,
              email: fbUser.email,
              ...profileSnap.data()
            });
          } else {
            // Document does not exist yet, they are starting onboarding
            callback({
              uid: fbUser.uid,
              email: fbUser.email,
              profileComplete: false
            });
          }
        } else {
          callback(null);
        }
      });
    } else {
      // Simulated Local Auth Listener
      const listener = () => {
        const mockUid = localStorage.getItem(CURRENT_MOCK_USER_ID_KEY);
        if (mockUid) {
          const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
          const currentProfile = users[mockUid];
          if (currentProfile) {
            callback({
              uid: mockUid,
              email: `${currentProfile.handle || 'user'}@validink.com`,
              ...currentProfile
            });
            return;
          }
        }
        callback(null);
      };
      
      // Execute immediately and listen to custom storage events or simple intervals
      listener();
      const interval = setInterval(listener, 1000);
      return () => clearInterval(interval);
    }
  },

  signIn: async (email: string, password: string): Promise<any> => {
    if (useRealFirebase && auth) {
      const cred = await fbSignIn(auth, email, password);
      // Fetch profile
      const profileSnap = await getDoc(doc(db, 'users', cred.user.uid));
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        ...(profileSnap.exists() ? profileSnap.data() : { profileComplete: false })
      };
    } else {
      // Find simulated user by handle/email
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      const targetHandle = email.split('@')[0].toLowerCase();
      const matchedUser = Object.values(users).find(u => u.handle.toLowerCase() === targetHandle || u.uid === email);
      
      if (matchedUser) {
        localStorage.setItem(CURRENT_MOCK_USER_ID_KEY, matchedUser.uid);
        return {
          uid: matchedUser.uid,
          email: `${matchedUser.handle}@validink.com`,
          ...matchedUser
        };
      } else {
        // Create an automatic mock user to make testing incredibly fluid!
        const newUid = `user_${Date.now()}`;
        const cleanHandle = targetHandle.replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 1000)}`;
        const newUser: UserProfile = {
          uid: newUid,
          displayName: email.split('@')[0],
          handle: cleanHandle,
          title: 'Reviewer Apprentice',
          bio: 'Passionate peer reviewer ready to build credit.',
          profileComplete: false,
          themePreference: 'light',
          stats: { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 },
          createdAt: new Date().toISOString()
        };
        users[newUid] = newUser;
        setLocalJSON(MOCK_USERS_KEY, users);
        
        // Register unique handle
        const handles = getLocalJSON<Record<string, string>>(MOCK_HANDLES_KEY, {});
        handles[cleanHandle] = newUid;
        setLocalJSON(MOCK_HANDLES_KEY, handles);
        
        localStorage.setItem(CURRENT_MOCK_USER_ID_KEY, newUid);
        return {
          uid: newUid,
          email,
          ...newUser
        };
      }
    }
  },

  signUp: async (email: string, password: string, profileData?: Partial<UserProfile>): Promise<any> => {
    if (useRealFirebase && auth) {
      const cred = await fbCreateUser(auth, email, password);
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        role: profileData?.role || 'student',
        displayName: profileData?.displayName || email.split('@')[0],
        handle: profileData?.handle || '', 
        title: profileData?.title || '',
        bio: profileData?.bio || '',
        avatarBase64: profileData?.avatarBase64 || '',
        profileComplete: profileData?.profileComplete || false,
        themePreference: 'light',
        stats: { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 },
        createdAt: Timestamp.now()
      };
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      if (profileData?.handle) {
        const cleanHandle = profileData.handle.toLowerCase().trim();
        await setDoc(doc(db, 'handles', cleanHandle), { uid: cred.user.uid });
      }
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        ...newProfile
      };
    } else {
      const newUid = `user_${Date.now()}`;
      const defaultHandle = profileData?.handle || email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 1000)}`;
      
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      const newUser: UserProfile = {
        uid: newUid,
        role: profileData?.role || 'student',
        displayName: profileData?.displayName || email.split('@')[0],
        handle: defaultHandle,
        title: profileData?.title || '',
        bio: profileData?.bio || '',
        avatarBase64: profileData?.avatarBase64 || '',
        profileComplete: profileData?.profileComplete || false,
        themePreference: 'light',
        stats: { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 },
        createdAt: new Date().toISOString()
      };
      users[newUid] = newUser;
      setLocalJSON(MOCK_USERS_KEY, users);

      const handles = getLocalJSON<Record<string, string>>(MOCK_HANDLES_KEY, {});
      handles[defaultHandle] = newUid;
      setLocalJSON(MOCK_HANDLES_KEY, handles);

      localStorage.setItem(CURRENT_MOCK_USER_ID_KEY, newUid);
      return {
        uid: newUid,
        email,
        ...newUser
      };
    }
  },

  signOut: async () => {
    if (useRealFirebase && auth) {
      await fbSignOut(auth);
    } else {
      localStorage.removeItem(CURRENT_MOCK_USER_ID_KEY);
    }
  },

  completeOnboarding: async (uid: string, profileData: any): Promise<UserProfile> => {
    const finalData = { ...profileData, profileComplete: true };
    await dbService.updateUserProfile(uid, finalData);
    const updated = await dbService.getUserProfile(uid);
    if (!updated) throw new Error("Onboarding error: Profile could not be resolved.");
    return updated;
  }
};

// ==========================================
// FIRESTORE / DATABASE SERVICE WRAPPER
// ==========================================

export const dbService = {
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    if (useRealFirebase && db) {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? (snap.data() as UserProfile) : null;
    } else {
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      return users[uid] || null;
    }
  },

  getAllUserProfiles: async (): Promise<UserProfile[]> => {
    if (useRealFirebase && db) {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserProfile);
    } else {
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      return Object.entries(users).map(([uid, u]) => ({ uid, ...u }));
    }
  },

  checkHandleUnique: async (handle: string): Promise<boolean> => {
    const cleanHandle = handle.toLowerCase().trim();
    if (useRealFirebase && db) {
      const snap = await getDoc(doc(db, 'handles', cleanHandle));
      return !snap.exists();
    } else {
      const handles = getLocalJSON<Record<string, string>>(MOCK_HANDLES_KEY, {});
      return !handles[cleanHandle];
    }
  },

  updateUserProfile: async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    if (useRealFirebase && db) {
      await updateDoc(doc(db, 'users', uid), data as any);
      
      // If handle changed, update uniqueness index
      if (data.handle) {
        const cleanHandle = data.handle.toLowerCase().trim();
        await setDoc(doc(db, 'handles', cleanHandle), { uid });
      }
    } else {
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      if (users[uid]) {
        const oldHandle = users[uid].handle;
        users[uid] = { ...users[uid], ...data } as UserProfile;
        setLocalJSON(MOCK_USERS_KEY, users);

        // Manage unique handle registration
        if (data.handle && data.handle !== oldHandle) {
          const handles = getLocalJSON<Record<string, string>>(MOCK_HANDLES_KEY, {});
          if (oldHandle) delete handles[oldHandle.toLowerCase()];
          handles[data.handle.toLowerCase()] = uid;
          setLocalJSON(MOCK_HANDLES_KEY, handles);
        }
      }
    }
  },

  // Achievements
  getAchievements: async (uid: string): Promise<Achievement[]> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'users', uid, 'achievements'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Achievement);
    } else {
      const achs = getLocalJSON<Record<string, Achievement[]>>(MOCK_ACHIEVEMENTS_KEY, {});
      return achs[uid] || [];
    }
  },

  addAchievement: async (uid: string, title: string, description: string, mediaBase64?: string): Promise<void> => {
    const newAch = {
      title,
      description,
      mediaBase64: mediaBase64 || '',
      validatedBy: [],
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      const colRef = collection(db, 'users', uid, 'achievements');
      await addDoc(colRef, newAch);
      
      // Increment user stats
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const stats = snap.data().stats || { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 };
        await updateDoc(userRef, {
          'stats.achievementsCount': (stats.achievementsCount || 0) + 1
        });
      }
    } else {
      const achs = getLocalJSON<Record<string, Achievement[]>>(MOCK_ACHIEVEMENTS_KEY, {});
      if (!achs[uid]) achs[uid] = [];
      
      const item: Achievement = {
        id: `ach_${Date.now()}`,
        ...newAch,
        createdAt: new Date().toISOString()
      };
      achs[uid].unshift(item);
      setLocalJSON(MOCK_ACHIEVEMENTS_KEY, achs);

      // Increment stats
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      if (users[uid]) {
        users[uid].stats.achievementsCount = (users[uid].stats.achievementsCount || 0) + 1;
        setLocalJSON(MOCK_USERS_KEY, users);
      }
    }
  },

  deleteAchievement: async (uid: string, achievementId: string): Promise<void> => {
    if (useRealFirebase && db) {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', uid, 'achievements', achievementId));

      // Decrement user stats
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const stats = snap.data().stats || { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 };
        await updateDoc(userRef, {
          'stats.achievementsCount': Math.max(0, (stats.achievementsCount || 0) - 1)
        });
      }
    } else {
      const achs = getLocalJSON<Record<string, Achievement[]>>(MOCK_ACHIEVEMENTS_KEY, {});
      if (achs[uid]) {
        achs[uid] = achs[uid].filter(a => a.id !== achievementId);
        setLocalJSON(MOCK_ACHIEVEMENTS_KEY, achs);
      }

      // Decrement stats
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      if (users[uid]) {
        users[uid].stats.achievementsCount = Math.max(0, (users[uid].stats.achievementsCount || 0) - 1);
        setLocalJSON(MOCK_USERS_KEY, users);
      }
    }
  },

  endorseAchievement: async (providerUid: string, achievementId: string, endorserUid: string): Promise<void> => {
    if (useRealFirebase && db) {
      const docRef = doc(db, 'users', providerUid, 'achievements', achievementId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const currentVals = snap.data().validatedBy || [];
        if (!currentVals.includes(endorserUid)) {
          await updateDoc(docRef, {
            validatedBy: [...currentVals, endorserUid]
          });
        }
      }
    } else {
      const achs = getLocalJSON<Record<string, Achievement[]>>(MOCK_ACHIEVEMENTS_KEY, {});
      if (achs[providerUid]) {
        const achIndex = achs[providerUid].findIndex(a => a.id === achievementId);
        if (achIndex !== -1) {
          const ach = achs[providerUid][achIndex];
          if (!ach.validatedBy.includes(endorserUid)) {
            ach.validatedBy.push(endorserUid);
            setLocalJSON(MOCK_ACHIEVEMENTS_KEY, achs);
          }
        }
      }
    }
  },

  addAchievementCritique: async (
    providerUid: string,
    achievementId: string,
    authorUid: string,
    authorName: string,
    authorHandle: string,
    authorAvatar: string | undefined,
    text: string
  ): Promise<void> => {
    const newCritique = {
      id: `crit_${Date.now()}`,
      authorId: authorUid,
      authorName,
      authorHandle,
      authorAvatar: authorAvatar || '',
      text,
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      const docRef = doc(db, 'users', providerUid, 'achievements', achievementId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const currentCritiques = snap.data().critiques || [];
        await updateDoc(docRef, {
          critiques: [...currentCritiques, newCritique]
        });
      }
    } else {
      const achs = getLocalJSON<Record<string, Achievement[]>>(MOCK_ACHIEVEMENTS_KEY, {});
      if (achs[providerUid]) {
        const achIndex = achs[providerUid].findIndex(a => a.id === achievementId);
        if (achIndex !== -1) {
          const ach = achs[providerUid][achIndex];
          if (!ach.critiques) ach.critiques = [];
          ach.critiques.push(newCritique);
          setLocalJSON(MOCK_ACHIEVEMENTS_KEY, achs);
        }
      }
    }
  },

  // Services
  getServices: async (category?: string): Promise<Service[]> => {
    if (useRealFirebase && db) {
      let q = query(collection(db, 'services'), where('status', '==', 'active'));
      if (category && category !== 'All') {
        q = query(collection(db, 'services'), where('category', '==', category), where('status', '==', 'active'));
      }
      const snap = await getDocs(q);
      const services = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Service);
      
      // Attach provider details dynamically to ensure up-to-date handles & avatars
      for (const s of services) {
        const pSnap = await getDoc(doc(db, 'users', s.providerId));
        if (pSnap.exists()) {
          const p = pSnap.data();
          s.providerName = p.displayName;
          s.providerHandle = p.handle;
          s.providerAvatar = p.avatarBase64;
          s.providerTitle = p.title;
        }
      }
      // Sort client-side by createdAt descending
      services.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return services;
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      
      let filtered = services.filter(s => s.status === 'active');
      if (category && category !== 'All') {
        filtered = filtered.filter(s => s.category === category);
      }
      
      // Inject actual provider profile details
      return filtered.map(s => {
        const p = users[s.providerId];
        return p ? {
          ...s,
          providerName: p.displayName,
          providerHandle: p.handle,
          providerAvatar: p.avatarBase64,
          providerTitle: p.title
        } : s;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  getService: async (serviceId: string): Promise<Service | null> => {
    if (useRealFirebase && db) {
      const snap = await getDoc(doc(db, 'services', serviceId));
      if (snap.exists()) {
        const s = { id: snap.id, ...snap.data() } as Service;
        const pSnap = await getDoc(doc(db, 'users', s.providerId));
        if (pSnap.exists()) {
          const p = pSnap.data();
          s.providerName = p.displayName;
          s.providerHandle = p.handle;
          s.providerAvatar = p.avatarBase64;
          s.providerTitle = p.title;
        }
        return s;
      }
      return null;
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      const s = services.find(x => x.id === serviceId);
      if (!s) return null;
      const p = users[s.providerId];
      return p ? {
        ...s,
        providerName: p.displayName,
        providerHandle: p.handle,
        providerAvatar: p.avatarBase64,
        providerTitle: p.title
      } : s;
    }
  },

  createService: async (uid: string, title: string, description: string, category: string, price: number): Promise<void> => {
    // Validate that the user is a professor
    const userProfile = await dbService.getUserProfile(uid);
    if (userProfile?.role !== 'professor') {
      throw new Error("Only professors can offer validation services.");
    }

    const srvData = {
      providerId: uid,
      title,
      description,
      category,
      price,
      status: 'active' as const,
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString(),
      updatedAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      await addDoc(collection(db, 'services'), srvData);
      
      // Increment stats
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const stats = snap.data().stats || { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 };
        await updateDoc(userRef, {
          'stats.servicesCount': (stats.servicesCount || 0) + 1
        });
      }
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const newSrv: Service = {
        id: `srv_${Date.now()}`,
        ...srvData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      services.unshift(newSrv);
      setLocalJSON(MOCK_SERVICES_KEY, services);

      // Increment stats
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      if (users[uid]) {
        users[uid].stats.servicesCount = (users[uid].stats.servicesCount || 0) + 1;
        setLocalJSON(MOCK_USERS_KEY, users);
      }
    }
  },

  deleteService: async (serviceId: string, providerId: string): Promise<void> => {
    if (useRealFirebase && db) {
      // Set to archived to protect historic data
      await updateDoc(doc(db, 'services', serviceId), { status: 'archived' });
      const userRef = doc(db, 'users', providerId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const stats = snap.data().stats || { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 };
        await updateDoc(userRef, {
          'stats.servicesCount': Math.max(0, (stats.servicesCount || 0) - 1)
        });
      }
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const matched = services.find(s => s.id === serviceId);
      if (matched) {
        matched.status = 'archived';
        setLocalJSON(MOCK_SERVICES_KEY, services);

        const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
        if (users[providerId]) {
          users[providerId].stats.servicesCount = Math.max(0, (users[providerId].stats.servicesCount || 0) - 1);
          setLocalJSON(MOCK_USERS_KEY, users);
        }
      }
    }
  },

  getServicesByProvider: async (providerId: string): Promise<Service[]> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'services'), where('providerId', '==', providerId));
      const snap = await getDocs(q);
      const services = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Service);
      for (const s of services) {
        const pSnap = await getDoc(doc(db, 'users', s.providerId));
        if (pSnap.exists()) {
          const p = pSnap.data();
          s.providerName = p.displayName;
          s.providerHandle = p.handle;
          s.providerAvatar = p.avatarBase64;
          s.providerTitle = p.title;
        }
      }
      services.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return services.filter(s => s.status !== 'archived');
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      const filtered = services.filter(s => s.providerId === providerId && s.status !== 'archived');
      return filtered.map(s => {
        const p = users[s.providerId];
        return p ? {
          ...s,
          providerName: p.displayName,
          providerHandle: p.handle,
          providerAvatar: p.avatarBase64,
          providerTitle: p.title
        } : s;
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  // Bookings (Revised Race-Free Architecture)
  getBookings: async (uid: string, asProvider: boolean): Promise<Booking[]> => {
    if (useRealFirebase && db) {
      const field = asProvider ? 'providerId' : 'clientId';
      const q = query(collection(db, 'bookings'), where(field, '==', uid));
      const snap = await getDocs(q);
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking);
      
      for (const b of bookings) {
        // Fetch service title/price
        const sSnap = await getDoc(doc(db, 'services', b.serviceId));
        if (sSnap.exists()) {
          b.serviceTitle = sSnap.data().title;
          b.servicePrice = sSnap.data().price;
        }

        // Fetch client and provider details
        const cSnap = await getDoc(doc(db, 'users', b.clientId));
        if (cSnap.exists()) {
          b.clientName = cSnap.data().displayName;
          b.clientHandle = cSnap.data().handle;
          b.clientAvatar = cSnap.data().avatarBase64;
        }

        const pSnap = await getDoc(doc(db, 'users', b.providerId));
        if (pSnap.exists()) {
          const isProfessor = pSnap.data().role === 'professor';
          b.providerName = isProfessor ? 'Anonymous Professor' : pSnap.data().displayName;
          b.providerHandle = isProfessor ? 'professor' : pSnap.data().handle;
          b.providerAvatar = isProfessor ? undefined : pSnap.data().avatarBase64;
        }
      }
      bookings.sort((a, b) => {
        const timeA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0).getTime();
        const timeB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA;
      });
      return bookings;
    } else {
      const bookings = getLocalJSON<Booking[]>(MOCK_BOOKINGS_KEY, []);
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});

      const myBookings = bookings.filter(b => asProvider ? b.providerId === uid : b.clientId === uid);
      
      return myBookings.map(b => {
        const s = services.find(x => x.id === b.serviceId);
        const c = users[b.clientId];
        const p = users[b.providerId];
        const isProfessor = p?.role === 'professor';

        return {
          ...b,
          serviceTitle: s?.title || 'Unknown Service',
          servicePrice: s?.price || 0,
          clientName: c?.displayName || 'Client',
          clientHandle: c?.handle || 'client',
          clientAvatar: c?.avatarBase64,
          providerName: isProfessor ? 'Anonymous Professor' : (p?.displayName || 'Provider'),
          providerHandle: isProfessor ? 'professor' : (p?.handle || 'provider'),
          providerAvatar: isProfessor ? undefined : p?.avatarBase64
        };
      }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  },

  createBooking: async (serviceId: string, clientId: string): Promise<void> => {
    if (useRealFirebase && db) {
      // We implement the transaction pattern
      await runTransaction(db, async (transaction) => {
        const srvRef = doc(db, 'services', serviceId);
        const bookingRef = doc(db, 'bookings', serviceId); // Deterministic bookingId == serviceId

        const srvSnap = await transaction.get(srvRef);
        const bookingSnap = await transaction.get(bookingRef);

        if (!srvSnap.exists()) throw new Error("Service does not exist");
        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data();
          if (bookingData.status === 'pending' || bookingData.status === 'accepted') {
            throw new Error("Service has already been booked or is in negotiation");
          }
        }

        const srvData = srvSnap.data();
        if (srvData.status !== 'active') throw new Error("Service is no longer active");
        if (srvData.providerId === clientId) throw new Error("You cannot book your own service");

        // Execute lock atomic actions (set overwrites any previous cancelled/declined/completed booking)
        transaction.set(bookingRef, {
          serviceId,
          clientId,
          providerId: srvData.providerId,
          status: 'pending',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        transaction.update(srvRef, { status: 'pending' });
      });

      // Send alert notification to the Provider
      const srvSnap = await getDoc(doc(db, 'services', serviceId));
      if (srvSnap.exists()) {
        const providerId = srvSnap.data().providerId;
        const clientSnap = await getDoc(doc(db, 'users', clientId));
        await dbService.createNotification(providerId, 'booking_request', {
          bookingId: serviceId,
          serviceId,
          senderId: clientId,
          senderName: clientSnap.exists() ? clientSnap.data().displayName : 'A client'
        });
      }
    } else {
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const bookings = getLocalJSON<Booking[]>(MOCK_BOOKINGS_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});

      const sIndex = services.findIndex(s => s.id === serviceId);
      if (sIndex === -1) throw new Error("Service not found");
      
      const srv = services[sIndex];
      if (srv.status !== 'active') throw new Error("Service is already booked or pending");
      if (srv.providerId === clientId) throw new Error("Cannot book your own service");

      // Set booking and status
      const existingIndex = bookings.findIndex(b => b.id === serviceId);
      if (existingIndex !== -1) {
        const existing = bookings[existingIndex];
        if (existing.status === 'pending' || existing.status === 'accepted') {
          throw new Error("Service has already been booked or is in negotiation");
        }
        // Remove or replace previous booking to allow fresh book
        bookings.splice(existingIndex, 1);
      }

      const newBooking: Booking = {
        id: serviceId,
        serviceId,
        clientId,
        providerId: srv.providerId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      bookings.push(newBooking);
      services[sIndex].status = 'pending';

      setLocalJSON(MOCK_BOOKINGS_KEY, bookings);
      setLocalJSON(MOCK_SERVICES_KEY, services);

      // Create notification
      const clientName = users[clientId]?.displayName || 'A client';
      await dbService.createNotification(srv.providerId, 'booking_request', {
        bookingId: serviceId,
        serviceId,
        senderId: clientId,
        senderName: clientName
      });
    }
  },

  updateBookingSessionId: async (bookingId: string, sessionId: string): Promise<void> => {
    if (useRealFirebase && db) {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { paymongoSessionId: sessionId });
    } else {
      const bookings = getLocalJSON<Booking[]>(MOCK_BOOKINGS_KEY, []);
      const bIndex = bookings.findIndex(b => b.id === bookingId);
      if (bIndex !== -1) {
        bookings[bIndex].paymongoSessionId = sessionId;
        setLocalJSON(MOCK_BOOKINGS_KEY, bookings);
      }
    }
  },
  updateBookingStatus: async (bookingId: string, newStatus: 'accepted' | 'declined' | 'completed' | 'cancelled' | 'paid'): Promise<void> => {
    if (useRealFirebase && db) {
      await runTransaction(db, async (transaction) => {
        const bookingRef = doc(db, 'bookings', bookingId);
        const srvRef = doc(db, 'services', bookingId);

        const bSnap = await transaction.get(bookingRef);
        if (!bSnap.exists()) throw new Error("Booking not found");
        
        const bData = bSnap.data();

        // Security check for state transitions
        if (newStatus === 'paid' && bData.status !== 'accepted') {
          throw new Error("Validation request must be accepted by the professor before payment can be processed.");
        }
        if (newStatus === 'accepted' && bData.status !== 'pending') {
          throw new Error("Only pending booking requests can be accepted.");
        }

        let finalServiceStatus: string = 'active';

        if (newStatus === 'accepted') {
          finalServiceStatus = 'booked';
        } else if (newStatus === 'paid') {
          finalServiceStatus = 'booked';
        } else if (newStatus === 'completed') {
          finalServiceStatus = 'completed';
        } else if (newStatus === 'declined' || newStatus === 'cancelled') {
          finalServiceStatus = 'active';
        }

        transaction.update(bookingRef, {
          status: newStatus,
          updatedAt: Timestamp.now()
        });

        transaction.update(srvRef, {
          status: finalServiceStatus,
          updatedAt: Timestamp.now()
        });
      });

      // Trigger respective real-time notifications
      const bSnap = await getDoc(doc(db, 'bookings', bookingId));
      if (bSnap.exists()) {
        const b = bSnap.data();
        if (newStatus === 'accepted') {
          await dbService.createNotification(b.clientId, 'booking_accepted', { bookingId, serviceId: b.serviceId });
        } else if (newStatus === 'declined') {
          await dbService.createNotification(b.clientId, 'booking_declined', { bookingId, serviceId: b.serviceId });
        } else if (newStatus === 'paid') {
          await dbService.createNotification(b.providerId, 'booking_paid', { bookingId, serviceId: b.serviceId, senderId: b.clientId });
          await dbService.createNotification(b.clientId, 'booking_paid', { bookingId, serviceId: b.serviceId, senderId: b.providerId });
        }

        // Increment provider completed counts on complete
        if (newStatus === 'completed') {
          const userRef = doc(db, 'users', b.providerId);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const stats = snap.data().stats || { servicesCount: 0, bookingsCompleted: 0, achievementsCount: 0 };
            await updateDoc(userRef, {
              'stats.bookingsCompleted': (stats.bookingsCompleted || 0) + 1
            });
          }
        }
      }
    } else {
      const bookings = getLocalJSON<Booking[]>(MOCK_BOOKINGS_KEY, []);
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);

      const bIndex = bookings.findIndex(b => b.id === bookingId);
      const sIndex = services.findIndex(s => s.id === bookingId);

      if (bIndex !== -1) {
        const b = bookings[bIndex];

        // Security check for state transitions in simulated mode
        if (newStatus === 'paid' && b.status !== 'accepted') {
          throw new Error("Validation request must be accepted by the professor before payment can be processed.");
        }
        if (newStatus === 'accepted' && b.status !== 'pending') {
          throw new Error("Only pending booking requests can be accepted.");
        }

        b.status = newStatus;
        b.updatedAt = new Date().toISOString();

        if (sIndex !== -1) {
          if (newStatus === 'accepted') {
            services[sIndex].status = 'booked';
          } else if (newStatus === 'paid') {
            services[sIndex].status = 'booked';
          } else if (newStatus === 'completed') {
            services[sIndex].status = 'completed';
          } else if (newStatus === 'declined' || newStatus === 'cancelled') {
            services[sIndex].status = 'active';
          }
          services[sIndex].updatedAt = new Date().toISOString();
        }

        setLocalJSON(MOCK_BOOKINGS_KEY, bookings);
        setLocalJSON(MOCK_SERVICES_KEY, services);

        // Notify
        if (newStatus === 'accepted') {
          await dbService.createNotification(b.clientId, 'booking_accepted', { bookingId, serviceId: b.serviceId });
        } else if (newStatus === 'declined') {
          await dbService.createNotification(b.clientId, 'booking_declined', { bookingId, serviceId: b.serviceId });
        } else if (newStatus === 'paid') {
          await dbService.createNotification(b.providerId, 'booking_paid', { bookingId, serviceId: b.serviceId, senderId: b.clientId });
          await dbService.createNotification(b.clientId, 'booking_paid', { bookingId, serviceId: b.serviceId, senderId: b.providerId });
        }

        if (newStatus === 'completed') {
          const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
          if (users[b.providerId]) {
            users[b.providerId].stats.bookingsCompleted = (users[b.providerId].stats.bookingsCompleted || 0) + 1;
            setLocalJSON(MOCK_USERS_KEY, users);
          }
        }
      }
    }
  },

  // Reviews
  getReviews: async (targetId: string): Promise<Review[]> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'reviews'), where('targetId', '==', targetId));
      const snap = await getDocs(q);
      const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Review);
      
      for (const r of reviews) {
        const pSnap = await getDoc(doc(db, 'users', r.authorId));
        if (pSnap.exists()) {
          r.authorName = pSnap.data().displayName;
          r.authorAvatar = pSnap.data().avatarBase64;
          r.authorHandle = pSnap.data().handle;
        }
      }
      reviews.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return reviews;
    } else {
      const reviews = getLocalJSON<Review[]>(MOCK_REVIEWS_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});

      return reviews.filter(r => r.targetId === targetId).map(r => {
        const author = users[r.authorId];
        return {
          ...r,
          authorName: author?.displayName || 'Reviewer',
          authorAvatar: author?.avatarBase64,
          authorHandle: author?.handle || 'reviewer'
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  },

  getReviewsForUser: async (targetId: string): Promise<Review[]> => {
    return dbService.getReviews(targetId);
  },

  createAchievement: async (uid: string, title: string, description: string, mediaBase64?: string): Promise<void> => {
    return dbService.addAchievement(uid, title, description, mediaBase64);
  },

  createReview: async (bookingId: string, serviceId: string, authorId: string, targetId: string, rating: number, comment: string): Promise<void> => {
    const revData = {
      bookingId,
      serviceId,
      authorId,
      targetId,
      rating,
      comment,
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      await setDoc(doc(db, 'reviews', bookingId), revData);

      // Recalculate average rating denormalized
      const q = query(collection(db, 'reviews'), where('serviceId', '==', serviceId));
      const rSnap = await getDocs(q);
      const allReviews = rSnap.docs.map(d => d.data());
      const ratingCount = allReviews.length;
      const sum = allReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
      const ratingAvg = ratingCount > 0 ? parseFloat((sum / ratingCount).toFixed(1)) : 0;

      await updateDoc(doc(db, 'services', serviceId), { ratingAvg, ratingCount });
      
      // Notify provider
      const clientSnap = await getDoc(doc(db, 'users', authorId));
      await dbService.createNotification(targetId, 'review_received', {
        bookingId,
        senderId: authorId,
        senderName: clientSnap.exists() ? clientSnap.data().displayName : 'A user'
      });
    } else {
      const reviews = getLocalJSON<Review[]>(MOCK_REVIEWS_KEY, []);
      const services = getLocalJSON<Service[]>(MOCK_SERVICES_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});

      const newRev: Review = {
        id: bookingId,
        ...revData,
        createdAt: new Date().toISOString()
      };
      reviews.push(newRev);
      setLocalJSON(MOCK_REVIEWS_KEY, reviews);

      // Recalculate average rating
      const serviceReviews = reviews.filter(r => r.serviceId === serviceId);
      const ratingCount = serviceReviews.length;
      const sum = serviceReviews.reduce((acc, curr) => acc + curr.rating, 0);
      const ratingAvg = ratingCount > 0 ? parseFloat((sum / ratingCount).toFixed(1)) : 0;

      const sIndex = services.findIndex(s => s.id === serviceId);
      if (sIndex !== -1) {
        services[sIndex].ratingAvg = ratingAvg;
        services[sIndex].ratingCount = ratingCount;
        setLocalJSON(MOCK_SERVICES_KEY, services);
      }

      const clientName = users[authorId]?.displayName || 'A user';
      await dbService.createNotification(targetId, 'review_received', {
        bookingId,
        senderId: authorId,
        senderName: clientName
      });
    }
  },

  // Conversations & Real-Time Messaging
  getConversations: async (uid: string): Promise<Conversation[]> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
      const snap = await getDocs(q);
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation);
      
      for (const c of convs) {
        const profiles: Record<string, Partial<UserProfile>> = {};
        for (const pId of c.participants) {
          const uSnap = await getDoc(doc(db, 'users', pId));
          if (uSnap.exists()) {
            profiles[pId] = {
              displayName: uSnap.data().displayName,
              handle: uSnap.data().handle,
              avatarBase64: uSnap.data().avatarBase64
            };
          }
        }
        c.participantProfiles = profiles;
      }
      return convs;
    } else {
      const convs = getLocalJSON<Conversation[]>(MOCK_CONVERSATIONS_KEY, []);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});

      const filtered = convs.filter(c => c.participants.includes(uid));
      return filtered.map(c => {
        const profiles: Record<string, Partial<UserProfile>> = {};
        c.participants.forEach(pId => {
          const u = users[pId];
          if (u) {
            profiles[pId] = {
              displayName: u.displayName,
              handle: u.handle,
              avatarBase64: u.avatarBase64
            };
          }
        });
        return {
          ...c,
          participantProfiles: profiles
        };
      }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
    }
  },

  listenConversations: (uid: string, callback: (convs: Conversation[]) => void) => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
      return onSnapshot(q, async (snap) => {
        const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation);
        for (const c of convs) {
          const profiles: Record<string, Partial<UserProfile>> = {};
          for (const pId of c.participants) {
            const uSnap = await getDoc(doc(db, 'users', pId));
            if (uSnap.exists()) {
              profiles[pId] = {
                displayName: uSnap.data().displayName,
                handle: uSnap.data().handle,
                avatarBase64: uSnap.data().avatarBase64
              };
            }
          }
          c.participantProfiles = profiles;
        }
        callback(convs);
      });
    } else {
      const listener = () => {
        const convs = getLocalJSON<Conversation[]>(MOCK_CONVERSATIONS_KEY, []);
        const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
        const filtered = convs.filter(c => c.participants.includes(uid));
        const mapped = filtered.map(c => {
          const profiles: Record<string, Partial<UserProfile>> = {};
          c.participants.forEach(pId => {
            const u = users[pId];
            if (u) {
              profiles[pId] = {
                displayName: u.displayName,
                handle: u.handle,
                avatarBase64: u.avatarBase64
              };
            }
          });
          return {
            ...c,
            participantProfiles: profiles
          };
        }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        callback(mapped);
      };
      listener();
      const interval = setInterval(listener, 1000);
      return () => clearInterval(interval);
    }
  },

  searchUsersByHandle: async (queryStr: string): Promise<UserProfile[]> => {
    const clean = queryStr.toLowerCase().trim();
    if (!clean) return [];
    if (useRealFirebase && db) {
      const q = query(
        collection(db, 'users'),
        where('handle', '>=', clean),
        where('handle', '<=', clean + '\uf8ff'),
        limit(10)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as UserProfile);
    } else {
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      return Object.values(users)
        .filter(u => u.handle.toLowerCase().includes(clean) || u.displayName.toLowerCase().includes(clean))
        .slice(0, 10);
    }
  },

  checkConversationExists: async (uid1: string, uid2: string): Promise<boolean> => {
    const parts = [uid1, uid2].sort();
    const id = parts.join('_');
    if (useRealFirebase && db) {
      const docRef = doc(db, 'conversations', id);
      const snap = await getDoc(docRef);
      return snap.exists();
    } else {
      const convs = getLocalJSON<Conversation[]>(MOCK_CONVERSATIONS_KEY, []);
      return !!convs.find(c => c.id === id);
    }
  },

  getOrCreateConversation: async (uid1: string, uid2: string): Promise<string> => {
    const parts = [uid1, uid2].sort();
    const id = parts.join('_');

    if (useRealFirebase && db) {
      const docRef = doc(db, 'conversations', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          participants: parts,
          lastMessage: '',
          lastMessageAt: Timestamp.now()
        });
      }
      return id;
    } else {
      const convs = getLocalJSON<Conversation[]>(MOCK_CONVERSATIONS_KEY, []);
      const existing = convs.find(c => c.id === id);
      if (!existing) {
        convs.push({
          id,
          participants: parts,
          lastMessage: '',
          lastMessageAt: new Date().toISOString()
        });
        setLocalJSON(MOCK_CONVERSATIONS_KEY, convs);
      }
      return id;
    }
  },

  listenMessages: (convId: string, callback: (msgs: Message[]) => void) => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'));
      return onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Message);
        callback(msgs);
      });
    } else {
      // Simulate polling/local updates
      const listener = () => {
        const allMsgs = getLocalJSON<Record<string, Message[]>>(MOCK_MESSAGES_KEY, {});
        callback(allMsgs[convId] || []);
      };
      listener();
      const interval = setInterval(listener, 1000);
      return () => clearInterval(interval);
    }
  },

  sendMessage: async (convId: string, senderId: string, text: string): Promise<void> => {
    const msgData = {
      senderId,
      text,
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      await addDoc(collection(db, 'conversations', convId, 'messages'), msgData);
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: text,
        lastMessageAt: Timestamp.now()
      });

      // Notify recipient
      const parts = convId.split('_');
      const otherId = parts.find(p => p !== senderId);
      if (otherId) {
        const senderSnap = await getDoc(doc(db, 'users', senderId));
        await dbService.createNotification(otherId, 'new_message', {
          conversationId: convId,
          senderId,
          senderName: senderSnap.exists() ? senderSnap.data().displayName : 'Someone'
        });
      }
    } else {
      const allMsgs = getLocalJSON<Record<string, Message[]>>(MOCK_MESSAGES_KEY, {});
      if (!allMsgs[convId]) allMsgs[convId] = [];
      
      const newMsg: Message = {
        id: `msg_${Date.now()}`,
        ...msgData,
        createdAt: new Date().toISOString()
      };
      allMsgs[convId].push(newMsg);
      setLocalJSON(MOCK_MESSAGES_KEY, allMsgs);

      // Update conversation lastMessage
      const convs = getLocalJSON<Conversation[]>(MOCK_CONVERSATIONS_KEY, []);
      const cIndex = convs.findIndex(c => c.id === convId);
      if (cIndex !== -1) {
        convs[cIndex].lastMessage = text;
        convs[cIndex].lastMessageAt = new Date().toISOString();
        setLocalJSON(MOCK_CONVERSATIONS_KEY, convs);
      }

      // Notify recipient
      const parts = convId.split('_');
      const otherId = parts.find(p => p !== senderId);
      const users = getLocalJSON<Record<string, UserProfile>>(MOCK_USERS_KEY, {});
      if (otherId) {
        const senderName = users[senderId]?.displayName || 'Someone';
        await dbService.createNotification(otherId, 'new_message', {
          conversationId: convId,
          senderId,
          senderName
        });
      }
    }
  },

  // Notifications
  getNotifications: async (uid: string): Promise<Notification[]> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notification);
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      return notifs[uid] || [];
    }
  },

  listenNotifications: (uid: string, callback: (notifs: Notification[]) => void) => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notification);
        callback(notifs);
      });
    } else {
      const listener = () => {
        const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
        callback(notifs[uid] || []);
      };
      listener();
      const interval = setInterval(listener, 1000);
      return () => clearInterval(interval);
    }
  },

  createNotification: async (targetUid: string, type: string, payload: any): Promise<void> => {
    const notifData = {
      type,
      payload,
      read: false,
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      await addDoc(collection(db, 'users', targetUid, 'notifications'), notifData);
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      if (!notifs[targetUid]) notifs[targetUid] = [];

      const newNotif: Notification = {
        id: `notif_${Date.now()}`,
        ...notifData,
        createdAt: new Date().toISOString()
      } as any;
      notifs[targetUid].unshift(newNotif);
      setLocalJSON(MOCK_NOTIFICATIONS_KEY, notifs);
    }
  },

  markNotificationRead: async (uid: string, notificationId: string): Promise<void> => {
    if (useRealFirebase && db) {
      await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), { read: true });
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      if (notifs[uid]) {
        const index = notifs[uid].findIndex(n => n.id === notificationId);
        if (index !== -1) {
          notifs[uid][index].read = true;
          setLocalJSON(MOCK_NOTIFICATIONS_KEY, notifs);
        }
      }
    }
  },

  markAllNotificationsRead: async (uid: string): Promise<void> => {
    if (useRealFirebase && db) {
      const q = query(collection(db, 'users', uid, 'notifications'), where('read', '==', false));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map(d => updateDoc(d.ref, { read: true }));
      await Promise.all(batchPromises);
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      if (notifs[uid]) {
        notifs[uid].forEach(n => n.read = true);
        setLocalJSON(MOCK_NOTIFICATIONS_KEY, notifs);
      }
    }
  },

  deleteNotification: async (uid: string, notificationId: string): Promise<void> => {
    if (useRealFirebase && db) {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId));
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      if (notifs[uid]) {
        notifs[uid] = notifs[uid].filter(n => n.id !== notificationId);
        setLocalJSON(MOCK_NOTIFICATIONS_KEY, notifs);
      }
    }
  },

  clearAllNotifications: async (uid: string): Promise<void> => {
    if (useRealFirebase && db) {
      const { deleteDoc, getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'users', uid, 'notifications'));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } else {
      const notifs = getLocalJSON<Record<string, Notification[]>>(MOCK_NOTIFICATIONS_KEY, {});
      if (notifs[uid]) {
        notifs[uid] = [];
        setLocalJSON(MOCK_NOTIFICATIONS_KEY, notifs);
      }
    }
  },

  // Blocks
  addBlock: async (uid: string, blockedUid: string): Promise<void> => {
    if (useRealFirebase && db) {
      await setDoc(doc(db, 'users', uid, 'blocks', blockedUid), { blockedUid });
    } else {
      const blocks = getLocalJSON<Record<string, string[]>>(MOCK_BLOCKS_KEY, {});
      if (!blocks[uid]) blocks[uid] = [];
      if (!blocks[uid].includes(blockedUid)) {
        blocks[uid].push(blockedUid);
        setLocalJSON(MOCK_BLOCKS_KEY, blocks);
      }
    }
  },

  getBlocks: async (uid: string): Promise<string[]> => {
    if (useRealFirebase && db) {
      const snap = await getDocs(collection(db, 'users', uid, 'blocks'));
      return snap.docs.map(d => d.id);
    } else {
      const blocks = getLocalJSON<Record<string, string[]>>(MOCK_BLOCKS_KEY, {});
      return blocks[uid] || [];
    }
  },

  // Reports
  createReport: async (reporterId: string, targetType: 'user' | 'service' | 'message', targetId: string, reason: string): Promise<void> => {
    const repData = {
      reporterId,
      targetType,
      targetId,
      reason,
      status: 'open',
      createdAt: useRealFirebase ? Timestamp.now() : new Date().toISOString()
    };

    if (useRealFirebase && db) {
      await addDoc(collection(db, 'reports'), repData);
    } else {
      // Simple report logging
      console.log("SIMULATED REPORT LOGGED:", repData);
    }
  }
};

// Seed mock database automatically when the module loads
initializeMockDatabase();
