import React, { useEffect, useState } from 'react';
import { getArcWallet, getPendingSubscription, getSubscriptionStatus, paySubscription } from '../services/arcApi';
import { SUBSCRIPTION_PRICE_USDC, SUBSCRIPTION_SCANS } from '../config';
import { EntitlementState } from '../types';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userAddress: string;
  onOpenAddFundsModal: () => void;
  onSubscribeSuccess: (entitlement: EntitlementState) => void;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const FAILED = ['FAILED', 'CANCELLED', 'CANCELED', 'DENIED'];

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  onOpenAddFundsModal,
  onSubscribeSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'pending' | 'success'>('checkout');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');

  const finishSuccess = (entitlement: EntitlementState) => {
    onSubscribeSuccess(entitlement);
    setStep('success');
    setIsProcessing(false);
  };

  const pollTransaction = async (transactionId: string, attempts = 36) => {
    setTxId(transactionId);
    setStep('pending');
    setIsProcessing(true);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const status = await getSubscriptionStatus(transactionId);
      const state = (status.status || 'PENDING').toUpperCase();
      setPaymentStatus(state);
      if (status.credits_granted && status.entitlement) {
        finishSuccess(status.entitlement);
        return;
      }
      if (FAILED.includes(state)) {
        setStep('checkout');
        setIsProcessing(false);
        throw new Error(`Circle payment ${state.toLowerCase()}. No scan credits were added.`);
      }
      if (attempt < attempts - 1) await wait(2500);
    }
    // Keep the UI in pending state. The user can close/reopen safely; both the
    // frontend and backend resume this transaction instead of charging again.
    setIsProcessing(false);
    throw new Error('Payment is still pending. No credits have been granted yet. You can close this window safely and resume status later.');
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingBalance(true);
    setError('');
    setStep('checkout');
    setTxId(null);
    setPaymentStatus('');

    Promise.allSettled([getArcWallet(), getPendingSubscription()])
      .then(async ([walletResult, pendingResult]) => {
        if (cancelled) return;
        if (walletResult.status === 'fulfilled') {
          const wallet = walletResult.value;
          if (!wallet.no_data) setLiveBalance(wallet.usdc_balance ?? 0);
        } else {
          setError(walletResult.reason instanceof Error ? walletResult.reason.message : 'Could not load Arc wallet balance.');
        }

        if (pendingResult.status === 'fulfilled' && pendingResult.value.pending_purchase) {
          const pending = pendingResult.value.pending_purchase;
          const state = (pending.status || 'PENDING').toUpperCase();
          setTxId(pending.transaction_id || null);
          setPaymentStatus(state);
          if (pending.credits_granted && pending.entitlement) {
            finishSuccess(pending.entitlement);
            return;
          }
          if (pending.transaction_id && !FAILED.includes(state)) {
            try {
              await pollTransaction(pending.transaction_id, 12);
            } catch (err) {
              if (!cancelled) setError(err instanceof Error ? err.message : 'Payment status check failed.');
            }
          } else if (!pending.transaction_id && state === 'INITIATING') {
            setStep('pending');
            setIsProcessing(false);
            setError('A payment request is already being initiated server-side. Wait a moment, then close and reopen this screen to refresh its status.');
          }
        }
      })
      .finally(() => { if (!cancelled) setIsLoadingBalance(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveBalance = liveBalance ?? walletBalance;
  const hasSufficientBalance = !isLoadingBalance && liveBalance !== null && effectiveBalance >= SUBSCRIPTION_PRICE_USDC;
  const neededMore = Math.max(0, SUBSCRIPTION_PRICE_USDC - effectiveBalance);

  const handlePay = async () => {
    if (!hasSufficientBalance) return;
    setIsProcessing(true);
    setError('');
    try {
      const purchase = await paySubscription();
      if (!purchase.transaction_id) throw new Error('Circle did not return a transaction ID. No credits were granted.');
      setTxId(purchase.transaction_id);
      setPaymentStatus((purchase.status || 'INITIATED').toUpperCase());
      if (purchase.credits_granted && purchase.entitlement) {
        finishSuccess(purchase.entitlement);
        return;
      }
      await pollTransaction(purchase.transaction_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
      setIsProcessing(false);
    }
  };

  const handleResume = async () => {
    if (!txId) return;
    setError('');
    try {
      await pollTransaction(txId, 12);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment status check failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#060e20]/85 backdrop-blur-md p-3 sm:p-4">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 shadow-2xl">
          <div className="sticky top-0 z-10 -mx-1 -mt-1 px-1 pt-1 pb-3 bg-[#131b2e] flex items-center justify-between border-b border-[#222a3d]">
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">RiskSearcher Scan Access</h3>
              <span className="font-mono text-[10px] text-[#4cd7f6] uppercase font-bold">Arc Testnet • USDC</span>
            </div>
            <button type="button" onClick={onClose} className="text-[#8c909f] hover:text-[#dae2fd] p-2 rounded-lg hover:bg-[#222a3d]" aria-label="Close">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {step === 'checkout' && (
            <div className="space-y-4">
              <div className="bg-[#060e20] p-4 rounded-xl border border-[#4d8eff]/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-base text-[#dae2fd]">{SUBSCRIPTION_SCANS} Scan Credits</h4>
                    <p className="font-mono text-[10px] text-[#8c909f] mt-1">Each fresh analysis or re-analysis consumes 1 credit.</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xl font-bold text-[#4edea3]">${SUBSCRIPTION_PRICE_USDC}</span>
                    <span className="font-mono text-[10px] text-[#8c909f] block">testnet USDC</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#222a3d] font-mono text-[10px] text-[#c2c6d6] space-y-1.5">
                  <p>✓ {SUBSCRIPTION_SCANS} server-enforced contract scans</p>
                  <p>✓ Full analysis reports and history</p>
                  <p>✓ Credits persist to your authenticated account</p>
                  <p className="text-[#8c909f]">One-time testnet scan pack. No auto-renewal.</p>
                </div>
              </div>

              <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] font-mono text-xs space-y-2">
                <div className="flex justify-between gap-3"><span className="text-[#8c909f]">Real Arc wallet balance</span><strong className="text-[#dae2fd]">{isLoadingBalance ? 'Checking…' : `$${effectiveBalance.toFixed(2)} USDC`}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-[#8c909f]">Price</span><strong className="text-[#dae2fd]">${SUBSCRIPTION_PRICE_USDC.toFixed(2)} USDC</strong></div>
              </div>

              {!isLoadingBalance && !hasSufficientBalance ? (
                <div className="bg-[#93000a]/20 border border-[#ffb4ab]/30 p-3 rounded-xl space-y-2">
                  <p className="font-mono text-[10px] text-[#ffb4ab]">You need ${neededMore.toFixed(2)} more testnet USDC.</p>
                  <button type="button" onClick={() => { onClose(); onOpenAddFundsModal(); }} className="w-full py-2.5 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold font-mono text-xs rounded-lg">Add Funds / Open Faucet</button>
                </div>
              ) : (
                <button type="button" disabled={isProcessing || isLoadingBalance} onClick={handlePay} className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] disabled:opacity-60 text-[#00285d] font-bold text-sm rounded-xl flex items-center justify-center gap-2">
                  {isProcessing && <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>}
                  <span>{isProcessing ? 'Checking payment…' : `Pay $${SUBSCRIPTION_PRICE_USDC} USDC for ${SUBSCRIPTION_SCANS} Scans`}</span>
                </button>
              )}
              {error && <p className="text-xs text-[#ffb4ab] font-mono leading-relaxed">{error}</p>}
            </div>
          )}

          {step === 'pending' && (
            <div className="p-6 text-center space-y-3 bg-[#060e20] rounded-xl border border-[#4d8eff]/30">
              <span className={`material-symbols-outlined text-[#4cd7f6] text-[32px] ${isProcessing ? 'animate-spin' : ''}`}>sync</span>
              <h4 className="font-bold text-[#dae2fd]">Waiting for Arc confirmation</h4>
              <p className="font-mono text-xs text-[#8c909f]">Circle status: <strong className="text-[#4cd7f6]">{paymentStatus || 'PENDING'}</strong></p>
              <p className="font-mono text-[10px] text-[#8c909f]">This payment is saved server-side. Closing or refreshing will not start a second payment.</p>
              {txId && <p className="font-mono text-[9px] text-[#8c909f] break-all">Circle tx: {txId}</p>}
              {!isProcessing && txId && <button type="button" onClick={handleResume} className="w-full py-2.5 bg-[#4d8eff] text-[#00285d] font-bold text-xs rounded-lg">Check Payment Status</button>}
              {error && <p className="text-xs text-[#ffb4ab] font-mono leading-relaxed">{error}</p>}
            </div>
          )}

          {step === 'success' && (
            <div className="p-6 text-center space-y-3 bg-[#060e20] rounded-xl border border-[#00a572]/30">
              <div className="w-12 h-12 rounded-full bg-[#00a572]/20 border border-[#00a572] flex items-center justify-center text-[#4edea3] mx-auto"><span className="material-symbols-outlined text-[28px]">verified</span></div>
              <h4 className="font-bold text-base text-[#dae2fd]">{SUBSCRIPTION_SCANS} scan credits added</h4>
              <p className="font-mono text-xs text-[#4edea3]">Payment confirmed on Arc Testnet.</p>
              {txId && <p className="font-mono text-[9px] text-[#8c909f] break-all">Circle tx: {txId}</p>}
              <button type="button" onClick={() => { setStep('checkout'); onClose(); }} className="w-full py-2.5 bg-[#4d8eff] text-[#00285d] font-bold text-xs rounded-lg">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
