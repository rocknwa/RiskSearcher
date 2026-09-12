import React, { useState } from 'react';
import { IDKitRequestWidget, selfieCheckLegacy, type RpContext } from '@worldcoin/idkit';
import { getRpSignature, verifyWorldId } from '../services/worldIdApi';

interface WorldIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifySuccess: (scansGranted: number, nullifier: string) => void;
  onAlreadyClaimed: (walletAddress: string) => void;
  isAlreadyVerified: boolean;
  walletAddress: string;
}

// World's Developer Portal app_id for this app - public, safe to expose
// client-side (unlike the RP signing_key, which never leaves the server).
const WORLD_APP_ID = import.meta.env.VITE_WORLD_APP_ID as string | undefined;
const WORLD_ACTION = 'verify-humanity-trial';

export const WorldIdModal: React.FC<WorldIdModalProps> = ({
  isOpen,
  onClose,
  onVerifySuccess,
  onAlreadyClaimed,
  isAlreadyVerified,
  walletAddress,
}) => {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [verificationState, setVerificationState] = useState<'idle' | 'fetching_rp_context' | 'verifying' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleStartVerification = async () => {
    setErrorMessage('');
    if (!WORLD_APP_ID) {
      setVerificationState('failed');
      setErrorMessage('World ID is not configured (missing VITE_WORLD_APP_ID). Contact support.');
      return;
    }
    setVerificationState('fetching_rp_context');
    try {
      // World ID 4.0 requires every request - Selfie Check included - to
      // carry an rp_context signed server-side. Calls the Python backend's
      // /world-id/rp-signature endpoint - see services/worldIdApi.ts and
      // rpc/world_id_provider.py for the full explanation.
      const rpSig = await getRpSignature(WORLD_ACTION);
      setRpContext({
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      });
      setWidgetOpen(true);
      setVerificationState('idle');
    } catch (error) {
      setVerificationState('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Could not start World ID verification.');
    }
  };

  // IDKit calls this with the raw, unverified result the moment the user
  // completes Selfie Check in World App. Client-side "success" here means
  // nothing on its own - the proof's cryptographic validity has NOT been
  // checked yet. handleVerify is IDKit's designated hook for exactly that:
  // it must call the backend and throw/reject if verification fails,
  // which tells IDKit to show a failure state instead of completing.
  const handleVerify = async (result: unknown) => {
    setVerificationState('verifying');
    const claim = await verifyWorldId(walletAddress, result);
    if (claim.no_data) {
      throw new Error('World ID verification service is currently unavailable.');
    }
    if (!claim.claimed) {
      // Real proof, but this human already claimed a trial - possibly
      // with a different wallet. Not an error in the proof itself, so
      // don't show it as a failure - hand it to the parent to explain.
      if (claim.reason === 'already_claimed') {
        onAlreadyClaimed(claim.wallet_address || '');
        onClose();
        return;
      }
      throw new Error(claim.reason || 'Trial claim was rejected.');
    }
    setVerificationState('success');
    setTimeout(() => {
      onVerifySuccess(claim.scans_granted ?? 3, claim.nullifier || '');
      onClose();
      setVerificationState('idle');
      setWidgetOpen(false);
    }, 1200);
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
                World ID Selfie Check
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
            Verify with <strong className="text-[#dae2fd]">World ID Selfie Check</strong> to unlock your free RiskSearcher trial.
          </p>
          <div className="bg-[#060e20] p-3 rounded-xl border border-[#222a3d] space-y-1">
            <span className="font-mono text-[11px] text-[#8c909f] block uppercase font-semibold">
              Why is this required?
            </span>
            <p className="text-xs text-[#c2c6d6] leading-relaxed">
              This helps prevent Sybil abuse and keeps free access fair for everyone. The trial is bound to your unique World ID, not your wallet - it cannot be reclaimed with a new wallet address.
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
            ) : verificationState === 'fetching_rp_context' ? (
              <span className="text-[#4cd7f6] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                <span>Preparing request...</span>
              </span>
            ) : verificationState === 'verifying' ? (
              <span className="text-[#4cd7f6] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                <span>Verifying proof...</span>
              </span>
            ) : verificationState === 'success' ? (
              <span className="text-[#4edea3] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Verified ✓</span>
              </span>
            ) : (
              <span className="text-[#ffb4ab] font-bold">Verification failed</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#222a3d]/60 text-[11px]">
            <span className="text-[#8c909f]">Trial Allocation:</span>
            <span className="text-[#dae2fd] font-bold">3 Free Contract Scans</span>
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
                Your free trial is now unlocked with scans remaining.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={verificationState === 'fetching_rp_context' || verificationState === 'verifying' || isAlreadyVerified}
              onClick={handleStartVerification}
              className="w-full py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
            >
              {verificationState === 'fetching_rp_context' || verificationState === 'verifying' ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                  <span>Verifying with World ID...</span>
                </>
              ) : isAlreadyVerified ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Already Verified</span>
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

      {WORLD_APP_ID && rpContext && (
        <IDKitRequestWidget
          open={widgetOpen}
          onOpenChange={setWidgetOpen}
          app_id={WORLD_APP_ID as `app_${string}`}
          action={WORLD_ACTION}
          rp_context={rpContext}
          allow_legacy_proofs
          preset={selfieCheckLegacy({ signal: walletAddress })}
          handleVerify={handleVerify}
          onSuccess={() => undefined}
          onError={(errorCode) => {
            setVerificationState('failed');
            setErrorMessage(`World ID verification was not completed (${errorCode}).`);
            setWidgetOpen(false);
          }}
        />
      )}
    </div>
  );
};
