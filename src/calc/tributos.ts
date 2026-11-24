import { ParametrosAno } from '../config/parametros';
import { formatarCentavos, formatarPercentual } from './moeda';

export interface FaixaCalculadaInss {
  faixa: number;
  limiteInferiorCentavos: number;
  limiteSuperiorCentavos: number;
  baseFatiaCentavos: number;
  aliquota: number;
  valorCentavos: number;
}

export interface ResultadoInss {
  valorCentavos: number;
  baseInformadaCentavos: number;
  baseConsideradaCentavos: number;
  aliquotaEfetiva: number;
  aliquotaTexto: string;
  formulaLegivel: string;
  detalhamentoFaixas: FaixaCalculadaInss[];
  passos: string[];
}

export function calcularInssProgressivo(
  baseCentavos: number,
  parametros: ParametrosAno
): ResultadoInss {
  const baseLimpa = Math.max(0, Math.round(baseCentavos));
  const baseConsiderada = Math.min(baseLimpa, parametros.tetoInssCentavos);

  if (baseConsiderada === 0) {
    return {
      valorCentavos: 0,
      baseInformadaCentavos: baseLimpa,
      baseConsideradaCentavos: 0,
      aliquotaEfetiva: 0,
      aliquotaTexto: '0%',
      formulaLegivel: 'R$ 0,00 × 0%',
      detalhamentoFaixas: [],
      passos: ['Base de contribuição igual a zero, sem incidência de INSS.'],
    };
  }

  let limiteAnterior = 0;
  let somaExata = 0;
  const detalhamentoFaixas: FaixaCalculadaInss[] = [];
  const passos: string[] = [];

  if (baseLimpa > parametros.tetoInssCentavos) {
    passos.push(
      `Base informada (${formatarCentavos(baseLimpa)}) limitada ao teto previdenciário de ${formatarCentavos(parametros.tetoInssCentavos)}.`
    );
  } else {
    passos.push(`Base de cálculo do INSS: ${formatarCentavos(baseConsiderada)}.`);
  }

  parametros.faixasInss.forEach((faixa, idx) => {
    if (baseConsiderada <= limiteAnterior) return;
    const tetoFaixa = Math.min(baseConsiderada, faixa.ateCentavos);
    const fatia = tetoFaixa - limiteAnterior;
    const contribuicaoExata = fatia * faixa.aliquota;
    somaExata += contribuicaoExata;

    const valorFatiaArredondado = Math.round(contribuicaoExata);
    detalhamentoFaixas.push({
      faixa: idx + 1,
      limiteInferiorCentavos: limiteAnterior,
      limiteSuperiorCentavos: faixa.ateCentavos,
      baseFatiaCentavos: fatia,
      aliquota: faixa.aliquota,
      valorCentavos: valorFatiaArredondado,
    });

    passos.push(
      `Faixa ${idx + 1} (${formatarPercentual(faixa.aliquota)}): ${formatarCentavos(fatia)} × ${formatarPercentual(faixa.aliquota)} = ${formatarCentavos(valorFatiaArredondado)}.`
    );

    limiteAnterior = faixa.ateCentavos;
  });

  const valorCentavos = Math.round(somaExata);
  const aliquotaEfetiva = valorCentavos / baseConsiderada;

  let aliquotaTexto: string;
  let formulaLegivel: string;

  if (detalhamentoFaixas.length === 1) {
    aliquotaTexto = formatarPercentual(detalhamentoFaixas[0].aliquota);
    formulaLegivel = `${formatarCentavos(baseConsiderada)} × ${aliquotaTexto}`;
  } else {
    aliquotaTexto = formatarPercentual(aliquotaEfetiva);
    formulaLegivel = `Progressivo sobre ${formatarCentavos(baseConsiderada)} (efetiva ${aliquotaTexto})`;
    passos.push(`Total do INSS após soma progressiva das faixas: ${formatarCentavos(valorCentavos)}.`);
  }

  return {
    valorCentavos,
    baseInformadaCentavos: baseLimpa,
    baseConsideradaCentavos: baseConsiderada,
    aliquotaEfetiva,
    aliquotaTexto,
    formulaLegivel,
    detalhamentoFaixas,
    passos,
  };
}

export interface ResultadoIrrf {
  valorCentavos: number;
  rendimentoTributavelCentavos: number;
  deducaoDependentesCentavos: number;
  deducoesLegaisCentavos: number;
  deducaoUtilizadaCentavos: number;
  usouDescontoSimplificado: boolean;
  baseCalculoCentavos: number;
  aliquotaFaixa: number;
  aliquotaTexto: string;
  impostoAntesRedutorCentavos: number;
  redutorAplicadoCentavos: number;
  formulaLegivel: string;
  passos: string[];
}

