import React, { useState } from 'react';
import { X, Check, Globe, HelpCircle, DollarSign, Sparkles } from 'lucide-react';
import { dbService } from '../firebase';
import { sanitizeInput } from '../utils';

interface ComposeModalProps {
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Grammarian',
  'Statistician',
  'Accountant',
  'Research consultation',
  'Research instrument validation'
];

export default function ComposeModal({ user, onClose, onSuccess }: ComposeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [category, setCategory] = useState('Grammarian');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = sanitizeInput(title);
    const cleanDescription = sanitizeInput(description);

    if (!cleanTitle || !cleanDescription || !price || isNaN(Number(price))) {
      setError('Please fill in all fields with valid information.');
      return;
    }
    if (Number(price) <= 0) {
      setError('Price must be greater than 0.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (user?.role !== 'professor') {
        throw new Error("Only professors can offer validation services.");
      }

      await dbService.createService(
        user.uid,
        cleanTitle,
        cleanDescription,
        category,
        Number(price)
      );
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to publish service. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const descMaxLen = 500;
  const charsLeft = descMaxLen - description.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[550px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Block */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-primary)] rounded-full transition cursor-pointer"
          >
            <X size={18} />
          </button>
          <span className="font-extrabold text-sm text-[var(--text-primary)]">
            Offer a Validation Service
          </span>
          <button
            id="btn-compose-publish"
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !description.trim() || !price}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-extrabold px-5 py-1.5 rounded-full text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Publishing...' : 'Publish'}
          </button>
        </div>

        {/* Form Area */}
        <div className="p-4 overflow-y-auto max-h-[75vh] flex flex-col gap-4">
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold">
              {error}
            </div>
          )}

          {/* User Preview */}
          <div className="flex gap-3 items-center">
            {user.avatarBase64 ? (
              <img
                src={user.avatarBase64}
                alt={user.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--surface)] flex items-center justify-center font-bold border border-[var(--border)] text-[var(--text-secondary)]">
                {user.displayName?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-sm leading-tight">{user.displayName}</span>
              <span className="text-xs text-[var(--text-secondary)]">@{user.handle}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                Service Title
              </label>
              <input
                id="compose-title"
                type="text"
                maxLength={100}
                required
                placeholder="I will validate your..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-[var(--text-primary)] border-b border-[var(--border)] py-1.5 focus:border-[var(--accent)] focus:outline-none text-md font-bold"
              />
            </div>

            {/* Description Textarea */}
            <div className="flex flex-col gap-1 mt-2">
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                Detailed Description (Max 500 chars)
              </label>
              <textarea
                id="compose-description"
                maxLength={descMaxLen}
                rows={4}
                required
                placeholder="Give details about your validation contract. Specify what materials the clients should share, what guidelines you will check against, and what outputs they will receive (e.g. video review, PDF checklist, etc.)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-sm focus:border-[var(--accent)] focus:outline-none leading-relaxed resize-none font-medium text-[var(--text-primary)]"
              />
              <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1">
                  <Globe size={11} className="text-emerald-500" /> Publicly visible in directories
                </span>
                <span className={charsLeft < 40 ? 'text-[var(--danger)] font-black' : ''}>
                  {charsLeft} chars remaining
                </span>
              </div>
            </div>

            {/* Categories scroll container */}
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={11} className="text-[var(--accent)]" /> Choose Category
              </label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition cursor-pointer select-none border ${
                      category === cat
                        ? 'bg-[var(--accent)] text-white border-transparent'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]/30'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price tag input */}
            <div className="flex flex-col gap-1 mt-2">
              <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                Validation Cost Price (USD)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center text-[var(--text-secondary)] pointer-events-none font-bold">
                  <DollarSign size={16} />
                </div>
                <input
                  id="compose-price"
                  type="number"
                  min={1}
                  required
                  placeholder="e.g. 75"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[var(--surface)] pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none text-sm font-bold"
                />
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
