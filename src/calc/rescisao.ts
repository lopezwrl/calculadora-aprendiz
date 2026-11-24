import { obterParametros, ParametrosAno } from '../config/parametros';
import {
  adicionarDias,
  calcularAvosDecimoTerceiroRescisao,
  calcularPeriodosEAvosFerias,
  compararDatas,
  derivarDatasContrato,
  diasCorridosInclusivos,
  formatarDataBr,
  parseData,
} from './datas';
import { formatarCentavos, formatarPercentual } from './moeda';
import {
  calcularFgtsDeposito,
  calcularInssProgressivo,
  calcularIrrf,
  calcularValeTransporte,
} from './tributos';
import {
  AvisoCalculo,
  LinhaResultado,
  ModalidadeRescisao,
  OutroDescontoItem,
  ResultadoCalculo,
  TipoContrato,
  VerbaRescisaoOpcoes,
} from './types';
import { validarSalarioPiso } from './validacao';

export interface RescisaoInput {
  dataAdmissao: string;
  dataSaida: string;
  modalidade: ModalidadeRescisao;
  salarioBaseCentavos: number;
  baseInssCentavos?: number;
  tipoContrato?: TipoContrato;
  valeTransporteAtivo?: boolean;
  valorValeTransporteMensalCentavos?: number;
  dependentes?: number;
  outrosDescontos?: OutroDescontoItem[];
  pisoCategoriaCentavos?: number;
  opcoes?: VerbaRescisaoOpcoes;
  parametros?: ParametrosAno;
}

export interface ItemPreviaVerbaRescisao {
  id: string;
  rotulo: string;
  descricaoCurta: string;
  obrigatoria: boolean;
  motivoBloqueio?: string;
  ativa: boolean;
  valorPrevistoCentavos: number;
  natureza: 'provento' | 'desconto';
}

/**
 * Calcula dias de aviso prévio proporcional conforme Lei nº 12.506/2011:
 * 30 dias mais 3 dias por ano completo de trabalho na mesma empresa, até o máximo de 90 dias.
 */
export function calcularDiasAvisoPrevio(anosCompletos: number): number {
  const anos = Math.max(0, Math.floor(anosCompletos));
  return Math.min(90, 30 + anos * 3);
}

/**
 * Calcula indenização do art. 479 da CLT para contratos por prazo determinado encerrados
 * antecipadamente pelo empregador: metade da remuneração a que teria direito até o termo final.
 */
export function calcularIndenizacaoArt479(
  salarioBaseCentavos: number,
  diasRestantes: number
): number {
  if (diasRestantes <= 0 || salarioBaseCentavos <= 0) return 0;
  return Math.round(((salarioBaseCentavos / 30) * diasRestantes) / 2);
}

