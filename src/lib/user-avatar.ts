// Foto de perfil do usuário: guardada em User.image como data URL (o
// navegador já recorta em quadrado e reduz pra 256px antes de enviar —
// ver AvatarUploader), servida por /api/users/<id>/avatar. Nunca vai pro
// JWT/cookie da sessão (o authorize em lib/auth.ts não devolve `image`):
// alguns KB de imagem estourariam o limite de tamanho do cookie.
export const AVATAR_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const AVATAR_MAX_LENGTH = 400_000; // ~300 KB de imagem — sobra pra 256x256

export function isValidAvatarDataUrl(value: string): boolean {
  return value.length <= AVATAR_MAX_LENGTH && AVATAR_DATA_URL_PATTERN.test(value);
}

// `v` muda a cada atualização do usuário → o navegador pode guardar a foto
// em cache por bastante tempo sem mostrar uma versão velha.
export function userAvatarSrc(user: { id: string; image: string | null; updatedAt: Date }): string | null {
  return user.image ? `/api/users/${user.id}/avatar?v=${user.updatedAt.getTime()}` : null;
}
