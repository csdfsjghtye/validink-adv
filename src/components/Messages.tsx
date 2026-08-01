import React, { useState, useEffect, useRef } from 'react';
import { db, dbService } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, updateDoc, Timestamp, getDoc, getDocs } from 'firebase/firestore';
import { Send, User, ChevronLeft, Shield, CheckCheck, MessageSquare } from 'lucide-react';
import { Conversation, Message, UserProfile } from '../types';

interface MessagesProps {
  partnerIdFromParam?: string;
  onNavigate: (view: string, params?: any) => void;
  currentUserProfile: UserProfile | null;
  onOpenAuth: () => void;
}

export default function Messages({
  partnerIdFromParam,
  onNavigate,
  currentUserProfile,
  onOpenAuth
}: MessagesProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // New text input
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial conversations list loader
  useEffect(() => {
    if (!currentUserProfile) return;

    setLoading(true);
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUserProfile.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const rawConvs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Conversation[];

        const enriched: Conversation[] = [];
        for (const c of rawConvs) {
          const profiles: Record<string, Partial<UserProfile>> = {};
          for (const pId of c.participants) {
            const profileDoc = await dbService.getUserProfile(pId);
            if (profileDoc) {
              const isProfessor = profileDoc.role === 'professor';
              profiles[pId] = {
                displayName: isProfessor ? 'Anonymous Professor' : profileDoc.displayName,
                handle: isProfessor ? 'professor' : profileDoc.handle,
                avatarBase64: isProfessor ? undefined : profileDoc.avatarBase64
              };
            }
          }
          enriched.push({
            ...c,
            participantProfiles: profiles
          });
        }
        
        // Sort conversations by lastMessageAt descending
        enriched.sort((a, b) => {
          const atA = a.lastMessageAt?.seconds || new Date(a.lastMessageAt || 0).getTime();
          const atB = b.lastMessageAt?.seconds || new Date(b.lastMessageAt || 0).getTime();
          return atB - atA;
        });

        setConversations(enriched);
      } catch (err) {
        console.error("Snapshot conversations error", err);
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error("Firebase Conversations Snap Error", err);
      // fallback
      dbService.getConversations(currentUserProfile.uid).then(setConversations);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile]);

  // 2. Open specific param-directed chat thread on start
  useEffect(() => {
    if (!currentUserProfile || !partnerIdFromParam) return;

    const setupDirectMessage = async () => {
      try {
        const convId = await dbService.getOrCreateConversation(currentUserProfile.uid, partnerIdFromParam);
        setActiveConvId(convId);
      } catch (err) {
        console.error(err);
      }
    };

    setupDirectMessage();
  }, [partnerIdFromParam, currentUserProfile]);

  // 3. Listen to messages for the active conversation
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'conversations', activeConvId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => {
      console.error("Snapshot messages error", err);
      // Fallback
      setMessages([]);
    });

    return () => unsubscribe();
  }, [activeConvId]);

  // Handle message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId || !currentUserProfile) return;

    setSending(true);
    const cleanText = inputText.trim();
    setInputText('');

    try {
      // 1. Add Message Doc
      await addDoc(collection(db, 'conversations', activeConvId, 'messages'), {
        senderId: currentUserProfile.uid,
        text: cleanText,
        createdAt: Timestamp.now()
      });

      // 2. Update Conversation Summary
      const convRef = doc(db, 'conversations', activeConvId);
      await updateDoc(convRef, {
        lastMessage: cleanText,
        lastMessageAt: Timestamp.now()
      });

      // 3. Create Notification for the recipient
      const parts = activeConvId.split('_');
      const recipientId = parts.find(id => id !== currentUserProfile.uid);
      if (recipientId) {
        await dbService.createNotification(recipientId, 'new_message', {
          conversationId: activeConvId,
          senderId: currentUserProfile.uid,
          senderName: currentUserProfile.displayName
        });
      }
    } catch (err) {
      console.error("Error sending message", err);
    } finally {
      setSending(false);
    }
  };

  const getPartnerProfile = (conv: Conversation) => {
    if (!currentUserProfile || !conv.participantProfiles) return null;
    const partnerId = conv.participants.find(id => id !== currentUserProfile.uid);
    return partnerId ? conv.participantProfiles[partnerId] : null;
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activePartner = activeConv ? getPartnerProfile(activeConv) : null;
  const activePartnerId = activeConv && currentUserProfile ? activeConv.participants.find(id => id !== currentUserProfile.uid) : null;

  const [canMessage, setCanMessage] = useState(false);

  useEffect(() => {
    if (!activePartnerId || !currentUserProfile) {
      setCanMessage(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const q1 = query(
          collection(db, 'bookings'),
          where('clientUid', '==', currentUserProfile.uid),
          where('providerUid', '==', activePartnerId),
          where('status', 'in', ['paid', 'completed'])
        );
        const q2 = query(
          collection(db, 'bookings'),
          where('providerUid', '==', currentUserProfile.uid),
          where('clientUid', '==', activePartnerId),
          where('status', 'in', ['paid', 'completed'])
        );
        
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        if (!snap1.empty || !snap2.empty) {
          setCanMessage(true);
        } else {
          setCanMessage(false);
        }
      } catch (e) {
         console.error(e);
         setCanMessage(false);
      }
    };
    checkAuth();
  }, [activePartnerId, currentUserProfile]);

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 border-r border-[var(--border)] bg-[var(--bg)] h-full w-full animate-in fade-in duration-200">
        <MessageSquare size={48} className="text-[var(--text-secondary)] mb-4 animate-bounce" />
        <h2 className="font-extrabold text-lg text-[var(--text-primary)]">Access Direct Consultations</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1 leading-relaxed">
          Sign up or log in to message other peer experts, receive direct service requests, and validate academic or industrial accomplishments.
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
    <div className="flex h-full border-r border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
      
      {/* 1. Conversations Sidebar list panel */}
      <div className={`w-full md:w-80 shrink-0 border-r border-[var(--border)] flex flex-col h-full ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h1 className="font-black text-lg tracking-tight">Messages</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-[var(--text-secondary)] font-bold">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 gap-2">
              <MessageSquare size={24} className="text-[var(--text-secondary)]" />
              <span className="font-bold text-sm">No conversations yet</span>
              <p className="text-[11px] text-[var(--text-secondary)]">Browse validation services on the home feed and click "Chat" to begin peer consultations.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const partner = getPartnerProfile(conv);
              const isActive = conv.id === activeConvId;
              if (!partner) return null;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`flex gap-3 items-center p-3 rounded-xl transition text-left cursor-pointer ${
                    isActive ? 'bg-[var(--surface)] border border-[var(--border)]' : 'hover:bg-[var(--surface)]/50'
                  }`}
                >
                  {partner.avatarBase64 ? (
                    <img
                      src={partner.avatarBase64}
                      alt={partner.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center border border-[var(--border)] font-bold text-xs">
                      {partner.displayName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm truncate">{partner.displayName}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] truncate font-medium">
                      {conv.lastMessage || 'Click to send messages...'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Chat Box Thread panel */}
      <div className={`flex-1 flex flex-col h-full bg-[var(--bg)] ${!activeConvId ? 'hidden md:flex items-center justify-center text-[var(--text-secondary)]' : 'flex'}`}>
        {activeConvId && activePartner ? (
          <>
            {/* Thread Header */}
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
              <button
                onClick={() => setActiveConvId(null)}
                className="p-1.5 hover:bg-[var(--surface)] rounded-full transition md:hidden cursor-pointer text-[var(--text-primary)]"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div
                onClick={() => activePartnerId && onNavigate('profile', { uid: activePartnerId })}
                className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition"
                title="View peer profile"
              >
                {activePartner.avatarBase64 ? (
                  <img
                    src={activePartner.avatarBase64}
                    alt={activePartner.displayName}
                    className="w-9 h-9 rounded-full object-cover border border-[var(--border)]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--surface)] flex items-center justify-center font-bold text-xs border border-[var(--border)]">
                    {activePartner.displayName?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex flex-col text-left">
                  <span className="font-black text-sm text-[var(--text-primary)] leading-tight flex items-center gap-1">
                    {activePartner.displayName}
                    <Shield size={12} className="text-[var(--validated)] fill-[var(--validated)]/10 shrink-0" />
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] leading-none">@{activePartner.handle}</span>
                </div>
              </div>
            </div>

            {/* Message Bubble Scrolls */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 gap-1 text-[var(--text-secondary)]">
                  <span className="text-sm font-bold">This is the start of your message history</span>
                  <p className="text-xs max-w-xs leading-relaxed">Discuss contract goals, validation requirements, and review schedules securely here.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUserProfile?.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                          isMe
                            ? 'bg-[var(--accent)] text-white rounded-br-xs'
                            : 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] font-bold text-[var(--text-secondary)] mt-1 flex items-center gap-0.5">
                        {isMe && <CheckCheck size={11} className="text-[var(--accent)]" />}
                        {new Date(msg.createdAt?.seconds * 1000 || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--border)] bg-[var(--bg)] flex flex-col items-center gap-2">
              {!canMessage && (
                <div className="w-full p-2 text-center text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-md">
                  Messages locked. You must have a paid validation contract with this expert to message them.
                </div>
              )}
              <div className="w-full flex items-center gap-2">
                <input
                  type="text"
                  required
                  disabled={sending || !canMessage}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={canMessage ? "Secure validation messages..." : "Payment required to message..."}
                  className="flex-1 bg-[var(--surface)] text-[var(--text-primary)] px-4 py-2.5 rounded-full text-xs font-semibold focus:outline-none border border-transparent focus:border-[var(--accent)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim() || !canMessage}
                  className="p-2.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 rounded-full transition shrink-0 cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 gap-2 text-[var(--text-secondary)]">
            <MessageSquare size={32} />
            <h3 className="font-extrabold text-md text-[var(--text-primary)]">Select a Conversation</h3>
            <p className="text-xs max-w-sm leading-relaxed text-center">Open a messaging thread on the left panel to coordinate peer audits and validate your skills with active review experts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