export function calcularIrrf(
  rendimentoTributavelCentavos: number,
  inssDedutivelCentavos: number,
  dependentes: number,
  parametros: ParametrosAno
): ResultadoIrrf {
  const rendimento = Math.max(0, Math.round(rendimentoTributavelCentavos));
  const inss = Math.max(0, Math.round(inssDedutivelCentavos));
  const qtdDependentes = Math.max(0, Math.floor(dependentes || 0));

  const deducaoDependentesCentavos = qtdDependentes * parametros.deducaoDependenteCentavos;
  const deducoesLegaisCentavos = inss + deducaoDependentesCentavos;
  const usouDescontoSimplificado =
    parametros.descontoSimplificadoIrrfCentavos > deducoesLegaisCentavos;
  const deducaoUtilizadaCentavos = Math.max(
    deducoesLegaisCentavos,
    parametros.descontoSimplificadoIrrfCentavos
  );

  const baseCalculoCentavos = Math.max(0, rendimento - deducaoUtilizadaCentavos);
  const passos: string[] = [
    `Rendimento tributável: ${formatarCentavos(rendimento)}.`,
  ];

  if (usouDescontoSimplificado) {
    passos.push(
      `Dedução aplicada: desconto simplificado mensal de ${formatarCentavos(parametros.descontoSimplificadoIrrfCentavos)}, mais vantajoso que as deduções legais (${formatarCentavos(deducoesLegaisCentavos)}).`
    );
  } else {
    passos.push(
      `Deduções legais aplicadas: INSS (${formatarCentavos(inss)}) mais ${qtdDependentes} dependente(s) (${formatarCentavos(deducaoDependentesCentavos)}) = ${formatarCentavos(deducoesLegaisCentavos)}.`
    );
  }

  passos.push(`Base de cálculo apurada: ${formatarCentavos(baseCalculoCentavos)}.`);

  const faixa =
    parametros.faixasIrrf.find((f) => baseCalculoCentavos <= f.ateCentavos) ??
    parametros.faixasIrrf[parametros.faixasIrrf.length - 1];

  const impostoAntesRedutorCentavos =
    faixa.aliquota === 0
      ? 0
      : Math.max(0, Math.round(baseCalculoCentavos * faixa.aliquota) - faixa.parcelaDeduzirCentavos);

  if (faixa.aliquota === 0) {
    passos.push('Base situada na faixa de isenção da tabela progressiva.');
  } else {
    passos.push(
      `Tabela progressiva (${formatarPercentual(faixa.aliquota)}): ${formatarCentavos(baseCalculoCentavos)} × ${formatarPercentual(faixa.aliquota)} menos ${formatarCentavos(faixa.parcelaDeduzirCentavos)} = ${formatarCentavos(impostoAntesRedutorCentavos)}.`
    );
  }

  let redutorAplicadoCentavos = 0;
  let valorCentavos = impostoAntesRedutorCentavos;

  if (impostoAntesRedutorCentavos > 0 && parametros.redutorIrrf) {
    const red = parametros.redutorIrrf;
    if (rendimento <= red.limiteIsencaoTotalCentavos) {
      redutorAplicadoCentavos = Math.min(
        impostoAntesRedutorCentavos,
        red.reducaoMaximaIsencaoCentavos
      );
      valorCentavos = Math.max(0, impostoAntesRedutorCentavos - redutorAplicadoCentavos);
      passos.push(
        `Redutor mensal aplicado (${formatarCentavos(redutorAplicadoCentavos)}) para rendimentos até ${formatarCentavos(red.limiteIsencaoTotalCentavos)}: imposto final ${formatarCentavos(valorCentavos)}.`
      );
    } else if (rendimento <= red.limiteReducaoParcialCentavos) {
      const redutorCalculado = Math.max(
        0,
        Math.round(red.constanteFormulaCentavos - red.coeficienteFormula * rendimento)
      );
      redutorAplicadoCentavos = Math.min(impostoAntesRedutorCentavos, redutorCalculado);
      valorCentavos = Math.max(0, impostoAntesRedutorCentavos - redutorAplicadoCentavos);
      passos.push(
        `Redutor parcial aplicado (${formatarCentavos(redutorAplicadoCentavos)}): ${formatarCentavos(impostoAntesRedutorCentavos)} menos ${formatarCentavos(redutorAplicadoCentavos)} = ${formatarCentavos(valorCentavos)}.`
      );
    }
  }

  const aliquotaTexto = valorCentavos === 0 ? 'Isento' : formatarPercentual(faixa.aliquota);
  let formulaLegivel = 'Isento na faixa vigente';
  if (valorCentavos > 0) {
    if (redutorAplicadoCentavos > 0) {
      formulaLegivel = `${formatarCentavos(baseCalculoCentavos)} × ${formatarPercentual(faixa.aliquota)} menos deduções e redutor`;
    } else {
      formulaLegivel = `${formatarCentavos(baseCalculoCentavos)} × ${formatarPercentual(faixa.aliquota)} menos ${formatarCentavos(faixa.parcelaDeduzirCentavos)}`;
    }
  }

  return {
    valorCentavos,
    rendimentoTributavelCentavos: rendimento,
    deducaoDependentesCentavos,
    deducoesLegaisCentavos,
    deducaoUtilizadaCentavos,
    usouDescontoSimplificado,
    baseCalculoCentavos,
    aliquotaFaixa: faixa.aliquota,
    aliquotaTexto,
    impostoAntesRedutorCentavos,
    redutorAplicadoCentavos,
    formulaLegivel,
    passos,
  };
}

