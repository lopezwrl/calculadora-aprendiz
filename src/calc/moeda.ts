/**
 * Funções puras de manipulação e formatação monetária em centavos inteiros.
 * Nenhum acesso ao DOM.
 */

export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais)) return 0;
  return Math.round(reais * 100);
}

export function centavosParaReais(centavos: number): number {
  if (!Number.isFinite(centavos)) return 0;
  return Math.round(centavos) / 100;
}

export function formatarCentavos(centavos: number): string {
  const inteiro = Math.round(centavos);
  const negativo = inteiro < 0;
  const abs = Math.abs(inteiro);
  const reais = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const reaisFormatado = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-R$ ' : 'R$ '}${reaisFormatado},${frac}`;
}

export function formatarPercentual(aliquotaDecimal: number): string {
  const pct = aliquotaDecimal * 100;
  const arredondado = Math.round(pct * 100) / 100;
  if (Number.isInteger(arredondado)) {
    return `${arredondado}%`;
  }
  return `${arredondado.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')}%`;
}

/**
 * Converte string monetária ("R$ 1.234,56", "1234.56", "712,00") em centavos inteiros.
 */
export function parseMoedaParaCentavos(entrada: string): number {
  if (!entrada || typeof entrada !== 'string') return 0;
  const limpo = entrada
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!limpo) return 0;

  const negativo = limpo.startsWith('-');
  const semSinal = limpo.replace(/^[+-]/, '');

  const ultimaVirgula = semSinal.lastIndexOf(',');
  const ultimoPonto = semSinal.lastIndexOf('.');

  let normalizado = semSinal;
  if (ultimaVirgula > ultimoPonto) {
    // Formato brasileiro: 1.234,56
    normalizado = semSinal.replace(/\./g, '').replace(',', '.');
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula !== -1) {
    // Formato americano com milhar: 1,234.56
    normalizado = semSinal.replace(/,/g, '');
  } else if (ultimoPonto !== -1 && ultimaVirgula === -1) {
    // Apenas ponto: se tiver exatamente 2 casas após o último ponto, trata como decimal (1234.56);
    // se tiver 3 casas e múltiplos pontos ou formato de milhar puro (1.500), verifica contexto
    const partes = semSinal.split('.');
    if (partes.length === 2 && partes[1].length <= 2) {
      normalizado = semSinal;
    } else {
      normalizado = semSinal.replace(/\./g, '');
    }
  } else {
    normalizado = semSinal.replace(/[^\d]/g, '');
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return 0;
  const centavos = Math.round(numero * 100);
  return negativo ? -centavos : centavos;
}

/**
 * Aplica máscara monetária brasileira a partir dos dígitos digitados pelo usuário.
 * Retorna string no formato "1.234,56" (sem prefixo R$, exibido no adorno do campo).
 */
export function aplicarMascaraMoeda(valorBruto: string): string {
  const digitos = valorBruto.replace(/\D/g, '');
  if (!digitos) return '';
  const centavos = parseInt(digitos, 10);
  if (!Number.isFinite(centavos)) return '';
  const reais = Math.floor(centavos / 100);
  const frac = String(centavos % 100).padStart(2, '0');
  const reaisFmt = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reaisFmt},${frac}`;
}
