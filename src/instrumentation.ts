// register() roda 1x quando o servidor Next.js sobe (dev ou produção) —
// documentado em node_modules/next/dist/docs/.../instrumentation.md desta
// versão. O Next compila este arquivo também para o runtime Edge, então
// tudo que precisa de Node.js (Prisma, node:fs) fica em
// instrumentation-node.ts e só é importado no runtime Node — o padrão
// "Importing runtime-specific code" da documentação.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