export interface ResultadoValeTransporte {
  valorCentavos: number;
  baseProporcionalCentavos: number;
  limiteLegalCentavos: number;
  limitadoAoFornecido: boolean;
  aliquotaTexto: string;
  formulaLegivel: string;
  passos: string[];
}

export function calcularValeTransporte(
  salarioBaseCentavos: number,
  diasTrabalhados: number,
  ativado: boolean,
  valorFornecidoCentavos: number,
  limitePercentual = 0.06
): ResultadoValeTransporte {
  if (!ativado || salarioBaseCentavos <= 0 || diasTrabalhados <= 0 || valorFornecidoCentavos <= 0) {
    return {
      valorCentavos: 0,
      baseProporcionalCentavos: 0,
      limiteLegalCentavos: 0,
      limitadoAoFornecido: false,
      aliquotaTexto: '0%',
      formulaLegivel: 'Não optante',
      passos: ['Vale-transporte desativado ou sem valor mensal fornecido.'],
    };
  }

  const dias = Math.min(30, Math.max(0, Math.floor(diasTrabalhados)));
  const baseProporcionalCentavos =
    dias >= 30 ? salarioBaseCentavos : Math.round((salarioBaseCentavos * dias) / 30);
  const limiteLegalCentavos = Math.round(baseProporcionalCentavos * limitePercentual);
  const beneficio = Math.max(0, Math.round(valorFornecidoCentavos));
  const valorCentavos = Math.min(limiteLegalCentavos, beneficio);
  const limitadoAoFornecido = beneficio < limiteLegalCentavos;

  const pctTexto = formatarPercentual(limitePercentual);
  const passos: string[] = [];

  if (dias < 30) {
    passos.push(
      `Salário proporcional a ${dias} dias trabalhados: ${formatarCentavos(salarioBaseCentavos)} ÷ 30 × ${dias} = ${formatarCentavos(baseProporcionalCentavos)}.`
    );
  } else {
    passos.push(`Base salarial integral considerada: ${formatarCentavos(baseProporcionalCentavos)}.`);
  }

  passos.push(
    `Limite legal de ${pctTexto}: ${formatarCentavos(baseProporcionalCentavos)} × ${pctTexto} = ${formatarCentavos(limiteLegalCentavos)}.`
  );

  if (limitadoAoFornecido) {
    passos.push(
      `Valor fornecido pela empresa (${formatarCentavos(beneficio)}) é inferior a ${pctTexto} do salário. Desconto limitado a ${formatarCentavos(valorCentavos)}.`
    );
  } else {
    passos.push(
      `Valor fornecido (${formatarCentavos(beneficio)}) supera o teto de ${pctTexto}. Desconto fixado em ${formatarCentavos(valorCentavos)}.`
    );
  }

  const formulaLegivel = limitadoAoFornecido
    ? `Limitado ao benefício fornecido (${formatarCentavos(beneficio)})`
    : `${formatarCentavos(baseProporcionalCentavos)} × ${pctTexto}`;

  return {
    valorCentavos,
    baseProporcionalCentavos,
    limiteLegalCentavos,
    limitadoAoFornecido,
    aliquotaTexto: limitadoAoFornecido ? 'Teto do benefício' : pctTexto,
    formulaLegivel,
    passos,
  };
}

export function calcularFgtsDeposito(
  baseRemuneracaoCentavos: number,
  tipoContrato: 'clt' | 'aprendiz',
  parametros: ParametrosAno
): { valorCentavos: number; aliquota: number; aliquotaTexto: string; formulaLegivel: string; passos: string[] } {
  const base = Math.max(0, Math.round(baseRemuneracaoCentavos));
  const aliquota =
    tipoContrato === 'aprendiz' ? parametros.aliquotaFgtsAprendiz : parametros.aliquotaFgtsClt;
  const aliquotaTexto = formatarPercentual(aliquota);
  const valorCentavos = Math.round(base * aliquota);

  return {
    valorCentavos,
    aliquota,
    aliquotaTexto,
    formulaLegivel: `${formatarCentavos(base)} × ${aliquotaTexto}`,
    passos: [
      `Base de FGTS considerada: ${formatarCentavos(base)}.`,
      `Alíquota aplicável (${tipoContrato === 'aprendiz' ? 'contrato de aprendizagem, Lei 10.097/2000' : 'contrato CLT padrão, Lei 8.036/1990'}): ${aliquotaTexto}.`,
      `Encargo depositado pela empresa, sem desconto do trabalhador: ${formatarCentavos(valorCentavos)}.`,
    ],
  };
}
