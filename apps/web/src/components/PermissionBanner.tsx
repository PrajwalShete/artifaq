interface Props {
  onGrant(): void;
}

export function PermissionBanner({ onGrant }: Props) {
  return (
    <div className="permission-banner" role="alert">
      <span>We've lost access to this folder.</span>
      <button type="button" onClick={onGrant}>
        grant again
      </button>
    </div>
  );
}
