import React, { useState } from 'react';
import { X, Sparkles, AlertCircle, Camera, Check } from 'lucide-react';
import { authService, dbService } from '../firebase';
import { compressImage, sanitizeInput } from '../utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: (force?: boolean) => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [createdUid, setCreatedUid] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Onboarding fields
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [role, setRole] = useState<'student' | 'professor'>('student');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        // Set onboarding states, but do not call Firebase signup yet
        const defaultDisplayName = email.split('@')[0];
        const defaultHandle = defaultDisplayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setDisplayName(defaultDisplayName);
        setHandle(defaultHandle);
        setIsOnboarding(true);
      } else {
        const user = await authService.signIn(email, password);
        if (!user.profileComplete) {
          setCreatedUid(user.uid);
          // Pre-fill email split as displayName
          setDisplayName(user.displayName || email.split('@')[0]);
          setIsOnboarding(true);
        } else {
          onSuccess();
          onClose(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Check handles uniqueness
    const cleanHandle = handle.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (cleanHandle.length < 3 || cleanHandle.length > 20) {
      setError('Handle must be between 3 and 20 alphanumeric characters or underscores.');
      return;
    }

    // Strict input sanitization to prevent XSS / Common attacks
    const cleanDisplayName = sanitizeInput(displayName);
    const cleanTitle = sanitizeInput(title);
    const cleanBio = sanitizeInput(bio);

    // Mandatory form validations
    if (!cleanDisplayName) {
      setError('Full Name is mandatory.');
      return;
    }

    setLoading(true);
    try {
      const isUnique = await dbService.checkHandleUnique(cleanHandle);
      if (!isUnique) {
        setError('This handle is already taken. Try another.');
        setLoading(false);
        return;
      }

      if (isSignUp) {
        // Create actual Firebase Account and write the profile together
        await authService.signUp(email, password, {
          displayName: cleanDisplayName,
          handle: cleanHandle,
          role: role,
          title: cleanTitle || (role === 'professor' ? 'Academic Professor' : 'Student'),
          bio: cleanBio || `Dedicated ${role} at ValidInk.`,
          avatarBase64: avatar || '',
          profileComplete: true
        });
      } else {
        // Complete registration for existing incomplete auth account
        await dbService.updateUserProfile(createdUid, {
          displayName: cleanDisplayName,
          handle: cleanHandle,
          role: role,
          title: cleanTitle || (role === 'professor' ? 'Academic Professor' : 'Student'),
          bio: cleanBio || `Dedicated ${role} at ValidInk.`,
          avatarBase64: avatar || '',
          profileComplete: true
        });
      }

      onSuccess();
      onClose(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Registration completion failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 200, 200);
      setAvatar(compressed);
    } catch (err) {
      console.error("Error compressing image", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[440px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
        
        {/* Header Block */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--accent)] text-white font-extrabold text-xs">
              i
            </div>
            <span className="font-extrabold text-sm text-[var(--text-primary)]">
              {isOnboarding ? 'Complete Profile' : isSignUp ? 'Create Account' : 'Sign In'}
            </span>
          </div>
          {(!isOnboarding || isSignUp) && (
            <button
              onClick={() => onClose()}
              className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-secondary)] rounded-full transition cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content Block */}
        <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isOnboarding ? (
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold py-3 px-4 rounded-xl text-sm transition cursor-pointer mt-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>

              <div className="text-center text-xs mt-2 text-[var(--text-secondary)]">
                {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[var(--accent)] hover:underline font-bold"
                >
                  {isSignUp ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleOnboardingSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Welcome to ValidInk! Let peer reviewers and clients find you. Complete your profile onboarding card below.
              </p>

              {/* Avatar Selection */}
              <div className="flex flex-col gap-2 items-center">
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Avatar Preview"
                      className="w-20 h-20 rounded-full object-cover border border-[var(--border)] shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[var(--surface)] flex items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] font-extrabold text-xl">
                      {displayName.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 p-1.5 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] rounded-full border-2 border-[var(--bg)] cursor-pointer shadow-sm transition">
                    <Camera size={13} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-wider">
                  Select Avatar
                </span>
              </div>

              {/* Role Selection */}
              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  I am a...
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold border transition ${
                      role === 'student'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('professor')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold border transition ${
                      role === 'professor'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                    }`}
                  >
                    Professor
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Unique Handle</span>
                  <span className="lowercase text-[9px] text-[var(--text-secondary)] font-medium">Letters, numbers, underscores</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-[var(--text-secondary)] text-sm font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="janedoe"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] pl-8 pr-4 py-2.5 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Expert Professional Title <span className="text-[9px] font-medium text-[var(--text-secondary)] capitalize">(Optional)</span></span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior React Developer"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Bio <span className="text-[9px] font-medium text-[var(--text-secondary)] capitalize">(Optional)</span></span>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">{160 - bio.length} chars</span>
                </label>
                <textarea
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell peer experts why your validation credentials are trustworthy..."
                  rows={3}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-2.5 mt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold py-3 px-4 rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Creating Profile...' : 'Complete Registration'}
                </button>
                {isSignUp ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOnboarding(false);
                      setError('');
                    }}
                    className="w-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-primary)] font-extrabold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    Back to Credentials
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await authService.signOut();
                      onClose();
                    }}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-extrabold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    Sign Out & Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
