import React from 'react';

interface DocumentationViewProps {
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
  onOpenWalletModal?: (prompt?: string) => void;
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  onNavigate,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  return (
    <div className="w-full max-w-[88rem] mx-auto px-4 lg:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2 pb-4 border-b border-[#222a3d]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171f33] border border-[#222a3d] text-xs font-mono text-[#4cd7f6]">
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          <span>RISKSEARCHER PRODUCT &amp; ANALYSIS NOTES</span>
        </div>
        <h1 className="text-3xl font-bold text-[#dae2fd]">Documentation &amp; Forensic Mechanics</h1>
        <p className="text-sm text-[#c2c6d6] max-w-3xl">
          Overview of RiskSearcher's deterministic rule analysis, verified-source/bytecode fallback, transaction evidence, and specialist + judge reasoning pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Architecture */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4d8eff]">settings_system_daydream</span>
              <span>1. Deterministic Contract Analysis</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
              For each address, RiskSearcher fetches verified source when available and falls back to bytecode/opcode inspection when it is not. Deterministic rules identify concrete risk signals before the LLM review stage.
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-[#dae2fd] font-mono pl-2">
              <li>• Verified source analysis when explorer source is available.</li>
              <li>• Bytecode/opcode fallback for unverified contracts.</li>
              <li>• Historical transaction and The Graph evidence where available.</li>
            </ul>
            <p className="text-xs text-[#8c909f] leading-relaxed">
              The rules engine produces deterministic findings and a baseline score; it does not pretend to execute a live mempool or local-fork sell simulation.
            </p>
          </div>

          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd7f6]">psychology</span>
              <span>2. Specialist + Judge Reasoning</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
              An LLM specialist checks the contract for common rug and honeypot patterns, then a judge reconciles those findings against the deterministic rules engine before RiskSearcher presents the final verdict.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#4cd7f6] font-bold block">Risk Specialist</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Reviews liquidity, mint privilege, trading controls, upgradeability, ownership, sell blocking, and balance gating.</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#4edea3] font-bold block">Deterministic Rules</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Provides reproducible source/bytecode findings and baseline scoring.</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#adc6ff] font-bold block">Judge</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Reconciles specialist findings with deterministic evidence for the final assessment.</span>
              </div>
            </div>
          </div>

          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3]">api</span>
              <span>3. Programmatic API Access</span>
            </h2>
            <div className="rounded-lg border border-[#222a3d] bg-[#060e20] p-4">
              <div className="flex items-center gap-2 font-semibold text-[#dae2fd]">
                <span className="material-symbols-outlined text-[18px] text-[#8c909f]">schedule</span>
                Public API keys are coming soon
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
                The current web app uses a passkey-authenticated backend session. RiskSearcher does not expose or display a fake production API token.
              </p>
            </div>
            <button type="button" onClick={() => isWalletConnected ? onNavigate('accounts') : onOpenWalletModal?.('Sign in with your passkey to view your account and scan credits.')} className="font-mono text-xs font-semibold px-3 py-2 rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] transition-colors">
              {isWalletConnected ? 'View account' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Quick Links & CTA */}
        <div className="space-y-6">
          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h3 className="font-semibold text-base text-[#dae2fd]">Quick Actions</h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (!isWalletConnected) {
                    onOpenWalletModal?.(
                      'Sign in with your passkey to launch interactive contract scans.'
                    );
                  } else {
                    onNavigate('scanner');
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#4d8eff] text-[#00285d] font-semibold text-xs rounded-lg hover:bg-[#adc6ff] flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  {!isWalletConnected && (
                    <span className="material-symbols-outlined text-[16px] text-[#00285d]">lock</span>
                  )}
                  <span>Run Interactive Scan</span>
                </div>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isWalletConnected) {
                    onOpenWalletModal?.(
                      'Sign in with your passkey to view your real balance, scan credits, and activity.'
                    );
                  } else {
                    onNavigate('accounts');
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#222a3d] text-[#dae2fd] font-semibold text-xs rounded-lg hover:bg-[#2d3449] flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  {!isWalletConnected && (
                    <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
                  )}
                  <span>View Wallet &amp; Scan Credits</span>
                </div>
                <span className="material-symbols-outlined text-[16px]">
                  {isWalletConnected ? 'key' : 'lock'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('supported-chains')}
                className="w-full py-2.5 px-4 bg-[#222a3d] text-[#dae2fd] font-semibold text-xs rounded-lg hover:bg-[#2d3449] flex items-center justify-between transition-colors"
              >
                <span>Supported EVM Chains</span>
                <span className="material-symbols-outlined text-[16px]">lan</span>
              </button>
            </div>
          </div>

          <div className="bg-[#171f33] p-5 rounded-xl border border-[#222a3d] space-y-2">
            <span className="font-mono text-[11px] text-[#4edea3] font-bold uppercase block">
              Auditor Note
            </span>
            <p className="text-xs text-[#c2c6d6] leading-relaxed">
              RiskSearcher combines deterministic source/bytecode checks with transaction evidence and an LLM specialist + judge. Results are risk signals, not a substitute for a full manual audit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
