import React, { useState, useEffect } from 'react';
import { X, CreditCard, Lock, CheckCircle2, ExternalLink, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface PaymongoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  amount: number;
  recipientName: string;
  bookingId?: string;
}

export default function PaymongoModal({ isOpen, onClose, onSuccess, amount, recipientName, bookingId }: PaymongoModalProps) {
  const [status, setStatus] = useState<{ configured: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkPaymongoStatus();
    }
  }, [isOpen]);

  const checkPaymongoStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/paymongo/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to check PayMongo status', err);
      setStatus({ configured: false, message: 'Could not reach backend PayMongo API proxy.' });
    } finally {
      setCheckingStatus(false);
    }
  };

  if (!isOpen) return null;

  const handlePayMongoCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/paymongo/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          description: `Validation fee for ${recipientName}`,
          name: `Academic Validation (${recipientName})`,
          bookingId: bookingId
        })
      });

      const data = await res.json();

      if (data.success && data.checkoutUrl) {
        // Redirect to PayMongo Hosted Checkout Page
        window.location.href = data.checkoutUrl;
      } else if (data.error) {
        setError(data.error);
        setLoading(false);
      } else {
        setError('Failed to create PayMongo Checkout session.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred connecting to PayMongo.');
      setLoading(false);
    }
  };

  const handleSimulateOrBypass = async () => {
    setLoading(true);
    setError(null);
    try {
      if (bookingId) {
        // Optimistic check, will throw in dbService if status is not 'accepted'
        await onSuccess();
        setLoading(false);
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 1200);
      } else {
        throw new Error("No booking ID provided for payment simulation.");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Payment simulation failed.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
        {/* Paymongo Header */}
        <div className="bg-[#059669] p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <X size={20} />
          </button>
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 p-3 rounded-full flex items-center justify-center">
              <CreditCard size={32} className="text-white" />
            </div>
          </div>
          <h2 className="font-extrabold text-2xl tracking-tight mb-1">PayMongo Gateway</h2>
          <p className="text-white/90 text-sm font-medium">
            Academic Fee for {recipientName}
          </p>
          <div className="mt-3 text-4xl font-black">
            ₱{(amount * 58).toFixed(2)} <span className="text-xs font-bold text-white/80">(${(amount).toFixed(2)} USD)</span>
          </div>
        </div>

        {/* Content Block */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 size={64} className="text-emerald-500 mb-4 animate-bounce" />
              <h3 className="font-black text-xl text-gray-800">Payment Verified!</h3>
              <p className="text-sm text-gray-500 mt-2 text-center">Unlocking direct communication channel...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* PayMongo API Key Status Badge */}
              {checkingStatus ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-emerald-600" />
                  Verifying PayMongo API connection...
                </div>
              ) : status?.configured ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>Real PayMongo API is active with your Secret Key.</span>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>PayMongo Key Setup Required</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Add <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">PAYMONGO_SECRET_KEY</code> to your AI Studio Secrets panel or <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">.env</code> file to enable live checkout via GCash, Maya, QRPH, or Card.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <form onSubmit={handlePayMongoCheckout} className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || checkingStatus}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    'Connecting to PayMongo...'
                  ) : (
                    <>
                      <Lock size={16} /> Pay via Official PayMongo Page
                      <ExternalLink size={14} className="opacity-80" />
                    </>
                  )}
                </button>

                {!status?.configured && (
                  <button
                    type="button"
                    onClick={handleSimulateOrBypass}
                    disabled={loading}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-gray-300"
                  >
                    Authorize Test Payment (Dev Preview Mode)
                  </button>
                )}
              </form>

              <div className="mt-2 pt-3 border-t border-gray-100 text-center">
                <p className="text-[11px] text-gray-500 font-semibold mb-1">Supported Payment Methods via PayMongo:</p>
                <div className="flex justify-center items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider flex-wrap">
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">GCash</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">Maya</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">QR PH</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">Credit / Debit Card</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">GrabPay</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
