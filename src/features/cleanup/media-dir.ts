import { existsSync } from "node:fs";
import path from "node:path";

// Pasta onde o serviço do WhatsApp guarda as mídias (recebidas e enviadas).
// CRM instalado: o launcher informa (%ProgramData%\IntegraCRM\whatsapp-media).
// Desenvolvimento: whatsapp-service/media. O CRM e o serviço rodam sempre no
// mesmo computador, então a Limpeza e o Backup leem a pasta direto — funciona
// até com o serviço do WhatsApp parado.
export function resolveMediaDir(): string | null {
  const fromEnv = process.env.WHATSAPP_MEDIA_DIR;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const dev = path.join(process.cwd(), "whatsapp-service", "media");
  return existsSync(dev) ? dev : null;
}

// Mesmo formato gerado pelo serviço (uuid4().hex + extensão) — e o mesmo
// validado pela rota /api/atendimento/media/[file].
export const MEDIA_FILE_PATTERN = /^[a-f0-9]{32}(\.[a-z0-9]{1,5})?$/i;
