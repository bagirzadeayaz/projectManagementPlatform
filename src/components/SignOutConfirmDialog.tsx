"use client";

export function SignOutConfirmDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-backdrop signout-confirm-backdrop" role="presentation">
      <section aria-labelledby="signout-confirm-title" aria-modal="true" className="confirm-dialog signout-confirm-dialog" role="dialog">
        <div className="confirm-icon signout-confirm-icon" aria-hidden="true">
          !
        </div>
        <div>
          <p className="auth-kicker">Sign out</p>
          <h2 id="signout-confirm-title">Log out of this account?</h2>
          <p className="confirm-copy">You will return to the sign-in screen and need to sign in again to continue.</p>
        </div>
        <div className="project-actions">
          <button className="auth-button auth-button-secondary" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="auth-button danger-button" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Signing out..." : "Log out"}
          </button>
        </div>
      </section>
    </div>
  );
}
