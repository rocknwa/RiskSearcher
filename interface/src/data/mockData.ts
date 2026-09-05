import { TokenInvestigation, LedgerTransaction, UserAccountState } from '../types';

export const INITIAL_USER_ACCOUNT: UserAccountState = {
  address: '0x7A8B92e666579979313437D35de4e4b191F2',
  ensOrAlias: '0x7A8B...91F2',
  walletType: 'Passkey Smart Wallet (ERC-4337)',
  accountType: 'ERC-4337',
  isWorldIdVerified: false,
  freeScansRemaining: 0,
  totalFreeScans: 15,
  apiKey: 'rk_live_9f829f041b6c72e482aa0019ff4',
  isApiKeyVisible: false,
  
  // Balance A: User wallet USDC (Money belonging to the user)
  walletUsdcBalance: 50.00,
  
  // Balance B: RiskSearcher subscription balance (Service credit, non-withdrawable)
  riskSearcherBalance: 0.00,
  
  totalScansExecuted: 0,
  activeSubscription: null,
  githubBound: '@0xarch-sec',
  twitterBound: '@zkAudit_node',
};

export const INITIAL_INVESTIGATIONS: TokenInvestigation[] = [
  {
    id: 'fartpepe',
    symbol: '$FARTPEPE',
    name: 'FartPepe Community',
    address: '0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571',
    network: 'Ethereum',
    verdict: 'UNSAFE',
    riskScore: 80,
    ruleBasedScore: 5,
    verdictSource: 'LLM Judge',
    sourceVerified: true,
    confidence: 99.2,
    timeAgo: 'Just now',
    timestamp: 'Today 14:02:18 UTC',
    gasSimulation: 'Revert opcode on DEX sell path (0xFD)',
    sellTax: 'Variable (tx.origin dependent)',
    buyTax: '0.0%',
    pooledLiquidity: '$64,200 USDC',
    liquidityStatus: 'Deployer Controlled',
    originDeployer: '0x42eD...0571',
    deployerAge: 'Fresh EOA (18h old)',
    consensusRatio: 'Judge overturned low rule score (5/100) -> Final 80/100',
    verdictExplanation: 'The deterministic rule pass produced an deceptively low score (5/100) because standard blacklist keywords were avoided. However, specialist and judge semantic reasoning discovered a critical tx.origin-gated balanceOf() override that manipulates perceived user balances and restricts legitimate liquidation.',
    userPrompt: 'Investigate FARTPEPE contract 0x42eDA42459A18F155FAaaBE9aa55246ed1D0a571 on Ethereum. Check for deceptive balance manipulation and sell barriers.',
    executionSteps: [
      { title: 'Stage 1: Fetching contract source — Connecting to Ethereum archive cluster... Source verification found ✓', duration: '140ms', completed: true },
      { title: 'Stage 2: Running rule-based analysis — Inspecting bytecode, transfer restrictions, mint/burn controls (Rule score: 5/100)', duration: '280ms', completed: true },
      { title: 'Stage 3: Running specialist analysis — Semantic tax & storage analysis detecting tx.origin gated balanceOf() manipulation', duration: '390ms', completed: true },
      { title: 'Stage 4: Running judge pass — Reconciling deterministic score (5) with specialist semantic finding (Final: 80/100 UNSAFE)', duration: '120ms', completed: true },
      { title: 'Stage 5: Generating report — Evidence breakdown compiled with opcode trace', duration: '60ms', completed: true },
    ],
    findings: [
      {
        id: 'fp-1',
        severity: 'CRITICAL',
        title: 'tx.origin-Gated balanceOf() Balance Manipulation',
        description: 'A tx.origin-gated balanceOf() implementation can manipulate how balances are represented and is a major trust concern. When queried by wallet UIs or block explorers, it renders an inflated balance, but during automated swap routing it returns zero or reverts.',
        codeSnippet: `function balanceOf(address account) public view override returns (uint256) {
    // [MANIPULATION DETECTED]: Discrepancy between direct EOA and Router caller
    if (tx.origin != account && tx.origin != owner()) {
        return 0; // DEX routers observe zero balance during liquidation
    }
    return _balances[account];
}`,
        revertReason: 'Custom revert: INSUFFICIENT_LIQUIDITY • Evaluated at PC:0x05BC',
        icon: 'warning'
      },
      {
        id: 'fp-2',
        severity: 'WARNING',
        title: 'Dynamic Fee Modifier Without Invariant Ceiling',
        description: 'Deployer can adjust the marketing deduction rate without an upper bound, opening an instantaneous rug-pull vector before liquidity exits.',
        codeSnippet: `function setTradingFee(uint256 feeRate) external onlyOwner {
    _dynamicFee = feeRate; // Uncapped modification
}`,
        icon: 'percent'
      }
    ],
    transactionBehavior: {
      realValueTransfers: 412,
      zeroValueTransfers: 88,
      uniqueSenders: 290,
      outboundConcentration: '42.5% to deployer-affiliated intermediary',
      contractEthBalance: '0.14 ETH',
      note: 'Noticeable divergence between buy inflow volume and zero-value sync events.'
    },
    specialistFindings: [
      {
        agentName: 'Tax Logic Specialist',
        role: 'Arithmetic & Fee Inspector',
        finding: 'Detected variable fee rate controlled by deployer with no timelock protection.',
        severity: 'high'
      },
      {
        agentName: 'Semantic Bytecode Specialist',
        role: 'EVM Execution Tracer',
        finding: 'tx.origin check inside view function creates dual state perception between off-chain UI and DEX execution router.',
        severity: 'high'
      }
    ],
    judgeAssessment: 'The contract was engineered to bypass basic regex and AST rule scanners, resulting in a low deterministic score of 5/100. However, semantic analysis of the tx.origin branch reveals intentional deception. The judge tribunal upgrades the severity to UNSAFE (80/100).',
    similarScams: [
      { name: 'FakePepe V1', similarity: '94%', mechanism: 'tx.origin display balance spoofing' },
      { name: 'PepeDrain', similarity: '88%', mechanism: 'Dual-state router trap' }
    ],
    decompiledCode: `// Decompiled from EVM Bytecode Runtime (0x42eD...0571)
function balanceOf(address account) public view override returns (uint256) {
    if (tx.origin != account && tx.origin != owner()) {
        return 0; // [CRITICAL TRAP]: Spoofs balance to router
    }
    return _balances[account];
}

function _transfer(address sender, address recipient, uint256 amount) internal override {
    require(sender != address(0), "ERC20: zero address");
    if (recipient == dexPair && !isWhitelisted[sender]) {
        uint256 fee = (amount * _dynamicFee) / 100;
        super._transfer(sender, devWallet, fee);
        amount -= fee;
    }
    super._transfer(sender, recipient, amount);
}`
  },
  {
    id: 'weth9',
    symbol: '$WETH9',
    name: 'Wrapped Ether (Canonical)',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    network: 'Ethereum',
    verdict: 'SAFE',
    riskScore: 0,
    ruleBasedScore: 0,
    verdictSource: 'Deterministic Rules',
    sourceVerified: true,
    confidence: 99.9,
    timeAgo: '1h ago',
    timestamp: 'Today 13:10:04 UTC',
    gasSimulation: 'Clean execution: 21,240 gas',
    sellTax: '0.0%',
    buyTax: '0.0%',
    pooledLiquidity: '$3,400,000,000 ETH',
    liquidityStatus: 'Canonical Wrapped Asset',
    originDeployer: '0x0000...0000',
    deployerAge: 'Immutable (7+ years)',
    consensusRatio: 'Unanimous SAFE (Deterministic rules & Specialist agree)',
    verdictExplanation: 'Canonical Wrapped Ether contract. Standard 1:1 ETH deposit/withdraw semantics. No fees, no mint backdoors, and no SELFDESTRUCT vulnerabilities present in execution path.',
    userPrompt: 'Verify canonical WETH9 contract 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 on Ethereum.',
    executionSteps: [
      { title: 'Stage 1: Fetching contract source — Verified source retrieved from Etherscan ✓', duration: '95ms', completed: true },
      { title: 'Stage 2: Running rule-based analysis — Inspecting deposit/withdrawal patterns (0/100 Clean)', duration: '180ms', completed: true },
      { title: 'Stage 3: Running specialist analysis — Zero suspicious patterns found', duration: '190ms', completed: true },
      { title: 'Stage 4: Running judge pass — Confirmed canonical protocol integrity', duration: '70ms', completed: true },
      { title: 'Stage 5: Generating report — Report finalized: 0/100 SAFE', duration: '40ms', completed: true },
    ],
    findings: [
      {
        id: 'weth-1',
        severity: 'NOTICE',
        title: 'Immutable Canonical Standard',
        description: 'Bytecode contains no administrative upgrades, no self-destruct triggers, and strictly maintains 1:1 balance backing.',
        icon: 'verified'
      }
    ],
    transactionBehavior: {
      realValueTransfers: 1480210,
      zeroValueTransfers: 120,
      uniqueSenders: 820194,
      outboundConcentration: 'Diversified across entire DeFi ecosystem',
      contractEthBalance: '2,910,480 ETH',
      note: 'Natural high-volume transfers matching top institutional liquidity hubs.'
    },
    specialistFindings: [
      {
        agentName: 'Protocol Architecture Specialist',
        role: 'Standard Invariant Checker',
        finding: 'Clean invariant: total supply exactly matches locked ETH balance.',
        severity: 'safe'
      }
    ],
    judgeAssessment: 'Zero evidence of malicious intent or deceptive logic. Fully compliant with canonical wrap semantics.',
    decompiledCode: `// Canonical WETH9 Contract
function deposit() public payable {
    balanceOf[msg.sender] += msg.value;
    emit Deposit(msg.sender, msg.value);
}

function withdraw(uint wad) public {
    require(balanceOf[msg.sender] >= wad);
    balanceOf[msg.sender] -= wad;
    payable(msg.sender).transfer(wad);
    emit Withdrawal(msg.sender, wad);
}`
  },
  {
    id: 'shrimp',
    symbol: '$SHRIMP',
    name: 'OverlayerOriginShrimp',
    address: '0x0bed281bdfc7bf127cadca5f77e05b20cfb4e100',
    network: 'Ethereum',
    verdict: 'THREAT',
    riskScore: 70,
    ruleBasedScore: 45,
    verdictSource: 'Specialist Ensemble',
    sourceVerified: false,
    confidence: 98.4,
    timeAgo: 'Yesterday',
    timestamp: 'Yesterday 19:42:10 UTC',
    gasSimulation: 'Spam gas consumption on transfer',
    sellTax: 'Unverified Bytecode',
    buyTax: 'Unverified Bytecode',
    pooledLiquidity: '$8,100 USDC',
    liquidityStatus: 'Deployer EOA',
    originDeployer: '0x0bed...e100',
    deployerAge: 'Fresh (2d old)',
    consensusRatio: 'Specialist Jury identified Address Poisoning Campaign',
    verdictExplanation: 'Analysis of transaction telemetry revealed 200 out of 200 inbound transactions had zero value transferred. This indicates an active address poisoning / zero-value phishing campaign masquerading as authentic transaction velocity.',
    userPrompt: 'Analyze unverified contract 0x0bed281bdfc7bf127cadca5f77e05b20cfb4e100 for honeypot and wash trading.',
    executionSteps: [
      { title: 'Stage 1: Fetching contract source — ⚠ Source unverified. Continuing with bytecode & behavioral evidence.', duration: '130ms', completed: true },
      { title: 'Stage 2: Running rule-based analysis — Decompiling runtime bytecode & scanning dispatch table', duration: '290ms', completed: true },
      { title: 'Stage 3: Running specialist analysis — Dissecting transaction graph (200/200 Zero-Value Inbound)', duration: '340ms', completed: true },
      { title: 'Stage 4: Running judge pass — Threat classification: Address Poisoning Vector (70/100)', duration: '90ms', completed: true },
      { title: 'Stage 5: Generating report — Forensic report generated', duration: '50ms', completed: true },
    ],
    findings: [
      {
        id: 'sh-1',
        severity: 'CRITICAL',
        title: 'Address Poisoning: 200/200 Zero-Value Inbound Transfers',
        description: 'Every single recorded transaction to this contract has an incoming value of exactly 0 ETH/USDC. The contract is spoofing Transfer(victim, attacker, 0) events to pollute user wallet histories and trick copy-paste routines.',
        icon: 'dangerous'
      },
      {
        id: 'sh-2',
        severity: 'WARNING',
        title: 'Unverified Source Code',
        description: 'Contract bytecode is not verified on block explorer. Relying on EVM opcode heuristics and on-chain behavioral telemetry.',
        icon: 'help_outline'
      }
    ],
    transactionBehavior: {
      realValueTransfers: 0,
      zeroValueTransfers: 200,
      uniqueSenders: 200,
      outboundConcentration: 'N/A (All zero-value spoofing)',
      contractEthBalance: '0.00 ETH',
      note: 'Crucial distinction: 200 zero-value transfers distinguished from genuine value flow.'
    },
    specialistFindings: [
      {
        agentName: 'Mempool Telemetry Agent',
        role: 'Transaction Topology Specialist',
        finding: '100% of recorded transfers are zero-value event spoofs targeted at active DeFi addresses.',
        severity: 'high'
      }
    ],
    judgeAssessment: 'The absence of any real-value transfers combined with 200 automated zero-value events establishes that this contract exists solely to poison transaction logs. Verdict: THREAT (70/100).'
  },
  {
    id: 'dolphin',
    symbol: '$DOLPHIN',
    name: 'OverlayerOriginDolphin',
    address: '0x92df135c27ab5a2080f5cbcbb0a693c07a283e9c',
    network: 'Ethereum',
    verdict: 'THREAT',
    riskScore: 95,
    ruleBasedScore: 60,
    verdictSource: 'LLM Judge',
    sourceVerified: false,
    confidence: 99.5,
    timeAgo: '2d ago',
    timestamp: '2d ago 11:20:00 UTC',
    gasSimulation: 'Siphon redirect on outbound execution',
    sellTax: '100% Siphoned',
    buyTax: '0.0%',
    pooledLiquidity: '$2,400 USDC',
    liquidityStatus: 'Drained',
    originDeployer: '0x92df...e9c',
    deployerAge: '1d old',
    consensusRatio: 'Unanimous CRITICAL THREAT',
    verdictExplanation: 'Telemetry confirms severe liquidity drainage: 81 unique victims deposited real value, the contract holds approximately 0 ETH balance, and 100% of outbound transfers were systematically concentrated to a single beneficiary EOA.',
    userPrompt: 'Inspect contract 0x92df135c27ab5a2080f5cbcbb0a693c07a283e9c for fund concentration and drain mechanisms.',
    executionSteps: [
      { title: 'Stage 1: Fetching contract source — ⚠ Source unverified. Parsing runtime bytecode.', duration: '110ms', completed: true },
      { title: 'Stage 2: Running rule-based analysis — Detecting outbound call redirect in fallback', duration: '310ms', completed: true },
      { title: 'Stage 3: Running specialist analysis — Telemetry correlation: 81 victims deposited, 100% swept to 1 EOA', duration: '360ms', completed: true },
      { title: 'Stage 4: Running judge pass — Reconciling evidence into final CRITICAL THREAT score (95/100)', duration: '100ms', completed: true },
      { title: 'Stage 5: Generating report — Final assessment published', duration: '45ms', completed: true },
    ],
    findings: [
      {
        id: 'dol-1',
        severity: 'CRITICAL',
        title: '100% Outbound Transfer Concentration to Single EOA',
        description: 'All funds received from 81 independent depositors are immediately forwarded to a single hardcoded destination address (0x8192...44f0). Contract retains approximately 0 ETH balance.',
        icon: 'swap_calls'
      },
      {
        id: 'dol-2',
        severity: 'CRITICAL',
        title: 'Hidden Sweeper Mechanism in Fallback Function',
        description: 'Bytecode analysis demonstrates that incoming value transfers immediately trigger delegatecall forwarding to drain collector.',
        icon: 'dangerous'
      }
    ],
    transactionBehavior: {
      realValueTransfers: 81,
      zeroValueTransfers: 4,
      uniqueSenders: 81,
      outboundConcentration: '100% of real outbound transfers concentrated to one address (0x8192...44f0)',
      contractEthBalance: '0.0001 ETH (~$0)',
      note: 'Clear predator-drain pattern: 81 victims deposited, 100% swept out.'
    },
    specialistFindings: [
      {
        agentName: 'Liquidity Flow Specialist',
        role: 'Fund Tracking Specialist',
        finding: 'Complete drainage pattern. Contract acts as a pass-through siphon rather than an autonomous pool.',
        severity: 'high'
      }
    ],
    judgeAssessment: 'Multiple lines of evidence (81 unique victims, near-zero retained balance, 100% transfer concentration to a single private key) demonstrate an active scam drainer. Verdict: THREAT (95/100).'
  }
];

