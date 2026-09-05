import React, { useState } from 'react';
import { EVMNetwork } from '../types';

interface WithdrawUsdcModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  onWithdrawSuccess: (amount: number, destination: string, network: EVMNetwork) => void;
}

export const WithdrawUsdcModal: React.FC<WithdrawUsdcModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  onWithdrawSuccess,
}) => {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState<EVMNetwork>('Base');
  const [step, setStep] = useState<'input' | 'review' | 'success'>('input');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const bridgeFee = 0.10;
  const totalDeduction = numAmount + bridgeFee;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!destination.trim() || !destination.startsWith('0x') || destination.length < 10) {
      setError('Please enter a valid destination EVM address (0x...)');
      return;
    }

    if (numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (totalDeduction > walletBalance) {
      setError(`Insufficient balance. You need $${totalDeduction.toFixed(2)} USDC (including $0.10 bridge fee), but your wallet has $${walletBalance.toFixed(2)} USDC.`);
      return;
    }

    setStep('review');
  };

  const handleConfirmWithdraw = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onWithdrawSuccess(numAmount, destination, network);
      setStep('success');
      setTimeout(() => {
        setStep('input');
        setAmount('');
        setDestination('');
        onClose();
      }, 1800);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#222a3d] border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6]">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Withdraw USDC</h3>
              <span className="font-mono text-[10px] text-[#8c909f] block">
                Withdraws your personal wallet funds (Balance A)
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

        {/* Step 1: Input */}
        {step === 'input' && (
          <form onSubmit={handleNext} className="space-y-4">
            {/* Available Balance */}
            <div className="flex items-center justify-between bg-[#060e20] p-3 rounded-xl border border-[#222a3d]">
              <span className="font-mono text-xs text-[#8c909f]">Available Wallet Funds:</span>
              <span className="font-mono text-sm font-bold text-[#4edea3]">
                ${walletBalance.toFixed(2)} USDC
              </span>
            </div>

            {/* Destination Address */}
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#8c909f] block">Destination Address</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="0x... external exchange or cold storage"
                className="w-full bg-[#060e20] p-3 rounded-lg border border-[#222a3d] font-mono text-xs text-[#dae2fd] placeholder:text-[#8c909f] focus:outline-none focus:border-[#4cd7f6]"
              />
            </div>

            {/* Amount with Max */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-[#8c909f]">Withdraw Amount</label>
                <button
                  type="button"
                  onClick={() => {
                    const maxPossible = Math.max(0, walletBalance - 0.10);
                    setAmount(maxPossible.toFixed(2));
                  }}
                  className="font-mono text-xs text-[#4cd7f6] hover:underline"
                >
                  Withdraw Max
                </button>
              </div>
              <div className="relative flex items-center bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="text-[#8c909f] font-mono text-sm mr-2">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent font-mono text-sm text-[#dae2fd] focus:outline-none"
                />
                <span className="font-mono text-xs text-[#4edea3] font-bold">USDC</span>
              </div>
            </div>

            {/* Destination Network */}
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#8c909f] block">Destination Network</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Base', 'Arbitrum', 'Ethereum'] as EVMNetwork[]).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setNetwork(net)}
                    className={`py-1.5 px-2 rounded-lg border font-mono text-xs transition-colors ${
                      network === net
                        ? 'bg-[#222a3d] border-[#4cd7f6] text-[#dae2fd]'
                        : 'bg-[#060e20] border-[#222a3d] text-[#8c909f] hover:bg-[#171f33]'
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            {/* Bridge fee & remaining calculation */}
            <div className="space-y-1 pt-1 font-mono text-[11px] text-[#8c909f]">
              <div className="flex items-center justify-between">
                <span>Network / Bridge Fee:</span>
                <span>${bridgeFee.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Remaining Wallet Balance:</span>
                <span className="text-[#dae2fd]">
                  ${Math.max(0, walletBalance - totalDeduction).toFixed(2)} USDC
                </span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#ffb4ab] font-mono leading-relaxed">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#4cd7f6] hover:bg-[#acedff] text-[#00285d] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Review Withdrawal</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </form>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Withdrawal Amount:</span>
                <span className="text-[#dae2fd] font-bold text-sm">${numAmount.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Network:</span>
                <span className="text-[#dae2fd]">{network}</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Destination:</span>
                <span className="text-[#adc6ff] truncate max-w-[200px]">{destination}</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f] border-t border-[#222a3d]/70 pt-2">
                <span>Bridge Fee:</span>
                <span className="text-[#8c909f]">${bridgeFee.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-[#dae2fd] border-t border-[#222a3d]/70 pt-2 font-bold">
                <span>Total Deducted:</span>
                <span className="text-[#4edea3]">${totalDeduction.toFixed(2)} USDC</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="w-1/3 py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#c2c6d6] font-mono text-xs rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmWithdraw}
                className="w-2/3 py-2.5 bg-[#4cd7f6] hover:bg-[#acedff] text-[#00285d] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span>Processing Withdrawal...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Confirm &amp; Withdraw</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="p-6 text-center space-y-3 bg-[#060e20] rounded-xl border border-[#00a572]/30 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-[#00a572]/20 border border-[#00a572] flex items-center justify-center text-[#4edea3] mx-auto">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <h4 className="font-bold text-base text-[#dae2fd]">Demo withdrawal submitted</h4>
            <p className="font-mono text-xs text-[#4edea3]">
              ${numAmount.toFixed(2)} USDC withdrawn to {destination.slice(0, 6)}...{destination.slice(-4)}
            </p>
          </div>
        )}

        {/* Explicit Non-Removable Service Credit Disclaimer */}
        <div className="pt-1 text-center bg-[#222a3d]/50 p-2.5 rounded-lg border border-[#222a3d]">
          <p className="font-mono text-[10px] text-[#8c909f] leading-relaxed">
            <strong className="text-[#adc6ff]">Important:</strong> Withdrawals only apply to your personal wallet USDC. RiskSearcher subscription service credits are non-refundable, non-transferable, and cannot be withdrawn.
          </p>
        </div>
      </div>
    </div>
  );
};
