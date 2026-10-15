import { z } from "zod";

// HTML do editor — limite folgado (um documento longo com tabelas fica bem
// abaixo disso), só pra ninguém colar algo gigante por engano.
export const CULTURE_CONTENT_MAX = 300_000;
export const CULTURE_ALERT_MAX = 280;

export const cultureContentSchema = z
  .string()
  .max(CULTURE_CONTENT_MAX, "Documento grande demais — divida em partes menores.");

export const cultureAlertSchema = z
  .string()
  .trim()
  .max(CULTURE_ALERT_MAX, `O aviso pode ter no máximo ${CULTURE_ALERT_MAX} caracteres.`);

// Editor vazio salva "<p></p>" — conta como sem conteúdo.
export function hasCultureContent(html: string | null | undefined): boolean {
  return Boolean(html && html.replace(/<[^>]*>/g, "").trim().length > 0) || Boolean(html && /<(table|hr)/.test(html));
}
