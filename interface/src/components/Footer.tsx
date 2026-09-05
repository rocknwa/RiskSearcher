import React from 'react';
import { LOGO_URL } from '../data/mockData';

interface FooterProps {
  onNavigate: (view: string) => void;
  isWalletConnected?: boolean;
  onOpenWalletModal?: (prompt?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  isWalletConnected = false,
  onOpenWalletModal,
}) => {
  return (
    <footer className="w-full bg-[#060e20] border-t border-[#222a3d]/70 py-10">
      <div className="max-w-[88rem] mx-auto px-4 lg:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <img 
            src={LOGO_URL} 
            alt="RiskSearcher Logo" 
            className="h-6 w-auto object-contain opacity-80"
          />
          <span className="font-mono text-xs text-[#c2c6d6]">
            RiskSearcher Institutional Forensic Intelligence
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-[#8c909f]">
          <button
            onClick={() => {
              if (!isWalletConnected) {
                onOpenWalletModal?.(
                  'Authentication Required: Connect your Web3 wallet or sign in to launch deep contract scans.'
                );
              } else {
                onNavigate('scanner');
              }
            }}
            className="hover:text-[#dae2fd] transition-colors flex items-center gap-1"
          >
            {!isWalletConnected && (
              <span className="material-symbols-outlined text-[13px] text-[#8c909f]">lock</span>
            )}
            <span>Scanner</span>
          </button>
          <button onClick={() => onNavigate('how-it-works')} className="hover:text-[#dae2fd] transition-colors">
            How It Works
          </button>
          <button onClick={() => onNavigate('supported-chains')} className="hover:text-[#dae2fd] transition-colors">
            Supported Chains
          </button>
          <button onClick={() => onNavigate('pricing')} className="hover:text-[#dae2fd] transition-colors">
            Pricing
          </button>
          <button onClick={() => onNavigate('documentation')} className="hover:text-[#dae2fd] transition-colors">
            Documentation
          </button>
          <button
            onClick={() => {
              if (!isWalletConnected) {
                onOpenWalletModal?.(
                  'Authentication Required: Connect your Web3 wallet or sign in to access your personal wallet, balances, and API keys.'
                );
              } else {
                onNavigate('accounts');
              }
            }}
            className="hover:text-[#dae2fd] transition-colors flex items-center gap-1"
          >
            {!isWalletConnected && (
              <span className="material-symbols-outlined text-[13px] text-[#ffb4ab]">lock</span>
            )}
            <span>Accounts</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-[#8c909f]">
            © {new Date().getFullYear()} RiskSearcher Security Labs. All verification rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};
