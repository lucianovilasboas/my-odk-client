/**
 * Aparências declaradas no XLSForm.
 *
 * O motor não expõe o `appearance` de forma utilizável — `node.appearances`
 * chega vazio mesmo em selects com `autocomplete`. Como o pacote traz o XML,
 * extraímos de lá uma vez por formulário carregado.
 */

export type MapaAparencias = Map<string, string[]>

/** Acima disto, a lista vertical ocupa mais de uma tela no celular. */
export const LIMITE_OPCOES_LISTA = 8

export function lerAparencias(xml: string): MapaAparencias {
  const mapa: MapaAparencias = new Map()
  if (typeof DOMParser === 'undefined') return mapa

  const documento = new DOMParser().parseFromString(xml, 'application/xml')
  if (documento.getElementsByTagName('parsererror').length) return mapa

  for (const elemento of Array.from(documento.getElementsByTagName('*'))) {
    const referencia = elemento.getAttribute('ref')
    if (!referencia) continue

    const aparencia = elemento.getAttribute('appearance')
    if (!aparencia) continue

    mapa.set(
      referencia,
      aparencia
        .split(/\s+/)
        .map((a) => a.trim())
        .filter(Boolean),
    )
  }

  return mapa
}

export function temAparencia(aparencias: MapaAparencias, nodeset: string | null, valor: string): boolean {
  if (!nodeset) return false
  return (aparencias.get(nodeset) ?? []).includes(valor)
}

/**
 * Um `select1` vira combobox quando o formulário pede `autocomplete` ou quando
 * a lista é longa demais para caber na tela.
 */
export function usaCombobox(
  aparencias: MapaAparencias,
  nodeset: string | null,
  totalOpcoes: number,
): boolean {
  return totalOpcoes > LIMITE_OPCOES_LISTA || temAparencia(aparencias, nodeset, 'autocomplete')
}

/** A tela precisa de teclado? Então os botões vão para cima. */
export function precisaEscrita(no: any, aparencias: MapaAparencias): boolean {
  const tipo = no?.nodeType

  if (tipo === 'input') {
    return no?.valueType !== 'geopoint'
  }

  if (tipo === 'select' && no?.selectType === 'select1') {
    const total = no?.currentState?.valueOptions?.length ?? 0
    return usaCombobox(aparencias, no?.definition?.nodeset ?? null, total)
  }

  return false
}
