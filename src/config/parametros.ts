/**
 * Parâmetros legais trabalhistas e tributários por ano de vigência.
 * Todos os valores monetários estão representados em centavos inteiros (ex.: R$ 1.621,00 = 162100).
 *
 * Onde conferir oficialmente:
 * - Salário mínimo nacional: Portal da Legislação do Planalto (https://www4.planalto.gov.br/legislacao)
 * - Piso salarial no Piauí: Assembleia Legislativa do Piauí (https://www.pi.leg.br) e sistema Mediador MTE
 *   para Convenções Coletivas de Teresina (https://www3.mte.gov.br/sistemas/mediador/)
 * - Tabela do INSS: Ministério da Previdência Social (https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social)
 * - Tabela do IRRF e redutor: Receita Federal (https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas)
 * - FGTS: Lei nº 8.036/1990, art. 15 (CLT 8%) e Lei nº 10.097/2000, art. 15, § 7º (Aprendiz 2%)
 */

export interface FaixaInss {
  /** Limite superior da faixa em centavos inteiros */
  ateCentavos: number;
  /** Alíquota decimal da faixa (ex.: 0.075 para 7,5%) */
  aliquota: number;
}

export interface FaixaIrrf {
  /** Limite superior da base de cálculo em centavos (Infinity na última faixa) */
  ateCentavos: number;
  /** Alíquota decimal da faixa */
  aliquota: number;
  /** Parcela a deduzir do imposto em centavos */
  parcelaDeduzirCentavos: number;
}

export interface RedutorIrrfMensal {
  /** Rendimento tributável até este limite tem redução integral limitada a reducaoMaximaIsencaoCentavos */
  limiteIsencaoTotalCentavos: number;
  /** Teto do redutor na faixa de isenção integral (em centavos) */
  reducaoMaximaIsencaoCentavos: number;
  /** Limite superior da faixa de redução parcial decrescente (em centavos) */
  limiteReducaoParcialCentavos: number;
  /** Constante fixa da fórmula legal do redutor parcial (em centavos) */
  constanteFormulaCentavos: number;
  /** Coeficiente multiplicador sobre o rendimento tributável em centavos */
  coeficienteFormula: number;
  /** Norma legal que instituiu o redutor */
  normaLegal: string;
}

export interface ParametrosAno {
  ano: number;
  dataConferencia: string;
  /** Salário mínimo nacional em centavos */
  salarioMinimoCentavos: number;
  fonteSalarioMinimo: string;
  /**
   * Piso estadual geral aplicável no Piauí em centavos.
   * Nota técnica: O Estado do Piauí não possui lei complementar estadual de piso salarial regional
   * geral para o setor privado nos moldes da Lei Complementar Federal nº 103/2000, aplicando-se
   * como piso geral o salário mínimo nacional, ressalvados pisos específicos definidos em
   * Convenção ou Acordo Coletivo de Trabalho da categoria em Teresina/PI.
   */
  pisoEstadualPiauiCentavos: number;
  fontePisoEstadualPiaui: string;
  /** Teto do salário de contribuição do INSS em centavos */
  tetoInssCentavos: number;
  faixasInss: FaixaInss[];
  fonteInss: string;
  /** Tabela progressiva mensal do IRRF */
  faixasIrrf: FaixaIrrf[];
  /** Dedução mensal por dependente legal em centavos */
  deducaoDependenteCentavos: number;
  /** Desconto simplificado mensal alternativo às deduções legais em centavos */
  descontoSimplificadoIrrfCentavos: number;
  /** Redutor adicional do imposto apurado (Lei nº 15.270/2025 a partir de jan/2026) */
  redutorIrrf: RedutorIrrfMensal | null;
  fonteIrrf: string;
  /** Alíquota do FGTS para contrato CLT padrão (8%) */
  aliquotaFgtsClt: number;
  /** Alíquota do FGTS para contrato de aprendizagem (2%) */
  aliquotaFgtsAprendiz: number;
  /** Multa rescisória do FGTS na dispensa sem justa causa (40%) */
  multaFgtsSemJustaCausa: number;
  /** Multa rescisória do FGTS no acordo entre as partes, art. 484 A da CLT (20%) */
  multaFgtsAcordo: number;
  /** Limite percentual legal de desconto do vale-transporte sobre o salário base (6%) */
  limiteValeTransporte: number;
  fonteFgts: string;
}

export const DATA_ULTIMA_CONFERENCIA = '24/11/2026';
export const ANO_VIGENTE = 2026;

