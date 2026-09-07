import React, { useState, useEffect, useRef } from 'react';
import { AnalysisStreamHandlers, TokenInvestigation, EVMNetwork, UserAccountState } from '../types';

interface ScannerViewProps {
  investigations: TokenInvestigation[];
  activeToken: TokenInvestigation;
  onSelectToken: (token: TokenInvestigation) => void;
  onRunScan: (address: string, network: EVMNetwork, handlers: AnalysisStreamHandlers) => void;
  autoScanRequest?: { id: number; address: string; network: EVMNetwork } | null;
  onAutoScanRequestHandled?: () => void;
  userAccount: UserAccountState;
  onOpenBytecodeModal: (code: string, title: string) => void;
  onOpenAddFundsModal: () => void;
  onOpenSubscriptionModal: () => void;
  onOpenWorldIdModal: () => void;
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
  onOpenWalletModal?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  investigations,
  activeToken,
  onSelectToken,
  onRunScan,
  autoScanRequest,
  onAutoScanRequestHandled,
  userAccount,
  onOpenBytecodeModal,
  onOpenAddFundsModal,
  onOpenSubscriptionModal,
  onOpenWorldIdModal,
  onNavigate,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [inputAddress, setInputAddress] = useState(activeToken.address);
  const [selectedNetwork, setSelectedNetwork] = useState<EVMNetwork>(activeToken.network || 'Ethereum');
  const [isScanning, setIsScanning] = useState(false);
  const [scanCurrentStage, setScanCurrentStage] = useState(1);
  const [scanProgressMessage, setScanProgressMessage] = useState('[1/5] Fetching contract source...');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isReSimulating, setIsReSimulating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAudit, setCopiedAudit] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);
  const handledAutoScanIdRef = useRef<number | null>(null);

  useEffect(() => {
    setInputAddress(activeToken.address);
    setSelectedNetwork(activeToken.network);
  }, [activeToken]);

  const networks: EVMNetwork[] = [
    'Ethereum',
    'Base',
    'Arbitrum',
    'Optimism',
    'BNB Chain',
    'Polygon',
  ];

  const filteredInvestigations = investigations.filter(
    (item) =>
      item.symbol.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.address.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const startScan = (address: string, network: EVMNetwork, skipScannerGates = false) => {
    if (!address.trim()) return;
    if (!skipScannerGates && !userAccount.isWorldIdVerified) {
      onOpenWorldIdModal();
      return;
    }
    if (!skipScannerGates && userAccount.freeScansRemaining <= 0 && !userAccount.activeSubscription && userAccount.riskSearcherBalance <= 0) {
      onOpenSubscriptionModal();
      return;
    }
    setIsScanning(true);
    setScanCurrentStage(1);
    setScanProgressMessage('[1/5] Fetching contract source...');
    setScanError(null);
    onRunScan(address.trim(), network, {
      onProgress: ({ message }) => {
        setScanProgressMessage(message);
        const stage = /^\[(\d)\/5\]/.exec(message)?.[1];
        if (stage) setScanCurrentStage(Number(stage));
      },
      onResult: () => setIsScanning(false),
      onError: (message) => {
        setIsScanning(false);
        setScanError(message);
      },
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startScan(inputAddress, selectedNetwork);
  };

  useEffect(() => {
    if (!autoScanRequest || handledAutoScanIdRef.current === autoScanRequest.id) return;
    handledAutoScanIdRef.current = autoScanRequest.id;
    setInputAddress(autoScanRequest.address);
    setSelectedNetwork(autoScanRequest.network);
    onAutoScanRequestHandled?.();
    startScan(autoScanRequest.address, autoScanRequest.network, true);
  }, [autoScanRequest, onAutoScanRequestHandled]);

  const handleSelectDemoToken = (id: string) => {
    const found = investigations.find((t) => t.id === id);
    if (found) {
      onSelectToken(found);
    }
  };

  const handleReRunSimulation = () => {
    setIsReSimulating(true);
    setTimeout(() => {
      setIsReSimulating(false);
    }, 1200);
  };

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleExportAudit = () => {
    const reportText = `RISKSEARCHER FORENSIC AUDIT REPORT
Target: ${activeToken.name} (${activeToken.symbol})
Address: ${activeToken.address}
Network: ${activeToken.network}
Verdict: ${activeToken.verdict} (${activeToken.riskScore}/100)
Verdict Source: ${activeToken.verdictSource}
Rule-based Score: ${activeToken.ruleBasedScore}/100
Source Status: ${activeToken.sourceVerified ? 'Verified Source' : 'Unverified Bytecode'}
Confidence: ${activeToken.confidence}%
Timestamp: ${activeToken.timestamp}

Verdict Explanation:
${activeToken.verdictExplanation}

Vulnerabilities Flagged (${activeToken.findings.length}):
${activeToken.findings.map(f => `- [${f.severity}] ${f.title}: ${f.description}`).join('\n')}

Transaction Behavior:
- Real-value transfers: ${activeToken.transactionBehavior?.realValueTransfers ?? 'N/A'}
- Zero-value transfers: ${activeToken.transactionBehavior?.zeroValueTransfers ?? 'N/A'}
- Unique senders: ${activeToken.transactionBehavior?.uniqueSenders ?? 'N/A'}
- Outbound concentration: ${activeToken.transactionBehavior?.outboundConcentration ?? 'N/A'}

Generated via RiskSearcher Multi-Judge SEC-KERNEL`;

    navigator.clipboard.writeText(reportText);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 1800);
  };

  const isScam = activeToken.verdict === 'UNSAFE' || activeToken.verdict === 'THREAT' || activeToken.verdict === 'MALICIOUS';

  if (!isWalletConnected) {
    return (
      <div className="flex flex-col w-full min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 relative overflow-hidden bg-[#0b1326]">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#4d8eff]/10 blur-[120px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-10 right-1/4 w-[400px] h-[200px] bg-[#4cd7f6]/10 blur-[100px] pointer-events-none rounded-full"></div>

        <div className="max-w-3xl w-full mx-auto relative z-10 text-center flex flex-col items-center">
          {/* Lock Icon Emblem */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-[#131b2e] border border-[#4d8eff]/40 shadow-[0_0_30px_rgba(77,142,255,0.25)] flex items-center justify-center text-[#4d8eff]">
              <span className="material-symbols-outlined text-[42px]">shield_lock</span>
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
            Forensic Terminal &amp; Dashboard Locked
          </h1>

          {/* Subtitle */}
          <p className="mt-3 text-sm sm:text-base text-[#c2c6d6] max-w-xl leading-relaxed">
            Real-time smart contract decompilation, opcode trace execution, mempool threat telemetry, and multi-judge AI consensus require an active session. Please sign in or connect your wallet to access the dashboard.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
            <button
              id="unlock-terminal-connect-btn"
              type="button"
              onClick={onOpenWalletModal}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#4d8eff] text-[#00285d] font-bold text-sm hover:bg-[#adc6ff] hover:text-[#002e6a] transition-all shadow-lg active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              <span>Connect Wallet / Login</span>
            </button>
            <button
              id="unlock-terminal-back-btn"
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
              Google &amp; Apple Passkey supported
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="text-[#4edea3] material-symbols-outlined text-[14px]">check</span>
              Zero-gas ERC-4337
            </span>
          </div>

          {/* Protected Modules Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-10 text-left">
            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>01 / REASONING</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">5-Stage Multi-Judge AI</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Parallel consensus between Decompiler Agent, Trap Hunter, Protocol Architect, and Threat Assessor.
              </p>
            </div>

            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>02 / HARDWARE SIM</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">Deterministic Opcode Tracer</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Live Anvil/Hardhat mempool dry-runs simulate transferFrom traps and fee modulations before transactions broadcast.
              </p>
            </div>

            <div className="bg-[#131b2e]/80 border border-[#222a3d] p-4 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between text-[#8c909f] mb-2 font-mono text-xs">
                <span>03 / VERIFIED QUOTA</span>
                <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#dae2fd]">World ID Sybil-Defense</h3>
              <p className="text-xs text-[#8c909f] mt-1 leading-relaxed">
                Claim 15 free forensic scans via zero-knowledge proof or fund your self-custodial smart account with USDC.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-4rem)]">
      {/* Flagship Demos Quick Launcher Strip */}
      <div className="w-full bg-[#060e20] px-4 lg:px-6 py-2 border-b border-[#222a3d]/70">
        <div className="max-w-[88rem] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="font-mono text-xs text-[#8c909f] font-semibold whitespace-nowrap">
              Benchmark Demos:
            </span>
            <button
              onClick={() => handleSelectDemoToken('fartpepe')}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeToken.id === 'fartpepe'
                  ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40'
                  : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd] border border-[#222a3d]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
              <span>FARTPEPE (80/100 UNSAFE • tx.origin)</span>
            </button>
            <button
              onClick={() => handleSelectDemoToken('weth9')}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeToken.id === 'weth9'
                  ? 'bg-[#00a572]/20 text-[#4edea3] border border-[#4edea3]/40'
                  : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd] border border-[#222a3d]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
              <span>WETH9 (0/100 SAFE Canonical)</span>
            </button>
            <button
              onClick={() => handleSelectDemoToken('shrimp')}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeToken.id === 'shrimp'
                  ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40'
                  : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd] border border-[#222a3d]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
              <span>Shrimp (70/100 • 200 Zero-Value Transfers)</span>
            </button>
            <button
              onClick={() => handleSelectDemoToken('dolphin')}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeToken.id === 'dolphin'
                  ? 'bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40'
                  : 'bg-[#131b2e] text-[#c2c6d6] hover:text-[#dae2fd] border border-[#222a3d]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
              <span>Dolphin (95/100 • 100% Siphon Concentration)</span>
            </button>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            {!userAccount.isWorldIdVerified ? (
              <button
                onClick={onOpenWorldIdModal}
                className="text-[#ffb4ab] hover:underline flex items-center gap-1 bg-[#ffb4ab]/10 px-2 py-0.5 rounded border border-[#ffb4ab]/30"
              >
                <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                <span>Verify World ID to unlock trial</span>
              </button>
            ) : (
              <span className="text-[#4edea3] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Humanity Verified ({userAccount.freeScansRemaining} scans remaining)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="w-full max-w-[88rem] mx-auto px-4 lg:px-6 py-4 flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left History Console (Cols 1-4) */}
          <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 bg-[#060e20] p-4 rounded-xl border border-[#222a3d]">
            <button
              onClick={() => {
                setInputAddress('');
                const input = document.getElementById('scanner-contract-input');
                if (input) input.focus();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] hover:text-[#002e6a] rounded-lg transition-all shadow-md group"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform">
                  add
                </span>
                <span className="font-semibold text-sm">Analyze Contract</span>
              </div>
              <span className="font-mono text-xs bg-[#00285d]/15 px-1.5 py-0.5 rounded font-bold">
                ⌘K
              </span>
            </button>

            {/* Filter */}
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c909f] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search past scans..."
                className="w-full bg-[#131b2e] text-[#dae2fd] placeholder:text-[#8c909f] text-xs font-mono pl-8 pr-3 py-2 rounded-lg border border-[#222a3d] focus:outline-none focus:border-[#4cd7f6]/50"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[480px] lg:max-h-[580px]">
              <div className="flex items-center justify-between px-1 py-0.5 text-xs font-mono text-[#8c909f]">
                <span>Scan History</span>
                <span className="text-[#4edea3] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-ping"></span>
                  Multi-Judge
                </span>
              </div>

              {filteredInvestigations.map((item) => {
                const isSelected = item.id === activeToken.id;
                const itemIsScam = item.verdict === 'UNSAFE' || item.verdict === 'THREAT' || item.verdict === 'MALICIOUS';

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectToken(item)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-[#222a3d] border-[#4cd7f6]/50 shadow-md'
                        : 'bg-[#131b2e] border-[#222a3d] hover:bg-[#171f33]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-[#dae2fd] truncate">
                        {item.symbol} ({item.name.replace('Community', '').trim()})
                      </span>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          itemIsScam
                            ? 'bg-[#93000a]/50 text-[#ffb4ab] border border-[#ffb4ab]/30'
                            : 'bg-[#00a572]/20 text-[#4edea3] border border-[#4edea3]/30'
                        }`}
                      >
                        {item.verdict} • {item.riskScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#8c909f] font-mono text-[11px]">
                      <span className="truncate">
                        {item.address.slice(0, 6)}...{item.address.slice(-4)} • {item.network}
                      </span>
                      <span>{item.timeAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Account Dock */}
            <div className="pt-2 mt-auto bg-[#131b2e] p-3 rounded-lg border border-[#222a3d] flex items-center justify-between">
              <button
                onClick={() => onNavigate('accounts')}
                className="flex items-center gap-2.5 min-w-0 text-left group"
              >
                <div className="w-7 h-7 rounded-full bg-[#4d8eff] text-[#00285d] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  0x
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-xs text-[#dae2fd] font-semibold truncate group-hover:text-[#4cd7f6] transition-colors">
                    {userAccount.ensOrAlias}
                  </div>
                  <div className="font-mono text-[10px] text-[#4edea3]">
                    Wallet: ${userAccount.walletUsdcBalance.toFixed(2)} USDC
                  </div>
                </div>
              </button>
              <button
                onClick={() => onNavigate('accounts')}
                className="text-[#8c909f] hover:text-[#dae2fd] p-1 rounded hover:bg-[#222a3d] transition-colors"
                title="Wallet & Billing"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              </button>
            </div>
          </aside>

          {/* Right Detailed Analysis Pipeline (Cols 5-12) */}
          <section className="lg:col-span-8 xl:col-span-9 flex flex-col bg-[#060e20] rounded-xl border border-[#222a3d] p-4 lg:p-5 relative overflow-hidden">
            {/* Top Analysis Header */}
            <div className="flex flex-wrap items-center justify-between pb-3 gap-2 bg-[#131b2e] px-4 py-2.5 rounded-lg border border-[#222a3d]">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isScam ? 'bg-[#ffb4ab] animate-ping' : 'bg-[#4edea3] animate-pulse'}`}></div>
                <div>
                  <div className="font-mono text-sm text-[#dae2fd] font-semibold flex items-center gap-2">
                    <span>TARGET: {activeToken.name} ({activeToken.symbol})</span>
                    <span className="font-mono text-[10px] bg-[#222a3d] px-1.5 py-0.5 rounded text-[#4cd7f6] uppercase">
                      {activeToken.network}
                    </span>
                    {activeToken.sourceVerified ? (
                      <span className="font-mono text-[10px] bg-[#00a572]/20 text-[#4edea3] px-1.5 py-0.5 rounded">
                        ✓ Verified source
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] bg-[#93000a]/30 text-[#ffb4ab] px-1.5 py-0.5 rounded">
                        ⚠ Source unverified
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-[#8c909f]">
                    Verdict Source: <strong className="text-[#adc6ff]">{activeToken.verdictSource}</strong> • Rule-based Score: {activeToken.ruleBasedScore}/100
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportAudit}
                  className="bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] border border-[#222a3d] px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedAudit ? 'check' : 'file_download'}
                  </span>
                  <span>{copiedAudit ? 'Copied' : 'Export Report'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] border border-[#222a3d] px-3 py-1.5 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copiedLink ? 'check' : 'share'}
                  </span>
                  <span>{copiedLink ? 'Copied' : 'Share'}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Forensic Body */}
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
              {/* Query Card */}
              <div className="flex justify-end">
                <div className="max-w-2xl bg-[#4d8eff]/90 text-[#00285d] p-4 rounded-xl rounded-tr-none shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-[#00285d]/80 text-[11px] font-mono">
                    <span>Investigation Request</span>
                    <span>{activeToken.timestamp}</span>
                  </div>
                  <p className="font-mono text-xs sm:text-sm text-[#00285d] font-medium leading-relaxed">
                    {activeToken.userPrompt}
                  </p>
                </div>
              </div>

              {/* 5-Stage Live Investigation Progress Simulation */}
              {isScanning ? (
                <div className="bg-[#131b2e] p-5 rounded-xl border border-[#4cd7f6]/40 space-y-3 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#4cd7f6] font-bold">
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      <span>5-STAGE FORENSIC ORCHESTRATION IN PROGRESS</span>
                    </div>
                    <span className="font-mono text-xs text-[#dae2fd]">
                      Stage {scanCurrentStage} of 5
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <p className="text-[#adc6ff] pb-1">{scanProgressMessage}</p>
                    <div className={`flex items-center gap-2 ${scanCurrentStage >= 1 ? 'text-[#4edea3]' : 'text-[#8c909f]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {scanCurrentStage > 1 ? 'check_circle' : 'radio_button_checked'}
                      </span>
                      <span>Stage 1: Fetching contract source &amp; verification status...</span>
                    </div>
                    <div className={`flex items-center gap-2 ${scanCurrentStage >= 2 ? 'text-[#4edea3]' : 'text-[#8c909f]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {scanCurrentStage > 2 ? 'check_circle' : scanCurrentStage === 2 ? 'sync' : 'radio_button_unchecked'}
                      </span>
                      <span>Stage 2: Running rule-based AST &amp; bytecode analysis...</span>
                    </div>
                    <div className={`flex items-center gap-2 ${scanCurrentStage >= 3 ? 'text-[#4edea3]' : 'text-[#8c909f]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {scanCurrentStage > 3 ? 'check_circle' : scanCurrentStage === 3 ? 'sync' : 'radio_button_unchecked'}
                      </span>
                      <span>Stage 3: Running specialist reasoning (tax, balance &amp; mempool agents)...</span>
                    </div>
                    <div className={`flex items-center gap-2 ${scanCurrentStage >= 4 ? 'text-[#4edea3]' : 'text-[#8c909f]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {scanCurrentStage > 4 ? 'check_circle' : scanCurrentStage === 4 ? 'sync' : 'radio_button_unchecked'}
                      </span>
                      <span>Stage 4: Running judge tribunal reconciliation...</span>
                    </div>
                    <div className={`flex items-center gap-2 ${scanCurrentStage >= 5 ? 'text-[#4edea3]' : 'text-[#8c909f]'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {scanCurrentStage === 5 ? 'sync' : 'radio_button_unchecked'}
                      </span>
                      <span>Stage 5: Generating final evidence report...</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Completed 5-stage badge */
                <div className="bg-[#131b2e] p-4 rounded-xl border border-[#222a3d] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs text-[#4cd7f6] font-semibold">
                      <span className="material-symbols-outlined text-[18px]">memory</span>
                      <span>5-STAGE MULTI-JUDGE PIPELINE: COMPLETED</span>
                    </div>
                    <span className="font-mono text-xs text-[#4edea3]">Consensus Formed (5/5 Stages)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px] text-[#8c909f] pt-1">
                    {activeToken.executionSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[#c2c6d6]">
                        <span className="material-symbols-outlined text-[14px] text-[#4edea3] shrink-0 mt-0.5">check_circle</span>
                        <span>{step.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scanError && (
                <div className="bg-[#93000a]/20 p-4 rounded-xl border border-[#ffb4ab]/40 space-y-2">
                  <div className="flex items-start gap-2 text-[#ffb4ab] font-mono text-xs">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{scanError}</span>
                  </div>
                  <button type="button" onClick={() => handleFormSubmit({ preventDefault: () => undefined } as React.FormEvent)} className="text-xs font-mono font-bold text-[#00285d] bg-[#ffb4ab] hover:bg-[#ffdad6] px-3 py-1.5 rounded-lg">
                    Retry analysis
                  </button>
                </div>
              )}

              {activeToken.analysisParameters && Object.keys(activeToken.analysisParameters).length > 0 && (
                <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-2">
                  <h3 className="font-semibold text-sm text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">tune</span>
                    <span>Analysis Parameters</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                    {Object.entries(activeToken.analysisParameters).map(([key, value]) => (
                      <div key={key} className="bg-[#131b2e] px-3 py-2 rounded-lg border border-[#222a3d]">
                        <span className="text-[#8c909f]">{key}: </span>
                        <span className="text-[#dae2fd] break-all">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Report Card */}
              <div className="bg-[#171f33] p-5 lg:p-6 rounded-xl border border-[#222a3d] space-y-5 shadow-xl">
                {/* Top Verdict Banner & Score Comparison */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#060e20] p-4 rounded-xl border border-[#222a3d]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-3 h-3 rounded-full ${isScam ? 'bg-[#ffb4ab] animate-pulse' : 'bg-[#4edea3] animate-pulse'}`}></span>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                          isScam
                            ? 'bg-[#93000a]/50 text-[#ffb4ab] border border-[#ffb4ab]/30'
                            : 'bg-[#00a572]/20 text-[#4edea3] border border-[#4edea3]/30'
                        }`}
                      >
                        {activeToken.verdict} • {activeToken.riskScore}/100 • {isScam ? 'HIGH RISK' : 'LOW RISK'}
                      </span>
                      <span className="font-mono text-[10px] bg-[#222a3d] px-2 py-0.5 rounded text-[#adc6ff]">
                        Verdict Source: {activeToken.verdictSource}
                      </span>
                    </div>
                    <h2 className={`text-2xl font-bold tracking-tight ${isScam ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}`}>
                      {isScam ? `${activeToken.verdict} DETECTED` : 'CONTRACT VERIFIED SAFE'}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#c2c6d6] max-w-xl leading-relaxed">
                      {activeToken.verdictExplanation}
                    </p>
                  </div>

                  {/* Contrast Dial: Rule Score vs Final Judge Score */}
                  <div className="flex items-center gap-4 bg-[#131b2e] px-4 py-3 rounded-xl border border-[#222a3d] shrink-0">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-[#222a3d]"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.8"
                        />
                        <path
                          className={isScam ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray={`${activeToken.riskScore}, 100`}
                          strokeLinecap="round"
                          strokeWidth="3.8"
                        />
                      </svg>
                      <span className={`absolute font-mono text-xl font-bold ${isScam ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}`}>
                        {activeToken.riskScore}
                      </span>
                    </div>
                    <div className="font-mono text-xs space-y-1">
                      <div className="text-[#dae2fd] font-bold">FINAL RISK</div>
                      <div className="text-[#8c909f]">Rule Score: <strong className="text-[#dae2fd]">{activeToken.ruleBasedScore}/100</strong></div>
                      <div className="text-[10px] text-[#4cd7f6]">
                        {activeToken.riskScore !== activeToken.ruleBasedScore ? 'Judge elevated risk' : 'Rule & Judge aligned'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Transaction Behavior (Crucial Real vs Zero-Value distinction) */}
                {activeToken.transactionBehavior && (
                  <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">query_stats</span>
                        <h3 className="font-semibold text-sm text-[#dae2fd]">Transaction Behavior &amp; Telemetry</h3>
                      </div>
                      <span className="font-mono text-[10px] text-[#4edea3] uppercase bg-[#00a572]/20 px-2 py-0.5 rounded">
                        Mempool Topology
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d]">
                        <span className="text-[#8c909f] text-[10px] uppercase block">Real-Value Transfers</span>
                        <span className="text-base font-bold text-[#dae2fd] block mt-0.5">
                          {activeToken.transactionBehavior.realValueTransfers.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8c909f]">Genuine asset flow</span>
                      </div>

                      <div className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d]">
                        <span className="text-[#8c909f] text-[10px] uppercase block">Zero-Value Transfers</span>
                        <span className={`text-base font-bold block mt-0.5 ${
                          activeToken.transactionBehavior.zeroValueTransfers > 50 ? 'text-[#ffb4ab]' : 'text-[#dae2fd]'
                        }`}>
                          {activeToken.transactionBehavior.zeroValueTransfers.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8c909f]">
                          {activeToken.transactionBehavior.zeroValueTransfers > 50 ? 'Spoofing / Poisoning' : 'Normal trace'}
                        </span>
                      </div>

                      <div className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d]">
                        <span className="text-[#8c909f] text-[10px] uppercase block">Unique Senders</span>
                        <span className="text-base font-bold text-[#dae2fd] block mt-0.5">
                          {activeToken.transactionBehavior.uniqueSenders.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8c909f]">Interacting EOAs</span>
                      </div>

                      <div className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d]">
                        <span className="text-[#8c909f] text-[10px] uppercase block">Contract ETH Balance</span>
                        <span className="text-base font-bold text-[#4cd7f6] block mt-0.5">
                          {activeToken.transactionBehavior.contractEthBalance}
                        </span>
                        <span className="text-[10px] text-[#8c909f]">Vault custody</span>
                      </div>
                    </div>

                    <div className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d] font-mono text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#adc6ff] text-[16px] shrink-0 mt-0.5">hub</span>
                      <div>
                        <span className="text-[#8c909f]">Outbound Concentration: </span>
                        <strong className="text-[#dae2fd]">{activeToken.transactionBehavior.outboundConcentration}</strong>
                        {activeToken.transactionBehavior.note && (
                          <p className="text-[11px] text-[#8c909f] mt-1">{activeToken.transactionBehavior.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Plain Language Technical Findings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-[#dae2fd] flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${isScam ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}`}>
                        {isScam ? 'warning' : 'verified'}
                      </span>
                      <span>Forensic Vulnerabilities Flagged ({activeToken.findings.length})</span>
                    </h3>
                  </div>

                  {activeToken.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`material-symbols-outlined text-[18px] ${
                              finding.severity === 'CRITICAL'
                                ? 'text-[#ffb4ab]'
                                : finding.severity === 'WARNING'
                                ? 'text-[#4cd7f6]'
                                : 'text-[#8c909f]'
                            }`}
                          >
                            {finding.icon}
                          </span>
                          <span
                            className={`font-semibold text-xs sm:text-sm ${
                              finding.severity === 'CRITICAL'
                                ? 'text-[#ffb4ab]'
                                : 'text-[#dae2fd]'
                            }`}
                          >
                            {finding.title}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            finding.severity === 'CRITICAL'
                              ? 'bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/30'
                              : finding.severity === 'WARNING'
                              ? 'bg-[#03b5d3]/20 text-[#4cd7f6] border border-[#4cd7f6]/30'
                              : 'bg-[#222a3d] text-[#c2c6d6]'
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
                        {finding.description}
                      </p>

                      {finding.codeSnippet && (
                        <pre className="font-mono text-xs bg-[#131b2e] p-3 rounded-lg border border-[#222a3d] text-[#adc6ff] overflow-x-auto leading-relaxed">
                          {finding.codeSnippet}
                        </pre>
                      )}

                      {finding.revertReason && (
                        <div className="font-mono text-xs text-[#8c909f] bg-[#171f33] px-2.5 py-1.5 rounded border border-[#222a3d]">
                          {finding.revertReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Specialist Findings & Judge Assessment */}
                {activeToken.specialistFindings && activeToken.specialistFindings.length > 0 && (
                  <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-[#dae2fd] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">psychology</span>
                        <span>Specialist Reasoning &amp; Judge Assessment</span>
                      </h3>
                      <span className="font-mono text-[10px] text-[#adc6ff]">
                        Multi-LLM Jury
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                      {activeToken.specialistFindings.map((spec, i) => (
                        <div key={i} className="bg-[#131b2e] p-3 rounded-lg border border-[#222a3d] space-y-1">
                          <div className="flex items-center justify-between text-[#4cd7f6] font-bold">
                            <span>{spec.agentName}</span>
                            <span className="text-[10px] text-[#8c909f]">{spec.role}</span>
                          </div>
                          <p className="text-[#c2c6d6] text-xs leading-relaxed">{spec.finding}</p>
                        </div>
                      ))}
                    </div>

                    {activeToken.judgeAssessment && (
                      <div className="bg-[#131b2e] p-3 rounded-lg border border-[#4d8eff]/30 space-y-1">
                        <span className="font-mono text-[10px] text-[#4d8eff] font-bold uppercase block">
                          Judge Assessment
                        </span>
                        <p className="text-xs text-[#dae2fd] leading-relaxed">
                          {activeToken.judgeAssessment}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Similar Scams */}
                {activeToken.similarScams && activeToken.similarScams.length > 0 && (
                  <div className="bg-[#060e20] p-4 rounded-xl border border-[#222a3d] space-y-2 font-mono text-xs">
                    <span className="text-[#8c909f] uppercase block font-semibold text-[11px]">
                      Correlated Attack Mechanisms:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeToken.similarScams.map((s, i) => (
                        <div key={i} className="bg-[#131b2e] p-2.5 rounded-lg border border-[#222a3d] flex items-center justify-between">
                          <div>
                            <span className="font-bold text-[#dae2fd]">{s.name}</span>
                            <span className="text-[10px] text-[#8c909f] block">{s.mechanism}</span>
                          </div>
                          <span className="text-[#ffb4ab] font-bold">{s.similarity} match</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#222a3d]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenBytecodeModal(
                          activeToken.decompiledCode || '// No decompiled bytecode available for target',
                          `${activeToken.symbol} (${activeToken.address.slice(0, 6)}...${activeToken.address.slice(-4)})`
                        )
                      }
                      className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-mono text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">code</span>
                      <span>Inspect Decompiled Bytecode</span>
                    </button>
                    <a
                      href={`https://etherscan.io/address/${activeToken.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-mono text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Etherscan</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={handleReRunSimulation}
                    disabled={isReSimulating}
                    className="bg-[#93000a] hover:bg-[#ffb4ab] text-[#ffdad6] hover:text-[#690005] font-mono text-xs font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isReSimulating ? 'animate-spin' : ''}`}>
                      {isReSimulating ? 'sync' : 'play_arrow'}
                    </span>
                    <span>{isReSimulating ? 'Simulating...' : 'Re-run Dry Sell Simulator'}</span>
                  </button>
                </div>
              </div>
              <div ref={streamEndRef} />
            </div>

            {/* Bottom Dock Input Bar */}
            <div className="pt-3 mt-auto border-t border-[#222a3d]">
              <form onSubmit={handleFormSubmit} className="bg-[#131b2e] p-3 rounded-xl border border-[#222a3d] space-y-2 shadow-xl">
                {/* Chain Selector */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    <span className="font-mono text-xs text-[#8c909f] uppercase font-semibold mr-1">
                      Network:
                    </span>
                    {networks.map((net) => {
                      const isNetActive = selectedNetwork === net;
                      return (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setSelectedNetwork(net)}
                          className={`px-2.5 py-1 rounded font-mono text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            isNetActive
                              ? 'bg-[#4d8eff] text-[#00285d]'
                              : 'bg-[#171f33] text-[#c2c6d6] hover:text-[#dae2fd]'
                          }`}
                        >
                          <span>{net}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="font-mono text-xs text-[#8c909f]">
                    {userAccount.isWorldIdVerified ? (
                      <span className="text-[#4edea3] font-bold">
                        {userAccount.freeScansRemaining} Free Checks Left
                      </span>
                    ) : (
                      <span className="text-[#ffb4ab] font-bold">Humanity Unverified</span>
                    )}
                  </div>
                </div>

                {/* Input Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#060e20] p-1.5 rounded-lg border border-[#222a3d] focus-within:border-[#4cd7f6]/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[#8c909f] pl-2 text-[20px] shrink-0">
                      search_insights
                    </span>
                    <input
                      id="scanner-contract-input"
                      type="text"
                      value={inputAddress}
                      onChange={(e) => setInputAddress(e.target.value)}
                      placeholder="Paste EVM target contract (0x...) to investigate..."
                      className="flex-1 min-w-0 bg-transparent font-mono text-xs sm:text-sm text-[#dae2fd] placeholder:text-[#8c909f] focus:outline-none px-2 py-1.5 sm:py-0"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isScanning}
                    className="bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] shadow-sm shrink-0 w-full sm:w-auto"
                  >
                    {isScanning ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">security</span>
                        <span>Analyze Contract</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
