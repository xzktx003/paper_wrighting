import { isPreviewableTextPath } from './previewAssets';

export interface FileItem {
  path: string;
  type: 'file' | 'dir';
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: FileTreeNode[];
}

export interface ClipboardTreeItem {
  path: string;
  type: 'file' | 'dir';
}

export function canCreateChildrenFromContext(node: ClipboardTreeItem | null): boolean {
  return !node || node.type === 'dir';
}

export function getCreateTargetFolderPath(node: ClipboardTreeItem | null): string | null {
  if (!node) return '';
  return node.type === 'dir' ? node.path : null;
}

export function buildProjectTree(items: FileItem[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const item of items) {
    const parts = item.path.split('/').filter(Boolean);
    let level = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;
      const type = isLeaf ? item.type : 'dir';
      let node = level.find((candidate) => candidate.name === part);
      if (!node) {
        node = { name: part, path: currentPath, type, children: [] };
        level.push(node);
      } else if (isLeaf && item.type === 'dir') {
        node.type = 'dir';
      }

      if (!isLeaf || node.type === 'dir') {
        level = node.children;
      }
    });
  }

  return sortTree(root);
}

export function getFileSelectType(filePath: string): 'chapter' | 'code' | 'other' {
  if (isPreviewableTextPath(filePath)) return 'chapter';
  return 'other';
}

export function getParentPath(filePath: string): string {
  const normalized = normalizeProjectPath(filePath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

export function getBaseName(filePath: string): string {
  const normalized = normalizeProjectPath(filePath);
  return normalized.split('/').filter(Boolean).pop() || '';
}

export function joinProjectPath(parentPath: string, name: string): string {
  const parent = normalizeProjectPath(parentPath);
  const child = normalizeProjectPath(name);
  return parent ? `${parent}/${child}` : child;
}

export function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function isDescendantPath(candidatePath: string, parentPath: string): boolean {
  const candidate = normalizeProjectPath(candidatePath);
  const parent = normalizeProjectPath(parentPath);
  return !!parent && candidate.startsWith(`${parent}/`);
}

export function canMoveTreeItem(source: ClipboardTreeItem, targetFolderPath: string): boolean {
  const target = normalizeProjectPath(targetFolderPath);
  const sourcePath = normalizeProjectPath(source.path);
  if (source.type !== 'dir') return getParentPath(sourcePath) !== target;
  return sourcePath !== target && !isDescendantPath(target, sourcePath) && getParentPath(sourcePath) !== target;
}

export function canCopyTreeItem(source: ClipboardTreeItem, targetFolderPath: string): boolean {
  const target = normalizeProjectPath(targetFolderPath);
  const sourcePath = normalizeProjectPath(source.path);
  if (source.type !== 'dir') return true;
  return sourcePath !== target && !isDescendantPath(target, sourcePath);
}

export function getUniquePastePath(items: FileItem[], targetFolderPath: string, sourcePath: string): string {
  const targetFolder = normalizeProjectPath(targetFolderPath);
  const sourceName = getBaseName(sourcePath);
  const existingPaths = new Set(items.map((item) => normalizeProjectPath(item.path)));
  const first = joinProjectPath(targetFolder, sourceName);
  if (!existingPaths.has(first)) return first;

  const dotIndex = sourceName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const stem = hasExtension ? sourceName.slice(0, dotIndex) : sourceName;
  const extension = hasExtension ? sourceName.slice(dotIndex) : '';
  let counter = 1;
  while (true) {
    const suffix = counter === 1 ? ' copy' : ` copy ${counter}`;
    const candidate = joinProjectPath(targetFolder, `${stem}${suffix}${extension}`);
    if (!existingPaths.has(candidate)) return candidate;
    counter += 1;
  }
}

export function removeTreeItem(items: FileItem[], sourcePath: string): FileItem[] {
  const source = normalizeProjectPath(sourcePath);
  return items.filter((item) => {
    const itemPath = normalizeProjectPath(item.path);
    return itemPath !== source && !isDescendantPath(itemPath, source);
  });
}

export function moveTreeItem(items: FileItem[], sourcePath: string, destinationPath: string): FileItem[] {
  const source = normalizeProjectPath(sourcePath);
  const destination = normalizeProjectPath(destinationPath);
  return sortFileItems(items.map((item) => {
    const itemPath = normalizeProjectPath(item.path);
    if (itemPath === source) return { ...item, path: destination };
    if (isDescendantPath(itemPath, source)) {
      return { ...item, path: `${destination}${itemPath.slice(source.length)}` };
    }
    return item;
  }));
}

export function copyTreeItem(items: FileItem[], sourcePath: string, destinationPath: string): FileItem[] {
  const source = normalizeProjectPath(sourcePath);
  const destination = normalizeProjectPath(destinationPath);
  const copies = items
    .filter((item) => {
      const itemPath = normalizeProjectPath(item.path);
      return itemPath === source || isDescendantPath(itemPath, source);
    })
    .map((item) => {
      const itemPath = normalizeProjectPath(item.path);
      return { ...item, path: itemPath === source ? destination : `${destination}${itemPath.slice(source.length)}` };
    });
  return sortFileItems([...items, ...copies]);
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortTree(node.children) }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function sortFileItems(items: FileItem[]): FileItem[] {
  return [...items].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
}
