import React from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'info' | 'confirm' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel: () => void;
}

export default function CustomDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'confirm',
  onConfirm,
  onCancel
}: CustomDialogProps) {
  if (!isOpen) return null;

  const IconMap = {
    info: <AlertCircle className="w-6 h-6 text-blue-500" />,
    confirm: <HelpCircle className="w-6 h-6 text-[var(--accent)]" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      id="custom-dialog-backdrop"
    >
      <div 
        className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-[400px] p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-left flex flex-col gap-4 relative"
        id="custom-dialog-content"
      >
        {/* Close Button */}
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full p-1 hover:bg-[var(--surface)] transition cursor-pointer"
          title="Close dialog"
        >
          <X size={16} />
        </button>

        {/* Header & Icon */}
        <div className="flex gap-3 items-start pr-6">
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shrink-0">
            {IconMap[type]}
          </div>
          <div className="flex flex-col text-left">
            <h3 className="font-extrabold text-base text-[var(--text-primary)] tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed font-medium">
              {message}
            </p>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="flex justify-end gap-2 text-xs font-bold mt-2">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="py-2 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] text-[var(--text-secondary)] transition cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => {
              if (type === 'confirm' && onConfirm) {
                onConfirm();
              } else {
                onCancel();
              }
            }}
            className={`py-2 px-5 rounded-xl text-white transition cursor-pointer shadow-xs ${
              type === 'error'
                ? 'bg-red-500 hover:bg-red-600'
                : type === 'success'
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            {type === 'confirm' ? confirmLabel : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
