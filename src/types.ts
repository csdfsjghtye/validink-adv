export interface UserProfile {
  uid: string;
  role?: 'student' | 'professor';
  displayName: string;
  handle: string; // lowercase, alphanumeric and underscores, 3-20 chars
  title: string;
  bio: string;
  avatarBase64?: string;
  bannerBase64?: string;
  profileComplete: boolean;
  themePreference: 'light' | 'dim' | 'lightsout';
  stats: {
    servicesCount: number;
    bookingsCompleted: number;
    achievementsCount: number;
  };
  createdAt: any; // Firestore Timestamp
}

export interface AchievementCritique {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  text: string;
  createdAt: any;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  mediaBase64?: string;
  validatedBy: string[]; // array of uids
  critiques?: AchievementCritique[]; // public critiques/evaluations
  createdAt: any;
}

export interface Service {
  id: string;
  providerId: string;
  providerName?: string;
  providerHandle?: string;
  providerAvatar?: string;
  providerTitle?: string;
  title: string;
  description: string;
  category: string;
  price: number;
  status: 'active' | 'pending' | 'booked' | 'completed' | 'archived';
  ratingAvg?: number;
  ratingCount?: number;
  createdAt: any;
  updatedAt: any;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantProfiles?: { [uid: string]: Partial<UserProfile> };
  lastMessage?: string;
  lastMessageAt?: any;
  status?: 'locked' | 'unlocked';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface Booking {
  id: string; // same as serviceId
  serviceId: string;
  clientId: string;
  providerId: string;
  status: 'pending' | 'accepted' | 'paid' | 'declined' | 'completed' | 'cancelled';
  paymongoSessionId?: string;
  transactionId?: string;
  createdAt: any;
  updatedAt: any;
  serviceTitle?: string;
  servicePrice?: number;
  clientName?: string;
  clientHandle?: string;
  clientAvatar?: string;
  providerName?: string;
  providerHandle?: string;
  providerAvatar?: string;
}

export interface Review {
  id: string; // same as bookingId
  bookingId: string;
  serviceId: string;
  authorId: string;
  targetId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: any;
  authorName?: string;
  authorAvatar?: string;
  authorHandle?: string;
}

export interface Notification {
  id: string;
  type: 'new_message' | 'booking_request' | 'booking_accepted' | 'booking_declined' | 'booking_paid' | 'review_received' | 'achievement_validated';
  payload: {
    conversationId?: string;
    bookingId?: string;
    serviceId?: string;
    achievementId?: string;
    senderId?: string;
    senderName?: string;
    rating?: number;
  };
  read: boolean;
  createdAt: any;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'user' | 'service' | 'message';
  targetId: string;
  reason: string;
  status: 'open' | 'reviewed';
  createdAt: any;
}
