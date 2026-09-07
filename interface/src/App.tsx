import React, { useState } from 'react';
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
import { AnalysisApiResult, AnalysisStreamHandlers, TokenInvestigation, EVMNetwork, UserAccountState, LedgerTransaction, RiskVerdict, VulnerabilityFlag } from './types';
import { streamContractAnalysis } from './services/riskSearcherApi';

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
    };
  };

  const triggerScanDirect = (address: string, network: EVMNetwork, handlers: AnalysisStreamHandlers) => {
    // A history entry is evidence from a prior run, not a cache hit. Always
    // request a fresh backend analysis so a reviewer can detect changed risk.
    const isReanalysis = investigations.some(
      (item) => item.address.toLowerCase() === address.toLowerCase() && item.network === network,
    );
    const chainByNetwork: Record<EVMNetwork, string> = { Ethereum: 'ethereum', Base: 'base', Arbitrum: 'arbitrum', Optimism: 'optimism', 'BNB Chain': 'bsc', Polygon: 'polygon', Avalanche: 'avalanche' };
    streamContractAnalysis(address.trim(), chainByNetwork[network], {
      onProgress: handlers.onProgress,
      onResult: (result) => {
        const investigation = createInvestigationFromApiResult(address.trim(), network, result);
        setInvestigations((previous) => [investigation, ...previous]);
        setActiveToken(investigation);
        setUserAccount((previous) => ({
          ...previous,
          freeScansRemaining: isReanalysis ? previous.freeScansRemaining : Math.max(0, previous.freeScansRemaining - 1),
          totalScansExecuted: previous.totalScansExecuted + 1,
        }));
        setTransactions((previous) => [{ id: `tx-${Date.now()}`, timestamp: 'Just now', operation: isReanalysis ? 'Contract risk reanalysis' : 'Contract risk analysis', category: 'service', typeIcon: 'token', amount: isReanalysis ? 'Reanalysis' : '1 Scan', isCredit: false, isFree: !isReanalysis, txHash: 'Backend analysis', settlement: 'Success' }, ...previous]);
        setCurrentView('scanner');
        handlers.onResult(result);
      },
      onError: handlers.onError,
    });
  };

  const handleStartScan = (address: string, network: EVMNetwork, handlers?: AnalysisStreamHandlers) => {
    // Access control: users cannot analyze or see the dashboard until they log in or connect wallet
    if (!isWalletConnected) {
      setPendingScan({ address, network });
      setWalletModalPrompt(
        `Sign in or connect your wallet to analyze ${address.slice(0, 10)}... (${network}) and view the forensic risk report.`
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

  const handleVerifyWorldIdSuccess = () => {
    setUserAccount((prev) => ({
      ...prev,
      isWorldIdVerified: true,
      totalFreeScans: 15,
      freeScansRemaining: 15,
    }));

    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: 'World ID zk-SNARK Verification',
      category: 'service',
      typeIcon: 'fingerprint',
      amount: '+15 Scans (Trial)',
      isCredit: true,
      isFree: true,
      txHash: '0x4299...a18f',
      settlement: 'Verified',
    };
    setTransactions([newTx, ...transactions]);
  };

  const handleAddFundsSuccess = (amount: number, network: string, method: string) => {
    setUserAccount((prev) => ({
      ...prev,
      walletUsdcBalance: prev.walletUsdcBalance + amount,
    }));

    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: method === 'buy' ? `Buy USDC (${network})` : `Receive USDC (${network})`,
      category: 'wallet',
      typeIcon: 'south_west',
      amount: `+${amount.toFixed(2)} USDC`,
      isCredit: true,
      txHash: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6),
      settlement: 'Confirmed',
    };
    setTransactions([newTx, ...transactions]);
  };

  const handleSendSuccess = (amount: number, toAddress: string, network: string) => {
    setUserAccount((prev) => ({
      ...prev,
      walletUsdcBalance: Math.max(0, prev.walletUsdcBalance - amount),
    }));

    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: `Send to ${toAddress.slice(0, 6)}... (${network})`,
      category: 'wallet',
      typeIcon: 'north_east',
      amount: `-${amount.toFixed(2)} USDC`,
      isCredit: false,
      txHash: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6),
      settlement: 'Broadcasted',
    };
    setTransactions([newTx, ...transactions]);
  };

  const handleWithdrawSuccess = (amount: number, destination: string, rail: string) => {
    setUserAccount((prev) => ({
      ...prev,
      walletUsdcBalance: Math.max(0, prev.walletUsdcBalance - amount),
    }));

    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: `Withdraw to ${rail.toUpperCase()}`,
      category: 'wallet',
      typeIcon: 'account_balance',
      amount: `-${amount.toFixed(2)} USDC`,
      isCredit: false,
      txHash: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6),
      settlement: 'Processed',
    };
    setTransactions([newTx, ...transactions]);
  };

  const handleSubscribeSuccess = (planName: string, amount: number, scans: number) => {
    setUserAccount((prev) => {
      const newWalletBal = Math.max(0, prev.walletUsdcBalance - amount);
      return {
        ...prev,
        walletUsdcBalance: newWalletBal,
        riskSearcherBalance: prev.riskSearcherBalance + amount,
        activeSubscription: {
          tier: 'PRO',
          name: planName,
          status: 'ACTIVE',
          renewsOn: 'Next month',
          priceMonthly: amount,
          scansIncluded: scans,
        },
      };
    });

    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: `Subscribe to ${planName}`,
      category: 'service',
      typeIcon: 'stars',
      amount: `-${amount.toFixed(2)} USDC`,
      isCredit: false,
      txHash: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6),
      settlement: 'Active',
    };
    setTransactions([newTx, ...transactions]);
  };

  const handleConnectWallet = (walletName: string) => {
    setIsWalletConnected(true);
    const isSocialOrSmart = walletName.includes('Google') || walletName.includes('Apple') || walletName.includes('Passkey');

    setUserAccount((prev) => ({
      ...prev,
      walletType: walletName,
      address: isSocialOrSmart
        ? '0x71C83b9281a182910c2847192839182471924337'
        : '0x88942b918247192839182910c28419b489289941',
      ensOrAlias: walletName.includes('Google')
        ? 'trader.google.id'
        : walletName.includes('Apple')
        ? 'trader.apple.id'
        : walletName.includes('Passkey')
        ? 'passkey.erc4337'
        : 'web3trader.eth',
      accountType: isSocialOrSmart ? 'ERC-4337 Smart Account' : 'EVM EOA Account',
    }));

    // If user attempted a scan before logging in, immediately execute it now!
    if (pendingScan) {
      const target = pendingScan;
      setPendingScan(null);
      setWalletModalPrompt(undefined);
      setIsWalletModalOpen(false);
      setScannerAutoScan({ id: Date.now(), address: target.address, network: target.network });
      setCurrentView('scanner');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setWalletModalPrompt(undefined);
    }
  };

  const handleDisconnectWallet = () => {
    setIsWalletConnected(false);
    setPendingScan(null);
    setWalletModalPrompt(undefined);
    // If the user was on a protected page (wallet/accounts or scanner), return safely to public overview
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
            'Authentication Required: Connect your Web3 wallet or sign in with Passkey / Google / Apple to access your personal wallet, on-chain balances, and API credentials.'
        );
      } else {
        setWalletModalPrompt(
          customPrompt ||
            'Authentication Required: Connect your Web3 wallet or sign in to launch deep forensic scans and view interactive contract risk analysis.'
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
          setWalletModalPrompt('Connect your Web3 wallet or sign in with Google / Apple / Passkey.');
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
              setWalletModalPrompt('Sign in or connect your wallet to analyze contracts and access the live risk dashboard.');
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
                'Authentication Required: Connect your Web3 wallet or sign in with Google / Apple / Passkey to unlock the forensic terminal & dashboard.'
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
                setWalletModalPrompt('Sign in or connect your wallet to deposit or purchase self-custodial USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setAddFundsModalState({ isOpen: true, tab: initialTab || 'receive' });
            }}
            onOpenSendModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to send USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSendModalOpen(true);
            }}
            onOpenWithdrawModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to withdraw self-custodial USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWithdrawModalOpen(true);
            }}
            onOpenSubscriptionModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to manage or activate a Pro Analyst subscription.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSubscriptionModalOpen(true);
            }}
            onOpenWorldIdModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to verify World ID humanity and unlock free scans.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWorldIdModalOpen(true);
            }}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={() => {
              setWalletModalPrompt(
                'Authentication Required: Connect your Web3 wallet or sign in with Google / Apple / Passkey to access your personal balances, execution node, and API credentials.'
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
                prompt || 'Sign in or connect your wallet to launch archival EVM traces and contract audits.'
              );
              setIsWalletModalOpen(true);
            }}
          />
        )}

        {currentView === 'pricing' && (
          <PricingView
            onOpenSubscriptionModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to subscribe to Pro Analyst with USDC.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsSubscriptionModalOpen(true);
            }}
            onOpenWorldIdModal={() => {
              if (!isWalletConnected) {
                setWalletModalPrompt('Sign in or connect your wallet to verify with World ID and claim 15 free forensic scans.');
                setIsWalletModalOpen(true);
                return;
              }
              setIsWorldIdModalOpen(true);
            }}
            onNavigate={handleNavigate}
            userAccount={userAccount}
            isWalletConnected={isWalletConnected}
            onOpenWalletModal={() => {
              setWalletModalPrompt('Sign in or connect your wallet to select a plan or verify humanity.');
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
                  'Authentication Required: Connect your Web3 wallet or sign in to access your personal API keys and forensic tools.'
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
            prompt || 'Authentication Required: Connect your Web3 wallet or sign in to access this section.'
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
        onClose={() => setIsSendModalOpen(false)}
        onSendSuccess={handleSendSuccess}
      />

      {/* Withdraw USDC Modal */}
      <WithdrawUsdcModal
        isOpen={isWalletConnected && isWithdrawModalOpen}
        walletBalance={userAccount.walletUsdcBalance}
        onClose={() => setIsWithdrawModalOpen(false)}
        onWithdrawSuccess={handleWithdrawSuccess}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isWalletConnected && isSubscriptionModalOpen}
        walletBalance={userAccount.walletUsdcBalance}
        onClose={() => setIsSubscriptionModalOpen(false)}
        onSubscribeSuccess={handleSubscribeSuccess}
        onOpenAddFundsModal={() => {
          setIsSubscriptionModalOpen(false);
          setAddFundsModalState({ isOpen: true, tab: 'buy' });
        }}
      />
    </div>
  );
}
