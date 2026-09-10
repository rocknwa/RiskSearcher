import React from 'react';
import { UserAccountState } from '../types';
import { SUBSCRIPTION_PRICE_USDC } from '../config';

interface PricingViewProps {
  onOpenSubscriptionModal: () => void;
  onOpenWorldIdModal: () => void;
  onNavigate: (view: string) => void;
  userAccount: UserAccountState;
  isWalletConnected?: boolean;
  onOpenWalletModal?: () => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  onOpenSubscriptionModal,
  onOpenWorldIdModal,
  onNavigate,
  userAccount,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  return (
    <div className="w-full max-w-[88rem] mx-auto px-4 lg:px-6 py-10 space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171f33] border border-[#222a3d] text-xs font-mono text-[#4edea3]">
          <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
          <span>TRANSPARENT RISK TRIAGE &amp; SERVICE TIERS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-[#dae2fd] tracking-tight">
          Verifiable Security for Every Trader
        </h1>
        <p className="text-base sm:text-lg text-[#c2c6d6] leading-relaxed">
          Start with 15 free forensic scans by verifying humanity with World ID. Subscribe for high-volume automated contract investigations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
        {/* Tier 1: Free Trial */}
        <div className="bg-[#131b2e] p-6 lg:p-8 rounded-xl border border-[#222a3d] flex flex-col justify-between space-y-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#8c909f] uppercase font-semibold">Free Trial</span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                  isWalletConnected && userAccount.isWorldIdVerified
                    ? 'bg-[#00a572]/20 text-[#4edea3]'
                    : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
                }`}
              >
                {isWalletConnected && userAccount.isWorldIdVerified
                  ? 'Humanity Verified ✓'
                  : isWalletConnected
                  ? 'Requires World ID'
                  : 'Sign In Required'}
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-bold text-[#dae2fd]">$0</span>
              <span className="text-sm text-[#8c909f]"> / trial</span>
            </div>
            <p className="text-xs sm:text-sm text-[#c2c6d6] mt-2 leading-relaxed">
              Verify your humanity with World ID to prevent bot abuse and unlock 15 complimentary multi-stage scans.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-xs text-[#c2c6d6]">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>15 Free Scans unlocked with World ID</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>zk-SNARK Anonymous Sybil Defense</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Full 5-stage Multi-Judge consensus</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>7 EVM Networks coverage</span>
              </li>
            </ul>
          </div>

          {isWalletConnected && userAccount.isWorldIdVerified ? (
            <button
              onClick={() => onNavigate('scanner')}
              className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>Launch Free Scanner</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : isWalletConnected ? (
            <button
              onClick={onOpenWorldIdModal}
              className="w-full py-2.5 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">fingerprint</span>
              <span>Verify with World ID</span>
            </button>
          ) : (
            <button
              onClick={onOpenWalletModal}
              className="w-full py-2.5 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              <span>Connect to Verify Humanity</span>
            </button>
          )}
        </div>

        {/* Tier 2: Pro Analyst ($20/month) */}
        <div className="bg-[#222a3d] p-6 lg:p-8 rounded-xl border-2 border-[#4d8eff] flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#4d8eff] text-[#00285d] font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
            Recommended
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#adc6ff] uppercase font-semibold">Pro Analyst</span>
              {isWalletConnected && userAccount.activeSubscription && (
                <span className="px-2 py-0.5 rounded bg-[#00a572]/30 text-[#4edea3] font-mono text-xs font-bold">
                  Active
                </span>
              )}
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-bold text-[#dae2fd]">${SUBSCRIPTION_PRICE_USDC}</span>
              <span className="text-sm text-[#8c909f]"> / month USDC</span>
            </div>
            <p className="text-xs sm:text-sm text-[#c2c6d6] mt-2 leading-relaxed">
              For active traders, research analysts, and protocol auditors needing reliable, high-volume contract checks.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-xs text-[#dae2fd]">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>200 unmetered scans per month</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Full REST API Key &amp; Webhook access</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Priority mempool execution nodes</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Automated AST decompilation &amp; PDF export</span>
              </li>
              <li className="flex items-center gap-2 text-[#8c909f] text-[11px] pt-1 border-t border-[#2d3449]">
                <span className="material-symbols-outlined text-[14px]">info</span>
                <span>Prepaid service credit (non-withdrawable)</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              if (!isWalletConnected) {
                if (onOpenWalletModal) onOpenWalletModal();
              } else {
                onOpenSubscriptionModal();
              }
            }}
            className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] font-bold text-xs sm:text-sm rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {!isWalletConnected ? 'lock' : 'stars'}
            </span>
            <span>
              {!isWalletConnected
                ? 'Connect Wallet to Subscribe'
                : userAccount.activeSubscription
                ? 'Manage Subscription'
                : 'Subscribe with USDC'}
            </span>
          </button>
        </div>

        {/* Tier 3: Institutional Vault */}
        <div className="bg-[#131b2e] p-6 lg:p-8 rounded-xl border border-[#222a3d] flex flex-col justify-between space-y-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#8c909f] uppercase font-semibold">Institutional Vault</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl sm:text-4xl font-bold text-[#dae2fd]">$499</span>
              <span className="text-sm text-[#8c909f]"> / month USDC</span>
            </div>
            <p className="text-xs sm:text-sm text-[#c2c6d6] mt-2 leading-relaxed">
              Custom isolated node infrastructure for exchanges, venture DAOs, and custodial protocol signers.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-xs text-[#c2c6d6]">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Unlimited multi-tenant scans</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Custom private LLM model weights</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>Direct Slack/Telegram alert webhooks</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">check</span>
                <span>24/7 dedicated forensic triage team</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              if (!isWalletConnected) {
                if (onOpenWalletModal) onOpenWalletModal();
              } else {
                onOpenSubscriptionModal();
              }
            }}
            className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {!isWalletConnected && (
              <span className="material-symbols-outlined text-[16px] text-[#8c909f]">lock</span>
            )}
            <span>{!isWalletConnected ? 'Connect Wallet for Enterprise' : 'View Enterprise Options'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
