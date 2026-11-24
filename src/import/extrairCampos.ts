import { formatarCentavos } from '../calc/moeda';
import {
  ChaveCampoHolerite,
  DICIONARIO_CAMPOS_HOLERITE,
  DefinicaoCampoDicionario,
  ROTULOS_LINHA_SENSIVEL,
} from './dicionario';
import {
  extrairCompetenciaDaLinha,
  extrairDataDaLinha,
  extrairTokensDecimaisDaLinha,
  normalizarParaComparacao,
  normalizarTextoHolerite,
  suprimirDadosSensiveis,
} from './normalizar';

export type NivelConfianca = 'alta' | 'media' | 'baixa';

export interface CampoExtraido {
  chave: ChaveCampoHolerite;
  rotulo: string;
  encontrado: boolean;
  valorDetectado: string;
  valorCentavos?: number;
  referencia?: string;
  confianca: NivelConfianca;
  trechoOriginal: string;
}

export interface ResultadoExtracaoHolerite {
  campos: Record<ChaveCampoHolerite, CampoExtraido>;
  listaCampos: CampoExtraido[];
  origemLeitura: 'pdf_texto' | 'ocr_imagem' | 'texto_direto';
  quantidadeReconhecida: number;
}

export interface OpcoesExtracaoTexto {
  origemLeitura?: 'pdf_texto' | 'ocr_imagem' | 'texto_direto';
  confiancaMediaOcr?: number;
}

/**
 * Interface desacoplada para extração de holerite. Permite substituir no futuro a implementação
 * local por um serviço externo com visão computacional mediante consentimento explícito do usuário.
 */
export interface ExtratorDeHolerite {
  extrairDeTexto(textoCru: string, opcoes?: OpcoesExtracaoTexto): Promise<ResultadoExtracaoHolerite>;
}

