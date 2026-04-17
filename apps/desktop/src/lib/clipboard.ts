import { writeText } from '@tauri-apps/plugin-clipboard-manager';

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    // Fallback to web clipboard if the plugin path fails (e.g. running in plain Vite dev).
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
