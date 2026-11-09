/**
 * Versão exibida na interface.
 *
 * Vem de `VITE_APP_VERSION`, injetada no build a partir da tag git pelo
 * `deploy.sh`. Nunca é digitada à mão: se a imagem for construída fora de uma
 * tag, a interface mostra `dev` — o que é informação útil, não erro.
 */
export const VERSAO = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || 'dev'
