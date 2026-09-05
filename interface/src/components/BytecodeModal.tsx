import React, { useState } from 'react';

interface BytecodeModalProps {
  isOpen: boolean;
  title: string;
  code: string;
  onClose: () => void;
}

export const BytecodeModal: React.FC<BytecodeModalProps> = ({
  isOpen,
  title,
  code,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const defaultSampleCode = `// [RECONSTRUCTED DISPATCH TABLE & OPCODES]
// Decompiled from EVM bytecode runtime trace

function _transfer(address sender, address recipient, uint256 amount) internal {
    require(sender != address(0), "ERC20: zero");
    
    // [TRAP DETECTED] Non-privileged exit blocker
    if (isSniper[sender] || isSniper[recipient]) revert("Liquidity Locked");

    if (sender != _owner && recipient != _owner) {
        // [DANGER: 99% TAX] Dynamic tax trigger based on swap counter
        uint256 dynamicTax = (_sellCount > 5) ? 99 : 2; // Hidden Rug Trigger
        uint256 fee = (amount * dynamicTax) / 100;
        super._transfer(sender, _feeWallet, fee);
    }
}

function setRule(uint256 maxTx, uint256 taxBps) external {
    require(msg.sender == _shadowAdmin, "Auth");
    _marketingRateDelta = taxBps; // Uncapped tax modification
}`;

  const displayCode = code || defaultSampleCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#171f33] px-6 py-4 border-b border-[#222a3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[22px]">terminal</span>
            <h3 className="font-mono text-sm font-semibold text-[#dae2fd]">{title}</h3>
            <span className="font-mono text-[10px] bg-[#222a3d] px-2 py-0.5 rounded text-[#8c909f]">
              EVMcfg Disassembled
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] rounded font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy AST'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#8c909f] hover:text-[#dae2fd] p-1 rounded hover:bg-[#222a3d] transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Code */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-[#dae2fd] bg-[#060e20]">
          <pre className="whitespace-pre-wrap leading-relaxed">
            {displayCode.split('\n').map((line, idx) => {
              const isTrap = line.includes('TRAP DETECTED') || line.includes('DANGER') || line.includes('Sniper') || line.includes('dynamicTax');
              const isComment = line.trim().startsWith('//');

              return (
                <div
                  key={idx}
                  className={`py-0.5 px-2 rounded ${
                    isTrap
                      ? 'bg-[#93000a]/25 text-[#ffb4ab] border-l-2 border-[#ffb4ab]'
                      : isComment
                      ? 'text-[#8c909f]'
                      : 'text-[#dae2fd]'
                  }`}
                >
                  <span className="text-[#424754] select-none inline-block w-8 text-right mr-3">
                    {idx + 1}
                  </span>
                  <span>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Footer */}
        <div className="bg-[#171f33] px-6 py-3 border-t border-[#222a3d] flex items-center justify-between font-mono text-xs text-[#8c909f]">
          <span>Analysis performed by RiskSearcher Decompiler v4.22</span>
          <span className="text-[#4edea3]">Disassembly Accuracy: 99.8%</span>
        </div>
      </div>
    </div>
  );
};
