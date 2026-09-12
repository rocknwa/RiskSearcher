import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { ScannerView } from './components/ScannerView';
import { AccountsView } from './components/AccountsView';
import { SupportedChainsView } from './components/SupportedChainsView';
import { PricingView } from './components/PricingView';
import { DocumentationView } from './components/DocumentationView';
import { ConnectWalletModal } from './components/ConnectWalletModal';
import { BytecodeModal } from './components/BytecodeModal';
import { WorldIdModal } from './components/WorldIdModal';
import { AddFundsModal } from './components/AddFundsModal';
import { SendUsdcModal } from './components/SendUsdcModal';
import { WithdrawUsdcModal } from './components/WithdrawUsdcModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import {
  INITIAL_INVESTIGATIONS,
  INITIAL_USER_ACCOUNT,
  INITIAL_TRANSACTIONS,
} from './data/mockData';
import { AnalysisApiResult, AnalysisStreamHandlers, TokenInvestigation, EVMNetwork, UserAccountState, LedgerTransaction, RiskVerdict, VulnerabilityFlag, EntitlementState } from './types';
import { streamContractAnalysis } from './services/riskSearcherApi';
import { getArcWallet } from './services/arcApi';
import { getScanHistory } from './services/historyApi';
import { getEntitlements, getLedger } from './services/entitlementApi';
import { clearSession, getSessionProfile, getSessionToken, logoutSession } from './services/authApi';
import { getStoredUsername } from './services/passkeyWallet';

