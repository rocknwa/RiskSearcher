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
          <span>RISKSEARCHER SPECIFICATIONS &amp; API SPEC v4.22</span>
        </div>
        <h1 className="text-3xl font-bold text-[#dae2fd]">Documentation &amp; Forensic Mechanics</h1>
        <p className="text-sm text-[#c2c6d6] max-w-3xl">
          Complete guide to how RiskSearcher conducts adversarial opcode decompilation, sandboxed sell simulation, and multi-LLM consensus classification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Architecture */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4d8eff]">settings_system_daydream</span>
              <span>1. Deterministic Sandbox Simulation</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
              Whenever an address is queried, RiskSearcher immediately spins up an ephemeral state fork at the current block height. We fund a dummy test account with simulated native token collateral and attempt a two-step transaction:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-[#dae2fd] font-mono pl-2">
              <li><strong className="text-[#4cd7f6]">buyTokens():</strong> Swap native ETH/USDC for target tokens via the highest liquidity pool.</li>
              <li><strong className="text-[#ffb4ab]">sellTokens():</strong> Approve the router and swap target tokens back to the base pair.</li>
            </ol>
            <p className="text-xs text-[#8c909f] leading-relaxed">
              If the sell transaction reverts with opcode 0xFD, custom error 0x08c379a0, or consumes &gt; 500,000 gas units, the token is deterministically categorized as an active Honeypot.
            </p>
          </div>

          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4cd7f6]">psychology</span>
              <span>2. Multi-LLM Specialist Jury</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
              Dynamic taxes and time-delayed rugs cannot always be triggered in a single block. To prevent countdown traps, decompiled abstract syntax trees (AST) are concurrently evaluated by three specialized AI models:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#4cd7f6] font-bold block">Tax Logic Agent</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Detects variable math modifiers and uncapped fee setters.</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#4edea3] font-bold block">Proxy Storage Agent</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Finds hidden fallback admins and diamond storage traps.</span>
              </div>
              <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <span className="font-mono text-[11px] text-[#adc6ff] font-bold block">Consensus Judge</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Aggregates execution logs into the final 0-100 score.</span>
              </div>
            </div>
          </div>

          <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] space-y-4">
            <h2 className="text-lg font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3]">api</span>
              <span>3. Programmatic API Integration</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
              Integrate RiskSearcher directly into your decentralized application, trading bot, or wallet RPC proxy using standard HTTP POST requests:
            </p>
            <pre className="font-mono text-xs bg-[#060e20] p-3 rounded border border-[#222a3d] text-[#adc6ff] overflow-x-auto">
{`curl -X POST https://api.risksearcher.sec/v1/scan \\
  -H "Authorization: Bearer rk_live_9f829f041b..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "ethereum",
    "contract": "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  }'`}
            </pre>

            {/* Authenticated API Keys Gate Notice */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-[#060e20] border border-[#222a3d]">
              <div className="flex items-center gap-2.5 text-xs text-[#c2c6d6]">
                <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">
                  {isWalletConnected ? 'key' : 'lock'}
                </span>
                <span>
                  {isWalletConnected
                    ? 'Your unique API key is active and provisioned for your account.'
                    : 'Production API tokens and quota are private and require an authenticated wallet.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isWalletConnected) {
                    onOpenWalletModal?.(
                      'Authentication Required: Connect your Web3 wallet or sign in to view and generate your Production Audit API Key.'
                    );
                  } else {
                    onNavigate('accounts');
                  }
                }}
                className="font-mono text-xs font-semibold px-3 py-1.5 rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] hover:text-[#acedff] flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {!isWalletConnected && (
                  <span className="material-symbols-outlined text-[14px] text-[#ffb4ab]">lock</span>
                )}
                <span>{isWalletConnected ? 'Manage API Key' : 'Connect to View API Key'}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
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
                      'Authentication Required: Connect your Web3 wallet or sign in to launch interactive contract scans.'
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
                      'Authentication Required: Connect your Web3 wallet or sign in with Passkey / Google / Apple to view your Production API Key, balances, and quota.'
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
                  <span>View API Keys &amp; Quota</span>
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
              RiskSearcher is developed under the Open EVM Security Standard. Opcode patterns and heuristic models are updated continuously with newly observed on-chain exploit signatures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