export function calcularRescisao(input: RescisaoInput): ResultadoCalculo {
  const parametros = input.parametros ?? obterParametros();
  const derivacao = derivarDatasContrato(input.dataAdmissao, input.dataSaida);

  if (!derivacao.valido || !derivacao.admissao || !derivacao.saida) {
    return {
      valido: false,
      erroBloqueante: derivacao.erro ?? 'Datas de admissão e saída inválidas.',
      modo: 'rescisao',
      anoParametros: parametros.ano,
      rotuloBruto: 'Total de verbas brutas',
      totalBrutoCentavos: 0,
      totalDescontosCentavos: 0,
      valorLiquidoCentavos: 0,
      linhasProventos: [],
      linhasDescontos: [],
      linhasEncargos: [],
      avisos: [],
    };
  }

  if (!Number.isFinite(input.salarioBaseCentavos) || input.salarioBaseCentavos <= 0) {
    return {
      valido: false,
      erroBloqueante: 'Informe um salário base maior que zero.',
      modo: 'rescisao',
      anoParametros: parametros.ano,
      rotuloBruto: 'Total de verbas brutas',
      totalBrutoCentavos: 0,
      totalDescontosCentavos: 0,
      valorLiquidoCentavos: 0,
      linhasProventos: [],
      linhasDescontos: [],
      linhasEncargos: [],
      avisos: [],
    };
  }

  const salarioBase = Math.round(input.salarioBaseCentavos);
  const { admissao, saida, anosCompletos, diasTrabalhadosMesSaida, mesesEstimadosFgts } = derivacao;
  const opcoes: VerbaRescisaoOpcoes = input.opcoes ?? {};
  const tipoContrato: TipoContrato = input.tipoContrato ?? 'clt';
  const avisos: AvisoCalculo[] = [];

  const checkPiso = validarSalarioPiso({
    salarioBaseCentavos: salarioBase,
    pisoCategoriaCentavos: input.pisoCategoriaCentavos,
    parametros,
  });
  if (checkPiso.aviso) {
    avisos.push(checkPiso.aviso);
  }

  const linhasProventos: LinhaResultado[] = [];
  const linhasDescontos: LinhaResultado[] = [];
  const linhasEncargos: LinhaResultado[] = [];

  // 1. Saldo de salário (limitado a 30 dias comerciais)
  const saldoSalarioCentavos = Math.round((salarioBase * diasTrabalhadosMesSaida) / 30);
  linhasProventos.push({
    id: 'saldo-salario',
    rotulo: `Saldo de salário (${diasTrabalhadosMesSaida} dias)`,
    natureza: 'provento',
    baseCentavos: salarioBase,
    formula: `${formatarCentavos(salarioBase)} ÷ 30 × ${diasTrabalhadosMesSaida}`,
    valorCentavos: saldoSalarioCentavos,
    passos: [
      `Dias considerados no mês da saída (limitados ao mês comercial de 30 dias): ${diasTrabalhadosMesSaida}.`,
      `Cálculo: ${formatarCentavos(salarioBase)} ÷ 30 × ${diasTrabalhadosMesSaida} = ${formatarCentavos(saldoSalarioCentavos)}.`,
    ],
  });

  // 2. Aviso prévio indenizado e projeção no tempo de serviço (Lei 12.506/2011)
  const permiteAvisoIndenizado =
    input.modalidade === 'sem_justa_causa' || input.modalidade === 'acordo';
  const avisoIndenizadoAtivo =
    permiteAvisoIndenizado && (opcoes.avisoPrevioIndenizado ?? true);

  const diasAvisoPrevio = permiteAvisoIndenizado ? calcularDiasAvisoPrevio(anosCompletos) : 0;
  let avisoPrevioCentavos = 0;
  const dataSaidaProjetada =
    avisoIndenizadoAtivo && diasAvisoPrevio > 0
      ? adicionarDias(saida, diasAvisoPrevio)
      : saida;

  if (avisoIndenizadoAtivo && diasAvisoPrevio > 0) {
    const valorAvisoIntegral = Math.round((salarioBase * diasAvisoPrevio) / 30);
    avisoPrevioCentavos =
      input.modalidade === 'acordo'
        ? Math.round(valorAvisoIntegral / 2)
        : valorAvisoIntegral;

    linhasProventos.push({
      id: 'aviso-previo-indenizado',
      rotulo:
        input.modalidade === 'acordo'
          ? `Aviso prévio indenizado pela metade (${diasAvisoPrevio} dias)`
          : `Aviso prévio indenizado (${diasAvisoPrevio} dias)`,
      natureza: 'provento',
      baseCentavos: salarioBase,
      formula:
        input.modalidade === 'acordo'
          ? `(${formatarCentavos(salarioBase)} ÷ 30 × ${diasAvisoPrevio}) ÷ 2`
          : `${formatarCentavos(salarioBase)} ÷ 30 × ${diasAvisoPrevio}`,
      valorCentavos: avisoPrevioCentavos,
      passos: [
        `Anos completos trabalhados: ${anosCompletos}. Dias de aviso pela Lei 12.506/2011: 30 + (${anosCompletos} × 3) = ${diasAvisoPrevio} dias.`,
        `Projeção contratual considerada para férias e 13º até ${formatarDataBr(dataSaidaProjetada)}.`,
        input.modalidade === 'acordo'
          ? `No acordo do art. 484 A da CLT, o aviso indenizado corresponde à metade de ${formatarCentavos(valorAvisoIntegral)}: ${formatarCentavos(avisoPrevioCentavos)}.`
          : `Valor indenizado (isento de INSS e IRRF): ${formatarCentavos(avisoPrevioCentavos)}.`,
      ],
    });
  }

  // 3. 13º salário proporcional (exceto justa causa)
  let decimoTerceiroCentavos = 0;
  if (input.modalidade !== 'justa_causa') {
    const { totalAvos, avosAnoSaida, avosProjetadosAnoSeguinte } =
      calcularAvosDecimoTerceiroRescisao(admissao, saida, dataSaidaProjetada);

    if (totalAvos > 0) {
      decimoTerceiroCentavos = Math.round((salarioBase * totalAvos) / 12);
      linhasProventos.push({
        id: 'decimo-terceiro-rescisao',
        rotulo: `13º salário proporcional (${totalAvos}/12 avos)`,
        natureza: 'provento',
        baseCentavos: salarioBase,
        formula: `${formatarCentavos(salarioBase)} ÷ 12 × ${totalAvos}`,
        valorCentavos: decimoTerceiroCentavos,
        passos: [
          avosProjetadosAnoSeguinte > 0
            ? `Avos no ano da saída: ${avosAnoSaida}/12, mais ${avosProjetadosAnoSeguinte}/12 da projeção do aviso prévio.`
            : `Meses com 15 dias ou mais no ano da rescisão (incluindo aviso projetado quando aplicável): ${totalAvos}/12.`,
          `Cálculo: ${formatarCentavos(salarioBase)} ÷ 12 × ${totalAvos} = ${formatarCentavos(decimoTerceiroCentavos)}.`,
        ],
      });
    }
  }

  // 4. Férias vencidas + 1/3 (quando ativadas)
  if (opcoes.feriasVencidas) {
    const multiplicadorDobro = opcoes.feriasVencidasEmDobro ? 2 : 1;
    const baseFeriasVencidas = salarioBase * multiplicadorDobro;
    const tercoVencidas = Math.round(baseFeriasVencidas / 3);
    const totalFeriasVencidas = baseFeriasVencidas + tercoVencidas;

    linhasProventos.push({
      id: 'ferias-vencidas',
      rotulo: opcoes.feriasVencidasEmDobro
        ? 'Férias vencidas em dobro + 1/3 constitucional'
        : 'Férias vencidas + 1/3 constitucional',
      natureza: 'provento',
      baseCentavos: baseFeriasVencidas,
      formula: `${formatarCentavos(baseFeriasVencidas)} + (${formatarCentavos(baseFeriasVencidas)} ÷ 3)`,
      valorCentavos: totalFeriasVencidas,
      passos: [
        opcoes.feriasVencidasEmDobro
          ? `Período concessivo expirado (art. 137 da CLT): base em dobro de ${formatarCentavos(baseFeriasVencidas)}.`
          : `Período aquisitivo completo não gozado: ${formatarCentavos(baseFeriasVencidas)}.`,
        `Adicional de 1/3 constitucional: ${formatarCentavos(tercoVencidas)}.`,
        `Total indenizado (isento de INSS e IRRF): ${formatarCentavos(totalFeriasVencidas)}.`,
      ],
    });
  }

  // 5. Férias proporcionais + 1/3 (todas as modalidades exceto justa causa)
  if (input.modalidade !== 'justa_causa') {
    const { periodosCompletos, avosProporcionais } = calcularPeriodosEAvosFerias(
      admissao,
      dataSaidaProjetada
    );
    // Caso tenha acabado de completar exatamente 12 meses na data de saída e não tenha marcado férias vencidas separadas,
    // garante os 12/12 adquiridos na rescisão caso periodosCompletos >= 1 e avosProporcionais === 0 e !opcoes.feriasVencidas
    const avosDevidos =
      avosProporcionais === 0 && periodosCompletos >= 1 && !opcoes.feriasVencidas
        ? 12
        : avosProporcionais;

    if (avosDevidos > 0) {
      const feriasPropBase = Math.round((salarioBase * avosDevidos) / 12);
      const tercoProp = Math.round(feriasPropBase / 3);
      const totalFeriasProp = feriasPropBase + tercoProp;

      linhasProventos.push({
        id: 'ferias-proporcionais',
        rotulo: `Férias proporcionais (${avosDevidos}/12) + 1/3`,
        natureza: 'provento',
        baseCentavos: feriasPropBase,
        formula: `(${formatarCentavos(salarioBase)} ÷ 12 × ${avosDevidos}) + 1/3`,
        valorCentavos: totalFeriasProp,
        passos: [
          `Avos contados desde o último aniversário de admissão (fração igual ou superior a 15 dias): ${avosDevidos}/12.`,
          `Férias proporcionais: ${formatarCentavos(feriasPropBase)}.`,
          `Terço constitucional: ${formatarCentavos(tercoProp)}.`,
          `Total indenizado (isento de INSS e IRRF): ${formatarCentavos(totalFeriasProp)}.`,
        ],
      });
    }
  }

  // 6. Indenização do art. 479 da CLT (exclusiva para término antecipado de contrato por prazo determinado)
  if (input.modalidade === 'termino_contrato' && opcoes.encerradoAntesDoPrazo) {
    const dataPrevista = parseData(opcoes.dataFimPrevistaContrato);
    if (dataPrevista && compararDatas(dataPrevista, saida) > 0) {
      const dataDiaSeguinte = adicionarDias(saida, 1);
      const diasRestantes = diasCorridosInclusivos(dataDiaSeguinte, dataPrevista);
      const valorArt479 = calcularIndenizacaoArt479(salarioBase, diasRestantes);

      if (valorArt479 > 0) {
        linhasProventos.push({
          id: 'indenizacao-art-479',
          rotulo: `Indenização art. 479 da CLT (${diasRestantes} dias restantes)`,
          natureza: 'provento',
          baseCentavos: salarioBase,
          formula: `(${formatarCentavos(salarioBase)} ÷ 30 × ${diasRestantes}) ÷ 2`,
          valorCentavos: valorArt479,
          passos: [
            `Contrato por prazo determinado encerrado antes de ${formatarDataBr(dataPrevista)}.`,
            `Dias restantes até o termo final: ${diasRestantes} dias.`,
            `Metade da remuneração restante devida por indenização: ${formatarCentavos(valorArt479)}.`,
          ],
        });
      }
    }
  }

  // 7. FGTS sobre verbas rescisórias e Multa do FGTS (40% sem justa causa, 20% no acordo, 0% nas demais)
  const baseFgtsRescisao = saldoSalarioCentavos + decimoTerceiroCentavos + avisoPrevioCentavos;
  const fgtsRescisao = calcularFgtsDeposito(baseFgtsRescisao, tipoContrato, parametros);
  linhasEncargos.push({
    id: 'fgts-verbas-rescisao',
    rotulo: `FGTS sobre a rescisão (${fgtsRescisao.aliquotaTexto})`,
    natureza: 'encargo',
    baseCentavos: baseFgtsRescisao,
    aliquotaTexto: fgtsRescisao.aliquotaTexto,
    formula: fgtsRescisao.formulaLegivel,
    valorCentavos: fgtsRescisao.valorCentavos,
    passos: fgtsRescisao.passos,
  });

  const fgtsMensalEstimado = Math.round(salarioBase * fgtsRescisao.aliquota);
  const saldoInformado =
    opcoes.saldoFgtsInformadoCentavos !== undefined && opcoes.saldoFgtsInformadoCentavos > 0
      ? Math.round(opcoes.saldoFgtsInformadoCentavos)
      : null;

  const saldoFgtsBaseMulta =
    saldoInformado ?? mesesEstimadosFgts * fgtsMensalEstimado + fgtsRescisao.valorCentavos;
  const saldoEhEstimado = saldoInformado === null;

  linhasEncargos.push({
    id: 'saldo-fgts-base',
    rotulo: saldoEhEstimado ? 'Saldo de FGTS acumulado (estimativa)' : 'Saldo de FGTS informado',
    natureza: 'encargo',
    baseCentavos: salarioBase,
    aliquotaTexto: fgtsRescisao.aliquotaTexto,
    formula: saldoEhEstimado
      ? `${mesesEstimadosFgts} meses × ${formatarCentavos(fgtsMensalEstimado)} + FGTS rescisório`
      : `Saldo informado pelo usuário: ${formatarCentavos(saldoFgtsBaseMulta)}`,
    valorCentavos: saldoFgtsBaseMulta,
    estimativa: saldoEhEstimado,
    passos: saldoEhEstimado
      ? [
          `Depósito mensal estimado (${fgtsRescisao.aliquotaTexto}): ${formatarCentavos(fgtsMensalEstimado)}.`,
          `Multiplicado por ${mesesEstimadosFgts} meses de contrato mais o FGTS da rescisão: ${formatarCentavos(saldoFgtsBaseMulta)}.`,
          'Consulte o extrato oficial da Caixa Econômica Federal para o saldo exato.',
        ]
      : [`Saldo de FGTS informado diretamente para cálculo da multa: ${formatarCentavos(saldoFgtsBaseMulta)}.`],
  });

  const aliquotaMultaFgts =
    input.modalidade === 'sem_justa_causa'
      ? parametros.multaFgtsSemJustaCausa
      : input.modalidade === 'acordo'
        ? parametros.multaFgtsAcordo
        : 0;

  if (aliquotaMultaFgts > 0) {
    const valorMultaFgts = Math.round(saldoFgtsBaseMulta * aliquotaMultaFgts);
    const pctMulta = formatarPercentual(aliquotaMultaFgts);
    linhasProventos.push({
      id: 'multa-fgts',
      rotulo: saldoEhEstimado
        ? `Multa de ${pctMulta} do FGTS (estimativa)`
        : `Multa de ${pctMulta} do FGTS`,
      natureza: 'provento',
      baseCentavos: saldoFgtsBaseMulta,
      aliquotaTexto: pctMulta,
      formula: `${formatarCentavos(saldoFgtsBaseMulta)} × ${pctMulta}`,
      valorCentavos: valorMultaFgts,
      estimativa: saldoEhEstimado,
      passos: [
        `Base do FGTS considerada (${saldoEhEstimado ? 'estimada' : 'informada'}): ${formatarCentavos(saldoFgtsBaseMulta)}.`,
        `Alíquota da modalidade (${pctMulta}): ${formatarCentavos(valorMultaFgts)}.`,
        'Verba indenizatória depositada pela empresa, isenta de INSS e IRRF.',
      ],
    });
  }

  // 8. Descontos trabalhistas e tributários separados (saldo de salário e 13º tributados separadamente)
  const baseInssSaldo =
    input.baseInssCentavos !== undefined &&
    input.baseInssCentavos > 0 &&
    input.baseInssCentavos !== salarioBase &&
    diasTrabalhadosMesSaida === 30
      ? Math.round(input.baseInssCentavos)
      : saldoSalarioCentavos;

  const inssSaldo = calcularInssProgressivo(baseInssSaldo, parametros);
  if (inssSaldo.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'inss-saldo-salario',
      rotulo: 'INSS sobre saldo de salário',
      natureza: 'desconto',
      baseCentavos: inssSaldo.baseConsideradaCentavos,
      aliquotaTexto: inssSaldo.aliquotaTexto,
      formula: inssSaldo.formulaLegivel,
      valorCentavos: inssSaldo.valorCentavos,
      passos: [
        'Aplicado exclusivamente sobre o saldo de salário (férias indenizadas e aviso indenizado são isentos).',
        ...inssSaldo.passos,
      ],
    });
  }

  if (decimoTerceiroCentavos > 0) {
    const inss13 = calcularInssProgressivo(decimoTerceiroCentavos, parametros);
    if (inss13.valorCentavos > 0) {
      linhasDescontos.push({
        id: 'inss-13-rescisao',
        rotulo: 'INSS sobre 13º proporcional',
        natureza: 'desconto',
        baseCentavos: inss13.baseConsideradaCentavos,
        aliquotaTexto: inss13.aliquotaTexto,
        formula: inss13.formulaLegivel,
        valorCentavos: inss13.valorCentavos,
        passos: [
          'Apurado em separado sobre o 13º salário proporcional.',
          ...inss13.passos,
        ],
      });
    }

    const irrf13 = calcularIrrf(
      decimoTerceiroCentavos,
      inss13.valorCentavos,
      input.dependentes ?? 0,
      parametros
    );
    if (irrf13.valorCentavos > 0) {
      linhasDescontos.push({
        id: 'irrf-13-rescisao',
        rotulo: 'IRRF sobre 13º proporcional',
        natureza: 'desconto',
        baseCentavos: irrf13.baseCalculoCentavos,
        aliquotaTexto: irrf13.aliquotaTexto,
        formula: irrf13.formulaLegivel,
        valorCentavos: irrf13.valorCentavos,
        passos: ['Tributação exclusiva na fonte sobre o 13º salário.', ...irrf13.passos],
      });
    }
  }

  const irrfSaldo = calcularIrrf(
    saldoSalarioCentavos,
    inssSaldo.valorCentavos,
    input.dependentes ?? 0,
    parametros
  );
  if (irrfSaldo.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'irrf-saldo-salario',
      rotulo: 'IRRF sobre saldo de salário',
      natureza: 'desconto',
      baseCentavos: irrfSaldo.baseCalculoCentavos,
      aliquotaTexto: irrfSaldo.aliquotaTexto,
      formula: irrfSaldo.formulaLegivel,
      valorCentavos: irrfSaldo.valorCentavos,
      passos: irrfSaldo.passos,
    });
  }

  const vt = calcularValeTransporte(
    salarioBase,
    diasTrabalhadosMesSaida,
    Boolean(input.valeTransporteAtivo),
    input.valorValeTransporteMensalCentavos ?? 0,
    parametros.limiteValeTransporte
  );
  if (vt.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'vt-rescisao',
      rotulo: 'Vale-transporte proporcional',
      natureza: 'desconto',
      baseCentavos: vt.baseProporcionalCentavos,
      aliquotaTexto: vt.aliquotaTexto,
      formula: vt.formulaLegivel,
      valorCentavos: vt.valorCentavos,
      passos: vt.passos,
    });
  }

  if (input.modalidade === 'pedido_demissao' && opcoes.descontarAvisoNaoTrabalhado) {
    linhasDescontos.push({
      id: 'desconto-aviso-nao-cumprido',
      rotulo: 'Aviso prévio não trabalhado',
      natureza: 'desconto',
      baseCentavos: salarioBase,
      aliquotaTexto: '30 dias',
      formula: `${formatarCentavos(salarioBase)} (1 salário base, art. 487 § 2º da CLT)`,
      valorCentavos: salarioBase,
      passos: [
        'Desconto aplicável no pedido de demissão quando o trabalhador não cumpre o aviso prévio e não obtém dispensa formal.',
      ],
    });
  }

  (input.outrosDescontos ?? []).forEach((item, idx) => {
    const val = Math.max(0, Math.round(item.valorCentavos));
    if (val > 0) {
      const desc = item.descricao.trim() || 'Outros descontos';
      linhasDescontos.push({
        id: `outro-desconto-rescisao-${idx}`,
        rotulo: desc,
        natureza: 'desconto',
        baseCentavos: saldoSalarioCentavos,
        aliquotaTexto: 'Valor fixo',
        formula: `Desconto informado: ${formatarCentavos(val)}`,
        valorCentavos: val,
        passos: [`Desconto informado manualmente: ${formatarCentavos(val)}.`],
      });
    }
  });

  const totalBrutoCentavos = linhasProventos.reduce((acc, l) => acc + l.valorCentavos, 0);
  const totalDescontosCentavos = linhasDescontos.reduce((acc, l) => acc + l.valorCentavos, 0);
  const valorLiquidoCentavos = Math.max(0, totalBrutoCentavos - totalDescontosCentavos);

  return {
    valido: true,
    modo: 'rescisao',
    anoParametros: parametros.ano,
    rotuloBruto: 'Total de verbas brutas',
    totalBrutoCentavos,
    totalDescontosCentavos,
    valorLiquidoCentavos,
    linhasProventos,
    linhasDescontos,
    linhasEncargos,
    avisos,
  };
}

