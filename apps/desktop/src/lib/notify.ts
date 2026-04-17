import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

let granted: boolean | null = null;

async function ensureGranted(): Promise<boolean> {
  if (granted !== null) return granted;
  try {
    const ok = await isPermissionGranted();
    if (ok) {
      granted = true;
      return true;
    }
    const requested = await requestPermission();
    granted = requested === 'granted';
    return granted;
  } catch {
    granted = false;
    return false;
  }
}

/** Quiet notification — no sound, short body. Returns true if the OS accepted it. */
export async function osNotify(title: string, body: string): Promise<boolean> {
  if (!(await ensureGranted())) return false;
  try {
    sendNotification({ title, body });
    return true;
  } catch {
    return false;
  }
}
