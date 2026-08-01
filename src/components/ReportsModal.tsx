import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'user' | 'service' | 'message';
  targetId: string;
  reporterId: string;
}

const REASONS = [
  'Spam or misleading information',
  'Inappropriate or offensive content',
  'Plagiarism or intellectual property violation',
  'Fraudulent or deceptive practices',
  'Harassment or abusive behavior',
  'Other'
];

export default function ReportsModal({ isOpen, onClose, targetType, targetId, reporterId }: ReportsModalProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId,
        targetType,
        targetId,
        reason,
        comment: comment.trim(),
        status: 'open',
        createdAt: Timestamp.now()
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[420px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-extrabold text-sm text-[var(--text-primary)]">
            Report Content
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-secondary)] rounded-full transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <h3 className="font-extrabold text-md text-[var(--text-primary)]">Report Submitted</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Thank you for keeping our peer-validated marketplace safe. Our moderators will review this content and take appropriate action shortly.
              </p>
              <button
                onClick={onClose}
                className="mt-2 bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--text-primary)] font-bold px-6 py-2 rounded-xl text-xs transition cursor-pointer border border-[var(--border)]"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2.5 items-start p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>You are submitting a formal moderation report for this {targetType}. Abusive report submissions can lead to account suspension.</span>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                  Reason for reporting
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5 rounded-xl text-xs focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-semibold"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex justify-between">
                  <span>Additional Comments</span>
                  <span className="text-[9px] font-normal lowercase text-[var(--text-secondary)]">Optional</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Provide precise details or message transcripts to help our validation reviewers assess this issue faster..."
                  rows={4}
                  maxLength={500}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl text-xs focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] leading-relaxed resize-none font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition cursor-pointer mt-2 disabled:opacity-50"
              >
                {loading ? 'Submitting Report...' : 'Submit Moderation Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