/**
 * Gera a lista de verbas configuráveis para a Etapa 2 da rescisão, indicando quais são
 * obrigatórias (ativadas e bloqueadas) e os valores previstos em tempo real.
 */
export function listarVerbasEtapaRescisao(input: RescisaoInput): ItemPreviaVerbaRescisao[] {
  const resultado = calcularRescisao(input);
  const opcoes = input.opcoes ?? {};
  const salario = Math.max(0, Math.round(input.salarioBaseCentavos));
  const derivacao = derivarDatasContrato(input.dataAdmissao, input.dataSaida);
  const anos = derivacao.valido ? derivacao.anosCompletos : 0;
  const diasAviso = calcularDiasAvisoPrevio(anos);

  const encontrarValor = (id: string) =>
    resultado.linhasProventos.find((l) => l.id === id)?.valorCentavos ??
    resultado.linhasDescontos.find((l) => l.id === id)?.valorCentavos ??
    0;

  const itens: ItemPreviaVerbaRescisao[] = [
    {
      id: 'saldo-salario',
      rotulo: 'Saldo de salário',
      descricaoCurta: 'Dias efetivamente trabalhados no mês do desligamento.',
      obrigatoria: true,
      motivoBloqueio: 'Verba obrigatória em qualquer modalidade de rescisão.',
      ativa: true,
      valorPrevistoCentavos: encontrarValor('saldo-salario'),
      natureza: 'provento',
    },
  ];

  if (input.modalidade !== 'justa_causa') {
    itens.push({
      id: 'decimo-terceiro-rescisao',
      rotulo: '13º salário proporcional',
      descricaoCurta: 'Proporcional aos meses com 15 dias ou mais no ano.',
      obrigatoria: true,
      motivoBloqueio: 'Direito obrigatório nesta modalidade de desligamento.',
      ativa: true,
      valorPrevistoCentavos: encontrarValor('decimo-terceiro-rescisao'),
      natureza: 'provento',
    });

    itens.push({
      id: 'ferias-proporcionais',
      rotulo: 'Férias proporcionais + 1/3',
      descricaoCurta: 'Avos contados desde o último aniversário da admissão.',
      obrigatoria: true,
      motivoBloqueio: 'Direito obrigatório nesta modalidade conforme a CLT.',
      ativa: true,
      valorPrevistoCentavos: encontrarValor('ferias-proporcionais'),
      natureza: 'provento',
    });
  }

  if (input.modalidade === 'sem_justa_causa' || input.modalidade === 'acordo') {
    const valorIntegralAviso = Math.round((salario * diasAviso) / 30);
    const previstoAviso =
      input.modalidade === 'acordo' ? Math.round(valorIntegralAviso / 2) : valorIntegralAviso;

    itens.push({
      id: 'avisoPrevioIndenizado',
      rotulo:
        input.modalidade === 'acordo'
          ? `Aviso prévio indenizado pela metade (${diasAviso} dias)`
          : `Aviso prévio indenizado (${diasAviso} dias)`,
      descricaoCurta: 'Desative caso o aviso prévio tenha sido cumprido trabalhando.',
      obrigatoria: false,
      ativa: opcoes.avisoPrevioIndenizado ?? true,
      valorPrevistoCentavos: previstoAviso,
      natureza: 'provento',
    });

    itens.push({
      id: 'multa-fgts',
      rotulo:
        input.modalidade === 'acordo' ? 'Multa de 20% do FGTS' : 'Multa de 40% do FGTS',
      descricaoCurta: 'Calculada sobre o saldo acumulado ou informado do FGTS.',
      obrigatoria: true,
      motivoBloqueio:
        input.modalidade === 'acordo'
          ? 'Indenização obrigatória prevista no art. 484 A da CLT.'
          : 'Indenização obrigatória na dispensa sem justa causa.',
      ativa: true,
      valorPrevistoCentavos: encontrarValor('multa-fgts'),
      natureza: 'provento',
    });
  }

  if (input.modalidade === 'pedido_demissao') {
    itens.push({
      id: 'descontarAvisoNaoTrabalhado',
      rotulo: 'Desconto de aviso prévio não cumprido',
      descricaoCurta: 'Ative apenas se a empresa descontar os 30 dias não trabalhados.',
      obrigatoria: false,
      ativa: Boolean(opcoes.descontarAvisoNaoTrabalhado),
      valorPrevistoCentavos: salario,
      natureza: 'desconto',
    });
  }

  itens.push({
    id: 'feriasVencidas',
    rotulo: 'Férias vencidas + 1/3 constitucional',
    descricaoCurta: 'Ative se houver período aquisitivo de 12 meses ainda não gozado.',
    obrigatoria: false,
    ativa: Boolean(opcoes.feriasVencidas),
    valorPrevistoCentavos: salario + Math.round(salario / 3),
    natureza: 'provento',
  });

  if (opcoes.feriasVencidas) {
    itens.push({
      id: 'feriasVencidasEmDobro',
      rotulo: 'Pagamento em dobro das férias vencidas',
      descricaoCurta: 'Ative se já expirou o segundo período de 12 meses sem concessão.',
      obrigatoria: false,
      ativa: Boolean(opcoes.feriasVencidasEmDobro),
      valorPrevistoCentavos: salario * 2 + Math.round((salario * 2) / 3),
      natureza: 'provento',
    });
  }

  if (input.modalidade === 'termino_contrato' && opcoes.encerradoAntesDoPrazo) {
    itens.push({
      id: 'indenizacao-art-479',
      rotulo: 'Indenização do art. 479 da CLT',
      descricaoCurta: 'Metade dos salários devidos até a data final prevista do contrato.',
      obrigatoria: true,
      motivoBloqueio: 'Devida na rescisão antecipada sem justa causa de contrato a termo.',
      ativa: true,
      valorPrevistoCentavos: encontrarValor('indenizacao-art-479'),
      natureza: 'provento',
    });
  }

  return itens;
}
