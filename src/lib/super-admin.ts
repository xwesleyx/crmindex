// Usuário do suporte (fornecedor do CRM): criado pelo instalador em toda
// instalação. É o único que vê o menu Licença e entra mesmo com o CRM
// travado. Por isso fica escondido e protegido dos outros administradores
// (não aparece em Usuários/Permissões e ninguém além dele mesmo o edita) —
// senão um admin do cliente trocaria a senha dele e destravaria o CRM.
export const SUPER_ADMIN_EMAIL = "admin@crm.index";

export function isSuperAdmin(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}
