import { formatarCentavos, parseMoedaParaCentavos } from '../calc/moeda';
import { PADROES_DADOS_SENSIVEIS } from './dicionario';

const MESES_EXTENSO: Record<string, string> = {
  janeiro: '01',
  jan: '01',
  fevereiro: '02',
  fev: '02',
  marco: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  maio: '05',
  mai: '05',
  junho: '06',
  jun: '06',
  julho: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  setembro: '09',
  set: '09',
  outubro: '10',
  out: '10',
  novembro: '11',
  nov: '11',
  dezembro: '12',
  dez: '12',
};

export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarParaComparacao(texto: string): string {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/[º°ª]/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove imediatamente CPF, PIS, matrícula e endereço para que dados sensíveis
 * nunca sejam processados nem exibidos na tela de revisão.
 */
export function suprimirDadosSensiveis(texto: string): string {
  let resultado = texto;
  for (const regex of PADROES_DADOS_SENSIVEIS) {
    resultado = resultado.replace(regex, '');
  }
  return resultado;
}

/**
 * Padroniza datas (DD/MM/AAAA), competências (MM/AAAA) e separadores decimais (1.234,56)
 * preservando a estrutura linha a linha do holerite.
 */
export function normalizarTextoHolerite(textoCru: string): string {
  if (!textoCru) return '';
  const semSensiveis = suprimirDadosSensiveis(textoCru.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));

  return semSensiveis
    .split('\n')
    .map((linha) => {
      let l = linha.replace(/\t+/g, '   ').replace(/\u00A0/g, ' ');

      // Converte competências por extenso como "Outubro/2026" ou "Nov / 2026" para "MM/AAAA"
      l = l.replace(
        /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*[/de\s]+\s*(20\d{2})\b/gi,
        (completo, mesNome: string, ano: string) => {
          const chave = removerAcentos(mesNome).toLowerCase();
          const mesNum = MESES_EXTENSO[chave];
          return mesNum ? `${mesNum}/${ano}` : completo;
        }
      );

      // Converte valores com ponto decimal estilo inglês "1,234.56" ou "712.00" (isolados de datas) para "1.234,56"
      l = l.replace(/(?<![/\d])(\d{1,3}(?:,\d{3})+)\.(\d{2})(?![/\d])/g, (_m, intPart: string, dec: string) => {
        return `${intPart.replace(/,/g, '.')},${dec}`;
      });
      l = l.replace(/(?<![.,/\d])(\d+)\.(\d{2})(?![.,/\d])/g, (_m, intPart: string, dec: string) => {
        const formatadoInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${formatadoInt},${dec}`;
      });

      return l.trimEnd();
    })
    .filter((linha) => linha.trim().length > 0)
    .join('\n');
}

export interface TokenNumericoLinha {
  bruto: string;
  centavos: number;
  indice: number;
  ehPercentual: boolean;
}

/**
 * Localiza todos os números decimais (ex.: "7,50", "712,00", "1.621,00") em uma linha normalizada,
 * ignorando datas DD/MM/AAAA e competências MM/AAAA.
 */
export function extrairTokensDecimaisDaLinha(linha: string): TokenNumericoLinha[] {
  const tokens: TokenNumericoLinha[] = [];
  const regex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{1,2})\s*(%?)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(linha)) !== null) {
    const numeroStr = match[1];
    const sufixoPct = match[2] === '%';
    const centavos = parseMoedaParaCentavos(numeroStr);
    tokens.push({
      bruto: sufixoPct ? `${numeroStr}%` : numeroStr,
      centavos,
      indice: match.index,
      ehPercentual: sufixoPct,
    });
  }

  return tokens;
}

export function extrairDataDaLinha(linha: string): string | null {
  const match = /\b(\d{2}\/\d{2}\/\d{4})\b/.exec(linha);
  return match ? match[1] : null;
}

export function extrairCompetenciaDaLinha(linha: string): string | null {
  // Evita capturar o final de uma data DD/MM/AAAA
  const semDatasCompletas = linha.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
  const match = /\b(0[1-9]|1[0-2])\/(20\d{2})\b/.exec(semDatasCompletas);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function formatarValorPadrao(centavos: number): string {
  return formatarCentavos(centavos);
}
