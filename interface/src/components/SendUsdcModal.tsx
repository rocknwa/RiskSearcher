import React, { useState } from 'react';
import { EVMNetwork } from '../types';
import { withdrawUsdc } from '../services/arcApi';

interface SendUsdcModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userAddress: string;
  onSendSuccess: (amount: number, recipient: string, network: EVMNetwork) => void;
}

export const SendUsdcModal: React.FC<SendUsdcModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  userAddress,
  onSendSuccess,
}) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState<EVMNetwork>('Base');
  const [step, setStep] = useState<'input' | 'review' | 'success'>('input');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [txId, setTxId] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const networkFee = 0.05;
  const totalDeduction = numAmount + networkFee;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!recipient.trim() || !recipient.startsWith('0x') || recipient.length < 10) {
      setError('Please enter a valid EVM recipient address (0x...)');
      return;
    }

    if (numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (totalDeduction > walletBalance) {
      setError(`Insufficient balance. You need $${totalDeduction.toFixed(2)} USDC (including $0.05 network fee), but your wallet has $${walletBalance.toFixed(2)} USDC.`);
      return;
    }

    setStep('review');
  };

  const handleConfirmSend = () => {
    setIsProcessing(true);
    setError('');
    withdrawUsdc(userAddress, recipient, numAmount)
      .then((result) => {
        setIsProcessing(false);
        if (result.no_data) {
          setError(`Transfer failed: ${result.reason || 'the Arc treasury service is unavailable.'}`);
          setStep('input');
          return;
        }
        setTxId(result.transaction_id ?? null);
        onSendSuccess(numAmount, recipient, network);
        setStep('success');
        setTimeout(() => {
          setStep('input');
          setAmount('');
          setRecipient('');
          setTxId(null);
          onClose();
        }, 2200);
      })
      .catch((err: Error) => {
        setIsProcessing(false);
        setError(err.message);
        setStep('input');
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#222a3d] border border-[#4d8eff]/40 flex items-center justify-center text-[#4d8eff]">
              <span className="material-symbols-outlined text-[20px]">north_east</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Send USDC</h3>
              <span className="font-mono text-[10px] text-[#8c909f] block">
                Transfers from your personal wallet (Balance A)
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
            {/* Available Balance Pill */}
            <div className="flex items-center justify-between bg-[#060e20] p-3 rounded-xl border border-[#222a3d]">
              <span className="font-mono text-xs text-[#8c909f]">Available Wallet Balance:</span>
              <span className="font-mono text-sm font-bold text-[#4edea3]">
                ${walletBalance.toFixed(2)} USDC
              </span>
            </div>

            {/* Recipient Input */}
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#8c909f] block">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x... or ENS name"
                className="w-full bg-[#060e20] p-3 rounded-lg border border-[#222a3d] font-mono text-xs text-[#dae2fd] placeholder:text-[#8c909f] focus:outline-none focus:border-[#4d8eff]"
              />
            </div>

            {/* Amount Input with Max */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs text-[#8c909f]">Amount</label>
                <button
                  type="button"
                  onClick={() => {
                    const maxPossible = Math.max(0, walletBalance - 0.05);
                    setAmount(maxPossible.toFixed(2));
                  }}
                  className="font-mono text-xs text-[#4cd7f6] hover:underline"
                >
                  Use Max
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

            {/* Network Selector */}
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#8c909f] block">Network</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Base', 'Arbitrum', 'Ethereum'] as EVMNetwork[]).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setNetwork(net)}
                    className={`py-1.5 px-2 rounded-lg border font-mono text-xs transition-colors ${
                      network === net
                        ? 'bg-[#222a3d] border-[#4d8eff] text-[#dae2fd]'
                        : 'bg-[#060e20] border-[#222a3d] text-[#8c909f] hover:bg-[#171f33]'
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee summary */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8c909f] pt-1">
              <span>Estimated Relayer Fee:</span>
              <span>${networkFee.toFixed(2)} USDC</span>
            </div>

            {error && (
              <p className="text-xs text-[#ffb4ab] font-mono leading-relaxed">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Review Transfer</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </form>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Sending Amount:</span>
                <span className="text-[#dae2fd] font-bold text-sm">${numAmount.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Network:</span>
                <span className="text-[#dae2fd]">{network}</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f]">
                <span>Recipient:</span>
                <span className="text-[#adc6ff] truncate max-w-[200px]">{recipient}</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f] border-t border-[#222a3d]/70 pt-2">
                <span>Relayer Gas Fee:</span>
                <span className="text-[#8c909f]">${networkFee.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-[#dae2fd] border-t border-[#222a3d]/70 pt-2 font-bold">
                <span>Total Deduction:</span>
                <span className="text-[#4edea3]">${totalDeduction.toFixed(2)} USDC</span>
              </div>
              <div className="flex items-center justify-between text-[#8c909f] text-[11px]">
                <span>Wallet Balance After:</span>
                <span>${(walletBalance - totalDeduction).toFixed(2)} USDC</span>
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
                onClick={handleConfirmSend}
                className="w-2/3 py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    <span>Broadcasting UserOp...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    <span>Confirm &amp; Send</span>
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
            <h4 className="font-bold text-base text-[#dae2fd]">Transfer submitted on Arc</h4>
            <p className="font-mono text-xs text-[#4edea3]">
              ${numAmount.toFixed(2)} USDC sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
            </p>
            {txId && (
              <p className="font-mono text-[10px] text-[#8c909f] break-all">Arc tx: {txId}</p>
            )}
          </div>
        )}

        <div className="pt-1 text-center">
          <p className="font-mono text-[10px] text-[#8c909f]">
            Sends real USDC from your Arc Testnet wallet. RiskSearcher subscription credits are separate and cannot be sent.
          </p>
        </div>
      </div>
    </div>
  );
};
