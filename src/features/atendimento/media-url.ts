// Link de mídia da Neonize gravado no banco aponta direto pro
// whatsapp-service (http://<ip>:8787/media/<arquivo>) — troca pelo caminho
// que passa pelo CRM (/api/atendimento/media/<arquivo>), que funciona em
// qualquer computador e não depende do IP. Outros links (API oficial, que já
// passa pelo CRM) ficam como estão.
const SERVICE_MEDIA_PATTERN = /^https?:\/\/[^/]+\/media\/([a-f0-9]{32}(?:\.[a-z0-9]{1,5})?)$/i;

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(SERVICE_MEDIA_PATTERN);
  return match ? `/api/atendimento/media/${match[1]}` : url;
}
