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
import { TokenInvestigation, EVMNetwork, UserAccountState, LedgerTransaction } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'scanner' | 'accounts' | 'supported-chains' | 'pricing' | 'documentation' | 'how-it-works'>('landing');
  const [investigations, setInvestigations] = useState<TokenInvestigation[]>(INITIAL_INVESTIGATIONS);
  const [activeToken, setActiveToken] = useState<TokenInvestigation>(INITIAL_INVESTIGATIONS[0]);
  const [userAccount, setUserAccount] = useState<UserAccountState>(INITIAL_USER_ACCOUNT);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(INITIAL_TRANSACTIONS);
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(false);
  const [pendingScan, setPendingScan] = useState<{ address: string; network: EVMNetwork } | null>(null);
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

  const triggerScanDirect = (address: string, network: EVMNetwork) => {
    // Check if token already exists in history
    const existing = investigations.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );

    if (existing) {
      setActiveToken(existing);
      setCurrentView('scanner');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Heuristically generate a realistic simulation for any new address
    const cleanAddr = address.trim();
    const isMockMalicious = !cleanAddr.toLowerCase().includes('420') && !cleanAddr.toLowerCase().includes('940');

    const newInvestigation: TokenInvestigation = {
      id: 'scan-' + Date.now(),
      symbol: isMockMalicious ? '$DYNATX' : '$VERIFIED',
      name: isMockMalicious ? 'Dynamic Tax Trap Protocol' : 'Verified Standard ERC20',
      address: cleanAddr,
      network: network,
      verdict: isMockMalicious ? 'UNSAFE' : 'SAFE',
      riskScore: isMockMalicious ? 88 : 0,
      verdictSource: 'LLM Judge',
      ruleBasedScore: isMockMalicious ? 15 : 0,
      sourceVerified: true,
      confidence: 99.1,
      timeAgo: 'Just now',
      timestamp: 'Just now',
      gasSimulation: isMockMalicious
        ? 'Reverted sell attempt: TRANSFER_RESTRICTED (0xFD)'
        : 'Clean swap executed: 22,480 gas',
      sellTax: isMockMalicious ? '45% - 99% Dynamic' : '0.0%',
      buyTax: isMockMalicious ? '3.5%' : '0.0%',
      pooledLiquidity: isMockMalicious ? '$28,400 USDC' : '$1,200,000 USDC',
      liquidityStatus: isMockMalicious ? 'Unlocked (Deployer EOA)' : 'Locked in Protocol TimeLock',
      originDeployer: '0x' + Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...6045',
      deployerAge: isMockMalicious ? 'Fresh EOA (1d old)' : 'Established Contract (1y old)',
      consensusRatio: isMockMalicious ? '3 of 3 LLM specialists voted UNSAFE' : '3 of 3 LLM specialists voted SAFE',
      userPrompt: `Inspect contract ${cleanAddr} on ${network} Mainnet. Check for anti-whale limits, hidden fee functions, and malicious ownership retention.`,
      verdictExplanation: isMockMalicious
        ? 'Dual buy/sell execution failed. Contract uses dynamic sell tax hooks that escalate fees up to 99% for standard non-whitelisted addresses.'
        : 'Standard OpenZeppelin token standard. Liquidity locked and owner renounced.',
      transactionBehavior: {
        realValueTransfers: isMockMalicious ? 14 : 320,
        zeroValueTransfers: isMockMalicious ? 82 : 2,
        uniqueSenders: isMockMalicious ? 12 : 280,
        outboundConcentration: isMockMalicious ? '82% of swap fees funneled to deployer address' : 'Distributed DEX swap topology',
        contractEthBalance: '~0.00 ETH',
        note: isMockMalicious ? 'High zero-value transfer count indicates potential transfer event poisoning.' : undefined,
      },
      executionSteps: [
        { title: `Step 1: Source code & bytecode retrieved from ${network} archive node.`, duration: '128ms', completed: true },
        { title: `Step 2: Rule-based AST & transfer restriction check completed.`, duration: '310ms', completed: true },
        { title: `Step 3: Specialist reasoning models analyzed tax mechanics.`, duration: '340ms', completed: true },
        { title: `Step 4: LLM Judge reconciled findings and elevated risk index.`, duration: '110ms', completed: true },
        { title: `Step 5: Final evidence audit report generated.`, duration: '85ms', completed: true },
      ],
      findings: isMockMalicious
        ? [
            {
              id: 'nf-1',
              severity: 'CRITICAL',
              title: 'Honeypot Trap Detected: Non-Whitelisted Sells Revert',
              description: 'Transaction trace shows opcode 0xFD hit when recipient is DEX router. Transfer function contains hidden whitelist check only deployer can pass.',
              codeSnippet: `>> if (!isWhitelistedBroker[sender] && recipient == dexPair) revert("TRANSFER_RESTRICTED");`,
              revertReason: 'TRANSFER_RESTRICTED • Opcode 0xFD reached at instruction PC:0x04F1',
              icon: 'block'
            },
            {
              id: 'nf-2',
              severity: 'CRITICAL',
              title: 'Dynamic Fee Modifier with Uncapped Ceiling',
              description: 'Deployer can adjust the sell tax to 99% in a single transaction before frontrunning liquidity withdrawal.',
              icon: 'percent'
            }
          ]
        : [
            {
              id: 'nf-safe',
              severity: 'NOTICE',
              title: 'Standard ERC20 Architecture Verified',
              description: 'Zero hidden mints, immutable owner renouncement, and 0% buy/sell fees verified on ephemeral fork.',
              icon: 'check_circle'
            }
          ],
      decompiledCode: isMockMalicious
        ? `// [RECONSTRUCTED AST DISPATCH]
// Target: ${cleanAddr}
function _transfer(address sender, address recipient, uint256 amount) internal {
    require(sender != address(0), "ERC20: zero");
    if (recipient == dexPair && !isWhitelistedBroker[sender]) {
        revert("TRANSFER_RESTRICTED"); // [TRAP DETECTED]
    }
    super._transfer(sender, recipient, amount);
}`
        : `// Canonical OpenZeppelin ERC20 Implementation
function _transfer(address from, address to, uint256 amount) internal override {
    require(from != address(0), "ERC20: zero address");
    _balances[from] -= amount;
    _balances[to] += amount;
    emit Transfer(from, to, amount);
}`
    };

    // Update state & quota
    setInvestigations([newInvestigation, ...investigations]);
    setActiveToken(newInvestigation);
    setUserAccount((prev) => ({
      ...prev,
      freeScansRemaining: Math.max(0, prev.freeScansRemaining - 1),
      freeScansUsed: prev.freeScansUsed + 1,
      totalScansExecuted: prev.totalScansExecuted + 1,
    }));

    // Record ledger transaction
    const newTx: LedgerTransaction = {
      id: 'tx-' + Date.now(),
      timestamp: 'Just now',
      operation: `Scan (${newInvestigation.symbol})`,
      category: 'service',
      typeIcon: 'token',
      amount: '1 Scan',
      isCredit: false,
      isFree: true,
      txHash: '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6),
      settlement: 'Success',
    };
    setTransactions([newTx, ...transactions]);

    setCurrentView('scanner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartScan = (address: string, network: EVMNetwork) => {
    // Access control: users cannot analyze or see the dashboard until they log in or connect wallet
    if (!isWalletConnected) {
      setPendingScan({ address, network });
      setWalletModalPrompt(
        `Sign in or connect your wallet to analyze ${address.slice(0, 10)}... (${network}) and view the forensic risk report.`
      );
      setIsWalletModalOpen(true);
      return;
    }

    triggerScanDirect(address, network);
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
      triggerScanDirect(target.address, target.network);
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
    <div className="min-h-screen flex flex-col bg-[#0b1326] text-[#dae2fd]">
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
