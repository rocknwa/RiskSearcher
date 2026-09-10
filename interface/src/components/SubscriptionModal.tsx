import React, { useEffect, useState } from 'react';
import { getArcWallet, paySubscription } from '../services/arcApi';
import { SUBSCRIPTION_PRICE_USDC } from '../config';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userAddress: string;
  onOpenAddFundsModal: () => void;
  onSubscribeSuccess: (planName: string, amount: number) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  userAddress,
  onOpenAddFundsModal,
  onSubscribeSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'success'>('checkout');
  const [error, setError] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingBalance(true);
    setBalanceError(null);
    getArcWallet(userAddress)
      .then((wallet) => {
        setIsLoadingBalance(false);
        if (wallet.no_data) {
          setBalanceError(wallet.reason || 'Arc treasury service unavailable');
          return;
        }
        setLiveBalance(wallet.usdc_balance ?? 0);
      })
      .catch((err: Error) => {
        setIsLoadingBalance(false);
        setBalanceError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userAddress]);

  if (!isOpen) return null;

  const planPrice = SUBSCRIPTION_PRICE_USDC;
  // Use the real, freshly-fetched balance once we have it. Fall back to the
  // stale local prop only while the real fetch is still in flight, so the
  // UI never lets a stale mock number drive a real payment decision.
  const effectiveBalance = liveBalance ?? walletBalance;
  const hasSufficientBalance = !isLoadingBalance && liveBalance !== null && effectiveBalance >= planPrice;
  const neededMore = Math.max(0, planPrice - effectiveBalance);

  const handlePaySubscription = () => {
    if (!hasSufficientBalance) return;

    setIsProcessing(true);
    setError('');
    paySubscription(userAddress, planPrice)
      .then((result) => {
        setIsProcessing(false);
        if (result.no_data) {
          setError(`Payment failed: ${result.reason || 'the Arc treasury service is unavailable.'}`);
          return;
        }
        setTxId(result.transaction_id ?? null);
        onSubscribeSuccess('RiskSearcher Pro', planPrice);
        setStep('success');
        setTimeout(() => {
          setStep('checkout');
          setTxId(null);
          onClose();
        }, 2200);
      })
      .catch((err: Error) => {
        setIsProcessing(false);
        setError(err.message);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#222a3d] border border-[#4d8eff]/40 flex items-center justify-center text-[#4d8eff]">
              <span className="material-symbols-outlined text-[20px]">stars</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">RiskSearcher Subscription</h3>
              <span className="font-mono text-[10px] text-[#4cd7f6] uppercase font-bold tracking-wider">
                Prepaid Service Credit Plan
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8c909f] hover:text-[#dae2fd] p-1 rounded hover:bg-[#222a3d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {step === 'checkout' && (
          <div className="space-y-4">
            {/* Plan Card */}
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#4d8eff]/40 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-[#dae2fd]">RiskSearcher Pro</h4>
                  <span className="font-mono text-xs text-[#8c909f]">Forensic Specialist Node</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xl font-bold text-[#4edea3]">${planPrice}</span>
                  <span className="font-mono text-xs text-[#8c909f]"> USDC / mo</span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1.5 font-mono text-xs text-[#c2c6d6] pt-2 border-t border-[#222a3d]">
                <div className="flex items-center gap-2 text-[#4edea3]">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>200 deep pre-flight scans per month</span>
                </div>
                <div className="flex items-center gap-2 text-[#4edea3]">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Full risk reports &amp; bytecode decompilation</span>
                </div>
                <div className="flex items-center gap-2 text-[#4edea3]">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Specialist ensemble analysis &amp; LLM Judge</span>
                </div>
                <div className="flex items-center gap-2 text-[#4edea3]">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Unlimited investigation audit log</span>
                </div>
              </div>
            </div>

            {/* Payment Source & Wallet Balance Check */}
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#8c909f]">Payment Source:</span>
                <span className="text-[#dae2fd] font-semibold">Smart Wallet (USDC)</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#8c909f]">Your Wallet Balance:</span>
                <span className={`font-bold ${hasSufficientBalance ? 'text-[#4edea3]' : 'text-[#ffb4ab]'}`}>
                  {isLoadingBalance ? 'Checking Arc chain...' : `$${effectiveBalance.toFixed(2)} USDC`}
                </span>
              </div>
              {balanceError && (
                <p className="font-mono text-[10px] text-[#ffb4ab]">
                  Live balance unavailable: {balanceError}
                </p>
              )}
              <div className="flex items-center justify-between font-mono text-xs border-t border-[#222a3d]/70 pt-2">
                <span className="text-[#8c909f]">Subscription Price:</span>
                <span className="text-[#dae2fd] font-bold">${planPrice.toFixed(2)} USDC</span>
              </div>
            </div>

            {/* Insufficient Balance State */}
            {isLoadingBalance ? (
              <div className="bg-[#060e20] p-3.5 rounded-xl border border-[#222a3d] flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[16px] text-[#4cd7f6]">sync</span>
                <span className="font-mono text-xs text-[#8c909f]">Checking your real Arc wallet balance...</span>
              </div>
            ) : !hasSufficientBalance ? (
              <div className="bg-[#93000a]/20 border border-[#ffb4ab]/30 p-3.5 rounded-xl space-y-3">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[#ffb4ab] text-[18px] shrink-0 mt-0.5">
                    error_outline
                  </span>
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-[#ffb4ab] leading-relaxed">
                      Insufficient USDC balance. You need <strong>${neededMore.toFixed(2)}</strong> more USDC to purchase this plan.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAddFundsModal();
                    }}
                    className="w-full py-2 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold font-mono text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_card</span>
                    <span>Add USDC to Wallet</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePaySubscription}
                className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    <span>Submitting Arc payment...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">credit_score</span>
                    <span>Pay ${planPrice} USDC</span>
                  </>
                )}
              </button>
            )}

            {error && (
              <p className="text-xs text-[#ffb4ab] font-mono leading-relaxed">{error}</p>
            )}

            {/* Explicit Non-Withdrawable Rule */}
            <div className="bg-[#222a3d]/40 p-3 rounded-xl border border-[#222a3d] text-center space-y-1">
              <span className="font-mono text-[10px] text-[#4cd7f6] uppercase font-bold block">
                Non-Withdrawable Service Credit
              </span>
              <p className="font-mono text-[10px] text-[#8c909f] leading-relaxed">
                Subscription credits are non-refundable, non-transferable, and cannot be withdrawn. They are dedicated solely to automated RiskSearcher contract scans.
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="p-6 text-center space-y-3 bg-[#060e20] rounded-xl border border-[#00a572]/30 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-[#00a572]/20 border border-[#00a572] flex items-center justify-center text-[#4edea3] mx-auto">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <h4 className="font-bold text-base text-[#dae2fd]">Payment confirmed on Arc ✓</h4>
            <p className="font-mono text-xs text-[#4edea3]">
              +${planPrice.toFixed(2)} RiskSearcher service credit added (200 scans unlocked)
            </p>
            {txId && (
              <p className="font-mono text-[10px] text-[#8c909f] break-all">Arc tx: {txId}</p>
            )}
            <p className="font-mono text-[11px] text-[#8c909f]">
              Your subscription balance is service credit and cannot be withdrawn or transferred.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
