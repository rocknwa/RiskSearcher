import React from 'react';

interface WithdrawUsdcModalProps {
  isOpen: boolean;
  walletBalance: number;
  userAddress: string;
  onClose: () => void;
  onWithdrawSuccess?: (...args: never[]) => void;
}

export const WithdrawUsdcModal: React.FC<WithdrawUsdcModalProps> = ({ isOpen, walletBalance, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#060e20]/85 backdrop-blur-md p-3 sm:p-4">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
            <div><h3 className="font-semibold text-[#dae2fd]">Off-ramp / Withdraw</h3><span className="font-mono text-[10px] text-[#8c909f]">Arc Testnet</span></div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#8c909f] hover:text-[#dae2fd] hover:bg-[#222a3d]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </div>
          <div className="bg-[#060e20] border border-[#222a3d] rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#222a3d] flex items-center justify-center text-[#8c909f]"><span className="material-symbols-outlined">schedule</span></div>
            <h4 className="font-bold text-[#dae2fd]">Coming soon</h4>
            <p className="font-mono text-[11px] text-[#8c909f] leading-relaxed">RiskSearcher does not currently provide a fiat off-ramp or cross-chain withdrawal bridge. No demo withdrawal will be simulated.</p>
            <p className="font-mono text-[10px] text-[#4cd7f6]">Current real Arc Testnet balance: ${walletBalance.toFixed(2)} USDC</p>
          </div>
          <button type="button" onClick={onClose} className="w-full py-2.5 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] rounded-xl font-mono text-xs font-semibold">Close</button>
        </div>
      </div>
    </div>
  );
};
