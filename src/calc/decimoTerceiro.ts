import { obterParametros, ParametrosAno } from '../config/parametros';
import { calcularAvosNoAno, parseData } from './datas';
import { formatarCentavos } from './moeda';
import { calcularFgtsDeposito, calcularInssProgressivo, calcularIrrf } from './tributos';
import {
  AvisoCalculo,
  LinhaResultado,
  OutroDescontoItem,
  ResultadoCalculo,
  TipoContrato,
} from './types';
import { validarSalarioPiso } from './validacao';

export interface DecimoTerceiroInput {
  dataAdmissao: string;
  anoReferencia?: number;
  /** Quando informado, usa diretamente a quantidade de avos (1 a 12). Caso omitido, deriva pela data de admissão no ano. */
  mesesTrabalhados?: number;
  salarioBaseCentavos: number;
  /** Caso exista ajuste específico na base do INSS do 13º; por padrão utiliza o próprio bruto proporcional do 13º. */
  baseInssCentavos?: number;
  tipoContrato?: TipoContrato;
  dependentes?: number;
  outrosDescontos?: OutroDescontoItem[];
  pisoCategoriaCentavos?: number;
  parametros?: ParametrosAno;
}

export function calcularDecimoTerceiro(input: DecimoTerceiroInput): ResultadoCalculo {
  const parametros = input.parametros ?? obterParametros();
  const admissao = parseData(input.dataAdmissao);

  if (!admissao) {
    return {
      valido: false,
      erroBloqueante: 'Informe uma data de admissão válida para calcular o décimo terceiro.',
      modo: 'decimo_terceiro',
      anoParametros: parametros.ano,
      rotuloBruto: 'Décimo terceiro bruto',
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
      modo: 'decimo_terceiro',
      anoParametros: parametros.ano,
      rotuloBruto: 'Décimo terceiro bruto',
      totalBrutoCentavos: 0,
      totalDescontosCentavos: 0,
      valorLiquidoCentavos: 0,
      linhasProventos: [],
      linhasDescontos: [],
      linhasEncargos: [],
      avisos: [],
    };
  }

  const anoRef = input.anoReferencia ?? parametros.ano;
  const fimDoAno = { dia: 31, mes: 12, ano: anoRef };

  const avos =
    input.mesesTrabalhados !== undefined
      ? Math.min(12, Math.max(0, Math.floor(input.mesesTrabalhados)))
      : calcularAvosNoAno(admissao, fimDoAno, anoRef);

  if (avos <= 0) {
    return {
      valido: false,
      erroBloqueante: 'Nenhum mês com 15 dias ou mais trabalhados no ano selecionado.',
      modo: 'decimo_terceiro',
      anoParametros: parametros.ano,
      rotuloBruto: 'Décimo terceiro bruto',
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
  const valorPorAvoExato = salarioBase / 12;
  const valorPorAvoExibicao = Math.round(valorPorAvoExato);
  const brutoDecimoCentavos = Math.round((salarioBase * avos) / 12);

  const avisos: AvisoCalculo[] = [];
  const checkPiso = validarSalarioPiso({
    salarioBaseCentavos: salarioBase,
    pisoCategoriaCentavos: input.pisoCategoriaCentavos,
    parametros,
  });
  if (checkPiso.aviso) {
    avisos.push(checkPiso.aviso);
  }

  const baseInss13 =
    input.baseInssCentavos !== undefined && input.baseInssCentavos > 0
      ? Math.round((input.baseInssCentavos * avos) / 12)
      : brutoDecimoCentavos;

  const inss = calcularInssProgressivo(baseInss13, parametros);
  const irrf = calcularIrrf(
    brutoDecimoCentavos,
    inss.valorCentavos,
    input.dependentes ?? 0,
    parametros
  );

  const linhasProventos: LinhaResultado[] = [
    {
      id: 'decimo-terceiro-bruto',
      rotulo: `13º salário proporcional (${avos}/12 avos)`,
      natureza: 'provento',
      baseCentavos: salarioBase,
      formula: `${formatarCentavos(salarioBase)} ÷ 12 × ${avos}`,
      valorCentavos: brutoDecimoCentavos,
      passos: [
        `Fração mensal (1/12): ${formatarCentavos(salarioBase)} ÷ 12 = ${formatarCentavos(valorPorAvoExibicao)} por mês.`,
        `Meses considerados no ano (15 dias ou mais trabalhados): ${avos} avo(s).`,
        `Total bruto do 13º salário: ${formatarCentavos(brutoDecimoCentavos)}.`,
      ],
    },
  ];

  const linhasDescontos: LinhaResultado[] = [];
  if (inss.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'desconto-inss-13',
      rotulo: 'INSS sobre 13º salário',
      natureza: 'desconto',
      baseCentavos: inss.baseConsideradaCentavos,
      aliquotaTexto: inss.aliquotaTexto,
      formula: inss.formulaLegivel,
      valorCentavos: inss.valorCentavos,
      passos: [
        'Tributação previdenciária exclusiva e separada da folha mensal.',
        ...inss.passos,
      ],
    });
  }

  if (irrf.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'desconto-irrf-13',
      rotulo: 'IRRF sobre 13º salário',
      natureza: 'desconto',
      baseCentavos: irrf.baseCalculoCentavos,
      aliquotaTexto: irrf.aliquotaTexto,
      formula: irrf.formulaLegivel,
      valorCentavos: irrf.valorCentavos,
      passos: ['Tributação exclusiva na fonte sobre o 13º salário.', ...irrf.passos],
    });
  }

  (input.outrosDescontos ?? []).forEach((item, idx) => {
    const val = Math.max(0, Math.round(item.valorCentavos));
    if (val > 0) {
      const desc = item.descricao.trim() || 'Outros descontos';
      linhasDescontos.push({
        id: `outro-desconto-13-${idx}`,
        rotulo: desc,
        natureza: 'desconto',
        baseCentavos: brutoDecimoCentavos,
        aliquotaTexto: 'Valor fixo',
        formula: `Desconto informado: ${formatarCentavos(val)}`,
        valorCentavos: val,
        passos: [`Desconto adicional informado para a 2ª parcela: ${formatarCentavos(val)}.`],
      });
    }
  });

  const totalDescontosCentavos = linhasDescontos.reduce((acc, l) => acc + l.valorCentavos, 0);
  const valorLiquidoCentavos = Math.max(0, brutoDecimoCentavos - totalDescontosCentavos);

  // Parcelas legais: 1ª parcela (até 30/11) = 50% do bruto sem descontos; 2ª parcela (até 20/12) = saldo bruto menos descontos
  const primeiraParcelaCentavos = Math.round(brutoDecimoCentavos / 2);
  const segundaParcelaBruta = brutoDecimoCentavos - primeiraParcelaCentavos;
  const segundaParcelaLiquidaCentavos = Math.max(0, segundaParcelaBruta - totalDescontosCentavos);

  const parcelasDecimoTerceiro: LinhaResultado[] = [
    {
      id: 'parcela-1-13',
      rotulo: '1ª parcela (paga até 30 de novembro)',
      natureza: 'parcela',
      baseCentavos: brutoDecimoCentavos,
      aliquotaTexto: '50%',
      formula: `${formatarCentavos(brutoDecimoCentavos)} ÷ 2 (sem descontos)`,
      valorCentavos: primeiraParcelaCentavos,
      passos: [
        'Adiantamento legal correspondente à metade do 13º salário bruto.',
        'Não há desconto de INSS nem de IRRF na primeira parcela.',
      ],
    },
    {
      id: 'parcela-2-13',
      rotulo: '2ª parcela (paga até 20 de dezembro)',
      natureza: 'parcela',
      baseCentavos: segundaParcelaBruta,
      formula: `${formatarCentavos(segundaParcelaBruta)} menos ${formatarCentavos(totalDescontosCentavos)} de descontos`,
      valorCentavos: segundaParcelaLiquidaCentavos,
      passos: [
        `Saldo bruto remanescente: ${formatarCentavos(brutoDecimoCentavos)} menos ${formatarCentavos(primeiraParcelaCentavos)} = ${formatarCentavos(segundaParcelaBruta)}.`,
        `Desconto integral do INSS e demais retenções na 2ª parcela: ${formatarCentavos(totalDescontosCentavos)}.`,
        `Valor líquido da 2ª parcela: ${formatarCentavos(segundaParcelaLiquidaCentavos)}.`,
      ],
    },
  ];

  const tipoContrato: TipoContrato = input.tipoContrato ?? 'clt';
  const fgts13 = calcularFgtsDeposito(brutoDecimoCentavos, tipoContrato, parametros);
  const linhasEncargos: LinhaResultado[] = [
    {
      id: 'encargo-fgts-13',
      rotulo: `FGTS sobre 13º (${fgts13.aliquotaTexto})`,
      natureza: 'encargo',
      baseCentavos: brutoDecimoCentavos,
      aliquotaTexto: fgts13.aliquotaTexto,
      formula: fgts13.formulaLegivel,
      valorCentavos: fgts13.valorCentavos,
      passos: fgts13.passos,
    },
  ];

  return {
    valido: true,
    modo: 'decimo_terceiro',
    anoParametros: parametros.ano,
    rotuloBruto: 'Décimo terceiro bruto',
    totalBrutoCentavos: brutoDecimoCentavos,
    totalDescontosCentavos,
    valorLiquidoCentavos,
    linhasProventos,
    linhasDescontos,
    linhasEncargos,
    parcelasDecimoTerceiro,
    avisos,
  };
}
