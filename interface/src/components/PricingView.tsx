import React from 'react';
import { UserAccountState } from '../types';
import { FREE_TRIAL_SCANS, SUBSCRIPTION_PRICE_USDC, SUBSCRIPTION_SCANS } from '../config';

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
    <div className="mx-auto w-full max-w-[88rem] space-y-10 px-4 py-10 lg:px-6">
      <div className="mx-auto max-w-3xl space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#222a3d] bg-[#171f33] px-3 py-1 font-mono text-xs text-[#4edea3]">
          <span className="h-2 w-2 rounded-full bg-[#4edea3]"></span>
          ARC TESTNET ACCESS
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#dae2fd] sm:text-5xl">Simple scan access</h1>
        <p className="text-base leading-relaxed text-[#c2c6d6] sm:text-lg">
          Verify once with World ID for {FREE_TRIAL_SCANS} free scans, or buy {SUBSCRIPTION_SCANS} scan credits for ${SUBSCRIPTION_PRICE_USDC} testnet USDC. Every fresh analysis or re-analysis uses one credit.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        <section className="flex flex-col justify-between space-y-6 rounded-xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl lg:p-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-semibold uppercase text-[#8c909f]">Verified human trial</span>
              <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${isWalletConnected && userAccount.isWorldIdVerified ? 'bg-[#00a572]/20 text-[#4edea3]' : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'}`}>
                {isWalletConnected && userAccount.isWorldIdVerified ? 'VERIFIED' : 'WORLD ID REQUIRED'}
              </span>
            </div>
            <div className="mt-4"><span className="text-4xl font-bold text-[#dae2fd]">$0</span><span className="text-sm text-[#8c909f]"> one-time trial</span></div>
            <p className="mt-3 text-sm leading-relaxed text-[#c2c6d6]">World ID gates the free allocation to reduce repeated trial claims from throwaway accounts.</p>
            <div className="mt-6 rounded-xl border border-[#222a3d] bg-[#060e20] p-4 font-mono text-sm text-[#dae2fd]">
              <div className="flex items-center justify-between"><span>Free scans</span><strong className="text-[#4edea3]">{FREE_TRIAL_SCANS}</strong></div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#8c909f]"><span>Remaining on your account</span><span>{userAccount.freeScansRemaining}</span></div>
            </div>
          </div>

          {isWalletConnected && userAccount.isWorldIdVerified ? (
            <button type="button" onClick={() => onNavigate('scanner')} className="w-full rounded-lg bg-[#222a3d] py-3 text-sm font-semibold text-[#dae2fd] hover:bg-[#2d3449]">Open scanner</button>
          ) : isWalletConnected ? (
            <button type="button" onClick={onOpenWorldIdModal} className="w-full rounded-lg bg-[#4edea3] py-3 text-sm font-bold text-[#003824] hover:bg-[#6ffbbe]">Verify with World ID</button>
          ) : (
            <button type="button" onClick={onOpenWalletModal} className="w-full rounded-lg bg-[#4d8eff] py-3 text-sm font-bold text-[#00285d] hover:bg-[#adc6ff]">Sign in first</button>
          )}
        </section>

        <section className="relative flex flex-col justify-between space-y-6 overflow-hidden rounded-xl border-2 border-[#4d8eff] bg-[#222a3d] p-6 shadow-2xl lg:p-8">
          <div className="absolute right-0 top-0 rounded-bl-lg bg-[#4d8eff] px-3 py-1 font-mono text-[10px] font-bold uppercase text-[#00285d]">Arc Testnet</div>
          <div>
            <span className="font-mono text-xs font-semibold uppercase text-[#adc6ff]">10-scan credit pack</span>
            <div className="mt-4"><span className="text-4xl font-bold text-[#dae2fd]">${SUBSCRIPTION_PRICE_USDC}</span><span className="text-sm text-[#8c909f]"> testnet USDC</span></div>
            <p className="mt-3 text-sm leading-relaxed text-[#c2c6d6]">One on-chain testnet payment adds {SUBSCRIPTION_SCANS} paid scan credits after the backend confirms the Circle transaction.</p>
            <div className="mt-6 space-y-3 font-mono text-xs text-[#dae2fd]">
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#4edea3]">check</span>{SUBSCRIPTION_SCANS} scans per pack</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#4edea3]">check</span>No auto-renewal</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#4edea3]">check</span>Credits are enforced server-side</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#4edea3]">check</span>Re-analysis costs one scan too</div>
            </div>
            {isWalletConnected && userAccount.paidScansRemaining > 0 && (
              <div className="mt-5 rounded-lg border border-[#00a572]/30 bg-[#00a572]/15 p-3 font-mono text-xs text-[#4edea3]">You currently have {userAccount.paidScansRemaining} paid scans remaining.</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isWalletConnected) onOpenWalletModal?.();
              else onOpenSubscriptionModal();
            }}
            className="w-full rounded-lg bg-[#4d8eff] py-3 text-sm font-bold text-[#00285d] hover:bg-[#adc6ff]"
          >
            {isWalletConnected ? `Get ${SUBSCRIPTION_SCANS} scans for $${SUBSCRIPTION_PRICE_USDC}` : 'Sign in to buy scan credits'}
          </button>
        </section>
      </div>

      <p className="mx-auto max-w-3xl text-center font-mono text-[11px] leading-relaxed text-[#8c909f]">
        Testnet USDC has no real monetary value. On-ramp and fiat off-ramp are not enabled in this release; use the Arc/Circle testnet faucet to fund the wallet.
      </p>
    </div>
  );
};
