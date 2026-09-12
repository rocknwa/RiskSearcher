import React, { useState } from 'react';
import { createPasskeyWallet, signInWithPasskey, getStoredUsername, signPasskeyMessage } from '../services/passkeyWallet';
import { createAuthChallenge, verifyAuthChallenge } from '../services/authApi';

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handlePasskeyAuth = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setErrorMessage('Enter the passkey name / username used for this account.');
      return;
    }
    setErrorMessage('');
    setIsConnecting(true);
    try {
      setStatusText(mode === 'register' ? 'Creating passkey…' : 'Opening passkey…');
      const result = mode === 'register'
        ? await createPasskeyWallet(trimmed)
        : await signInWithPasskey(trimmed);

      // Address strings are not authentication. Sign a backend nonce with the
      // same Circle smart account before any balance, scan, or payment API is usable.
      setStatusText('Confirm secure RiskSearcher session…');
      const challenge = await createAuthChallenge(result.address);
      const signature = await signPasskeyMessage(challenge.message);
      await verifyAuthChallenge(result.address, challenge.challenge_id, signature);

      onConnect('Passkey Smart Account', {
        address: result.address,
        accountType: 'ERC-4337',
        ensOrAlias: `${result.username}.passkey.arc`,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Passkey authentication failed. Please try again.');
    } finally {
      setStatusText('');
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#060e20]/85 backdrop-blur-md p-2 sm:p-4">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-sm max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 bg-[#131b2e]/95 backdrop-blur border-b border-[#222a3d] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-[#222a3d] border border-[#4cd7f6]/40 flex items-center justify-center text-[#4cd7f6]">
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-[#dae2fd] truncate">Account &amp; Wallet Login</h3>
                <span className="font-mono text-[9px] text-[#8c909f] block">Passkey • ERC-4337 • Arc Testnet</span>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close wallet modal" className="text-[#8c909f] hover:text-[#dae2fd] p-2 rounded-lg hover:bg-[#222a3d] transition-colors shrink-0">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="p-4 space-y-3">
            {modalPrompt && !isWalletConnected && (
              <div className="bg-[#171f33] border border-[#4d8eff]/40 rounded-lg p-2.5 flex items-start gap-2">
                <span className="material-symbols-outlined text-[#4d8eff] text-[16px] mt-0.5">lock</span>
                <p className="text-[10px] font-mono text-[#adc6ff] leading-relaxed">{modalPrompt}</p>
              </div>
            )}

            {isWalletConnected ? (
              <div className="bg-[#171f33] border border-[#4edea3]/30 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-[9px] text-[#8c909f] uppercase block">Connected</span>
                  <span className="font-mono text-xs font-semibold text-[#dae2fd] truncate block">{currentWalletName}</span>
                </div>
                {onDisconnect && (
                  <button type="button" onClick={() => { onDisconnect(); onClose(); }} className="px-3 py-2 bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 rounded-lg text-[10px] font-mono font-semibold">
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="font-mono text-[10px] text-[#4edea3] uppercase font-bold tracking-wider block">Circle Passkey Smart Account</span>
                <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-3 space-y-2.5">
                  <label className="block">
                    <span className="font-mono text-[9px] text-[#8c909f] uppercase font-bold block mb-1">{mode === 'register' ? 'Name this passkey' : 'Passkey username'}</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. your name or email"
                      disabled={isConnecting}
                      className="w-full bg-[#131b2e] border border-[#222a3d] rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] placeholder:text-[#565d70] focus:outline-none focus:border-[#4edea3]/50"
                    />
                  </label>
                  <button type="button" disabled={isConnecting} onClick={handlePasskeyAuth} className="w-full px-3 py-2.5 bg-[#171f33] hover:bg-[#1b2540] border border-[#4edea3]/40 hover:border-[#4edea3] rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                    <span className={`material-symbols-outlined text-[#4edea3] text-[18px] ${isConnecting ? 'animate-spin' : ''}`}>{isConnecting ? 'sync' : 'key'}</span>
                    <span className="font-mono text-[11px] font-semibold text-[#4edea3]">{isConnecting ? (statusText || 'Authenticating…') : mode === 'register' ? 'Create Passkey Account' : 'Sign in with Passkey'}</span>
                  </button>
                  <button type="button" disabled={isConnecting} onClick={() => { setMode(mode === 'register' ? 'signin' : 'register'); setErrorMessage(''); }} className="w-full text-center font-mono text-[9px] text-[#8c909f] hover:text-[#4cd7f6]">
                    {mode === 'register' ? 'Already have a passkey? Sign in' : 'New here? Create a passkey'}
                  </button>
                </div>

                {errorMessage && <div className="bg-[#2a1418] border border-[#ffb4ab]/40 rounded-lg p-2.5 text-[10px] font-mono text-[#ffb4ab]">{errorMessage}</div>}

                <p className="font-mono text-[9px] text-[#8c909f] leading-relaxed">Works with Face ID, Touch ID, Windows Hello, Android biometrics, or a security key. A signed nonce creates a secure RiskSearcher session; the address alone is never trusted.</p>

                <div className="border-t border-[#222a3d] pt-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[9px] text-[#8c909f] uppercase font-bold block">Other EVM wallets</span>
                    <span className="text-[10px] text-[#565d70]">Rabby • MetaMask • Coinbase • WalletConnect</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-[#8c909f]/15 text-[#8c909f] px-2 py-1 rounded">Coming soon</span>
                </div>
              </>
            )}

            <div className="text-center font-mono text-[9px] text-[#8c909f]">Passkey sign-in never asks you to approve an asset transfer.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
