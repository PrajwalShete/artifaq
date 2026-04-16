export async function writeClipboard(text: string): Promise<boolean> {
  if (!('clipboard' in navigator)) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
