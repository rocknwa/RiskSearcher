import React, { useState } from 'react';
import { UserAccountState, LedgerTransaction } from '../types';
import { FREE_TRIAL_SCANS, SUBSCRIPTION_PRICE_USDC, SUBSCRIPTION_SCANS } from '../config';

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

function formatTimestamp(value: string | null): string {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function shortRef(value: string): string {
  if (!value) return '—';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
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
  const [copiedAddr, setCopiedAddr] = useState(false);

  if (!isWalletConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#0b1326] px-4 py-16">
        <div className="w-full max-w-2xl rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 text-center shadow-xl sm:p-9">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#4d8eff]/40 bg-[#060e20] text-[#4d8eff]">
            <span className="material-symbols-outlined text-[34px]">account_balance_wallet</span>
          </div>
          <h1 className="text-2xl font-bold text-[#dae2fd] sm:text-3xl">Wallet &amp; activity are private</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#c2c6d6]">
            Sign in with your passkey to load your real Arc Testnet balance, scan entitlement, and per-user ledger. RiskSearcher does not show demo balances or activity here.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onOpenWalletModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4d8eff] px-6 py-3 font-bold text-[#00285d] transition-colors hover:bg-[#adc6ff]"
            >
              <span className="material-symbols-outlined text-[20px]">key</span>
              Sign in with passkey
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="rounded-xl border border-[#222a3d] bg-[#171f33] px-5 py-3 font-mono text-xs text-[#c2c6d6] transition-colors hover:bg-[#222a3d]"
            >
              Return to overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyAddress = async () => {
    if (!userAccount.address) return;
    await navigator.clipboard.writeText(userAccount.address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const availableScans = userAccount.freeScansRemaining + userAccount.paidScansRemaining;
  const earnedCapacity = (userAccount.isWorldIdVerified ? FREE_TRIAL_SCANS : 0) + userAccount.paidScansRemaining + userAccount.totalScansExecuted;
  const capacityDenominator = Math.max(earnedCapacity, availableScans, 1);
  const percentageUsed = Math.min(100, Math.round((userAccount.totalScansExecuted / capacityDenominator) * 100));

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#222a3d]/70 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="font-mono text-xs text-[#8c909f]">RiskSearcher / Wallet &amp; Access</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#dae2fd]">Wallet &amp; Scan Credits</h1>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 rounded bg-[#222a3d] px-2.5 py-1 font-mono text-xs text-[#c2c6d6] hover:bg-[#2d3449]"
            >
              <span className="material-symbols-outlined text-[14px]">{copiedAddr ? 'check' : 'content_copy'}</span>
              {copiedAddr ? 'Copied' : 'Copy identity address'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#222a3d] bg-[#171f33] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[#4edea3]"></span>
          <span className="font-mono text-xs font-semibold text-[#dae2fd]">{userAccount.walletType}</span>
          <span className="rounded bg-[#03b5d3]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#4cd7f6]">{userAccount.accountType}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4d8eff]/30 bg-[#060e20] text-[#4d8eff]">
                <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              </div>
              <div>
                <span className="block font-mono text-xs font-semibold uppercase tracking-wider text-[#8c909f]">Arc Testnet</span>
                <h2 className="text-lg font-bold text-[#dae2fd]">Circle wallet balance</h2>
              </div>
            </div>
            <span className="rounded bg-[#00a572]/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#4edea3]">Live balance</span>
          </div>

          <div>
            <div className="font-mono text-3xl font-bold text-[#4edea3] sm:text-4xl">${userAccount.walletUsdcBalance.toFixed(2)} USDC</div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-[#8c909f]">
              Loaded from the Circle Developer-Controlled Wallet mapped to your authenticated passkey identity. No placeholder balance is used.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[#222a3d]/70 pt-3 sm:grid-cols-4">
            <button type="button" onClick={() => onOpenAddFundsModal('receive')} className="flex flex-col items-center gap-1 rounded-xl border border-[#222a3d] bg-[#060e20] px-3 py-2.5 font-mono text-xs font-semibold text-[#4cd7f6] hover:bg-[#171f33]">
              <span className="material-symbols-outlined text-[18px]">water_drop</span><span>Faucet / Receive</span>
            </button>
            <button type="button" onClick={() => onOpenAddFundsModal('buy')} className="flex flex-col items-center gap-1 rounded-xl border border-[#222a3d] bg-[#060e20] px-3 py-2.5 font-mono text-xs font-semibold text-[#8c909f] hover:bg-[#171f33]">
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span><span>On-ramp</span><span className="text-[9px] uppercase">Coming soon</span>
            </button>
            <button type="button" onClick={onOpenSendModal} className="flex flex-col items-center gap-1 rounded-xl border border-[#222a3d] bg-[#060e20] px-3 py-2.5 font-mono text-xs font-semibold text-[#adc6ff] hover:bg-[#171f33]">
              <span className="material-symbols-outlined text-[18px]">north_east</span><span>Send on Arc</span>
            </button>
            <button type="button" onClick={onOpenWithdrawModal} className="flex flex-col items-center gap-1 rounded-xl border border-[#222a3d] bg-[#060e20] px-3 py-2.5 font-mono text-xs font-semibold text-[#8c909f] hover:bg-[#171f33]">
              <span className="material-symbols-outlined text-[18px]">account_balance</span><span>Off-ramp</span><span className="text-[9px] uppercase">Coming soon</span>
            </button>
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4cd7f6]/30 bg-[#060e20] text-[#4cd7f6]">
                <span className="material-symbols-outlined text-[22px]">verified_user</span>
              </div>
              <div>
                <span className="block font-mono text-xs font-semibold uppercase tracking-wider text-[#8c909f]">Authoritative backend entitlement</span>
                <h2 className="text-lg font-bold text-[#dae2fd]">Scan credits</h2>
              </div>
            </div>
            <span className="rounded bg-[#03b5d3]/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#4cd7f6]">{availableScans} available</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#222a3d] bg-[#060e20] p-3 text-center">
              <div className="font-mono text-2xl font-bold text-[#4edea3]">{userAccount.freeScansRemaining}</div>
              <div className="mt-1 font-mono text-[10px] uppercase text-[#8c909f]">Free</div>
            </div>
            <div className="rounded-xl border border-[#222a3d] bg-[#060e20] p-3 text-center">
              <div className="font-mono text-2xl font-bold text-[#adc6ff]">{userAccount.paidScansRemaining}</div>
              <div className="mt-1 font-mono text-[10px] uppercase text-[#8c909f]">Paid</div>
            </div>
            <div className="rounded-xl border border-[#222a3d] bg-[#060e20] p-3 text-center">
              <div className="font-mono text-2xl font-bold text-[#dae2fd]">{userAccount.totalScansExecuted}</div>
              <div className="mt-1 font-mono text-[10px] uppercase text-[#8c909f]">Completed</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!userAccount.isWorldIdVerified && (
              <button type="button" onClick={onOpenWorldIdModal} className="flex-1 rounded-xl bg-[#4edea3] px-4 py-3 text-xs font-bold text-[#003824] hover:bg-[#6ffbbe]">
                Verify humanity — get {FREE_TRIAL_SCANS} free scans
              </button>
            )}
            <button type="button" onClick={onOpenSubscriptionModal} className="flex-1 rounded-xl bg-[#4d8eff] px-4 py-3 text-xs font-bold text-[#00285d] hover:bg-[#adc6ff]">
              Get {SUBSCRIPTION_SCANS} scans — ${SUBSCRIPTION_PRICE_USDC} testnet USDC
            </button>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-[#8c909f]">
            Every fresh analysis or re-analysis consumes one credit. Paid scan packs do not auto-renew and service credits cannot be withdrawn.
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-4 rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
            <div>
              <h3 className="font-semibold text-[#dae2fd]">World ID verification</h3>
              <p className="mt-1 font-mono text-[11px] text-[#8c909f]">One human → one free-trial allocation</p>
            </div>
            <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${userAccount.isWorldIdVerified ? 'bg-[#00a572]/20 text-[#4edea3]' : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'}`}>
              {userAccount.isWorldIdVerified ? 'Verified' : 'Unverified'}
            </span>
          </div>
          {userAccount.isWorldIdVerified ? (
            <div className="rounded-xl border border-[#00a572]/30 bg-[#00a572]/15 p-4 font-mono text-xs text-[#4edea3]">
              Humanity verified. The one-time free allocation is {FREE_TRIAL_SCANS} scans; remaining free scans: {userAccount.freeScansRemaining}.
            </div>
          ) : (
            <button type="button" onClick={onOpenWorldIdModal} className="w-full rounded-xl bg-[#4edea3] px-4 py-3 text-xs font-bold text-[#003824] hover:bg-[#6ffbbe]">
              Verify with World ID — unlock {FREE_TRIAL_SCANS} scans
            </button>
          )}
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-[11px] text-[#8c909f]"><span>Observed scan usage</span><span>{percentageUsed}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full border border-[#222a3d] bg-[#060e20]"><div className="h-full rounded-full bg-[#4d8eff] transition-all" style={{ width: `${percentageUsed}%` }} /></div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl lg:col-span-7">
          <div className="border-b border-[#222a3d] pb-3">
            <h3 className="font-semibold text-[#dae2fd]">Passkey identity &amp; API access</h3>
            <p className="mt-1 font-mono text-[11px] text-[#8c909f]">Authenticated smart-account identity for this session</p>
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#8c909f]">Identity address</div>
            <div className="flex items-center gap-2 rounded-xl border border-[#222a3d] bg-[#060e20] p-3">
              <span className="min-w-0 flex-1 break-all font-mono text-xs text-[#dae2fd]">{userAccount.address}</span>
              <button type="button" onClick={handleCopyAddress} className="shrink-0 rounded bg-[#222a3d] p-2 text-[#c2c6d6] hover:bg-[#2d3449]" title="Copy address"><span className="material-symbols-outlined text-[16px]">{copiedAddr ? 'check' : 'content_copy'}</span></button>
            </div>
          </div>
          <div className="rounded-xl border border-[#222a3d] bg-[#060e20] p-4">
            <div className="flex items-center gap-2 font-semibold text-[#dae2fd]"><span className="material-symbols-outlined text-[18px] text-[#8c909f]">api</span>Public API access — coming soon</div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-[#8c909f]">No fake production API token is displayed. The current web app uses the authenticated session directly.</p>
          </div>
        </section>
      </div>

      <section className="space-y-5 rounded-2xl border border-[#222a3d] bg-[#131b2e] p-6 shadow-xl">
        <div className="flex flex-col justify-between gap-4 border-b border-[#222a3d] pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#dae2fd] sm:text-lg">Ledger Activity</h3>
            <p className="mt-1 font-mono text-xs text-[#8c909f]">Real activity for this authenticated user: Circle wallet transactions plus RiskSearcher service-credit events.</p>
          </div>
          <button type="button" onClick={() => onOpenAddFundsModal('receive')} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#4d8eff] px-3.5 py-2 font-mono text-xs font-semibold text-[#00285d] hover:bg-[#adc6ff]">
            <span className="material-symbols-outlined text-[16px]">water_drop</span>Faucet / Add Funds
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead><tr className="border-b border-[#222a3d] bg-[#060e20] text-[#8c909f]"><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Operation</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Settlement</th></tr></thead>
            <tbody className="divide-y divide-[#222a3d]/70 text-[#dae2fd]">
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8c909f]">No real wallet or service activity yet.</td></tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#171f33]">
                  <td className="whitespace-nowrap px-4 py-3 text-[#c2c6d6]">{formatTimestamp(tx.timestamp)}</td>
                  <td className="whitespace-nowrap px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${tx.category === 'wallet' ? 'bg-[#4d8eff]/20 text-[#adc6ff]' : 'bg-[#4cd7f6]/20 text-[#4cd7f6]'}`}>{tx.category}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#8c909f]">{tx.typeIcon}</span><span>{tx.operation}</span></div></td>
                  <td className={`whitespace-nowrap px-4 py-3 font-semibold ${tx.isFree ? 'text-[#4cd7f6]' : tx.isCredit ? 'text-[#4edea3]' : 'text-[#ffb4ab]'}`}>{tx.amount}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#8c909f]" title={tx.txHash}>{shortRef(tx.txHash)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right"><span className="rounded bg-[#00a572]/20 px-2 py-0.5 text-[10px] font-bold uppercase text-[#4edea3]">{tx.settlement}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
