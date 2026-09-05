import React, { useState } from 'react';

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletName: string) => void;
  isWalletConnected?: boolean;
  currentWalletName?: string;
  onDisconnect?: () => void;
  modalPrompt?: string;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isWalletConnected = false,
  currentWalletName = 'Active Wallet',
  onDisconnect,
  modalPrompt,
}) => {
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectWallet = (name: string) => {
    setConnectingWallet(name);
    setTimeout(() => {
      setConnectingWallet(null);
      onConnect(name);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#222a3d] border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6]">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Account &amp; Wallet Login</h3>
              <span className="font-mono text-[10px] text-[#8c909f] block">
                ERC-4337 Smart Accounts &amp; EVM Wallets
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

        {/* Dynamic Action Reason Callout */}
        {modalPrompt && !isWalletConnected && (
          <div className="bg-[#171f33] border border-[#4d8eff]/40 rounded-xl p-3.5 flex items-start gap-3 shadow-lg">
            <div className="w-7 h-7 rounded-lg bg-[#4d8eff]/20 border border-[#4d8eff]/40 flex items-center justify-center text-[#4d8eff] shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[16px]">lock</span>
            </div>
            <div className="text-xs font-mono text-[#adc6ff] leading-relaxed">
              <span className="font-bold text-[#dae2fd] block uppercase text-[10px] tracking-wider mb-0.5">
                Authentication Required
              </span>
              {modalPrompt}
            </div>
          </div>
        )}

        {/* Active Session Status (when connected) */}
        {isWalletConnected && (
          <div className="bg-[#171f33] border border-[#4edea3]/30 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3] animate-pulse"></span>
              <div>
                <span className="font-mono text-[10px] text-[#8c909f] uppercase font-bold block">Currently Connected</span>
                <span className="font-mono text-xs font-semibold text-[#dae2fd]">{currentWalletName}</span>
              </div>
            </div>
            {onDisconnect && (
              <button
                type="button"
                onClick={() => {
                  onDisconnect();
                  onClose();
                }}
                className="px-3 py-1.5 bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">logout</span>
                <span>Disconnect</span>
              </button>
            )}
          </div>
        )}

        {/* Section 1: Social & Passkey Smart Account */}
        <div className="space-y-2">
          <span className="font-mono text-[11px] text-[#4edea3] uppercase font-bold tracking-wider block">
            Instant Smart Wallet (ERC-4337 Gasless)
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={connectingWallet !== null}
              onClick={() => handleSelectWallet('Google Smart Account')}
              className="p-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4edea3]/50 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors group"
            >
              <span className="text-xl">🌐</span>
              <span className="font-mono text-[11px] text-[#dae2fd] group-hover:text-[#4edea3]">Google</span>
            </button>
            <button
              type="button"
              disabled={connectingWallet !== null}
              onClick={() => handleSelectWallet('Apple Smart Account')}
              className="p-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4edea3]/50 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors group"
            >
              <span className="text-xl">🍏</span>
              <span className="font-mono text-[11px] text-[#dae2fd] group-hover:text-[#4edea3]">Apple</span>
            </button>
            <button
              type="button"
              disabled={connectingWallet !== null}
              onClick={() => handleSelectWallet('Passkey Smart Account')}
              className="p-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4edea3]/50 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors group"
            >
              <span className="text-xl">🔑</span>
              <span className="font-mono text-[11px] text-[#dae2fd] group-hover:text-[#4edea3]">Passkey</span>
            </button>
          </div>
        </div>

        {/* Section 2: Connect Existing EVM Wallet */}
        <div className="space-y-2 pt-1">
          <span className="font-mono text-[11px] text-[#8c909f] uppercase font-bold tracking-wider block">
            Connect Existing Web3 Wallet
          </span>
          <div className="space-y-2">
            {[
              { name: 'Rabby Smart Account', icon: '🐰', desc: 'Pre-flight gas & transaction simulator', badge: 'Recommended' },
              { name: 'MetaMask', icon: '🦊', desc: 'Popular EVM browser extension' },
              { name: 'Coinbase Wallet', icon: '🔵', desc: 'Self-custodial mobile & web extension' },
              { name: 'WalletConnect', icon: '🔗', desc: 'Connect 100+ mobile wallets via QR code' },
            ].map((w) => (
              <button
                key={w.name}
                type="button"
                disabled={connectingWallet !== null}
                onClick={() => handleSelectWallet(w.name)}
                className="w-full flex items-center justify-between p-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4cd7f6]/50 rounded-xl transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{w.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#dae2fd] group-hover:text-[#4cd7f6]">
                        {w.name}
                      </span>
                      {w.badge && (
                        <span className="text-[9px] font-mono font-bold bg-[#03b5d3]/20 text-[#4cd7f6] px-1.5 py-0.5 rounded">
                          {w.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8c909f]">{w.desc}</span>
                  </div>
                </div>
                {connectingWallet === w.name ? (
                  <span className="material-symbols-outlined animate-spin text-[#4cd7f6] text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[#8c909f] group-hover:text-[#dae2fd] text-[16px]">
                    chevron_right
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1 text-center">
          <span className="font-mono text-[10px] text-[#8c909f]">
            Read-only authentication • RiskSearcher never requests permission to spend or transfer assets
          </span>
        </div>
      </div>
    </div>
  );
};
