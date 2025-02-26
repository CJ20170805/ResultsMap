// global.d.ts

interface Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;

  showOpenFilePicker?: (options?: {
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
}

interface FileSystemFileHandle {
  name: string;
  createWritable: () => Promise<FileSystemWritableFileStream>;
  getFile: () => Promise<File>;
  requestPermission: (options: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied'>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}
