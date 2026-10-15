// Tamanho de arquivo legível (Backup, Limpeza): "820 KB", "12,4 MB", "1,2 GB".
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(bytes > 0 ? 1 : 0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB`;
}