// Reverse of the chainByNetwork map used when sending a scan request -
// needed to turn a saved history record's plain chain string back into
// the EVMNetwork label the UI expects.
const NETWORK_BY_CHAIN: Record<string, EVMNetwork> = {
  ethereum: 'Ethereum', base: 'Base', arbitrum: 'Arbitrum', optimism: 'Optimism',
  bsc: 'BNB Chain', polygon: 'Polygon', avalanche: 'Avalanche',
};

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'scanner' | 'accounts' | 'supported-chains' | 'pricing' | 'documentation' | 'how-it-works'>('landing');
  const [investigations, setInvestigations] = useState<TokenInvestigation[]>(INITIAL_INVESTIGATIONS);
  const [activeToken, setActiveToken] = useState<TokenInvestigation>(INITIAL_INVESTIGATIONS[0]);
  const [userAccount, setUserAccount] = useState<UserAccountState>(INITIAL_USER_ACCOUNT);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [pendingScan, setPendingScan] = useState<{ address: string; network: EVMNetwork } | null>(null);
  const [scannerAutoScan, setScannerAutoScan] = useState<{ id: number; address: string; network: EVMNetwork } | null>(null);
  const [walletModalPrompt, setWalletModalPrompt] = useState<string | undefined>(undefined);

  // Modals state
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [bytecodeModal, setBytecodeModal] = useState<{ isOpen: boolean; code: string; title: string }>({
    isOpen: false,
    code: '',
    title: '',
  });
  const [isWorldIdModalOpen, setIsWorldIdModalOpen] = useState(false);
  const [addFundsModalState, setAddFundsModalState] = useState<{ isOpen: boolean; tab: 'receive' | 'buy' }>({
    isOpen: false,
    tab: 'receive',
  });
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  // Preserve a valid authenticated passkey session across browser refreshes.
  // This restores only server-verified identity; balances, entitlements and
  // ledger rows are then fetched by the existing authenticated effects below.
  useEffect(() => {
    if (!getSessionToken()) return;
    let cancelled = false;
    void getSessionProfile()
      .then((profile) => {
        if (cancelled || !profile.authenticated || !profile.wallet_address) return;
        const username = getStoredUsername();
        setUserAccount((prev) => ({
          ...prev,
          walletType: 'Passkey Smart Account',
          address: profile.wallet_address,
          ensOrAlias: username || 'Passkey account',
          accountType: 'ERC-4337',
        }));
        setTransactions([]);
        setIsWalletConnected(true);
      })
      .catch(() => {
        clearSession();
      });
    return () => { cancelled = true; };
  }, []);

  // Refresh the real Circle DCW balance on connect/address/view changes so
  // wallet surfaces never rely on stale client-side balance state.
  useEffect(() => {
    if (!isWalletConnected || !userAccount.address) return;
    getArcWallet()
      .then((wallet) => {
        if (wallet.no_data) return;
        setUserAccount((prev) => ({ ...prev, walletUsdcBalance: wallet.usdc_balance ?? prev.walletUsdcBalance }));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, userAccount.address, currentView]);

  const createInvestigationFromApiResult = (address: string, network: EVMNetwork, result: AnalysisApiResult): TokenInvestigation => {
    const normalizedVerdict = result.verdict.toUpperCase();
    const verdict: RiskVerdict = ['UNSAFE', 'SAFE', 'THREAT', 'MALICIOUS', 'VERIFIED SAFE'].includes(normalizedVerdict)
      ? normalizedVerdict as RiskVerdict : result.score >= 30 ? 'THREAT' : 'SAFE';
    const severity = result.severity.toUpperCase();
    const findings: VulnerabilityFlag[] = result.breakdown.length
      ? result.breakdown.map((description, index) => ({ id: `backend-${index}`, severity: severity === 'CRITICAL' || result.score >= 70 ? 'CRITICAL' : severity === 'WARNING' || result.score >= 30 ? 'WARNING' : 'NOTICE', title: `Risk signal ${index + 1}`, description, icon: result.score >= 70 ? 'warning' : 'info' }))
      : [{ id: 'backend-no-findings', severity: 'NOTICE', title: 'No rule-based risk signals reported', description: result.final_reason || 'The backend completed its analysis without reporting a specific risk signal.', icon: 'check_circle' }];
    const finalReason = result.final_reason || result.breakdown.join(' ') || 'The backend completed the contract analysis.';
    return {
      id: `scan-${Date.now()}`, symbol: 'CONTRACT', name: 'Analyzed Contract', address, network, verdict,
      riskScore: Math.max(0, Math.min(100, result.score)), ruleBasedScore: Math.max(0, Math.min(100, result.rule_score ?? result.score)),
      verdictSource: result.verdict_source === 'rule_based' ? 'Deterministic Rules' : result.verdict_source === 'specialist_ensemble' ? 'Specialist Ensemble' : 'LLM Judge',
      sourceVerified: false, confidence: 100, timeAgo: 'Just now', timestamp: 'Just now',
      gasSimulation: 'Not returned by backend', sellTax: 'Not returned by backend', buyTax: 'Not returned by backend', pooledLiquidity: 'Not returned by backend', liquidityStatus: 'Not returned by backend', originDeployer: 'Not returned by backend', deployerAge: 'Not returned by backend', consensusRatio: result.score_source || 'Backend analysis',
      userPrompt: `Inspect contract ${address} on ${network} Mainnet.`, verdictExplanation: finalReason,
      executionSteps: [
        { title: 'Step 1: Contract source fetched.', duration: 'Live', completed: true }, { title: 'Step 2: Rule-based analysis completed.', duration: 'Live', completed: true }, { title: 'Step 3: Specialist analysis completed.', duration: 'Live', completed: true }, { title: 'Step 4: Judge pass completed.', duration: 'Live', completed: true }, { title: 'Step 5: Report generated.', duration: 'Live', completed: true },
      ], findings, judgeAssessment: finalReason, analysisParameters: result.parameters,
      graphEvidence: result.graph_evidence ?? undefined,
    };
  };

  // Wallet connect doesn't just mean "sign in" - RiskSearcher's own scan
  // history (as opposed to the Arc wallet balance above) previously lived
  // only in local React state, so it reset on every refresh and wasn't
  // scoped to which address was connected at all. This loads whatever
  // Firestore actually has for this address and merges it in, deduplicated
  // by the real Firestore doc id so this can safely re-run.
  useEffect(() => {
    if (!isWalletConnected || !userAccount.address) return;
    getScanHistory()
      .then((response) => {
        if (response.no_data || !response.records?.length) return;
        const historyInvestigations = response.records.map((record) => {
          const network = (NETWORK_BY_CHAIN[record.chain] ?? 'Ethereum') as EVMNetwork;
          const investigation = createInvestigationFromApiResult(record.contract_address, network, record);
          return { ...investigation, id: `history-${record.doc_id}` };
        });
        setInvestigations((previous) => {
          const existingIds = new Set(previous.map((item) => item.id));
          const newOnes = historyInvestigations.filter((item) => !existingIds.has(item.id));
          return [...newOnes, ...previous];
        });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, userAccount.address]);

  const applyEntitlement = (state: EntitlementState | undefined) => {
    if (!state || state.no_data) return;
    setUserAccount((prev) => ({
      ...prev,
      isWorldIdVerified: state.world_verified,
      totalFreeScans: state.free_scans_granted || 3,
      freeScansRemaining: state.free_scans_remaining,
      paidScansRemaining: state.paid_scans_remaining,
      totalScansExecuted: state.total_scans_executed,
      // Legacy field retained for component compatibility only; scan counts are authoritative.
      riskSearcherBalance: 0,
      activeSubscription: state.paid_scans_remaining > 0 ? {
        tier: 'PRO',
        name: '10-Scan Access Pack',
        status: 'ACTIVE',
        priceUsdc: 5,
        scansIncluded: state.paid_scans_remaining,
      } : null,
    }));
  };

  const refreshEntitlementsAndLedger = async () => {
    if (!isWalletConnected) return;
    const [entitlementResult, ledgerResult] = await Promise.allSettled([getEntitlements(), getLedger()]);
    if (entitlementResult.status === 'fulfilled') applyEntitlement(entitlementResult.value);
    if (ledgerResult.status === 'fulfilled' && !ledgerResult.value.no_data) {
      setTransactions(ledgerResult.value.records || []);
    }
  };

  // Restore authoritative credits + real per-user ledger after login/reload.
  useEffect(() => {
    if (!isWalletConnected || !userAccount.address) return;
    void refreshEntitlementsAndLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, userAccount.address]);

  const triggerScanDirect = (address: string, network: EVMNetwork, handlers: AnalysisStreamHandlers) => {
    const chainByNetwork: Record<EVMNetwork, string> = { Ethereum: 'ethereum', Base: 'base', Arbitrum: 'arbitrum', Optimism: 'optimism', 'BNB Chain': 'bsc', Polygon: 'polygon', Avalanche: 'avalanche' };
    streamContractAnalysis(address.trim(), chainByNetwork[network], {
      onProgress: handlers.onProgress,
      onResult: (result) => {
        const investigation = createInvestigationFromApiResult(address.trim(), network, result);
        setInvestigations((previous) => [investigation, ...previous]);
        setActiveToken(investigation);
        applyEntitlement(result.entitlement);
        void refreshEntitlementsAndLedger();
        setCurrentView('scanner');
        handlers.onResult(result);
      },
      onError: (message) => {
        // A failed analysis is refunded server-side; refresh the displayed count.
        void refreshEntitlementsAndLedger();
        handlers.onError(message);
      },
    });
  };

  const handleStartScan = (address: string, network: EVMNetwork, handlers?: AnalysisStreamHandlers) => {
    // Access control: users cannot analyze or see the dashboard until they log in or connect wallet
    if (!isWalletConnected) {
      setPendingScan({ address, network });
      setWalletModalPrompt(
        `Sign in with your passkey to analyze ${address.slice(0, 10)}... (${network}) and view the forensic risk report.`
      );
      setIsWalletModalOpen(true);
      return;
    }

    // Landing-page scans have no ScannerView handlers yet. Navigate first so
    // the existing scanner can own and display the live streaming progress.
    if (!handlers) {
      setScannerAutoScan({ id: Date.now(), address, network });
      setCurrentView('scanner');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    triggerScanDirect(address, network, handlers || { onProgress: () => undefined, onResult: () => undefined, onError: () => undefined });
  };

  const handleVerifyWorldIdSuccess = (scansGranted: number, nullifier: string) => {
    setUserAccount((prev) => ({ ...prev, isWorldIdVerified: true, totalFreeScans: scansGranted, freeScansRemaining: scansGranted }));
    if (userAccount.address && nullifier) {
      localStorage.setItem(`world_id_nullifier_${userAccount.address.toLowerCase()}`, nullifier);
    }
    void refreshEntitlementsAndLedger();
  };

  const handleWorldIdAlreadyClaimed = (originalWalletAddress: string) => {
    const shortAddress = originalWalletAddress
      ? `${originalWalletAddress.slice(0, 6)}...${originalWalletAddress.slice(-4)}`
      : 'a different wallet';
    window.alert(`This World ID has already claimed its one-time trial with ${shortAddress}. Each verified human gets 3 free scans total.`);
  };

  const refreshRealWalletBalance = () => {
    if (!isWalletConnected) return;
    void getArcWallet().then((wallet) => {
      if (!wallet.no_data) setUserAccount((prev) => ({ ...prev, walletUsdcBalance: wallet.usdc_balance ?? 0 }));
    }).catch(() => undefined);
  };

  const handleAddFundsSuccess = () => {
    refreshRealWalletBalance();
    void refreshEntitlementsAndLedger();
  };

  const handleSendSuccess = (_amount: number, _toAddress: string, _network: string) => {
    refreshRealWalletBalance();
    void refreshEntitlementsAndLedger();
  };

  const handleSubscribeSuccess = (entitlement: EntitlementState) => {
    applyEntitlement(entitlement);
    refreshRealWalletBalance();
    void refreshEntitlementsAndLedger();
  };

  // walletName is a display label ("Passkey Smart Account", ...); address/
  // accountType/ensOrAlias come from a REAL connection now — Circle's
  // Modular Wallets (passkey) flow for the smart-account path (see
  // ConnectWalletModal.tsx, services/passkeyWallet.ts), or a real EVM
  // wallet connector for MetaMask/Rabby/Coinbase/WalletConnect once that's
  // wired up. Nothing here invents or hardcodes an address anymore.
  const handleConnectWallet = (
    walletName: string,
    connection: { address: string; accountType: 'ERC-4337' | 'EOA'; ensOrAlias: string },
  ) => {
    setIsWalletConnected(true);
    setTransactions([]);
    setInvestigations(INITIAL_INVESTIGATIONS);
    setActiveToken(INITIAL_INVESTIGATIONS[0]);

    setUserAccount((prev) => ({
      ...prev,
      walletType: walletName,
      address: connection.address,
      ensOrAlias: connection.ensOrAlias,
      accountType: connection.accountType,
    }));

    // If the user attempted a scan before signing in, load the authoritative
    // entitlement first so the scanner does not briefly mistake an existing
    // paid/free balance for zero and show the wrong access prompt.
    if (pendingScan) {
      const target = pendingScan;
      setPendingScan(null);
      setWalletModalPrompt(undefined);
      setIsWalletModalOpen(false);
      setCurrentView('scanner');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      void getEntitlements()
        .then((state) => applyEntitlement(state))
        .catch(() => undefined)
        .finally(() => setScannerAutoScan({ id: Date.now(), address: target.address, network: target.network }));
    } else {
      setWalletModalPrompt(undefined);
    }
  };

  const handleDisconnectWallet = () => {
    void logoutSession();
    setIsWalletConnected(false);
    setPendingScan(null);
    setScannerAutoScan(null);
    setWalletModalPrompt(undefined);
    setUserAccount(INITIAL_USER_ACCOUNT);
    setTransactions([]);
    setInvestigations(INITIAL_INVESTIGATIONS);
    setActiveToken(INITIAL_INVESTIGATIONS[0]);
    if (currentView === 'accounts' || currentView === 'scanner') {
      setCurrentView('landing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavigate = (view: string, customPrompt?: string) => {
    // Strictly gate user-specific / interactive views (wallet/accounts & scanner)
    if ((view === 'accounts' || view === 'scanner') && !isWalletConnected) {
      if (view === 'accounts') {
        setWalletModalPrompt(
          customPrompt ||
            'Authentication Required: Sign in with your passkey to access your Arc Testnet wallet balance, scan credits, and activity.'
        );
      } else {
        setWalletModalPrompt(
          customPrompt ||
            'Authentication Required: Sign in with your passkey to launch deep forensic scans and view interactive contract risk analysis.'
        );
      }
      setIsWalletModalOpen(true);
      return;
    }

    setCurrentView(view as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1326] text-[#dae2fd] overflow-x-hidden">
      {/* Global Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        userAccount={userAccount}
        onOpenWalletModal={() => {
          setWalletModalPrompt('Sign in with your passkey.');
          setIsWalletModalOpen(true);
        }}
        isWalletConnected={isWalletConnected}
        onDisconnectWallet={handleDisconnectWallet}
      />

      {/* Main Content View Container */}
      <main className="flex-1 pt-16 flex flex-col">
        {currentView === 'landing' && (
          <LandingPage
            onStartScan={handleStartScan}
            onOpenWalletModal={() => {
              setWalletModalPrompt('Sign in with your passkey to analyze contracts and access the live risk dashboard.');
              setIsWalletModalOpen(true);
            }}
            onNavigate={handleNavigate}
            isWalletConnected={isWalletConnected}
          />
        )}

        {currentView === 'scanner' && (
          <ScannerView
            investigations={investigations}
            activeToken={activeToken}
            onSelectToken={(token) => {
              setActiveToken(token);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onRunScan={handleStartScan}
            autoScanRequest={scannerAutoScan}
            onAutoScanRequestHandled={() => setScannerAutoScan(null)}
            userAccount={userAccount}
            onOpenBytecodeModal={(code, title) => {
              setBytecodeModal({ isOpen: true, code, title });
            }}
            onOpenAddFundsModal={() => setAddFundsModalState({ isOpen: true, tab: 'receive' })}
            onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
            onOpenWorldIdModal={() => setIsWorldIdModalOpen(true)}
            onNavigate={handleNavigate}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={() => {
              setWalletModalPrompt(
                'Authentication Required: Sign in with your passkey to unlock the scanner and dashboard.'
              );
              setIsWalletModalOpen(true);
            }}
          />
        )}

        {currentView === 'accounts' && (
          <AccountsView
            userAccount={userAccount}
            transactions={transactions}
            onOpenAddFundsModal={(initialTab) => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to fund your Arc Testnet wallet.');
                setIsWalletModalOpen(true);
                return;
              }
              setAddFundsModalState({ isOpen: true, tab: initialTab || 'receive' });
            }}
            onOpenSendModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to send USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSendModalOpen(true);
            }}
            onOpenWithdrawModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to view wallet features. Off-ramp is coming soon.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWithdrawModalOpen(true);
            }}
            onOpenSubscriptionModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to buy a 10-scan testnet access pack.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSubscriptionModalOpen(true);
            }}
            onOpenWorldIdModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to verify World ID humanity and unlock free scans.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWorldIdModalOpen(true);
            }}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={() => {
              setWalletModalPrompt(
                'Authentication Required: Sign in with your passkey to access your real Arc Testnet balance, scan credits, and activity.'
              );
              setIsWalletModalOpen(true);
            }}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'supported-chains' && (
          <SupportedChainsView
            onSelectChainForScan={(chain) => {
              handleNavigate('scanner');
            }}
            onNavigate={handleNavigate}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={(prompt) => {
              setWalletModalPrompt(
                prompt || 'Sign in with your passkey to run contract analysis on the selected EVM network.'
              );
              setIsWalletModalOpen(true);
            }}
          />
        )}

        {currentView === 'pricing' && (
          <PricingView
            onOpenSubscriptionModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to buy 10 scan credits with $5 testnet USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSubscriptionModalOpen(true);
            }}
            onOpenWorldIdModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in with your passkey to verify with World ID and claim 3 free forensic scans.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWorldIdModalOpen(true);
            }}
            onNavigate={handleNavigate}
            userAccount={userAccount}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={() => {
              setWalletModalPrompt('Sign in with your passkey to buy scan credits or verify humanity.');
              setIsWalletModalOpen(true);
            }}
          />
        )}

        {(currentView === 'documentation' || currentView === 'how-it-works') && (
          <DocumentationView
            onNavigate={handleNavigate}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={(prompt) => {
              setWalletModalPrompt(
                prompt ||
                  'Authentication Required: Sign in with your passkey to access your wallet, scan credits, and analysis tools.'
              );
              setIsWalletModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={handleNavigate}
        isWalletConnected={isWalletConnected}
        onOpenWalletModal={(prompt) => {
          setWalletModalPrompt(
            prompt || 'Authentication Required: Sign in with your passkey to access this section.'
          );
          setIsWalletModalOpen(true);
        }}
      />

      {/* Wallet Connection Modal (ERC-4337 & Web3 Wallets) */}
      <ConnectWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setWalletModalPrompt(undefined);
        }}
        onConnect={handleConnectWallet}
        isWalletConnected={isWalletConnected}
        currentWalletName={userAccount.walletType}
        onDisconnect={handleDisconnectWallet}
        modalPrompt={walletModalPrompt}
      />

      {/* Bytecode Inspector Modal */}
      <BytecodeModal
        isOpen={bytecodeModal.isOpen}
        code={bytecodeModal.code}
        title={bytecodeModal.title}
        onClose={() => setBytecodeModal({ isOpen: false, code: '', title: '' })}
      />

      {/* World ID Verification Modal (Sybil Defense) */}
      <WorldIdModal
        isOpen={isWalletConnected && isWorldIdModalOpen}
        onClose={() => setIsWorldIdModalOpen(false)}
        onVerifySuccess={handleVerifyWorldIdSuccess}
        onAlreadyClaimed={handleWorldIdAlreadyClaimed}
        isAlreadyVerified={userAccount.isWorldIdVerified}
        walletAddress={userAccount.address}
      />

      {/* Add Funds Modal (Receive & Buy USDC) */}
      <AddFundsModal
        isOpen={isWalletConnected && addFundsModalState.isOpen}
        initialTab={addFundsModalState.tab}
        walletAddress={userAccount.address}
        onClose={() => setAddFundsModalState((prev) => ({ ...prev, isOpen: false }))}
        onAddFundsSuccess={handleAddFundsSuccess}
      />

      {/* Send USDC Modal */}
      <SendUsdcModal
        isOpen={isWalletConnected && isSendModalOpen}
        walletBalance={userAccount.walletUsdcBalance}
        userAddress={userAccount.address}
        onClose={() => setIsSendModalOpen(false)}
        onSendSuccess={handleSendSuccess}
      />

      {/* Withdraw USDC Modal */}
      <WithdrawUsdcModal
        isOpen={isWalletConnected && isWithdrawModalOpen}
        walletBalance={userAccount.walletUsdcBalance}
        userAddress={userAccount.address}
        onClose={() => setIsWithdrawModalOpen(false)}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isWalletConnected && isSubscriptionModalOpen}
        walletBalance={userAccount.walletUsdcBalance}
        userAddress={userAccount.address}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onSubscribeSuccess={handleSubscribeSuccess}
        onOpenAddFundsModal={() => {
          setIsSubscriptionModalOpen(false);
          setAddFundsModalState({ isOpen: true, tab: 'receive' });
        }}
      />
    </div>
  );
}
