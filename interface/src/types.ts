export type EVMNetwork = 
  | 'Ethereum' 
  | 'Base' 
  | 'Arbitrum' 
  | 'Optimism' 
  | 'BNB Chain' 
  | 'Polygon' 
  | 'Avalanche';

export type RiskVerdict = 'UNSAFE' | 'SAFE' | 'THREAT' | 'MALICIOUS' | 'VERIFIED SAFE';

export interface ScanHistoryRecord {
  doc_id: string;
  contract_address: string;
  chain: string;
  verdict: string;
  severity: string;
  score: number;
  rule_score: number | null;
  score_source: string | null;
  verdict_source: string | null;
  final_reason: string;
  breakdown: string[];
  saved_at: string | null;
}

export interface ScanHistoryResponse {
  no_data: boolean;
  reason?: string;
  records?: ScanHistoryRecord[];
}

export interface AnalysisProgressEvent {
  message: string;
}

export interface EntitlementState {
  no_data: boolean;
  reason?: string;
  wallet_address?: string;
  world_verified: boolean;
  free_scans_remaining: number;
  free_scans_granted: number;
  paid_scans_remaining: number;
  total_scans_executed: number;
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

export interface ArcWallet {
  no_data: boolean;
  reason?: string;
  deposit_address?: string;
  usdc_balance?: number | null;
}

export interface ArcTransferResult {
  no_data: boolean;
  reason?: string;
  transaction_id?: string;
  status?: string;
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
  entitlement?: EntitlementState;
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
  timestamp: string | null;
  operation: string;
  typeIcon: string;
  amount: string;
  isCredit: boolean;
  isFree?: boolean;
  category: 'wallet' | 'service';
  txHash: string;
  settlement: string;
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
  paidScansRemaining: number;
  apiKey: string;
  isApiKeyVisible: boolean;
  
  // CRITICAL SEPARATION OF BALANCES
  // Balance A: live USDC held in the Circle Developer-Controlled Wallet mapped to this authenticated identity
  walletUsdcBalance: number;
  
  // Legacy numeric service-balance field retained for UI compatibility; scan entitlements are authoritative as counts above
  riskSearcherBalance: number;
  
  totalScansExecuted: number;
  activeSubscription: SubscriptionPlan | null;
  githubBound: string;
  twitterBound: string;
}
