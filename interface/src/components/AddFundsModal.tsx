import React, { useEffect, useState } from 'react';
import { getArcWallet } from '../services/arcApi';

interface AddFundsModalProps {
  isOpen: boolean;
  initialTab?: 'receive' | 'buy';
  onClose: () => void;
  walletAddress: string;
  onAddFundsSuccess?: () => void;
}

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  initialTab,
  onClose,
  onAddFundsSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'buy'>(initialTab ?? 'receive');
  const [copied, setCopied] = useState(false);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const refreshArcWallet = async () => {
    setIsLoadingWallet(true);
    setWalletError(null);
    try {
      const wallet = await getArcWallet();
      if (wallet.no_data) throw new Error(wallet.reason || 'Arc wallet unavailable');
      setDepositAddress(wallet.deposit_address ?? null);
      setLiveBalance(wallet.usdc_balance ?? 0);
      onAddFundsSuccess?.();
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Arc wallet unavailable');
    } finally {
      setIsLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab ?? 'receive');
    void refreshArcWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCopyAddress = async () => {
    if (!depositAddress) return;
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openFaucet = async () => {
    if (depositAddress) await navigator.clipboard.writeText(depositAddress).catch(() => undefined);
    window.open('https://faucet.circle.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#060e20]/85 backdrop-blur-md p-3 sm:p-4">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Add USDC</h3>
              <span className="font-mono text-[10px] text-[#8c909f]">Real Arc Testnet wallet balance only</span>
            </div>
            <button type="button" onClick={onClose} className="text-[#8c909f] hover:text-[#dae2fd] p-2 rounded-lg hover:bg-[#222a3d]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-[#060e20] p-1 rounded-xl border border-[#222a3d]">
            <button type="button" onClick={() => setActiveTab('receive')} className={`py-2 rounded-lg text-xs font-mono font-semibold ${activeTab === 'receive' ? 'bg-[#222a3d] text-[#4cd7f6]' : 'text-[#8c909f]'}`}>Receive / Faucet</button>
            <button type="button" onClick={() => setActiveTab('buy')} className={`py-2 rounded-lg text-xs font-mono font-semibold ${activeTab === 'buy' ? 'bg-[#222a3d] text-[#4edea3]' : 'text-[#8c909f]'}`}>Buy / On-ramp</button>
          </div>

          {activeTab === 'receive' ? (
            <div className="space-y-4">
              {walletError && <div className="bg-[#93000a]/20 border border-[#ffb4ab]/30 p-3 rounded-xl font-mono text-xs text-[#ffb4ab]">{walletError}</div>}
              <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] text-center">
                <span className="font-mono text-[10px] text-[#8c909f] uppercase block">Live Arc Testnet balance</span>
                <strong className="font-mono text-2xl text-[#4edea3] block mt-1">{isLoadingWallet ? '—' : `$${(liveBalance ?? 0).toFixed(2)} USDC`}</strong>
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] text-[#8c909f]">Arc Testnet deposit address</span>
                <div className="bg-[#060e20] border border-[#222a3d] rounded-lg p-2.5 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#dae2fd] break-all flex-1 min-w-0">{depositAddress || (isLoadingWallet ? 'Loading…' : 'Unavailable')}</span>
                  <button type="button" disabled={!depositAddress} onClick={handleCopyAddress} className="shrink-0 px-2.5 py-2 bg-[#222a3d] rounded-lg font-mono text-[10px] text-[#dae2fd] disabled:opacity-50">{copied ? 'Copied ✓' : 'Copy'}</button>
                </div>
              </div>
              <button type="button" disabled={!depositAddress} onClick={openFaucet} className="w-full py-3 bg-[#4edea3]/10 hover:bg-[#4edea3]/20 border border-[#4edea3]/40 text-[#4edea3] rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[17px]">water_drop</span>
                Open Circle Testnet Faucet
              </button>
              <button type="button" onClick={refreshArcWallet} disabled={isLoadingWallet} className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] rounded-xl font-mono text-xs font-semibold disabled:opacity-50">{isLoadingWallet ? 'Checking…' : 'Refresh real balance'}</button>
              <p className="font-mono text-[10px] text-[#8c909f] text-center">The faucet opens in a new tab. Your deposit address is copied automatically when available.</p>
            </div>
          ) : (
            <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-6 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-full bg-[#222a3d] flex items-center justify-center text-[#8c909f]"><span className="material-symbols-outlined">schedule</span></div>
              <h4 className="font-bold text-[#dae2fd]">Fiat on-ramp coming soon</h4>
              <p className="font-mono text-[11px] text-[#8c909f] leading-relaxed">No mock purchase is available. For this Arc Testnet release, fund the real wallet with Circle's faucet instead.</p>
              <button type="button" onClick={() => setActiveTab('receive')} className="w-full py-2.5 bg-[#4d8eff] text-[#00285d] font-bold text-xs rounded-lg">Use Testnet Faucet</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
