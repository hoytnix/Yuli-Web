export interface DownloadProgress {
  bytesLoaded: number;
  totalBytes: number;
  pct: number;
}

export const DEFAULT_MODEL_FILENAME = 'Yuli-Qwen2.5-0.5B-Reddit-v0.1.0-Q4_K_M.gguf';

export function extractModelFileName(urlOrPath: string): string {
  try {
    const parsed = new URL(urlOrPath, 'http://localhost');
    const pathname = parsed.pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    return last && last.length > 0 ? decodeURIComponent(last) : DEFAULT_MODEL_FILENAME;
  } catch {
    const parts = urlOrPath.split('/');
    const last = parts[parts.length - 1];
    return last && last.length > 0 ? last : DEFAULT_MODEL_FILENAME;
  }
}

export class OPFSStorageManager {
  private fileName: string;
  private directoryName: string;

  constructor(fileName: string = DEFAULT_MODEL_FILENAME, directoryName: string = 'yuli_cache') {
    this.fileName = fileName;
    this.directoryName = directoryName;
  }

  private async getDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
      throw new Error('Origin Private File System (OPFS) is not supported in this environment.');
    }
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(this.directoryName, { create: true });
  }

  public async hasCachedModel(fileName?: string): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
        return false;
      }
      const dir = await this.getDirectoryHandle();
      const fileHandle = await dir.getFileHandle(fileName || this.fileName);
      const file = await fileHandle.getFile();
      return file.size > 100 * 1024 * 1024; // >100MB ensures non-empty model
    } catch {
      return false;
    }
  }

  public async clearCachedModel(fileName?: string): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
        return false;
      }
      const dir = await this.getDirectoryHandle();
      await dir.removeEntry(fileName || this.fileName);
      return true;
    } catch {
      return false;
    }
  }

  public static async hasCachedModel(fileName?: string, directoryName: string = 'yuli_cache'): Promise<boolean> {
    const manager = new OPFSStorageManager(fileName || DEFAULT_MODEL_FILENAME, directoryName);
    return manager.hasCachedModel();
  }

  public static async clearCachedModel(fileName?: string, directoryName: string = 'yuli_cache'): Promise<boolean> {
    const manager = new OPFSStorageManager(fileName || DEFAULT_MODEL_FILENAME, directoryName);
    return manager.clearCachedModel();
  }

  public async getModelBlob(): Promise<Blob> {
    const dir = await this.getDirectoryHandle();
    const fileHandle = await dir.getFileHandle(this.fileName);
    return await fileHandle.getFile();
  }

  public async downloadAndCache(
    sourceUrl: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<Blob> {
    const dir = await this.getDirectoryHandle();
    const fileHandle = await dir.getFileHandle(this.fileName, { create: true });
    // @ts-ignore createWritable is standard in WebWorker OPFS environments
    const writable: FileSystemWritableFileStream = await fileHandle.createWritable();

    const headResponse = await fetch(sourceUrl, { method: 'HEAD' });
    const totalBytes = parseInt(headResponse.headers.get('content-length') || '0', 10);

    const response = await fetch(sourceUrl);
    if (!response.body) {
      throw new Error('Failed to open readable stream from model URL');
    }

    const reader = response.body.getReader();
    let bytesLoaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await writable.write(value);
      bytesLoaded += value.length;

      if (onProgress && totalBytes > 0) {
        onProgress({
          bytesLoaded,
          totalBytes,
          pct: Math.min(100, Math.round((bytesLoaded / totalBytes) * 100))
        });
      }
    }

    await writable.close();
    return await this.getModelBlob();
  }

  public async saveSnapshot(name: string, buffer: ArrayBuffer): Promise<void> {
    const dir = await this.getDirectoryHandle();
    const fileHandle = await dir.getFileHandle(`${name}.snap`, { create: true });
    // @ts-ignore createWritable is standard in WebWorker OPFS environments
    const writable: FileSystemWritableFileStream = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
  }

  public async loadSnapshot(name: string): Promise<ArrayBuffer> {
    const dir = await this.getDirectoryHandle();
    const fileHandle = await dir.getFileHandle(`${name}.snap`);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  }
}
