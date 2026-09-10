export interface DownloadProgress {
  bytesLoaded: number;
  totalBytes: number;
  pct: number;
}

export class OPFSStorageManager {
  private fileName: string;
  private directoryName: string;

  constructor(fileName: string = 'yuli-qwen2.5-0.5b-q4_k_m.gguf', directoryName: string = 'yuli_cache') {
    this.fileName = fileName;
    this.directoryName = directoryName;
  }

  private async getDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(this.directoryName, { create: true });
  }

  public async hasCachedModel(): Promise<boolean> {
    try {
      const dir = await this.getDirectoryHandle();
      const fileHandle = await dir.getFileHandle(this.fileName);
      const file = await fileHandle.getFile();
      return file.size > 100 * 1024 * 1024; // >100MB ensures non-empty model
    } catch {
      return false;
    }
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
