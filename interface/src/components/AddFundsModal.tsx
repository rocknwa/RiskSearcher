import React, { useState } from 'react';
import { EVMNetwork } from '../types';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  onAddFundsSuccess: (amount: number, method: 'receive' | 'buy') => void;
}

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  onAddFundsSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'buy'>('receive');
  const [selectedNetwork, setSelectedNetwork] = useState<EVMNetwork>('Base');
  const [copied, setCopied] = useState(false);
  const [buyAmount, setBuyAmount] = useState('50');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'bank'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateReceive = () => {
    setIsProcessing(true);
    setNotification('Waiting for incoming USDC...');
    setTimeout(() => {
      setIsProcessing(false);
      onAddFundsSuccess(25.0, 'receive');
      setNotification('+$25.00 USDC received into your wallet!');
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1500);
    }, 1200);
  };

  const handleBuyOnramp = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(buyAmount);
    if (isNaN(val) || val <= 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onAddFundsSuccess(val, 'buy');
      setNotification(`+$${val.toFixed(2)} USDC added via on-ramp!`);
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1400);
    }, 1300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#222a3d] border border-[#4d8eff]/40 flex items-center justify-center text-[#4d8eff]">
              <span className="material-symbols-outlined text-[20px]">add_card</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Add USDC to Wallet</h3>
              <span className="font-mono text-[10px] text-[#8c909f] block">
                Funds your personal wallet (Balance A)
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

        {/* Tabs: Receive vs Buy */}
        <div className="grid grid-cols-2 gap-1 bg-[#060e20] p-1 rounded-xl border border-[#222a3d]">
          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'receive'
                ? 'bg-[#222a3d] text-[#4cd7f6] shadow-sm'
                : 'text-[#8c909f] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            <span>Receive USDC</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('buy')}
            className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'buy'
                ? 'bg-[#222a3d] text-[#4edea3] shadow-sm'
                : 'text-[#8c909f] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
            <span>Buy / On-ramp</span>
          </button>
        </div>

        {notification && (
          <div className="p-3 rounded-xl bg-[#00a572]/15 border border-[#00a572]/30 text-center font-mono text-xs text-[#4edea3] animate-pulse">
            {notification}
          </div>
        )}

        {/* Tab 1: Receive USDC */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            {/* Network Selector */}
            <div className="space-y-1">
              <label className="font-mono text-xs text-[#8c909f] block">Select Network</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Base', 'Arbitrum', 'Ethereum'] as EVMNetwork[]).map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setSelectedNetwork(net)}
                    className={`py-1.5 px-2 rounded-lg border font-mono text-xs transition-colors ${
                      selectedNetwork === net
                        ? 'bg-[#222a3d] border-[#4cd7f6] text-[#dae2fd]'
                        : 'bg-[#060e20] border-[#222a3d] text-[#8c909f] hover:bg-[#171f33]'
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated QR Code */}
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] flex flex-col items-center justify-center space-y-3">
              <div className="w-36 h-36 bg-white p-2 rounded-lg flex items-center justify-center shadow-inner">
                {/* SVG mock QR pattern */}
                <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                  <rect width="100" height="100" fill="white" />
                  <path d="M10 10h30v30h-30z M15 15h20v20h-20z M60 10h30v30h-30z M65 15h20v20h-20z M10 60h30v30h-30z M15 65h20v20h-20z M45 10h10v10h-10z M45 30h10v10h-10z M45 50h10v10h-10z M10 45h10v10h-10z M30 45h10v10h-10z M50 70h20v20h-20z M75 50h15v15h-15z M60 80h10v10h-10z M80 75h10v15h-10z" fill="#0b1326" />
                </svg>
              </div>
              <span className="font-mono text-[11px] text-[#8c909f]">
                Deposit directly on <strong className="text-[#dae2fd]">{selectedNetwork}</strong>
              </span>
            </div>

            {/* Address Display */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Your USDC Wallet Address:</span>
                <span className="font-mono text-[10px] text-[#4edea3]">Only send USDC on {selectedNetwork}</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d] flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[#dae2fd] truncate select-all">
                  {walletAddress}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-3 py-1 rounded font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Address copied ✓' : 'Copy address'}</span>
                </button>
              </div>
            </div>

            {/* Simulation Demo Trigger */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleSimulateReceive}
              className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] border border-[#4cd7f6]/40 text-[#4cd7f6] rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">sim_card_download</span>
              <span>{isProcessing ? 'Waiting for incoming USDC...' : 'Simulate Incoming Transfer (+$25.00 USDC)'}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Buy / On-ramp */}
        {activeTab === 'buy' && (
          <form onSubmit={handleBuyOnramp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-[#8c909f] block">Select Amount (USDC)</label>
              <div className="grid grid-cols-4 gap-2">
                {['25', '50', '100', '250'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBuyAmount(preset)}
                    className={`py-2 rounded-lg font-mono text-xs font-semibold border transition-colors ${
                      buyAmount === preset
                        ? 'bg-[#222a3d] border-[#4edea3] text-[#4edea3]'
                        : 'bg-[#060e20] border-[#222a3d] text-[#c2c6d6] hover:bg-[#171f33]'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <div className="relative flex items-center bg-[#060e20] p-3 rounded-lg border border-[#222a3d] mt-2">
                <span className="text-[#8c909f] font-mono text-sm mr-2">$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full bg-transparent font-mono text-sm text-[#dae2fd] focus:outline-none"
                  placeholder="Custom amount"
                />
                <span className="font-mono text-xs text-[#4edea3] font-bold">USDC</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-[#8c909f] block">Payment Method</label>
              <div className="space-y-2">
                {[
                  { id: 'card', name: 'Credit / Debit Card', fee: 'Instant • 0% fee' },
                  { id: 'apple', name: 'Apple Pay / Google Pay', fee: 'Instant verification' },
                  { id: 'bank', name: 'Bank Wire (ACH)', fee: '1-2 business days' },
                ].map((pm) => (
                  <div
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id as any)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      paymentMethod === pm.id
                        ? 'bg-[#222a3d] border-[#4edea3]'
                        : 'bg-[#060e20] border-[#222a3d] hover:bg-[#171f33]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        checked={paymentMethod === pm.id}
                        onChange={() => setPaymentMethod(pm.id as any)}
                        className="accent-[#4edea3]"
                      />
                      <span className="font-mono text-xs text-[#dae2fd]">{pm.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#8c909f]">{pm.fee}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  <span>Processing On-Ramp...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  <span>Buy ${buyAmount || '0'} USDC</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-1 text-center">
          <p className="font-mono text-[10px] text-[#8c909f]">
            Note: This funds your personal Web3 wallet. This money remains yours and can be sent or withdrawn at any time.
          </p>
        </div>
      </div>
    </div>
  );
};
