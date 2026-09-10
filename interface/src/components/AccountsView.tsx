import React, { useState } from 'react';
import { UserAccountState, LedgerTransaction } from '../types';
import { SUBSCRIPTION_PRICE_USDC } from '../config';

interface AccountsViewProps {
  userAccount: UserAccountState;
  transactions: LedgerTransaction[];
  onOpenAddFundsModal: (initialTab?: 'receive' | 'buy') => void;
  onOpenSendModal: () => void;
  onOpenWithdrawModal: () => void;
  onOpenSubscriptionModal: () => void;
  onOpenWorldIdModal: () => void;
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
  onOpenWalletModal?: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  userAccount,
  transactions,
  onOpenAddFundsModal,
  onOpenSendModal,
  onOpenWithdrawModal,
  onOpenSubscriptionModal,
  onOpenWorldIdModal,
  onNavigate,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Gated Access: Wallet page, balances, API keys, and transactions cannot be seen until wallet is connected
  if (!isWalletConnected) {
    return (
      <div className="flex flex-col w-full min-h-[calc(100vh-4rem)] items-center justify-center py-16 px-4 relative overflow-hidden bg-[#0b1326]">
        {/* Subtle Ambient Depth Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#4d8eff]/10 blur-[120px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-10 right-1/4 w-[400px] h-[200px] bg-[#4cd7f6]/10 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="max-w-3xl w-full mx-auto relative z-10 text-center flex flex-col items-center">
          {/* Lock Icon Emblem */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-[#131b2e] border border-[#4d8eff]/40 shadow-[0_0_30px_rgba(77,142,255,0.25)] flex items-center justify-center text-[#4d8eff]">
              <span className="material-symbols-outlined text-[42px]">account_balance_wallet</span>
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ffb4ab] border-2 border-[#0b1326] flex items-center justify-center text-[#0b1326]">
              <span className="material-symbols-outlined text-[14px] font-bold">lock</span>
            </span>
          </div>

          {/* Overline Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#222a3d]/80 border border-[#424754]/60 shadow-sm mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] animate-ping"></span>
            <span className="font-mono text-[11px] font-bold uppercase text-[#dae2fd] tracking-wider">
              Access Restricted • Authentication Required
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-bold text-[#dae2fd] tracking-tight">
            Wallet, Balances &amp; API Credentials Locked
          </h1>

          {/* Subtitle */}
          <p className="mt-3 text-sm sm:text-base text-[#c2c6d6] max-w-xl leading-relaxed">
            Personal self-custodial balances, gasless ERC-4337 smart account addresses, production audit API tokens, and transaction ledgers are isolated and encrypted. Connect your Web3 wallet or sign in to access your account.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            <button
              id="unlock-wallet-connect-btn"
              type="button"
              onClick={onOpenWalletModal}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#4d8eff] text-[#00285d] font-bold text-sm hover:bg-[#adc6ff] hover:text-[#002e6a] transition-all shadow-lg active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              <span>Connect Wallet / Login</span>
            </button>
            <button
              id="unlock-wallet-back-btn"
              type="button"
              onClick={() => onNavigate('landing')}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#171f33] hover:bg-[#222a3d] text-[#c2c6d6] hover:text-[#dae2fd] border border-[#222a3d] font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Return to Overview</span>
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 text-[11px] font-mono text-[#8c909f]">
            <span className="flex items-center gap-1">
              <span className="text-[#4edea3] material-symbols-outlined text-[14px]">check</span>
              Self-custodial on-chain USDC
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="text-[#4edea3] material-symbols-outlined text-[14px]">check</span>
              Encrypted API Token
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="text-[#4edea3] material-symbols-outlined text-[14px]">check</span>
              Gasless UserOps Relayer
            </span>
          </div>

          {/* Protected Modules Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-10 text-left">
            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>01 / CREDENTIALS</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">Production Audit API Key</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Secure programmatic REST API token for integrating real-time contract triage directly into CI/CD pipelines.
              </p>
            </div>

            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>02 / SELF-CUSTODY</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">Personal USDC Balances</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Full-custody on-chain balance to deposit, send, buy, or withdraw funds with zero intermediary custodial risk.
              </p>
            </div>

            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>03 / RELAYER LEDGER</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">UserOps Execution History</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Immutable ledger of deposit transactions, subscription renewals, gas sponsorships, and World ID verifications.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(userAccount.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAddress = () => {
    if (!isWalletConnected) {
      if (onOpenWalletModal) onOpenWalletModal();
      return;
    }
    navigator.clipboard.writeText(userAccount.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const handleWalletAction = (action: () => void) => {
    if (!isWalletConnected && onOpenWalletModal) {
      onOpenWalletModal();
      return;
    }
    action();
  };

  const remainingScans = userAccount.activeSubscription
    ? userAccount.activeSubscription.scansIncluded
    : userAccount.freeScansRemaining;

  const totalQuota = userAccount.activeSubscription ? 200 : userAccount.totalFreeScans;
  const percentageUsed = userAccount.isWorldIdVerified
    ? Math.min(100, Math.round(((totalQuota - remainingScans) / totalQuota) * 100))
    : 0;

  return (
    <div className="w-full max-w-[88rem] mx-auto px-4 lg:px-6 py-6 space-y-6">
      {/* Top Breadcrumb & Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222a3d]/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs text-[#8c909f]">
            <button onClick={() => onNavigate('landing')} className="hover:text-[#dae2fd] transition-colors">
              RiskSearcher
            </button>
            <span>/</span>
            <span className="text-[#dae2fd]">Wallet &amp; Billing</span>
            <span>/</span>
            <span className={isWalletConnected ? 'text-[#4cd7f6]' : 'text-[#8c909f]'}>
              {isWalletConnected ? userAccount.ensOrAlias : 'Guest / Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#dae2fd] tracking-tight">Wallet &amp; Subscriptions</h1>
            {isWalletConnected ? (
              <button
                onClick={handleCopyAddress}
                className="font-mono text-xs bg-[#222a3d] hover:bg-[#2d3449] text-[#c2c6d6] px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedAddr ? 'check' : 'content_copy'}
                </span>
                <span>{copiedAddr ? 'Copied' : 'Copy Address'}</span>
              </button>
            ) : (
              <button
                onClick={onOpenWalletModal}
                className="font-mono text-xs bg-[#4d8eff]/20 hover:bg-[#4d8eff]/30 text-[#adc6ff] border border-[#4d8eff]/40 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">login</span>
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>

        {/* Account Abstract Badge */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isWalletConnected ? (
            <div className="bg-[#171f33] border border-[#222a3d] px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="font-mono text-xs text-[#dae2fd] font-semibold">{userAccount.walletType}</span>
              <span className="font-mono text-[10px] bg-[#03b5d3]/20 text-[#4cd7f6] px-1.5 py-0.5 rounded font-bold">
                {userAccount.accountType}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenWalletModal}
              className="bg-[#131b2e] hover:bg-[#171f33] border border-[#ffb4ab]/40 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-[#ffb4ab]"></span>
              <span className="font-mono text-xs text-[#ffb4ab] font-semibold">Wallet Disconnected</span>
              <span className="font-mono text-[10px] bg-[#4d8eff] text-[#00285d] group-hover:bg-[#adc6ff] px-1.5 py-0.5 rounded font-bold">
                Connect
              </span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-1.5 font-mono text-xs text-[#8c909f] bg-[#131b2e] px-3 py-1.5 rounded-lg border border-[#222a3d]">
            <span>Base L2</span>
            <span>•</span>
            <span>Arbitrum</span>
            <span>•</span>
            <span>Ethereum</span>
          </div>
        </div>
      </div>

      {/* TWO SEPARATED BALANCES: Balance A (Wallet USDC) vs Balance B (RiskSearcher Subscription) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Balance A: User Wallet USDC (Cols 1-6) */}
        <div className="lg:col-span-6 bg-[#131b2e] p-6 rounded-2xl border border-[#222a3d] space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#060e20] border border-[#4d8eff]/30 flex items-center justify-center text-[#4d8eff]">
                <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              </div>
              <div>
                <span className="font-mono text-xs text-[#8c909f] uppercase tracking-wider block font-semibold">
                  Balance A • Personal Wallet
                </span>
                <h3 className="font-bold text-lg text-[#dae2fd]">User Wallet USDC</h3>
              </div>
            </div>
            <span className="font-mono text-[11px] bg-[#00a572]/20 text-[#4edea3] px-2 py-0.5 rounded font-bold uppercase">
              Self-Custodial
            </span>
          </div>

          <div>
            <span className="text-3xl sm:text-4xl font-mono font-bold text-[#4edea3] block">
              {isWalletConnected ? `$${userAccount.walletUsdcBalance.toFixed(2)} USDC` : '$0.00 USDC'}
            </span>
            <p className="text-xs text-[#8c909f] font-mono mt-1">
              {isWalletConnected
                ? 'Your personal on-chain balance. You have full custody to receive, buy, send, or withdraw at any time.'
                : 'Wallet not connected. Connect your Web3 wallet or passkey to view real-time on-chain USDC.'}
            </p>
          </div>

          {/* Wallet Actions: Receive, Buy, Send, Withdraw */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#222a3d]/70">
            <button
              onClick={() => handleWalletAction(() => onOpenAddFundsModal('receive'))}
              className="py-2.5 px-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4cd7f6]/50 rounded-xl font-mono text-xs font-semibold text-[#4cd7f6] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              <span>Receive</span>
            </button>
            <button
              onClick={() => handleWalletAction(() => onOpenAddFundsModal('buy'))}
              className="py-2.5 px-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4edea3]/50 rounded-xl font-mono text-xs font-semibold text-[#4edea3] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              <span>Buy USDC</span>
            </button>
            <button
              onClick={() => handleWalletAction(onOpenSendModal)}
              className="py-2.5 px-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#4d8eff]/50 rounded-xl font-mono text-xs font-semibold text-[#adc6ff] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">north_east</span>
              <span>Send</span>
            </button>
            <button
              onClick={() => handleWalletAction(onOpenWithdrawModal)}
              className="py-2.5 px-3 bg-[#060e20] hover:bg-[#171f33] border border-[#222a3d] hover:border-[#c2c6d6]/50 rounded-xl font-mono text-xs font-semibold text-[#c2c6d6] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Balance B: RiskSearcher Subscription Service Credit (Cols 7-12) */}
        <div className="lg:col-span-6 bg-[#131b2e] p-6 rounded-2xl border border-[#222a3d] space-y-5 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#060e20] border border-[#4cd7f6]/30 flex items-center justify-center text-[#4cd7f6]">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
              <div>
                <span className="font-mono text-xs text-[#8c909f] uppercase tracking-wider block font-semibold">
                  Balance B • Service Credit
                </span>
                <h3 className="font-bold text-lg text-[#dae2fd]">RiskSearcher Subscription</h3>
              </div>
            </div>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold uppercase ${
                userAccount.activeSubscription
                  ? 'bg-[#00a572]/20 text-[#4edea3]'
                  : userAccount.isWorldIdVerified
                  ? 'bg-[#03b5d3]/20 text-[#4cd7f6]'
                  : 'bg-[#222a3d] text-[#8c909f]'
              }`}
            >
              {userAccount.activeSubscription ? 'Pro Active' : userAccount.isWorldIdVerified ? 'Free Trial' : 'Trial Locked'}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#dae2fd]">
                ${userAccount.riskSearcherBalance.toFixed(2)} USDC
              </span>
              <span className="font-mono text-xs text-[#8c909f] block mt-1">
                {userAccount.activeSubscription
                  ? 'Pro Plan: 200 unmetered scans / month'
                  : userAccount.isWorldIdVerified
                  ? `${userAccount.freeScansRemaining} of ${userAccount.totalFreeScans} free scans remaining`
                  : '0 scans available (Verify World ID to unlock 15 free scans)'}
              </span>
            </div>

            <button
              onClick={onOpenSubscriptionModal}
              className="bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] font-bold font-mono text-xs px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">stars</span>
              <span>{userAccount.activeSubscription ? 'Plan Active' : `Subscribe ($${SUBSCRIPTION_PRICE_USDC}/mo)`}</span>
            </button>
          </div>

          {/* Explicit Helper Text: Cannot be withdrawn or transferred */}
          <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] flex items-start gap-2 text-xs">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[16px] shrink-0 mt-0.5">
              info
            </span>
            <p className="text-[#8c909f] font-mono text-[11px] leading-relaxed">
              <strong className="text-[#adc6ff]">Service Credit Rule:</strong> Subscription credits are non-refundable, non-transferable, and cannot be withdrawn. They are dedicated solely to automated RiskSearcher contract scans.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: World ID Sybil Defense + API Key & Identity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* World ID Humanity Verification (High Priority ZK Module) */}
        <div className="lg:col-span-5 bg-[#131b2e] p-6 rounded-2xl border border-[#222a3d] space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#060e20] border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3]">
                <span className="material-symbols-outlined text-[22px]">fingerprint</span>
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#dae2fd]">World ID Verification</h3>
                <span className="font-mono text-xs text-[#8c909f]">Zero-Knowledge Sybil Defense</span>
              </div>
            </div>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                userAccount.isWorldIdVerified
                  ? 'bg-[#00a572]/20 text-[#4edea3]'
                  : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
              }`}
            >
              {userAccount.isWorldIdVerified ? 'Humanity Verified ✓' : 'Unverified'}
            </span>
          </div>

          <p className="text-xs text-[#c2c6d6] leading-relaxed">
            Verify with <strong className="text-[#dae2fd]">World ID</strong> to unlock your free RiskSearcher trial. This helps prevent Sybil abuse and keeps free access fair for genuine forensic analysts.
          </p>

          {userAccount.isWorldIdVerified ? (
            <div className="bg-[#00a572]/15 border border-[#00a572]/30 p-3.5 rounded-xl space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[#4edea3] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Humanity verified ✓</span>
                </div>
                <span className="text-[10px] bg-[#00a572]/20 px-2 py-0.5 rounded">15 Scans Unlocked</span>
              </div>
              <span className="text-[#8c909f] text-[11px] block">
                Proof Nullifier: #0x4299...a18f (Verified anonymously on World Chain)
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] font-mono text-xs text-[#ffb4ab]">
                <span>⚠ Free trial locked until humanity verification.</span>
              </div>
              <button
                type="button"
                onClick={onOpenWorldIdModal}
                className="w-full py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                <span>Verify with World ID (Unlock 15 Scans)</span>
              </button>
            </div>
          )}

          {/* Capacity Meter */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between font-mono text-xs text-[#8c909f]">
              <span>Scan Usage Capacity</span>
              <span className="text-[#dae2fd] font-semibold">{percentageUsed}% used</span>
            </div>
            <div className="w-full bg-[#060e20] h-2.5 rounded-full overflow-hidden border border-[#222a3d]">
              <div
                className="bg-gradient-to-r from-[#4d8eff] to-[#4cd7f6] h-full rounded-full transition-all duration-500"
                style={{ width: `${percentageUsed}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-[#8c909f]">
              <span>{remainingScans} scans remaining</span>
              <span>{userAccount.activeSubscription ? 'Pro Plan Unlimited' : 'Resets monthly'}</span>
            </div>
          </div>
        </div>

        {/* Institutional Identity & API Token (Cols 6-12) */}
        <div className="lg:col-span-7 bg-[#131b2e] p-6 rounded-2xl border border-[#222a3d] space-y-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#060e20] border border-[#4d8eff]/30 flex items-center justify-center text-[#4d8eff]">
                <span className="material-symbols-outlined text-[22px]">vpn_key</span>
              </div>
              <div>
                <h3 className="font-semibold text-base text-[#dae2fd]">Vault Execution Node</h3>
                <span className="font-mono text-xs text-[#8c909f]">Gasless ERC-4337 Relayer Session</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#060e20] text-[#adc6ff] font-mono text-xs font-bold border border-[#222a3d]">
              Tier-1 Node
            </span>
          </div>

          {/* Primary Address */}
          <div className="space-y-1.5">
            <span className="font-mono text-xs text-[#8c909f] uppercase tracking-wider block">
              Smart Account Execution Address
            </span>
            <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] flex items-center justify-between gap-2">
              <span className="font-mono text-xs sm:text-sm text-[#dae2fd] truncate select-all">
                {userAccount.address}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleCopyAddress}
                  className="text-[#8c909f] hover:text-[#dae2fd] p-1.5 rounded hover:bg-[#222a3d] transition-colors"
                  title="Copy"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedAddr ? 'check' : 'content_copy'}
                  </span>
                </button>
                <a
                  href={`https://etherscan.io/address/${userAccount.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8c909f] hover:text-[#dae2fd] p-1.5 rounded hover:bg-[#222a3d] transition-colors"
                  title="View on Etherscan"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              </div>
            </div>
            <span className="font-mono text-[11px] text-[#4edea3] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              <span>Gasless Relayer Active (ERC-4337 UserOps Sponsored)</span>
            </span>
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#8c909f] uppercase tracking-wider">
                Production Audit API Token
              </span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="font-mono text-xs text-[#4cd7f6] hover:underline"
              >
                {showApiKey ? 'Hide Token' : 'Reveal Token'}
              </button>
            </div>
            <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] flex items-center justify-between gap-2">
              <span className="font-mono text-xs sm:text-sm text-[#4cd7f6] truncate">
                {showApiKey ? userAccount.apiKey : 'rk_live_••••••••••••••••••••••••••••••••'}
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-3 py-1 rounded font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedKey ? 'check' : 'content_copy'}
                </span>
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* USDC Ledger Activity */}
      <div className="bg-[#131b2e] p-6 rounded-2xl border border-[#222a3d] space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222a3d]">
          <div className="space-y-1">
            <h3 className="font-semibold text-base sm:text-lg text-[#dae2fd]">Ledger Activity</h3>
            <p className="font-mono text-xs text-[#8c909f]">
              Settlement history across wallet transactions and RiskSearcher service operations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddFundsModal('receive')}
              className="bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] px-3.5 py-2 rounded-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Add Funds</span>
            </button>
            <button
              onClick={onOpenWithdrawModal}
              className="bg-[#222a3d] hover:bg-[#2d3449] text-[#c2c6d6] px-3.5 py-2 rounded-xl font-mono text-xs transition-colors"
            >
              Withdraw Wallet
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#060e20] text-[#8c909f] border-b border-[#222a3d]">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Scope</th>
                <th className="py-3 px-4 font-semibold">Type / Operation</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Tx Reference</th>
                <th className="py-3 px-4 font-semibold text-right">Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222a3d]/70 text-[#dae2fd]">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#171f33] transition-colors">
                  <td className="py-3 px-4 text-[#c2c6d6] whitespace-nowrap">{tx.timestamp}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        tx.category === 'wallet'
                          ? 'bg-[#4d8eff]/20 text-[#adc6ff]'
                          : 'bg-[#4cd7f6]/20 text-[#4cd7f6]'
                      }`}
                    >
                      {tx.category === 'wallet' ? 'Wallet' : 'Service'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#8c909f]">
                        {tx.typeIcon}
                      </span>
                      <span>{tx.operation}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        tx.isFree
                          ? 'text-[#4cd7f6]'
                          : tx.isCredit
                          ? 'text-[#4edea3]'
                          : 'text-[#ffb4ab]'
                      }`}
                    >
                      {tx.amount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#8c909f]">
                    <span className="hover:text-[#4cd7f6] transition-colors">{tx.txHash}</span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-bold text-[10px] uppercase">
                      {tx.settlement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
