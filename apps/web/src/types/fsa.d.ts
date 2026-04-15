// Ambient augmentations for File System Access permission methods.
// As of TS 5.9 (May 2026), lib.dom.d.ts ships FileSystemHandle, FileSystemDirectoryHandle, and
// FileSystemFileHandle, but omits the non-standard permission methods (queryPermission /
// requestPermission). We declare them globally here. Using @types/wicg-file-system-access
// conflicts with lib.dom so it's intentionally avoided.

export {};

declare global {
  type FSAPermissionMode = 'read' | 'readwrite';

  interface FileSystemHandlePermissionDescriptor {
    mode?: FSAPermissionMode;
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: FSAPermissionMode;
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }
}
