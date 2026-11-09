/**
 * Verificação de alcance do adaptador.
 *
 * `navigator.onLine` diz que existe interface de rede, não que o servidor
 * responde — captive portal é o caso clássico. Sem esta checagem, o envio
 * automático tentaria a fila inteira contra um servidor inalcançável e inflaria
 * o contador de tentativas.
 */
export async function servidorAlcancavel(timeoutMs = 3000): Promise<boolean> {
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), timeoutMs)

  try {
    const resposta = await fetch('/api/health', {
      signal: controle.signal,
      cache: 'no-store',
      credentials: 'same-origin',
    })
    return resposta.ok
  } catch {
    return false
  } finally {
    clearTimeout(relogio)
  }
}
