import React from 'react';
import { SUPPORTED_CHAINS } from '../data/mockData';
import { EVMNetwork } from '../types';

interface SupportedChainsViewProps {
  onSelectChainForScan: (chain: EVMNetwork) => void;
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
  onOpenWalletModal?: (prompt?: string) => void;
}

export const SupportedChainsView: React.FC<SupportedChainsViewProps> = ({
  onSelectChainForScan,
  onNavigate,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  return (
    <div className="w-full max-w-[88rem] mx-auto px-4 lg:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171f33] border border-[#222a3d] text-xs font-mono text-[#4cd7f6]">
          <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
          <span>7 SUPPORTED EVM NETWORKS</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#dae2fd] tracking-tight">
          Supported Chains
        </h1>
        <p className="text-base text-[#c2c6d6] leading-relaxed">
          RiskSearcher can fetch source/bytecode and transaction evidence across these EVM networks using its configured providers. The Graph evidence is added where the current analyzer supports it.
        </p>
      </div>

      {/* Grid of Chains */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SUPPORTED_CHAINS.map((chain) => (
          <div
            key={chain.name}
            className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] hover:border-[#4cd7f6]/40 transition-all space-y-4 shadow-lg group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg bg-[#222a3d] flex items-center justify-center font-mono font-bold text-sm"
                  style={{ color: chain.color }}
                >
                  {chain.symbol.slice(0, 3)}
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#dae2fd] group-hover:text-[#4cd7f6] transition-colors">
                    {chain.name}
                  </h3>
                  <span className="font-mono text-xs text-[#8c909f]">Native Token: {chain.symbol}</span>
                </div>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-bold">
                SUPPORTED
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#060e20] p-3 rounded-lg border border-[#222a3d] font-mono text-xs">
              <div>
                <span className="text-[10px] text-[#8c909f] block">SOURCE</span>
                <span className="text-[#4cd7f6] font-bold">Explorer/API</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8c909f] block">BYTECODE</span>
                <span className="text-[#dae2fd] font-bold">RPC</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8c909f] block">ANALYSIS</span>
                <span className="text-[#4edea3] font-bold">Enabled</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-[#c2c6d6]">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8c909f]">Analysis Engine:</span>
                <span className="text-[#dae2fd]">Rules + Bytecode Fallback</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8c909f]">Transaction Evidence:</span>
                <span className="text-[#dae2fd]">RPC / The Graph where available</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (!isWalletConnected) {
                  onOpenWalletModal?.(
                    `Sign in with your passkey to run contract analysis on ${chain.name}.`
                  );
                  return;
                }
                onSelectChainForScan(chain.name as EVMNetwork);
                onNavigate('scanner');
              }}
              className="w-full py-2 bg-[#222a3d] hover:bg-[#4d8eff] hover:text-[#00285d] text-[#dae2fd] font-mono text-xs rounded-lg transition-colors font-semibold flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">
                {!isWalletConnected ? 'lock' : 'radar'}
              </span>
              <span>
                {!isWalletConnected ? `Connect to Scan ${chain.name}` : `Launch Scan on ${chain.name}`}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
