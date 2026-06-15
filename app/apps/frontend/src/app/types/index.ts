export interface OpenFile {
  filename: string;
  content: string;
  type: 'chapter' | 'code' | 'other';
  dirty: boolean;
}

export interface PendingEdit {
  id: string;
  filename: string;
  original: string;
  proposed: string;
  description: string;
}