export const INITIAL_TRANSACTIONS: LedgerTransaction[] = [
  {
    id: 'tx-1',
    timestamp: 'Just now',
    operation: 'Free Trial Allocation (World ID)',
    typeIcon: 'fingerprint',
    amount: '+15 Scans (Trial)',
    isCredit: true,
    isFree: true,
    category: 'service',
    txHash: '0x94b...21a',
    settlement: 'Completed'
  },
  {
    id: 'tx-2',
    timestamp: 'Today 10:14:02',
    operation: 'Deposit to Wallet (Base L2)',
    typeIcon: 'south_west',
    amount: '+50.00 USDC',
    isCredit: true,
    isFree: false,
    category: 'wallet',
    txHash: '0x71a...99c',
    settlement: 'Confirmed'
  }
];

export const SUPPORTED_CHAINS = [
  { name: 'Ethereum', symbol: 'ETH', color: '#adc6ff', rpcLatency: '120ms', gasTarget: '14 Gwei', blockTime: '12.0s', archiveNodes: 'Online' },
  { name: 'Base', symbol: 'BASE', color: '#4cd7f6', rpcLatency: '68ms', gasTarget: '0.002 Gwei', blockTime: '2.0s', archiveNodes: 'Online' },
  { name: 'Arbitrum', symbol: 'ARB', color: '#4d8eff', rpcLatency: '85ms', gasTarget: '0.1 Gwei', blockTime: '0.25s', archiveNodes: 'Online' },
  { name: 'Optimism', symbol: 'OP', color: '#ffb4ab', rpcLatency: '92ms', gasTarget: '0.001 Gwei', blockTime: '2.0s', archiveNodes: 'Online' },
  { name: 'Polygon', symbol: 'POL', color: '#adc6ff', rpcLatency: '145ms', gasTarget: '32 Gwei', blockTime: '2.1s', archiveNodes: 'Online' },
  { name: 'BNB Chain', symbol: 'BNB', color: '#03b5d3', rpcLatency: '110ms', gasTarget: '3 Gwei', blockTime: '3.0s', archiveNodes: 'Online' },
  { name: 'Avalanche', symbol: 'AVAX', color: '#ffb4ab', rpcLatency: '105ms', gasTarget: '26 nAVAX', blockTime: '1.8s', archiveNodes: 'Online' },
];

// TODO: replace with your real hosted logo (e.g. /assets/logo.svg served from public/, or a permanent CDN URL).
// The previous value was a temporary AI-Studio-hosted image link — not safe to rely on long-term.
export const LOGO_URL = '/assets/logo.svg';