export const PARAMETROS_POR_ANO: Record<number, ParametrosAno> = {
  2026: {
    ano: 2026,
    dataConferencia: DATA_ULTIMA_CONFERENCIA,
    // Decreto nº 12.797/2025 (vigência a partir de 01/01/2026): R$ 1.621,00
    salarioMinimoCentavos: 162100,
    fonteSalarioMinimo: 'Decreto Federal nº 12.797/2025, vigente desde 01/01/2026',
    // Piauí adota o salário mínimo nacional para a iniciativa privada geral (sem piso regional LC 103/2000)
    pisoEstadualPiauiCentavos: 162100,
    fontePisoEstadualPiaui:
      'Ausência de lei complementar estadual de piso regional privado no Piauí (aplica-se o mínimo nacional ou CCT local)',
    // Portaria Interministerial MPS/MF nº 13/2026 (vigência a partir de 01/01/2026): teto R$ 8.475,55
    tetoInssCentavos: 847555,
    faixasInss: [
      { ateCentavos: 162100, aliquota: 0.075 },
      { ateCentavos: 290284, aliquota: 0.09 },
      { ateCentavos: 435427, aliquota: 0.12 },
      { ateCentavos: 847555, aliquota: 0.14 },
    ],
    fonteInss: 'Portaria Interministerial MPS/MF nº 13/2026, Anexo II',
    // Lei nº 15.191/2025 e Lei nº 15.270/2025 (Receita Federal, exercício 2026)
    faixasIrrf: [
      { ateCentavos: 242880, aliquota: 0, parcelaDeduzirCentavos: 0 },
      { ateCentavos: 282665, aliquota: 0.075, parcelaDeduzirCentavos: 18216 },
      { ateCentavos: 375105, aliquota: 0.15, parcelaDeduzirCentavos: 39416 },
      { ateCentavos: 466468, aliquota: 0.225, parcelaDeduzirCentavos: 67549 },
      { ateCentavos: Number.POSITIVE_INFINITY, aliquota: 0.275, parcelaDeduzirCentavos: 90873 },
    ],
    // Lei nº 9.250/1995 c/c Lei nº 15.191/2025: R$ 189,59 por dependente e desconto simplificado de R$ 607,20
    deducaoDependenteCentavos: 18959,
    descontoSimplificadoIrrfCentavos: 60720,
    // Lei nº 15.270/2025: isenção prática até R$ 5.000,00 (redutor até R$ 312,89) e redução gradual até R$ 7.350,00
    redutorIrrf: {
      limiteIsencaoTotalCentavos: 500000,
      reducaoMaximaIsencaoCentavos: 31289,
      limiteReducaoParcialCentavos: 735000,
      constanteFormulaCentavos: 97862,
      coeficienteFormula: 0.133145,
      normaLegal: 'Lei nº 15.270/2025 (tabela de redução mensal do IRRF a partir de 01/01/2026)',
    },
    fonteIrrf: 'Lei nº 15.191/2025 e Lei nº 15.270/2025 (Receita Federal do Brasil)',
    aliquotaFgtsClt: 0.08,
    aliquotaFgtsAprendiz: 0.02,
    multaFgtsSemJustaCausa: 0.4,
    multaFgtsAcordo: 0.2,
    limiteValeTransporte: 0.06,
    fonteFgts: 'Lei nº 8.036/1990, arts. 15 e 18; CLT, art. 484 A; Lei nº 10.097/2000, art. 15, § 7º',
  },
  2025: {
    ano: 2025,
    dataConferencia: DATA_ULTIMA_CONFERENCIA,
    // Decreto nº 12.342/2024: R$ 1.518,00
    salarioMinimoCentavos: 151800,
    fonteSalarioMinimo: 'Decreto Federal nº 12.342/2024, vigente em 2025',
    pisoEstadualPiauiCentavos: 151800,
    fontePisoEstadualPiaui:
      'Ausência de lei complementar estadual de piso regional privado no Piauí (aplica-se o mínimo nacional ou CCT local)',
    // Portaria Interministerial MPS/MF nº 6/2025: teto R$ 8.157,41
    tetoInssCentavos: 815741,
    faixasInss: [
      { ateCentavos: 151800, aliquota: 0.075 },
      { ateCentavos: 279388, aliquota: 0.09 },
      { ateCentavos: 419083, aliquota: 0.12 },
      { ateCentavos: 815741, aliquota: 0.14 },
    ],
    fonteInss: 'Portaria Interministerial MPS/MF nº 6/2025',
    // MP nº 1.294/2025 convertida na Lei nº 15.191/2025 (a partir de maio/2025)
    faixasIrrf: [
      { ateCentavos: 242880, aliquota: 0, parcelaDeduzirCentavos: 0 },
      { ateCentavos: 282665, aliquota: 0.075, parcelaDeduzirCentavos: 18216 },
      { ateCentavos: 375105, aliquota: 0.15, parcelaDeduzirCentavos: 39416 },
      { ateCentavos: 466468, aliquota: 0.225, parcelaDeduzirCentavos: 67549 },
      { ateCentavos: Number.POSITIVE_INFINITY, aliquota: 0.275, parcelaDeduzirCentavos: 90873 },
    ],
    deducaoDependenteCentavos: 18959,
    descontoSimplificadoIrrfCentavos: 60720,
    redutorIrrf: null,
    fonteIrrf: 'Lei nº 15.191/2025 (Receita Federal do Brasil)',
    aliquotaFgtsClt: 0.08,
    aliquotaFgtsAprendiz: 0.02,
    multaFgtsSemJustaCausa: 0.4,
    multaFgtsAcordo: 0.2,
    limiteValeTransporte: 0.06,
    fonteFgts: 'Lei nº 8.036/1990, arts. 15 e 18; CLT, art. 484 A; Lei nº 10.097/2000, art. 15, § 7º',
  },
};

export function obterParametros(ano: number = ANO_VIGENTE): ParametrosAno {
  return PARAMETROS_POR_ANO[ano] ?? PARAMETROS_POR_ANO[ANO_VIGENTE];
}
