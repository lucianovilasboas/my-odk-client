/**
 * Ajuda para o bloqueio de localização.
 *
 * O iOS **não repete o prompt** depois de uma negativa: sem instrução exata, o
 * campo fica inutilizável até o usuário mexer nas configurações do sistema.
 * Por isso o texto muda conforme a plataforma.
 */

export type EstadoPermissao = 'granted' | 'denied' | 'prompt' | 'desconhecida'
export type Plataforma = 'ios' | 'android' | 'outro'

export function plataforma(): Plataforma {
  const ua = navigator.userAgent
  const ipadComTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1

  if (/iPad|iPhone|iPod/.test(ua) || ipadComTouch) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'outro'
}

export function instalado(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false
}

export async function estadoPermissao(): Promise<EstadoPermissao> {
  if (!navigator.permissions?.query) return 'desconhecida'
  try {
    const resultado = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return resultado.state as EstadoPermissao
  } catch {
    return 'desconhecida'
  }
}

export function instrucoes(p: Plataforma = plataforma()): string[] {
  if (p === 'ios') {
    return [
      'Abra Ajustes → Privacidade e Segurança → Serviços de Localização.',
      'Procure Safari — ou o nome do app, se ele aparecer na lista — e escolha “Ao Usar o App”.',
      'Ative “Localização Precisa” para não receber coordenada com erro de quilômetros.',
      'Volte ao aplicativo e toque em “Tentar novamente”.',
    ]
  }

  if (p === 'android') {
    return [
      'Toque no cadeado ao lado do endereço.',
      'Abra Permissões → Localização e escolha “Permitir”.',
      'Volte ao aplicativo e toque em “Tentar novamente”.',
    ]
  }

  return [
    'Abra as permissões do site no navegador e permita a localização.',
    'Volte ao aplicativo e toque em “Tentar novamente”.',
  ]
}

export function textoCopiado(p: Plataforma = plataforma()): string {
  const passos = instrucoes(p)
    .map((passo, i) => `${i + 1}. ${passo}`)
    .join('\n')
  return `Como liberar a localização no My ODK Client:\n${passos}`
}
