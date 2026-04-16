/**
 * Re-grant permission on a previously-picked handle.
 * MUST be called from inside a user-gesture handler (click / keydown).
 */
export async function ensureReadable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  const current = await handle.queryPermission(opts);
  if (current === 'granted') return true;
  if (current === 'denied') return false;
  const result = await handle.requestPermission(opts);
  return result === 'granted';
}

export async function checkReadable(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' });
}
