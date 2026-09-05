import React, { useState } from 'react';
import { EVMNetwork } from '../types';

interface LandingPageProps {
  onStartScan: (address: string, network: EVMNetwork) => void;
  onOpenWalletModal: () => void;
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartScan,
  onOpenWalletModal,
  onNavigate,
  isWalletConnected = false,
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<EVMNetwork>('Ethereum');
  const [contractAddress, setContractAddress] = useState('0x6B175474E89094C44Da98b954EedeAC495271d0F');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  const networks: EVMNetwork[] = [
    'Ethereum',
    'Base',
    'Arbitrum',
    'Optimism',
    'BNB Chain',
    'Polygon',
    'Avalanche',
  ];

  const handleRunScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contractAddress.trim()) return;

    if (!isWalletConnected) {
      onStartScan(contractAddress.trim(), selectedNetwork);
      return;
    }

    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      onStartScan(contractAddress, selectedNetwork);
    }, 900);
  };

  const handleQuickFeedClick = (address: string, network: EVMNetwork) => {
    onStartScan(address, network);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Live Network Alert Banner */}
      <div className="w-full bg-[#060e20] border-b border-[#222a3d]/70 py-2 px-4 lg:px-6">
        <div className="max-w-[88rem] mx-auto flex flex-wrap items-center justify-between gap-2 text-[#c2c6d6]">
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-mono font-bold text-[10px] uppercase tracking-wider">
              Live Stream
            </span>
            <span className="font-mono text-[#dae2fd]">Mempool Threat Monitor: Active on 7 Chains</span>
            <span className="text-[#424754]">•</span>
            <span className="font-mono hidden md:inline text-[#8c909f]">
              Block execution simulation engine v4.19 active
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-[#4cd7f6] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              <span>120ms RPC Latency</span>
            </span>
            <span className="text-[#8c909f]">Gas Target: 14 Gwei</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative w-full py-12 lg:py-20 overflow-hidden">
        {/* Ambient Tactical Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-[#4d8eff]/10 blur-[130px] pointer-events-none rounded-full"></div>
        <div className="absolute top-1/3 -right-20 w-[420px] h-[260px] bg-[#4cd7f6]/10 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="max-w-[88rem] mx-auto px-4 lg:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
            {/* Overline Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#222a3d]/70 border border-[#424754]/50 shadow-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] animate-ping"></span>
              <span className="font-mono text-[10px] font-bold uppercase text-[#dae2fd] tracking-wider">
                Multi-Stage Forensic Intelligence
              </span>
              <span className="text-[#424754]">/</span>
              <span className="font-mono text-[10px] font-bold text-[#adc6ff] uppercase">
                Zero-Knowledge Sybil Defense
              </span>
            </div>

            {/* Core Promise Headline */}
            <h1 className="font-bold text-3xl sm:text-5xl lg:text-[46px] text-[#dae2fd] tracking-tight leading-tight">
              Know the risk <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#adc6ff] via-[#4cd7f6] to-[#4edea3]">
                before you buy.
              </span>
            </h1>

            {/* Supporting Message */}
            <p className="mt-4 text-base sm:text-lg text-[#c2c6d6] max-w-3xl leading-relaxed">
              Investigate smart contracts before you interact with them. RiskSearcher analyzes source code, bytecode, transaction behavior, and known risk patterns to surface evidence-backed warnings.
            </p>

            {/* Benchmark Demo Launchers */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-xs text-[#8c909f]">Try benchmark contracts:</span>
              <button
                type="button"
                onClick={() => {
                  setContractAddress('0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571');
                  setSelectedNetwork('Ethereum');
                }}
                className="font-mono text-xs bg-[#131b2e] hover:bg-[#222a3d] text-[#ffb4ab] border border-[#ffb4ab]/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
                <span>FARTPEPE (Flagship 80/100)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
                  setSelectedNetwork('Ethereum');
                }}
                className="font-mono text-xs bg-[#131b2e] hover:bg-[#222a3d] text-[#4edea3] border border-[#4edea3]/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                <span>WETH9 (Safe 0/100)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractAddress('0x0bed281bdfc7bf127cadca5f77e05b20cfb4e100');
                  setSelectedNetwork('Ethereum');
                }}
                className="font-mono text-xs bg-[#131b2e] hover:bg-[#222a3d] text-[#adc6ff] border border-[#222a3d] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Shrimp (Zero-Value)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractAddress('0x92df135c27ab5a2080f5cbcbb0a693c07a283e9c');
                  setSelectedNetwork('Ethereum');
                }}
                className="font-mono text-xs bg-[#131b2e] hover:bg-[#222a3d] text-[#adc6ff] border border-[#222a3d] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>Dolphin (Siphon)</span>
              </button>
            </div>

            {/* Interactive Demo Scan Instrument */}
            <form 
              onSubmit={handleRunScan}
              className="w-full mt-6 bg-[#171f33] p-3 sm:p-4 rounded-xl border border-[#222a3d] shadow-2xl relative"
            >
              <div className="flex flex-col lg:flex-row items-stretch gap-2.5">
                {/* Chain Selector Dropdown */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    className="w-full flex items-center justify-between gap-2.5 bg-[#060e20] hover:bg-[#131b2e] px-3.5 py-3 rounded-lg border border-[#222a3d] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#2d3449] flex items-center justify-center text-[11px] font-bold text-[#dae2fd]">
                        Ξ
                      </span>
                      <span className="font-mono text-sm text-[#dae2fd] font-medium">{selectedNetwork}</span>
                    </div>
                    <span className="material-symbols-outlined text-[#8c909f] text-[18px]">expand_more</span>
                  </button>

                  {showNetworkDropdown && (
                    <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#131b2e] border border-[#222a3d] rounded-lg shadow-2xl z-30 py-1 font-mono text-xs">
                      {networks.map((net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => {
                            setSelectedNetwork(net);
                            setShowNetworkDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-[#222a3d] flex items-center justify-between transition-colors ${
                            selectedNetwork === net ? 'text-[#4cd7f6] bg-[#171f33]' : 'text-[#dae2fd]'
                          }`}
                        >
                          <span>{net}</span>
                          {selectedNetwork === net && (
                            <span className="material-symbols-outlined text-sm text-[#4cd7f6]">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monospace Input Container */}
                <div className="flex-1 relative flex items-center bg-[#060e20] px-3.5 py-3 rounded-lg border border-[#222a3d] focus-within:border-[#4cd7f6]/60 transition-colors min-w-0">
                  <span className="material-symbols-outlined text-[#8c909f] text-[20px] mr-2 shrink-0">
                    fingerprint
                  </span>
                  <input
                    type="text"
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    placeholder="Paste token address (0x...) or pair contract"
                    className="w-full bg-transparent font-mono text-xs sm:text-sm text-[#dae2fd] focus:outline-none placeholder:text-[#8c909f]"
                  />
                  <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#2d3449] text-[#8c909f] font-mono text-[10px] ml-2 shrink-0">
                    <span>CMD</span>
                    <span>K</span>
                  </div>
                </div>

                {/* Primary Scan CTA Button */}
                <button
                  id="landing-analyze-btn"
                  type="submit"
                  disabled={isSimulating}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#4d8eff] text-[#00285d] font-semibold text-sm hover:bg-[#adc6ff] hover:text-[#002e6a] transition-all shadow-lg active:scale-[0.99] shrink-0"
                >
                  {isSimulating ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                      <span>Simulating Opcode Trace...</span>
                    </>
                  ) : !isWalletConnected ? (
                    <>
                      <span className="material-symbols-outlined text-[19px]">lock</span>
                      <span>Connect &amp; Analyze</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">radar</span>
                      <span>Analyze Contract</span>
                    </>
                  )}
                </button>
              </div>

              {/* Secondary Quick Authentications Strip */}
              <div className="mt-3 pt-2.5 border-t border-[#222a3d]/60 flex flex-wrap items-center justify-between gap-3 text-[#c2c6d6]">
                <div className="flex items-center gap-1.5 font-mono text-xs text-[#8c909f]">
                  <span className="text-[#4edea3] material-symbols-outlined text-[16px]">verified</span>
                  <span>Direct mempool dry-run with Hardhat/Anvil fork nodes</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const section = document.getElementById('pipeline-architecture');
                      if (section) section.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="font-mono text-xs text-[#8c909f] hover:text-[#dae2fd] transition-colors flex items-center gap-1 px-2.5 py-1"
                  >
                    <span>See how it works</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenWalletModal}
                    className="font-mono text-xs text-[#dae2fd] hover:text-[#adc6ff] transition-colors flex items-center gap-1 bg-[#222a3d] hover:bg-[#2d3449] px-2.5 py-1 rounded"
                  >
                    <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                    <span>Web3 Wallet</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenWalletModal}
                    className="font-mono text-xs text-[#4cd7f6] hover:text-[#acedff] transition-colors flex items-center gap-1 bg-[#222a3d] hover:bg-[#2d3449] px-2.5 py-1 rounded"
                  >
                    <span className="material-symbols-outlined text-[14px]">passkey</span>
                    <span>Passkey / Social</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Trust Indicators Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-10 text-left">
              <div className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d]">
                <span className="font-mono text-xs text-[#8c909f] uppercase block">Scam Tokens Flagged</span>
                <span className="text-2xl font-bold text-[#dae2fd] tracking-tight mt-1 block">14,820+</span>
                <span className="text-xs text-[#4edea3] flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span>+382 caught past 24h</span>
                </span>
              </div>

              <div className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d]">
                <span className="font-mono text-xs text-[#8c909f] uppercase block">Honeypot Precision</span>
                <span className="text-2xl font-bold text-[#4cd7f6] tracking-tight mt-1 block">0.00%</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Zero recorded false-positives</span>
              </div>

              <div className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d]">
                <span className="font-mono text-xs text-[#8c909f] uppercase block">Supported EVM Chains</span>
                <span className="text-2xl font-bold text-[#dae2fd] tracking-tight mt-1 block">7 Networks</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">ETH, Base, ARB, OP, POL, BNB, AVAX</span>
              </div>

              <div className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d]">
                <span className="font-mono text-xs text-[#8c909f] uppercase block">Triage Speed</span>
                <span className="text-2xl font-bold text-[#4edea3] tracking-tight mt-1 block">&lt; 1.4s</span>
                <span className="text-xs text-[#c2c6d6] mt-1 block">Dual-engine simulated verdict</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Simulated Diagnostic Drawer / Teaser Result */}
      <section className="w-full bg-[#060e20] py-8 border-y border-[#222a3d]/70">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="bg-[#222a3d]/80 border border-[#2d3449] rounded-xl p-5 lg:p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#2d3449]/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#060e20] border border-[#4cd7f6]/40 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">verified_user</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base text-[#dae2fd] truncate">
                      Uniswap V2 Router02 Diagnostic Trace
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-mono text-[10px] font-bold">
                      SAFE VERDICT
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#8c909f] truncate block mt-0.5">
                    Target: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D • Ethereum Mainnet
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="font-mono text-[11px] text-[#8c909f] block">COMPOSITE RISK INDEX</span>
                  <span className="text-xl font-bold text-[#4edea3]">02 / 100</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#060e20] flex items-center justify-center text-[#4edea3] font-mono font-bold">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-[#2d3449]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    />
                    <path
                      className="text-[#4edea3]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray="98, 100"
                      strokeLinecap="round"
                      strokeWidth="3.5"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Telemetry Data Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
              <div className="bg-[#060e20] p-3.5 rounded-lg border border-[#222a3d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8c909f]">SELL TAX SIMULATION</span>
                  <span className="text-[#4edea3] font-mono text-[10px] uppercase font-bold">0.00% Verified</span>
                </div>
                <p className="text-xs text-[#c2c6d6] mt-2 leading-relaxed">
                  Gas consumed: 21,490 units. No dynamic fee modifier detected in fallback dispatch.
                </p>
              </div>

              <div className="bg-[#060e20] p-3.5 rounded-lg border border-[#222a3d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8c909f]">LIQUIDITY PERMIT</span>
                  <span className="text-[#4edea3] font-mono text-[10px] uppercase font-bold">Immutable Lock</span>
                </div>
                <p className="text-xs text-[#c2c6d6] mt-2 leading-relaxed">
                  No unverified proxy delegatecalls. Liquidity pair ownership held by dead address.
                </p>
              </div>

              <div className="bg-[#060e20] p-3.5 rounded-lg border border-[#222a3d] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8c909f]">LLM JURY CONSENSUS</span>
                  <span className="text-[#4cd7f6] font-mono text-[10px] uppercase font-bold">3 / 3 Agreement</span>
                </div>
                <p className="text-xs text-[#c2c6d6] mt-2 leading-relaxed">
                  Decompiler Agent & Trap Hunter confirm standard router dispatch routines without backdoors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Forensic Protocol Pipeline (3-Step Section) */}
      <section className="w-full py-16 relative">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="max-w-2xl mb-10">
            <span className="font-mono text-xs text-[#adc6ff] uppercase tracking-widest block font-semibold">
              Forensic Protocol Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1 tracking-tight">
              Multi-Layer Threat Evaluation in 1.4 Seconds
            </h2>
            <p className="text-sm sm:text-base text-[#c2c6d6] mt-2 leading-relaxed">
              Deterministic execution physics paired with decentralized AI judges. Every token analysis goes through automated zero-trust execution.
            </p>
          </div>

          {/* Bento Grid / 3-Step Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Step 1 Card */}
            <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] flex flex-col justify-between relative overflow-hidden group hover:border-[#4d8eff]/40 transition-colors">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#4d8eff]/5 rounded-full blur-2xl group-hover:bg-[#4d8eff]/10 transition-colors"></div>
              <div>
                <span className="font-mono text-base text-[#adc6ff] font-bold">01 / DISCOVERY</span>
                <h3 className="text-lg font-bold text-[#dae2fd] mt-1.5">Paste Token Address</h3>
                <p className="text-sm text-[#c2c6d6] mt-2.5 leading-relaxed">
                  Submit any ERC-20 contract or DEX pool address across Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, or Avalanche. Instant bytecode and source extraction via high-throughput archive nodes.
                </p>
              </div>
              <div className="mt-6 pt-3 bg-[#060e20] p-3 rounded-lg border border-[#222a3d]">
                <div className="flex items-center justify-between font-mono text-xs text-[#8c909f] mb-1">
                  <span>RPC Fetch Pipeline</span>
                  <span className="text-[#4edea3] font-medium">200 OK</span>
                </div>
                <div className="font-mono text-xs text-[#dae2fd] bg-[#2d3449]/40 px-2 py-1 rounded truncate">
                  eth_getCode(0x7a250...) &gt; 0x60806040...
                </div>
              </div>
            </div>

            {/* Step 2 Card */}
            <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] flex flex-col justify-between relative overflow-hidden group hover:border-[#4cd7f6]/40 transition-colors">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#4cd7f6]/5 rounded-full blur-2xl group-hover:bg-[#4cd7f6]/10 transition-colors"></div>
              <div>
                <span className="font-mono text-base text-[#4cd7f6] font-bold">02 / FORENSIC SANDBOX</span>
                <h3 className="text-lg font-bold text-[#dae2fd] mt-1.5">Dual-Layer Inspection</h3>
                <p className="text-sm text-[#c2c6d6] mt-2.5 leading-relaxed">
                  Deterministic rules engine simulates actual simulated buy/sell actions on local mempool forks, while a specialist multi-LLM tribunal audits decompiled opcode semantics for unverified hidden backdoors.
                </p>
              </div>
              <div className="mt-6 space-y-1.5 bg-[#060e20] p-3 rounded-lg border border-[#222a3d] font-mono text-xs">
                <div className="flex items-center justify-between text-[#c2c6d6]">
                  <span>Fork Simulation</span>
                  <span className="text-[#4edea3] font-semibold">PASSED</span>
                </div>
                <div className="flex items-center justify-between text-[#c2c6d6]">
                  <span>Decompiler Reviewer</span>
                  <span className="text-[#4cd7f6] font-semibold">SYNTHESIZED</span>
                </div>
                <div className="flex items-center justify-between text-[#c2c6d6]">
                  <span>Prompt Trap Defense</span>
                  <span className="text-[#4edea3] font-semibold">CLEAN</span>
                </div>
              </div>
            </div>

            {/* Step 3 Card */}
            <div className="bg-[#131b2e] p-6 rounded-xl border border-[#222a3d] flex flex-col justify-between relative overflow-hidden group hover:border-[#4edea3]/40 transition-colors">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#4edea3]/5 rounded-full blur-2xl group-hover:bg-[#4edea3]/10 transition-colors"></div>
              <div>
                <span className="font-mono text-base text-[#4edea3] font-bold">03 / VERDICT</span>
                <h3 className="text-lg font-bold text-[#dae2fd] mt-1.5">Actionable Decision</h3>
                <p className="text-sm text-[#c2c6d6] mt-2.5 leading-relaxed">
                  Receive a definitive SAFE or MALICIOUS verdict with an actionable 0-100 Risk Score. Clear plain-English explanations replace confusing compiler warnings so you never walk into a liquidity trap.
                </p>
              </div>
              <div className="mt-6 bg-[#060e20] p-3 rounded-lg border border-[#222a3d] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-[24px]">verified</span>
                  <div>
                    <span className="font-mono text-xs text-[#dae2fd] font-semibold block">VERDICT: APPROVED</span>
                    <span className="font-mono text-[11px] text-[#8c909f]">Simulation gas: verified</span>
                  </div>
                </div>
                <span className="px-2 py-1 bg-[#00a572]/20 text-[#4edea3] font-mono text-[10px] font-bold rounded uppercase">
                  Score 00
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Scans Stream Ticker */}
      <section className="w-full bg-[#171f33] py-12 border-y border-[#222a3d]/70 overflow-hidden">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4cd7f6] animate-pulse"></span>
            <h3 className="font-semibold text-base sm:text-lg text-[#dae2fd]">Recent Scans Live Feed</h3>
          </div>
          <span className="font-mono text-xs text-[#8c909f]">Real-time threat feed across all decentralized protocols</span>
        </div>

        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Feed Card 1: SCAM HONEYPOT */}
            <div 
              onClick={() => handleQuickFeedClick('0x49f28a1048b92b1a82910c28419b489281c981c9', 'Base')}
              className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d] hover:border-[#ffb4ab]/60 hover:bg-[#222a3d] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Base • Uniswap V3</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#93000a]/40 text-[#ffb4ab] font-mono text-[10px] font-bold uppercase">
                  MALICIOUS
                </span>
              </div>
              <div className="font-mono text-sm text-[#dae2fd] mt-2 font-semibold truncate group-hover:text-[#ffb4ab] transition-colors">
                $PEPEAI (0x49f2...81c9)
              </div>
              <p className="text-xs text-[#ffb4ab] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>Honeypot: TransferFrom reverts</span>
              </p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-[#8c909f] border-t border-[#222a3d] pt-2">
                <span>Sell Tax: 99.8%</span>
                <span className="text-[#ffb4ab] font-bold">Risk: 99/100</span>
              </div>
            </div>

            {/* Feed Card 2: SAFE TOKEN */}
            <div 
              onClick={() => handleQuickFeedClick('0xfc5a1a923891823901bca98129841893c321c321', 'Arbitrum')}
              className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d] hover:border-[#4edea3]/60 hover:bg-[#222a3d] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Arbitrum • Camelot</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-mono text-[10px] font-bold uppercase">
                  VERIFIED SAFE
                </span>
              </div>
              <div className="font-mono text-sm text-[#dae2fd] mt-2 font-semibold truncate group-hover:text-[#4edea3] transition-colors">
                $GMX (0xfc5a...c321)
              </div>
              <p className="text-xs text-[#4edea3] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Zero hidden mints</span>
              </p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-[#8c909f] border-t border-[#222a3d] pt-2">
                <span>Tax: 0% / 0%</span>
                <span className="text-[#4edea3] font-bold">Risk: 00/100</span>
              </div>
            </div>

            {/* Feed Card 3: WARNING BACKDOOR */}
            <div 
              onClick={() => handleQuickFeedClick('0x81b7a91823910c284719283918247192d24ad24a', 'Ethereum')}
              className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d] hover:border-[#ffb4ab]/60 hover:bg-[#222a3d] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Ethereum • Sushi</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#93000a]/40 text-[#ffb4ab] font-mono text-[10px] font-bold uppercase">
                  RUG HAZARD
                </span>
              </div>
              <div className="font-mono text-sm text-[#dae2fd] mt-2 font-semibold truncate group-hover:text-[#ffb4ab] transition-colors">
                $DOGEX (0x81b7...d24a)
              </div>
              <p className="text-xs text-[#ffb4ab] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">dangerous</span>
                <span>Fake Renounce: Proxy Owner</span>
              </p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-[#8c909f] border-t border-[#222a3d] pt-2">
                <span>Max Tx: Limited</span>
                <span className="text-[#ffb4ab] font-bold">Risk: 94/100</span>
              </div>
            </div>

            {/* Feed Card 4: SAFE TOKEN */}
            <div 
              onClick={() => handleQuickFeedClick('0x4200000000000000000000000000000000000042', 'Optimism')}
              className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d] hover:border-[#4edea3]/60 hover:bg-[#222a3d] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8c909f]">Optimism • Velodrome</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] font-mono text-[10px] font-bold uppercase">
                  VERIFIED SAFE
                </span>
              </div>
              <div className="font-mono text-sm text-[#dae2fd] mt-2 font-semibold truncate group-hover:text-[#4edea3] transition-colors">
                $OP (0x4200...0042)
              </div>
              <p className="text-xs text-[#4edea3] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Governance Multicall OK</span>
              </p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-[#8c909f] border-t border-[#222a3d] pt-2">
                <span>Standard ERC20</span>
                <span className="text-[#4edea3] font-bold">Risk: 01/100</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Value Grid: Code Audits vs. RiskSearcher */}
      <section className="w-full py-16">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="font-mono text-xs text-[#4cd7f6] uppercase tracking-widest block font-semibold">
              Buyer Protection Matrix
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1 tracking-tight">
              Why Standard Audits Don't Protect Retail Buyers
            </h2>
            <p className="text-sm sm:text-base text-[#c2c6d6] mt-2 leading-relaxed">
              Auditing firms verify whether a smart contract executes as designed. Scammers build tokens designed specifically to lock liquidity and drain traders with full compiler compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conventional Audits Box */}
            <div className="bg-[#131b2e] p-6 lg:p-8 rounded-xl border border-[#222a3d]">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="material-symbols-outlined text-[#8c909f] text-[24px]">cancel</span>
                <h3 className="text-lg font-bold text-[#dae2fd]">Standard Academic Audits</h3>
              </div>
              <p className="text-sm text-[#c2c6d6] mb-6 leading-relaxed">
                Static PDF certificates purchased by developers weeks prior to deployment. Often meaningless when the deployer retains mutable privilege backdoors.
              </p>
              <ul className="space-y-3.5 text-sm text-[#8c909f]">
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#8c909f] text-[20px] shrink-0 mt-0.5">remove</span>
                  <span>Only flags arithmetic errors and reentrancy; ignores malicious business logic designed to entrap buyers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#8c909f] text-[20px] shrink-0 mt-0.5">remove</span>
                  <span>Static evaluation of code comments; does not execute actual buy-and-sell cycles against decentralized exchanges.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#8c909f] text-[20px] shrink-0 mt-0.5">remove</span>
                  <span>Blind to dynamically modified fee structures triggered by block countdowns or specific block numbers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#8c909f] text-[20px] shrink-0 mt-0.5">remove</span>
                  <span>Fooled by simulated renouncements where an external proxy admin still maintains unilateral withdrawal rights.</span>
                </li>
              </ul>
            </div>

            {/* RiskSearcher Protection Engine */}
            <div className="bg-[#222a3d] p-6 lg:p-8 rounded-xl border border-[#4d8eff]/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#4d8eff]/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="material-symbols-outlined text-[#4d8eff] text-[24px]">verified_user</span>
                <h3 className="text-lg font-bold text-[#dae2fd]">RiskSearcher Pre-Flight Protection</h3>
              </div>
              <p className="text-sm text-[#c2c6d6] mb-6 leading-relaxed">
                Real-time, deterministic adversarial simulations run at the microsecond of your query. Built strictly for the trader's solvency.
              </p>
              <ul className="space-y-3.5 text-sm text-[#dae2fd]">
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong className="text-[#dae2fd]">Mempool Buy &amp; Sell Simulation:</strong> Executes a simulated dual-trade sequence on an ephemeral test fork to ensure unencumbered exits.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong className="text-[#dae2fd]">Dynamic Fee Traps:</strong> Decompiles hidden tax schedules and trigger functions designed to hike sell tax to 99% upon launch.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong className="text-[#dae2fd]">Ownership Truancy Checks:</strong> Validates zero-address ownership claims against underlying diamond and upgradeable proxy storage slots.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong className="text-[#dae2fd]">Specialist Multi-LLM Panel:</strong> Consensus layer analyzes variable nomenclature, hidden burn routines, and obscure opcode patterns.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Architecture & Code Inspector Graphic */}
      <section className="w-full bg-[#060e20] py-16 border-y border-[#222a3d]/70">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <span className="font-mono text-xs text-[#4edea3] uppercase tracking-widest block font-semibold">
                Deterministic Rules + Consensus
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1.5 tracking-tight">
                Decompiled Bytecode Inspection in Real Time
              </h2>
              <p className="text-sm text-[#c2c6d6] mt-4 leading-relaxed">
                Unverified contracts are decompiled on-the-fly. Even when Solidity source code is hidden on block explorers, our reverse-engineering engine reconstructs dispatch trees, liquidity routing mechanisms, and variable balance limits.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[#dae2fd] font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#adc6ff]"></span>
                  <span>EVM Opcode disassembler (EVMcfg)</span>
                </div>
                <div className="flex items-center gap-2 text-[#dae2fd] font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#4cd7f6]"></span>
                  <span>Hardhat/Anvil transaction tracer</span>
                </div>
                <div className="flex items-center gap-2 text-[#dae2fd] font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
                  <span>Multi-specialist AI consensus engine</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              {/* Code Diagnostic Terminal UI */}
              <div className="bg-[#171f33] rounded-xl border border-[#222a3d] shadow-2xl overflow-hidden font-mono text-xs">
                <div className="bg-[#222a3d] px-4 py-2.5 flex items-center justify-between border-b border-[#2d3449]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#ffb4ab]/60"></span>
                    <span className="w-3 h-3 rounded-full bg-[#2d3449]"></span>
                    <span className="w-3 h-3 rounded-full bg-[#4edea3]/60"></span>
                    <span className="ml-2 text-[#8c909f]">risksearcher-sandbox://trace-0x81b7.sol</span>
                  </div>
                  <span className="text-[#4cd7f6]">GAS_USED: 28,104</span>
                </div>
                <div className="p-4 space-y-1 overflow-x-auto text-[#dae2fd]">
                  <div className="text-[#8c909f]">// [RECONSTRUCTED DISPATCH TABLE]</div>
                  <div className="text-[#8c909f]">// Identifying trap functions matching blacklist mechanics</div>
                  <div><span className="text-[#4cd7f6] font-bold">function</span> _transfer(address sender, address recipient, uint256 amount) internal &#123;</div>
                  <div className="pl-4 text-[#c2c6d6]">require(sender != address(0), <span className="text-[#adc6ff]">"ERC20: zero"</span>);</div>
                  <div className="pl-4 bg-[#93000a]/20 text-[#ffb4ab] px-2 py-1 rounded flex items-center justify-between my-1 border border-[#ffb4ab]/30">
                    <span>&gt;&gt; if (isSniper[sender] || isSniper[recipient]) revert("Liquidity Locked");</span>
                    <span className="text-[10px] uppercase font-bold bg-[#ffb4ab] text-[#690005] px-1.5 py-0.5 rounded">
                      TRAP DETECTED
                    </span>
                  </div>
                  <div className="pl-4 text-[#c2c6d6]">if (sender != _owner &amp;&amp; recipient != _owner) &#123;</div>
                  <div className="pl-8 bg-[#93000a]/20 text-[#ffb4ab] px-2 py-1 rounded flex items-center justify-between my-1 border border-[#ffb4ab]/30">
                    <span>&gt;&gt; uint256 dynamicTax = (_sellCount &gt; 5) ? 99 : 2; // Hidden Rug Trigger</span>
                    <span className="text-[10px] uppercase font-bold bg-[#ffb4ab] text-[#690005] px-1.5 py-0.5 rounded">
                      DANGER: 99% TAX
                    </span>
                  </div>
                  <div className="pl-8 text-[#c2c6d6]">uint256 fee = (amount * dynamicTax) / 100;</div>
                  <div className="pl-8 text-[#c2c6d6]">super._transfer(sender, _feeWallet, fee);</div>
                  <div className="pl-4 text-[#c2c6d6]">&#125;</div>
                  <div>&#125;</div>
                </div>
                <div className="bg-[#131b2e] px-4 py-2.5 border-t border-[#222a3d] flex items-center justify-between">
                  <span className="text-[#ffb4ab] flex items-center gap-1.5 font-medium">
                    <span className="material-symbols-outlined text-[16px]">dangerous</span>
                    <span>Verdict: CRITICAL_HONEYPOT_DETECTED</span>
                  </span>
                  <span className="text-[10px] bg-[#2d3449] text-[#dae2fd] px-2 py-0.5 rounded font-bold">
                    Deterministic Rules Match
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Chains Grid Strip */}
      <section className="w-full py-12 bg-[#171f33]">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6 text-center">
          <span className="font-mono text-xs text-[#8c909f] uppercase tracking-widest block font-semibold">
            Complete Multi-Chain Coverage
          </span>
          <h3 className="text-xl sm:text-2xl font-bold text-[#dae2fd] mt-1">
            High-Speed RPC Node Integration on 7 EVM Networks
          </h3>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {[
              { name: 'Ethereum', dot: '#adc6ff' },
              { name: 'Base', dot: '#4cd7f6' },
              { name: 'Arbitrum One', dot: '#4d8eff' },
              { name: 'Optimism', dot: '#ffb4ab' },
              { name: 'Polygon PoS', dot: '#adc6ff' },
              { name: 'BNB Chain', dot: '#03b5d3' },
              { name: 'Avalanche C-Chain', dot: '#ffb4ab' },
            ].map((chain) => (
              <button
                key={chain.name}
                onClick={() => onNavigate('supported-chains')}
                className="flex items-center gap-2 bg-[#222a3d] hover:bg-[#2d3449] border border-[#2d3449] px-4 py-2 rounded-lg transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chain.dot }}></span>
                <span className="font-mono text-xs sm:text-sm text-[#dae2fd]">{chain.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action Matrix */}
      <section className="w-full py-16 relative">
        <div className="max-w-[88rem] mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dual CTA Card 1: Web3 Wallet */}
            <div className="bg-[#131b2e] p-6 lg:p-8 rounded-xl border border-[#222a3d] flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#4d8eff]/10 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#222a3d] border border-[#4d8eff]/30 flex items-center justify-center text-[#4d8eff] mb-4">
                  <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
                </div>
                <h3 className="text-xl font-bold text-[#dae2fd]">Connect Web3 Wallet</h3>
                <p className="text-sm text-[#c2c6d6] mt-2 leading-relaxed">
                  Instantly connect with MetaMask, Rabby, Coinbase, or WalletConnect. Enable automated pre-transaction checks on pending swaps.
                </p>
              </div>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={onOpenWalletModal}
                  className="w-full py-3 px-4 rounded-lg bg-[#4d8eff] text-[#00285d] font-semibold text-sm hover:bg-[#adc6ff] hover:text-[#002e6a] transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <span className="material-symbols-outlined text-[20px]">link</span>
                  <span>Connect Wallet (EVM)</span>
                </button>
                <span className="block text-center font-mono text-xs text-[#8c909f] mt-2">
                  Zero signatures required for standard analysis
                </span>
              </div>
            </div>

            {/* Dual CTA Card 2: Passkey / Social Smart Account */}
            <div className="bg-[#131b2e] p-6 lg:p-8 rounded-xl border border-[#222a3d] flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-[#4cd7f6]/10 rounded-full blur-2xl pointer-events-none"></div>
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#222a3d] border border-[#4cd7f6]/30 flex items-center justify-center text-[#4cd7f6] mb-4">
                  <span className="material-symbols-outlined text-[28px]">passkey</span>
                </div>
                <h3 className="text-xl font-bold text-[#dae2fd]">Sign in with Passkey / Social</h3>
                <p className="text-sm text-[#c2c6d6] mt-2 leading-relaxed">
                  No seed phrases needed. Create an ERC-4337 smart account using Touch ID, Face ID, or social providers for frictionless buyer protection.
                </p>
              </div>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={onOpenWalletModal}
                  className="w-full py-3 px-4 rounded-lg bg-[#2d3449] text-[#dae2fd] hover:bg-[#31394d] transition-all font-semibold text-sm flex items-center justify-center gap-2 shadow-md border border-[#424754]"
                >
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                  <span>Sign In with Passkey (Social)</span>
                </button>
                <span className="block text-center font-mono text-xs text-[#8c909f] mt-2">
                  Powered by Account Abstraction ERC-4337
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
