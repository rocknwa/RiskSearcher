import React, { useState } from 'react';

interface WorldIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifySuccess: () => void;
  isAlreadyVerified: boolean;
}

export const WorldIdModal: React.FC<WorldIdModalProps> = ({
  isOpen,
  onClose,
  onVerifySuccess,
  isAlreadyVerified,
}) => {
  const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleStartVerification = () => {
    setVerificationState('verifying');
    setErrorMessage('');
    
    // Simulate World ID Zero-Knowledge Proof generation
    setTimeout(() => {
      // 95% chance success simulation
      const success = true;
      if (success) {
        setVerificationState('success');
        setTimeout(() => {
          onVerifySuccess();
          onClose();
          setVerificationState('idle');
        }, 1200);
      } else {
        setVerificationState('failed');
        setErrorMessage('Proof verification timed out. Please retry.');
      }
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060e20]/85 backdrop-blur-md">
      <div className="bg-[#131b2e] border border-[#222a3d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#060e20] border border-[#4edea3]/40 flex items-center justify-center text-[#4edea3]">
              <span className="material-symbols-outlined text-[20px]">fingerprint</span>
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#dae2fd]">Verify your humanity</h3>
              <span className="font-mono text-[10px] text-[#4edea3] uppercase font-bold tracking-wider">
                Zero-Knowledge Sybil Defense
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8c909f] hover:text-[#dae2fd] p-1 rounded hover:bg-[#222a3d] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Informational Copy */}
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-[#c2c6d6] leading-relaxed">
            Verify with <strong className="text-[#dae2fd]">World ID</strong> to unlock your free RiskSearcher trial.
          </p>
          <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] space-y-1">
            <span className="font-mono text-[11px] text-[#8c909f] block uppercase font-semibold">
              Why is this required?
            </span>
            <p className="text-xs text-[#c2c6d6] leading-relaxed">
              This helps prevent Sybil abuse and keeps free access fair for everyone. World ID verifies unique humanness without revealing your identity or wallet keys.
            </p>
          </div>
        </div>

        {/* Verification Status Area */}
        <div className="p-4 rounded-xl border font-mono text-xs space-y-2 bg-[#060e20] border-[#222a3d]">
          <div className="flex items-center justify-between">
            <span className="text-[#8c909f]">Status:</span>
            {isAlreadyVerified ? (
              <span className="text-[#4edea3] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>Humanity Verified ✓</span>
              </span>
            ) : verificationState === 'idle' ? (
              <span className="text-[#8c909f]">Not verified</span>
            ) : verificationState === 'verifying' ? (
              <span className="text-[#4cd7f6] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                <span>Generating zk-Proof...</span>
              </span>
            ) : verificationState === 'success' ? (
              <span className="text-[#4edea3] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Verified ✓ (15 Scans Unlocked)</span>
              </span>
            ) : (
              <span className="text-[#ffb4ab] font-bold">Verification failed</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#222a3d]/60 text-[11px]">
            <span className="text-[#8c909f]">Trial Allocation:</span>
            <span className="text-[#dae2fd] font-bold">15 Free Pre-Flight Scans</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {verificationState === 'success' ? (
            <div className="bg-[#00a572]/15 border border-[#00a572]/30 p-3 rounded-xl text-center space-y-1">
              <div className="font-bold text-[#4edea3] text-sm flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Humanity verified ✓</span>
              </div>
              <p className="text-xs text-[#c2c6d6]">
                Your free trial is now unlocked with 15 scans remaining.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={verificationState === 'verifying' || isAlreadyVerified}
              onClick={handleStartVerification}
              className="w-full py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {verificationState === 'verifying' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  <span>Verifying with World ID...</span>
                </>
              ) : isAlreadyVerified ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Already Verified (15 Scans Active)</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                  <span>Verify with World ID</span>
                </>
              )}
            </button>
          )}

          {verificationState === 'failed' && (
            <p className="text-xs text-[#ffb4ab] text-center font-mono">{errorMessage}</p>
          )}
        </div>

        {/* Legal / Sybil note */}
        <div className="pt-1 text-center">
          <p className="font-mono text-[10px] text-[#8c909f] leading-relaxed">
            Verification unlocks free access. Free credits are non-transferable and non-withdrawable.
          </p>
        </div>
      </div>
    </div>
  );
};
