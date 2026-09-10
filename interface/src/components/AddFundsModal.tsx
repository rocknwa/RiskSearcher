import React, { useEffect, useState } from 'react';
import { getArcWallet } from '../services/arcApi';

interface AddFundsModalProps {
  isOpen: boolean;
  initialTab?: 'receive' | 'buy';
  onClose: () => void;
  walletAddress: string;
  onAddFundsSuccess: (amount: number, method: 'receive' | 'buy') => void;
}

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  initialTab,
  onClose,
  walletAddress,
  onAddFundsSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'buy'>(initialTab ?? 'receive');
  const [copied, setCopied] = useState(false);
  const [buyAmount, setBuyAmount] = useState('50');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple' | 'bank'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [lastSeenBalance, setLastSeenBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const refreshArcWallet = () => {
    setIsLoadingWallet(true);
    setWalletError(null);
    getArcWallet(walletAddress)
      .then((wallet) => {
        setIsLoadingWallet(false);
        if (wallet.no_data) {
          setWalletError(wallet.reason || 'Arc treasury service unavailable');
          return;
        }
        setDepositAddress(wallet.deposit_address ?? null);
        const balance = wallet.usdc_balance ?? 0;
        setLiveBalance(balance);
        // A rising real balance means a deposit landed since we last checked —
        // credit the local ledger with the observed delta, not a fake amount.
        if (lastSeenBalance !== null && balance > lastSeenBalance) {
          onAddFundsSuccess(balance - lastSeenBalance, 'receive');
        }
        setLastSeenBalance(balance);
      })
      .catch((err: Error) => {
        setIsLoadingWallet(false);
        setWalletError(err.message);
      });
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab ?? 'receive');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'receive') {
      refreshArcWallet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

        {/* Tab 1: Receive USDC (real Arc Testnet wallet) */}
        {activeTab === 'receive' && (
          <div className="space-y-4">
            <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] flex items-center justify-between">
              <span className="font-mono text-xs text-[#8c909f]">Network</span>
              <span className="font-mono text-xs text-[#4cd7f6] font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                Arc Testnet
              </span>
            </div>

            {walletError && (
              <div className="bg-[#93000a]/20 border border-[#ffb4ab]/30 p-3 rounded-xl font-mono text-xs text-[#ffb4ab] leading-relaxed">
                Arc wallet unavailable: {walletError}
              </div>
            )}

            {/* Live Balance */}
            <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] flex flex-col items-center justify-center space-y-1.5">
              <span className="font-mono text-[10px] text-[#8c909f] uppercase">Live Wallet Balance</span>
              <span className="font-mono text-2xl font-bold text-[#4edea3]">
                {isLoadingWallet ? '—' : `$${(liveBalance ?? 0).toFixed(2)}`}
              </span>
              <span className="font-mono text-[10px] text-[#8c909f]">USDC on Arc Testnet</span>
            </div>

            {/* Real Address Display */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Your Arc Testnet Deposit Address:</span>
                <span className="font-mono text-[10px] text-[#4edea3]">Only send testnet USDC on Arc</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d] flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[#dae2fd] truncate select-all">
                  {depositAddress || (isLoadingWallet ? 'Loading your Arc wallet...' : 'Unavailable')}
                </span>
                <button
                  type="button"
                  disabled={!depositAddress}
                  onClick={handleCopyAddress}
                  className="bg-[#222a3d] hover:bg-[#2d3449] disabled:opacity-50 text-[#dae2fd] px-3 py-1 rounded font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span>{copied ? 'Address copied ✓' : 'Copy address'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoadingWallet}
              onClick={refreshArcWallet}
              className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] border border-[#4cd7f6]/40 text-[#4cd7f6] rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoadingWallet ? 'animate-spin' : ''}`}>
                {isLoadingWallet ? 'sync' : 'refresh'}
              </span>
              <span>{isLoadingWallet ? 'Checking Arc chain...' : 'Refresh Balance'}</span>
            </button>

            <button
              type="button"
              disabled={!depositAddress}
              onClick={() => {
                if (depositAddress) {
                  navigator.clipboard.writeText(depositAddress);
                }
                window.open('https://faucet.circle.com', '_blank', 'noopener,noreferrer');
              }}
              className="w-full py-2.5 bg-[#4edea3]/10 hover:bg-[#4edea3]/20 border border-[#4edea3]/40 text-[#4edea3] rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">water_drop</span>
              <span>Get Free Testnet USDC</span>
            </button>
            <p className="font-mono text-[10px] text-[#8c909f] text-center -mt-2">
              Opens Circle's official faucet in a new tab and copies your address above — just paste, pick Arc Testnet, and submit. Free, no account needed, up to 10 USDC every 24h.
            </p>
          </div>
        )}

        {/* Tab 2: Buy / On-ramp (simulated — no fiat on-ramp partner integrated yet) */}
        {activeTab === 'buy' && (
          <div className="bg-[#222a3d]/40 border border-[#222a3d] rounded-lg px-3 py-2 -mt-2">
            <span className="font-mono text-[10px] text-[#8c909f]">
              Simulated for this demo — no live fiat on-ramp partner is connected yet.
            </span>
          </div>
        )}
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
            Receive USDC uses your real Arc Testnet wallet — this money remains yours and can be sent or withdrawn at any time. The Buy tab is simulated.
          </p>
        </div>
      </div>
    </div>
  );
};