function contemTermoIsolado(linhaNorm: string, termoNorm: string): boolean {
  const escapado = termoNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-z0-9])${escapado}($|[^a-z0-9])`, 'i');
  return regex.test(linhaNorm);
}

function linhaEhApenasSensivel(linhaNorm: string): boolean {
  return ROTULOS_LINHA_SENSIVEL.some((r) => linhaNorm.startsWith(`${r}:`) || linhaNorm === r);
}

function ajustarConfiancaPorOcr(
  base: 'alta' | 'media',
  opcoes?: OpcoesExtracaoTexto
): NivelConfianca {
  if (opcoes?.origemLeitura === 'ocr_imagem') {
    const score = opcoes.confiancaMediaOcr ?? 75;
    if (score < 72) return 'baixa';
    if (score < 86 && base === 'alta') return 'media';
  }
  return base;
}

function limparValorTextoAposRotulo(linha: string, termos: string[]): string {
  let trecho = suprimirDadosSensiveis(linha).trim();
  const ordenada = [...termos].sort((a, b) => b.length - a.length);

  for (const termo of ordenada) {
    const padrao = termo
      .split(/\s+/)
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    const regex = new RegExp(`^.*?${padrao}\\s*[:.-]?\\s*`, 'i');
    const normalizadaLinha = normalizarParaComparacao(trecho);
    if (new RegExp(padrao, 'i').test(normalizadaLinha)) {
      // Encontra o índice aproximado na string sem acento (mesmo comprimento em letras latinas comuns)
      const semAcento = trecho.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const match = regex.exec(semAcento);
      if (match) {
        trecho = trecho.slice(match[0].length).trim();
        break;
      }
    }
  }

  // Corta caso haja outra coluna à direita separada por múltiplos espaços ou barra vertical
  trecho = trecho.split(/\s{3,}|\|/)[0]?.trim() ?? '';
  // Remove códigos numéricos iniciais isolados (ex.: "00124 - MARIA DA SILVA" -> "MARIA DA SILVA")
  trecho = trecho.replace(/^\d{1,6}\s*[-–.]?\s*/, '').trim();
  return trecho;
}

/**
 * Tenta casar linhas de cabeçalho tabular em que os rótulos ficam em uma linha
 * e os valores numéricos correspondentes ficam imediatamente na linha seguinte.
 */
function extrairParesCabecalhoEValores(
  linhas: string[],
  opcoes?: OpcoesExtracaoTexto
): Partial<Record<ChaveCampoHolerite, CampoExtraido>> {
  const achados: Partial<Record<ChaveCampoHolerite, CampoExtraido>> = {};
  const camposRodape = DICIONARIO_CAMPOS_HOLERITE.filter(
    (d) => d.categoria === 'base' || d.categoria === 'total' || d.chave === 'salarioBase'
  );

  for (let i = 0; i < linhas.length - 1; i += 1) {
    const linhaRotulos = linhas[i];
    const linhaValores = linhas[i + 1];
    const normRotulos = normalizarParaComparacao(linhaRotulos);

    // Se a própria linha de rótulos já tem muitos números decimais, não é cabeçalho puro
    if (extrairTokensDecimaisDaLinha(linhaRotulos).length >= 2) continue;

    const tokensValores = extrairTokensDecimaisDaLinha(linhaValores);
    if (tokensValores.length < 2) continue;

    const colunasDetectadas: Array<{
      def: DefinicaoCampoDicionario;
      pos: number;
      nivel: 'alta' | 'media';
    }> = [];

    for (const def of camposRodape) {
      let melhorPos = -1;
      let nivel: 'alta' | 'media' = 'media';

      for (const exato of def.rotulosExatos) {
        const pos = normRotulos.indexOf(exato);
        if (pos !== -1 && (melhorPos === -1 || pos < melhorPos)) {
          melhorPos = pos;
          nivel = 'alta';
        }
      }
      if (melhorPos === -1) {
        for (const sin of def.sinonimos) {
          const pos = normRotulos.indexOf(sin);
          if (pos !== -1 && (melhorPos === -1 || pos < melhorPos)) {
            melhorPos = pos;
            nivel = 'media';
          }
        }
      }

      if (melhorPos !== -1) {
        colunasDetectadas.push({ def, pos: melhorPos, nivel });
      }
    }

    colunasDetectadas.sort((a, b) => a.pos - b.pos);

    if (colunasDetectadas.length >= 2 && colunasDetectadas.length === tokensValores.length) {
      colunasDetectadas.forEach((col, idx) => {
        const token = tokensValores[idx];
        if (!achados[col.def.chave]) {
          achados[col.def.chave] = {
            chave: col.def.chave,
            rotulo: col.def.rotulo,
            encontrado: true,
            valorDetectado: formatarCentavos(token.centavos),
            valorCentavos: token.centavos,
            confianca: ajustarConfiancaPorOcr(col.nivel, opcoes),
            trechoOriginal: `${linhaRotulos.trim()} / ${linhaValores.trim()}`,
          };
        }
      });
    }
  }

  return achados;
}

export function extrairCamposDoTexto(
  textoCru: string,
  opcoes?: OpcoesExtracaoTexto
): ResultadoExtracaoHolerite {
  const origemLeitura = opcoes?.origemLeitura ?? 'texto_direto';
  const textoNormalizado = normalizarTextoHolerite(textoCru);
  const linhas = textoNormalizado
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const mapaInicial = {} as Record<ChaveCampoHolerite, CampoExtraido>;
  for (const def of DICIONARIO_CAMPOS_HOLERITE) {
    mapaInicial[def.chave] = {
      chave: def.chave,
      rotulo: def.rotulo,
      encontrado: false,
      valorDetectado: '',
      confianca: 'baixa',
      trechoOriginal: '',
    };
  }

  if (linhas.length === 0) {
    return {
      campos: mapaInicial,
      listaCampos: DICIONARIO_CAMPOS_HOLERITE.map((d) => mapaInicial[d.chave]),
      origemLeitura,
      quantidadeReconhecida: 0,
    };
  }

  // 1. Verifica blocos tabulares de duas linhas (rótulos em cima, valores embaixo)
  const paresTabulares = extrairParesCabecalhoEValores(linhas, opcoes);
  for (const [chave, campo] of Object.entries(paresTabulares)) {
    if (campo) {
      mapaInicial[chave as ChaveCampoHolerite] = campo;
    }
  }

  // 2. Analisa linha por linha completa (código, descrição, referência, valor ou pares inline separados por |)
  for (const linhaInteira of linhas) {
    // Subdivide caso a linha contenha múltiplos pares explícitos separados por barra vertical "|"
    const segmentos = linhaInteira.includes('|')
      ? linhaInteira.split('|').map((s) => s.trim()).filter(Boolean)
      : [linhaInteira];

    for (const segmento of segmentos) {
      const norm = normalizarParaComparacao(segmento);
      if (!norm || linhaEhApenasSensivel(norm)) continue;

      for (const def of DICIONARIO_CAMPOS_HOLERITE) {
        // Evita sobrescrever um campo já encontrado com confiança Alta
        if (mapaInicial[def.chave].encontrado && mapaInicial[def.chave].confianca === 'alta') {
          continue;
        }

        // Impede confusão entre "INSS" (desconto) e "Base INSS" (base), ou "FGTS" e "Base FGTS", ou "Salário" e "Total/Líquido"
        if (def.chave === 'inss' && /\b(base|sal\.?\s*contr|contrib\.?\s*inss)\b/.test(norm)) {
          continue;
        }
        if (def.chave === 'irrf' && /\bbase\b/.test(norm)) {
          continue;
        }
        if (
          def.chave === 'salarioBase' &&
          /\b(liquido|contrib|inss|fgts|familia|13o|decimo|adiantamento)\b/.test(norm)
        ) {
          continue;
        }
        if (def.chave === 'liquido' && /\b(proventos|vencimentos|descontos)\b/.test(norm) && segmento === linhaInteira) {
          // Se a mesma linha tem proventos, descontos e líquido juntos sem "|", só extrai se for o último valor
        }

        const bateuExato = def.rotulosExatos.some((t) => contemTermoIsolado(norm, t));
        const bateuSinonimo = !bateuExato && def.sinonimos.some((t) => contemTermoIsolado(norm, t));

        if (!bateuExato && !bateuSinonimo) continue;

        const nivelBase: 'alta' | 'media' = bateuExato ? 'alta' : 'media';

        if (def.tipo === 'competencia') {
          const comp = extrairCompetenciaDaLinha(segmento);
          if (comp) {
            mapaInicial[def.chave] = {
              chave: def.chave,
              rotulo: def.rotulo,
              encontrado: true,
              valorDetectado: comp,
              confianca: ajustarConfiancaPorOcr(nivelBase, opcoes),
              trechoOriginal: segmento,
            };
          }
          continue;
        }

        if (def.tipo === 'data') {
          const dt = extrairDataDaLinha(segmento);
          if (dt) {
            mapaInicial[def.chave] = {
              chave: def.chave,
              rotulo: def.rotulo,
              encontrado: true,
              valorDetectado: dt,
              confianca: ajustarConfiancaPorOcr(nivelBase, opcoes),
              trechoOriginal: segmento,
            };
          }
          continue;
        }

        if (def.tipo === 'texto') {
          const valorLimpo = limparValorTextoAposRotulo(segmento, [
            ...def.rotulosExatos,
            ...def.sinonimos,
          ]);
          if (valorLimpo && valorLimpo.length >= 2 && !/^\d+[.,]\d{2}$/.test(valorLimpo)) {
            mapaInicial[def.chave] = {
              chave: def.chave,
              rotulo: def.rotulo,
              encontrado: true,
              valorDetectado: valorLimpo,
              confianca: ajustarConfiancaPorOcr(nivelBase, opcoes),
              trechoOriginal: segmento,
            };
          }
          continue;
        }

        if (def.tipo === 'moeda') {
          const tokens = extrairTokensDecimaisDaLinha(segmento);
          if (tokens.length === 0) continue;

          // Em uma linha de holerite (ex.: "101 INSS 7,50 53,25" ou "001 Salário Base 30,00 712,00"),
          // o último valor monetário não percentual é o valor da rubrica, e o penúltimo (quando existe) é a referência!
          const naoPercentuais = tokens.filter((t) => !t.ehPercentual);
          const tokenPrincipal =
            naoPercentuais[naoPercentuais.length - 1] ?? tokens[tokens.length - 1];

          let referencia: string | undefined;
          if (def.aceitaReferencia && tokens.length >= 2) {
            const candidatoRef = tokens[tokens.length - 2];
            if (candidatoRef && candidatoRef !== tokenPrincipal) {
              referencia = candidatoRef.bruto;
            }
          }

          mapaInicial[def.chave] = {
            chave: def.chave,
            rotulo: def.rotulo,
            encontrado: true,
            valorDetectado: formatarCentavos(tokenPrincipal.centavos),
            valorCentavos: tokenPrincipal.centavos,
            referencia,
            confianca: ajustarConfiancaPorOcr(nivelBase, opcoes),
            trechoOriginal: segmento,
          };
        }
      }
    }
  }

  // Fallback para competência isolada no cabeçalho (primeiras 5 linhas) caso não tenha vindo com rótulo explícito
  if (!mapaInicial.competencia.encontrado) {
    for (const linhaCab of linhas.slice(0, 5)) {
      const comp = extrairCompetenciaDaLinha(linhaCab);
      if (comp) {
        mapaInicial.competencia = {
          chave: 'competencia',
          rotulo: 'Competência',
          encontrado: true,
          valorDetectado: comp,
          confianca: origemLeitura === 'ocr_imagem' ? 'baixa' : 'media',
          trechoOriginal: linhaCab,
        };
        break;
      }
    }
  }

  const listaCampos = DICIONARIO_CAMPOS_HOLERITE.map((d) => mapaInicial[d.chave]);
  const quantidadeReconhecida = listaCampos.filter((c) => c.encontrado).length;

  return {
    campos: mapaInicial,
    listaCampos,
    origemLeitura,
    quantidadeReconhecida,
  };
}

export class ExtratorLocalDeHolerite implements ExtratorDeHolerite {
  async extrairDeTexto(
    textoCru: string,
    opcoes?: OpcoesExtracaoTexto
  ): Promise<ResultadoExtracaoHolerite> {
    return extrairCamposDoTexto(textoCru, opcoes);
  }
}
