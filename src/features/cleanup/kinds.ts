// Tipos de mídia da Limpeza — arquivo sem dependência de servidor, usado
// tanto pelas telas quanto pelas rotinas.
export const MEDIA_KINDS = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  IMAGE: "Imagens",
  VIDEO: "Vídeos",
  AUDIO: "Áudios",
  DOCUMENT: "Documentos",
  STICKER: "Figurinhas",
};
