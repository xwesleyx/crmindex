export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  // Brasil: DDD (2) + número (8 fixo ou 9 celular) = 10 ou 11 dígitos.
  return digits.length === 10 || digits.length === 11;
}

// O WhatsApp sempre manda o número completo (55 + DDD + número — 12 ou 13
// dígitos), mas o resto do CRM guarda telefone só como DDD + número (10/11
// dígitos, isValidPhone acima), convenção de antes da integração com
// WhatsApp real. Sem normalizar na borda da integração, um contato criado
// manualmente (sem "55", porque a validação não deixa) nunca batia com o
// mesmo contato chegando de verdade pelo WhatsApp (com "55") — o sistema
// tratava como pessoa nova toda vez que o cliente escrevia.
export function stripBrazilCountryCode(value: string): string {
  const digits = onlyDigits(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

// Inverso — usado só na hora de mandar de volta pro provider do WhatsApp
// (que precisa do número completo pra montar o JID), nunca pra gravar no
// banco.
export function withBrazilCountryCode(value: string): string {
  const digits = onlyDigits(value);
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// CEP brasileiro: 8 dígitos (não tem dígito verificador público pra checar,
// diferente de CNPJ/CPF — só o tamanho é validável sem consultar uma base).
export function isValidCEP(value: string): boolean {
  return onlyDigits(value).length === 8;
}

// Validação real do dígito verificador do CNPJ (não apenas contagem de
// dígitos) — seção 27 do escopo pede validação de CNPJ.
export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcCheckDigit = (base: string) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = cnpj.slice(0, 12);
  const digit1 = calcCheckDigit(base);
  const digit2 = calcCheckDigit(base + digit1);

  return cnpj === base + String(digit1) + String(digit2);
}
