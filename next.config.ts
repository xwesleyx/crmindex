import type { NextConfig } from "next";

// Build do instalador Windows (installer/build.ps1): servidor autocontido
// ("standalone", sem precisar de node_modules) numa pasta própria, pra não
// misturar com o .next do `npm run dev`/Render.
const forInstaller = process.env.BUILD_INSTALLER === "1";

const nextConfig: NextConfig = {
  ...(forInstaller ? { output: "standalone" as const, distDir: ".next-installer" } : {}),
  experimental: {
    // Default é 1MB — muito pouco pra anexo de foto/vídeo/áudio do
    // Atendimento (sendMediaMessage, limite de 16MB validado na action).
    serverActions: {
      // Documentos no Atendimento podem ter até 100 MB (limite do WhatsApp).
      bodySizeLimit: "105mb",
    },
  },
  // Em dev, o Next só aceita pedidos de JS/HMR vindos de "localhost" por
  // padrão — sem isso, acessar por outro computador na rede carrega o HTML
  // mas o JS fica bloqueado (login "não faz nada"). Adicione aqui qualquer
  // IP novo que passe a acessar o projeto na rede.
  allowedDevOrigins: ["192.168.10.208", "26.244.88.52"],
};

export default nextConfig;
