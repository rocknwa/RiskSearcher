import React, { useState } from 'react';
import { LOGO_URL } from '../data/mockData';
import { UserAccountState } from '../types';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userAccount: UserAccountState;
  onOpenWalletModal: () => void;
  isWalletConnected: boolean;
  onDisconnectWallet?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  userAccount,
  onOpenWalletModal,
  isWalletConnected,
  onDisconnectWallet,
}) => {
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  return (
    <header className="fixed top-0 w-full z-50 bg-[#060e20]/90 backdrop-blur-xl border-b border-[#222a3d]/60 shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
      <div className="h-16 max-w-[88rem] mx-auto px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Logo & System Pulse */}
        <div className="flex items-center gap-4">
          <button 
            id="nav-logo-btn"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 focus:outline-none group text-left"
          >
            <div className="relative flex items-center justify-center">
              <img 
                src={LOGO_URL} 
                alt="RiskSearcher Logo" 
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  // Fallback if network blocked
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="hidden [img:not([style*='display: none'])+&]:hidden w-8 h-8 rounded-lg bg-[#131b2e] border border-[#4cd7f6]/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">shield_lock</span>
              </div>
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-[#dae2fd] uppercase font-mono">
              RiskSearcher
            </span>
          </button>

          <div id="system-status-indicator" className="hidden xl:flex items-center gap-2 bg-[#131b2e] px-3 py-1 rounded-lg border border-[#222a3d]">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            <span className="font-mono text-[11px] text-[#c2c6d6]">
              Rules Engine: <span className="text-[#4edea3] font-medium">Online</span>
            </span>
            <span className="text-[#424754] font-mono text-[11px]">•</span>
            <span className="font-mono text-[11px] text-[#c2c6d6]">
              Multi-LLM Judge: <span className="text-[#4cd7f6] font-medium">Active</span>
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {[
            { id: 'landing', label: 'Overview' },
            { id: 'scanner', label: 'Scanner', locked: !isWalletConnected },
            { id: 'how-it-works', label: 'How It Works' },
            { id: 'supported-chains', label: 'Supported Chains' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'documentation', label: 'Documentation' },
          ].map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => {
                  onNavigate(item.id);
                  if (item.id === 'scanner' && !isWalletConnected) {
                    onOpenWalletModal();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#222a3d] text-[#dae2fd] font-semibold'
                    : 'text-[#c2c6d6] hover:text-[#dae2fd] hover:bg-[#222a3d]/50'
                }`}
              >
                <span>{item.label}</span>
                {item.locked && (
                  <span className="material-symbols-outlined text-[13px] text-[#8c909f]">lock</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {isWalletConnected && (
            <button
              id="nav-account-alias-btn"
              onClick={() => onNavigate('accounts')}
              className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                currentView === 'accounts'
                  ? 'bg-[#222a3d] border-[#4cd7f6]/50 text-[#dae2fd]'
                  : 'bg-[#171f33] border-[#222a3d] text-[#dae2fd] hover:bg-[#222a3d]'
              }`}
            >
              <span className="font-mono text-[10px] font-bold tracking-wider bg-[#03b5d3]/20 text-[#4cd7f6] px-1.5 py-0.5 rounded">
                ERC-4337
              </span>
              <span className="font-mono text-xs">{userAccount.ensOrAlias}</span>
            </button>
          )}

          {isWalletConnected ? (
            <div className="relative">
              <button
                id="nav-connect-wallet-btn"
                onClick={() => setShowWalletDropdown((prev) => !prev)}
                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-[0.99] shadow-md bg-[#131b2e] border border-[#4edea3]/40 text-[#4edea3] hover:bg-[#171f33]"
              >
                <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse mr-2"></span>
                <span>Connected</span>
                <span className="material-symbols-outlined text-[16px] ml-1 text-[#8c909f]">
                  expand_more
                </span>
              </button>

              {showWalletDropdown && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-[#131b2e] border border-[#222a3d] rounded-xl shadow-2xl p-2 z-50 text-xs font-mono">
                  <div className="px-3 py-2 border-b border-[#222a3d] mb-1">
                    <span className="text-[#8c909f] text-[10px] uppercase block font-semibold">Active Wallet</span>
                    <span className="text-[#dae2fd] font-bold block truncate mt-0.5">{userAccount.walletType}</span>
                    <span className="text-[#4cd7f6] text-[11px] block truncate">{userAccount.ensOrAlias}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowWalletDropdown(false);
                      onNavigate('accounts');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#222a3d] text-[#dae2fd] rounded flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">account_balance_wallet</span>
                    <span>Wallet &amp; Subscriptions</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowWalletDropdown(false);
                      onOpenWalletModal();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#222a3d] text-[#dae2fd] rounded flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">swap_horiz</span>
                    <span>Switch Wallet</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowWalletDropdown(false);
                      if (onDisconnectWallet) onDisconnectWallet();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#ffb4ab]/10 text-[#ffb4ab] rounded flex items-center gap-2 transition-colors mt-1 border-t border-[#222a3d]/70"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              id="nav-connect-wallet-btn"
              onClick={onOpenWalletModal}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-[0.99] shadow-md bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] hover:text-[#002e6a]"
            >
              <span className="material-symbols-outlined text-[18px] mr-1.5">
                account_balance_wallet
              </span>
              <span>Connect Wallet</span>
            </button>
          )}

          <button
            id="nav-user-profile-btn"
            onClick={() => {
              if (!isWalletConnected) {
                onOpenWalletModal();
              } else {
                onNavigate('accounts');
              }
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
              isWalletConnected
                ? 'bg-[#adc6ff] text-[#002e6a] hover:ring-2 hover:ring-[#4cd7f6]'
                : 'bg-[#171f33] text-[#8c909f] border border-[#222a3d] hover:text-[#dae2fd]'
            }`}
            title={isWalletConnected ? 'Account & Quota' : 'Wallet Not Connected - Click to Sign In'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isWalletConnected ? 'person' : 'lock'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
