import React, { useEffect, useState } from 'react';
import { getArcWallet, sendUsdc } from '../services/arcApi';

interface SendUsdcModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  userAddress: string;
  onSendSuccess: (amount: number, recipient: string, network: string) => void;
}

export const SendUsdcModal: React.FC<SendUsdcModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  onSendSuccess,
}) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void getArcWallet().then((wallet) => {
      if (!wallet.no_data) setLiveBalance(wallet.usdc_balance ?? 0);
    }).catch(() => undefined);
  }, [isOpen]);

  if (!isOpen) return null;
  const effectiveBalance = liveBalance ?? walletBalance;
  const numAmount = Number(amount) || 0;

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient.trim())) return setError('Enter a valid 0x recipient address.');
    if (numAmount <= 0) return setError('Enter an amount greater than 0.');
    if (numAmount > effectiveBalance) return setError('Insufficient Arc Testnet USDC balance.');
    setIsProcessing(true);
    try {
      const result = await sendUsdc(recipient.trim(), numAmount);
      if (result.no_data) throw new Error(result.reason || 'Arc transfer failed');
      setTxId(result.transaction_id ?? null);
      setLiveBalance(Math.max(0, effectiveBalance - numAmount));
      onSendSuccess(numAmount, recipient.trim(), 'Arc Testnet');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Arc transfer failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#060e20]/85 backdrop-blur-md p-3 sm:p-4">
      <div className="min-h-full flex items-start sm:items-center justify-center">
        <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#222a3d] pb-3">
            <div><h3 className="font-semibold text-[#dae2fd]">Send USDC</h3><span className="font-mono text-[10px] text-[#8c909f]">Arc Testnet only</span></div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#8c909f] hover:text-[#dae2fd] hover:bg-[#222a3d]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </div>
          <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] flex justify-between font-mono text-xs"><span className="text-[#8c909f]">Live balance</span><strong className="text-[#4edea3]">${effectiveBalance.toFixed(2)} USDC</strong></div>
          {!txId ? (
            <form onSubmit={handleSend} className="space-y-3">
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient 0x address" className="w-full bg-[#060e20] p-3 rounded-lg border border-[#222a3d] font-mono text-xs text-[#dae2fd] focus:outline-none focus:border-[#4d8eff]" />
              <div className="flex items-center bg-[#060e20] p-3 rounded-lg border border-[#222a3d]"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent font-mono text-sm text-[#dae2fd] focus:outline-none"/><span className="font-mono text-xs text-[#4edea3]">USDC</span></div>
              {error && <p className="font-mono text-[10px] text-[#ffb4ab]">{error}</p>}
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#4d8eff] hover:bg-[#adc6ff] disabled:opacity-60 text-[#00285d] font-bold text-sm rounded-xl">{isProcessing ? 'Submitting Arc transfer…' : 'Send on Arc Testnet'}</button>
            </form>
          ) : (
            <div className="bg-[#060e20] border border-[#00a572]/30 rounded-xl p-5 text-center space-y-2"><span className="material-symbols-outlined text-[#4edea3] text-[30px]">check_circle</span><p className="font-bold text-[#dae2fd]">Transfer submitted</p><p className="font-mono text-[9px] text-[#8c909f] break-all">Circle tx: {txId}</p><button type="button" onClick={onClose} className="w-full py-2 bg-[#222a3d] rounded-lg font-mono text-xs text-[#dae2fd]">Close</button></div>
          )}
          <p className="font-mono text-[9px] text-[#8c909f] text-center">This is a real Arc Testnet wallet transfer, not a cross-chain bridge or fiat off-ramp.</p>
        </div>
      </div>
    </div>
  );
};
