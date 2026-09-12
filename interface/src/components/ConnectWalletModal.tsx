import React, { useState } from 'react';
import { createPasskeyWallet, signInWithPasskey, getStoredUsername } from '../services/passkeyWallet';

export interface WalletConnection {
  address: string;
  accountType: 'ERC-4337' | 'EOA';
  ensOrAlias: string;
}

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletName: string, connection: WalletConnection) => void;
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
  const storedUsername = getStoredUsername();
  const [mode, setMode] = useState<'signin' | 'register'>(storedUsername ? 'signin' : 'register');
  const [username, setUsername] = useState<string>(storedUsername || '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  /**
   * The real flow — no setTimeout, no hardcoded address. This triggers
   * the browser's actual passkey prompt (Face ID / Touch ID / Windows
   * Hello / security key) and reads back a real Arc Testnet smart-
   * account address derived from that passkey. See
   * services/passkeyWallet.ts for the Circle Modular Wallets SDK calls
   * behind each of these.
   */
  const handlePasskeyAuth = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setErrorMessage('Enter a name for this passkey (only used to label it on your device).');
      return;
    }
    setErrorMessage('');
    setIsConnecting(true);
    try {
      const result = mode === 'register'
        ? await createPasskeyWallet(trimmed)
        : await signInWithPasskey(trimmed);

      onConnect('Passkey Smart Account', {
        address: result.address,
        accountType: 'ERC-4337',
        ensOrAlias: `${result.username}.passkey.arc`,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Passkey authentication failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
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

        {!isWalletConnected && (
          <div className="space-y-3">
            <span className="font-mono text-[11px] text-[#4edea3] uppercase font-bold tracking-wider block">
              Instant Smart Wallet (ERC-4337 Gasless, Arc Testnet)
            </span>

            <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-4 space-y-3">
              <label className="block">
                <span className="font-mono text-[10px] text-[#8c909f] uppercase font-bold block mb-1.5">
                  {mode === 'register' ? 'Name this passkey' : 'Passkey username'}
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. your name or email"
                  disabled={isConnecting}
                  className="w-full bg-[#131b2e] border border-[#222a3d] rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] placeholder:text-[#565d70] focus:outline-none focus:border-[#4edea3]/50"
                />
              </label>

              <button
                type="button"
                disabled={isConnecting}
                onClick={handlePasskeyAuth}
                className="w-full p-3 bg-[#171f33] hover:bg-[#1b2540] border border-[#4edea3]/40 hover:border-[#4edea3] rounded-xl flex items-center justify-center gap-2 transition-colors group disabled:opacity-50"
              >
                {isConnecting ? (
                  <span className="material-symbols-outlined animate-spin text-[#4edea3] text-[18px]">sync</span>
                ) : (
                  <span className="text-lg">🔑</span>
                )}
                <span className="font-mono text-xs font-semibold text-[#4edea3]">
                  {isConnecting
                    ? 'Waiting for Face ID / Touch ID / Windows Hello…'
                    : mode === 'register'
                    ? 'Create Passkey Account'
                    : 'Sign in with Passkey'}
                </span>
              </button>

              <button
                type="button"
                disabled={isConnecting}
                onClick={() => {
                  setMode(mode === 'register' ? 'signin' : 'register');
                  setErrorMessage('');
                }}
                className="w-full text-center font-mono text-[10px] text-[#8c909f] hover:text-[#4cd7f6] transition-colors"
              >
                {mode === 'register' ? 'Already have a passkey? Sign in instead' : "Don't have one yet? Create an account"}
              </button>
            </div>

            {errorMessage && (
              <div className="bg-[#2a1418] border border-[#ffb4ab]/40 rounded-xl p-3 text-xs font-mono text-[#ffb4ab]">
                {errorMessage}
              </div>
            )}

            <span className="font-mono text-[10px] text-[#8c909f] block">
              Works with Face ID, Touch ID, Windows Hello, Android biometric, or a security key —
              no app install, no account to remember beyond your device's own passkey manager.
            </span>
          </div>
        )}

        {/* Connect Existing EVM Wallet — not wired up yet; needs a real
            wallet connector (wagmi/RainbowKit or ConnectKit). Disabled
            rather than silently mocked. */}
        <div className="space-y-2 pt-1">
          <span className="font-mono text-[11px] text-[#8c909f] uppercase font-bold tracking-wider block">
            Connect Existing Web3 Wallet
          </span>
          <div className="space-y-2">
            {[
              { name: 'Rabby Smart Account', icon: '🐰', desc: 'Pre-flight gas & transaction simulator' },
              { name: 'MetaMask', icon: '🦊', desc: 'Popular EVM browser extension' },
              { name: 'Coinbase Wallet', icon: '🔵', desc: 'Self-custodial mobile & web extension' },
              { name: 'WalletConnect', icon: '🔗', desc: 'Connect 100+ mobile wallets via QR code' },
            ].map((w) => (
              <button
                key={w.name}
                type="button"
                disabled
                title="Not wired up yet — needs a real wallet connector (wagmi/RainbowKit or ConnectKit)"
                className="w-full flex items-center justify-between p-3 bg-[#060e20] border border-[#222a3d] rounded-xl transition-all text-left group opacity-40 cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{w.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#dae2fd]">
                        {w.name}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-[#8c909f]/20 text-[#8c909f] px-1.5 py-0.5 rounded">
                        Coming soon
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8c909f]">{w.desc}</span>
                  </div>
                </div>
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
