import React, { useState } from 'react';
import { EVMNetwork } from '../types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositSuccess: (amount: number, network: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onDepositSuccess,
}) => {
  const [amount, setAmount] = useState('25');
  const [network, setNetwork] = useState<EVMNetwork>('Base');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onDepositSuccess(val, network);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/80 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3] text-[22px]">payments</span>
            <h3 className="font-semibold text-base text-[#dae2fd]">Top Up USDC Ledger</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8c909f] hover:text-[#dae2fd] p-1 rounded hover:bg-[#222a3d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleDeposit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-[#8c909f] block">Select Deposit Network</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Base', 'Arbitrum', 'Ethereum', 'Optimism'] as EVMNetwork[]).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetwork(net)}
                  className={`p-2.5 rounded-lg border font-mono text-xs flex items-center justify-between transition-colors ${
                    network === net
                      ? 'bg-[#222a3d] border-[#4cd7f6] text-[#dae2fd]'
                      : 'bg-[#060e20] border-[#222a3d] text-[#c2c6d6] hover:bg-[#171f33]'
                  }`}
                >
                  <span>{net}</span>
                  {network === net && (
                    <span className="material-symbols-outlined text-sm text-[#4cd7f6]">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-xs text-[#8c909f] block">Deposit Amount (USDC)</label>
            <div className="relative flex items-center bg-[#060e20] p-3 rounded-lg border border-[#222a3d] focus-within:border-[#4cd7f6]">
              <span className="text-[#8c909f] font-mono text-sm mr-2">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent font-mono text-base text-[#dae2fd] focus:outline-none"
                placeholder="25.00"
              />
              <span className="font-mono text-xs text-[#4cd7f6] font-bold">USDC</span>
            </div>
            <div className="flex gap-2 pt-1 font-mono text-xs">
              {['10', '25', '50', '100'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className="px-2.5 py-1 rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#c2c6d6] hover:text-[#dae2fd] transition-colors"
                >
                  +${preset}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#060e20] p-3 rounded-lg border border-[#222a3d] space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between text-[#8c909f]">
              <span>Rate:</span>
              <span className="text-[#dae2fd]">0.10 USDC per Contract Scan</span>
            </div>
            <div className="flex items-center justify-between text-[#8c909f]">
              <span>Allocated Scans:</span>
              <span className="text-[#4edea3] font-bold">
                {Math.floor((parseFloat(amount) || 0) / 0.10)} Pre-Flight Scans
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] text-[#00285d] hover:text-[#002e6a] font-bold text-sm rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                <span>Confirming Relayer Tx...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                <span>Deposit ${amount || '0'} USDC</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
