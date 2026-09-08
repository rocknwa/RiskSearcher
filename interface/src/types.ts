export type EVMNetwork = 
  | 'Ethereum' 
  | 'Base' 
  | 'Arbitrum' 
  | 'Optimism' 
  | 'BNB Chain' 
  | 'Polygon' 
  | 'Avalanche';

export type RiskVerdict = 'UNSAFE' | 'SAFE' | 'THREAT' | 'MALICIOUS' | 'VERIFIED SAFE';

export interface AnalysisProgressEvent {
  message: string;
}

export interface GraphEvidence {
  source: string;
  token_address: string;
  chain: string;
  no_data: boolean;
  reason: string;
  total_liquidity_usd: number | null;
  first_swap_timestamp: number | null;
  recent_swap_volume_usd: { '24h': number | null; '7d': number | null };
  pool_count: number;
  pool_count_exact?: boolean;
  pools_data_reliable?: boolean;
}

/** The final `result` event emitted by the FastAPI `/analyze` SSE endpoint. */
export interface AnalysisApiResult {
  verdict: string;
  severity: string;
  score: number;
  rule_score: number | null;
  score_source: string | null;
  verdict_source: string | null;
  final_reason: string;
  parameters?: Record<string, unknown>;
  breakdown: string[];
  graph_evidence?: GraphEvidence | null;
}

export interface AnalysisStreamHandlers {
  onProgress: (event: AnalysisProgressEvent) => void;
  onResult: (result: AnalysisApiResult) => void;
  onError: (message: string) => void;
}

export interface VulnerabilityFlag {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'NOTICE';
  title: string;
  description: string;
  codeSnippet?: string;
  revertReason?: string;
  icon: string;
}

export interface TransactionBehaviorData {
  realValueTransfers: number;
  zeroValueTransfers: number;
  uniqueSenders: number;
  outboundConcentration: string;
  contractEthBalance: string;
  note?: string;
}

export interface SpecialistFinding {
  agentName: string;
  role: string;
  finding: string;
  severity: 'high' | 'medium' | 'safe';
  timestamp?: string;
}

export interface TokenInvestigation {
  id: string;
  symbol: string;
  name: string;
  address: string;
  network: EVMNetwork;
  verdict: RiskVerdict;
  riskScore: number;
  ruleBasedScore: number;
  verdictSource: 'LLM Judge' | 'Deterministic Rules' | 'Specialist Ensemble';
  sourceVerified: boolean;
  confidence: number;
  timeAgo: string;
  timestamp: string;
  gasSimulation: string;
  sellTax: string;
  buyTax: string;
  pooledLiquidity: string;
  liquidityStatus: string;
  originDeployer: string;
  deployerAge: string;
  consensusRatio: string;
  isAnalyzing?: boolean;
  userPrompt?: string;
  verdictExplanation: string;
  analysisParameters?: Record<string, unknown>;
  executionSteps: {
    title: string;
    duration: string;
    completed: boolean;
  }[];
  findings: VulnerabilityFlag[];
  decompiledCode?: string;
  transactionBehavior?: TransactionBehaviorData;
  specialistFindings?: SpecialistFinding[];
  judgeAssessment?: string;
  graphEvidence?: GraphEvidence;
  similarScams?: {
    name: string;
    similarity: string;
    mechanism: string;
  }[];
}

export interface LedgerTransaction {
  id: string;
  timestamp: string;
  operation: string;
  typeIcon: string;
  amount: string;
  isCredit: boolean;
  isFree?: boolean;
  category: 'wallet' | 'service';
  txHash: string;
  settlement: 'Completed' | 'Confirmed' | 'Success' | 'Verified' | 'Broadcasted' | 'Processed' | 'Active';
}

export interface SubscriptionPlan {
  tier?: string;
  name: string;
  priceMonthly?: number;
  priceUsdc?: number;
  scansIncluded: number;
  status: string;
  renewsOn?: string;
  renewsDate?: string;
}

export interface UserAccountState {
  address: string;
  ensOrAlias: string;
  walletType: string;
  accountType: 'ERC-4337' | 'EOA';
  isWorldIdVerified: boolean;
  freeScansRemaining: number;
  totalFreeScans: number;
  apiKey: string;
  isApiKeyVisible: boolean;
  
  // CRITICAL SEPARATION OF BALANCES
  // Balance A: User wallet USDC (belongs to user, can send/withdraw/buy/receive)
  walletUsdcBalance: number;
  
  // Balance B: RiskSearcher service credit (prepaid service credit, non-withdrawable, non-transferable)
  riskSearcherBalance: number;
  
  totalScansExecuted: number;
  activeSubscription: SubscriptionPlan | null;
  githubBound: string;
  twitterBound: string;
}
