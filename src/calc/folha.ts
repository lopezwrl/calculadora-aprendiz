import { obterParametros, ParametrosAno } from '../config/parametros';
import { parseData } from './datas';
import { formatarCentavos } from './moeda';
import {
  calcularFgtsDeposito,
  calcularInssProgressivo,
  calcularIrrf,
  calcularValeTransporte,
} from './tributos';
import {
  AvisoCalculo,
  LinhaResultado,
  OutroDescontoItem,
  ResultadoCalculo,
  TipoContrato,
} from './types';
import { validarSalarioPiso } from './validacao';

export interface FolhaInput {
  dataAdmissao: string;
  salarioBaseCentavos: number;
  baseInssCentavos?: number;
  diasTrabalhados?: number;
  tipoContrato?: TipoContrato;
  valeTransporteAtivo?: boolean;
  valorValeTransporteMensalCentavos?: number;
  dependentes?: number;
  outrosDescontos?: OutroDescontoItem[];
  pisoCategoriaCentavos?: number;
  parametros?: ParametrosAno;
}

export function calcularFolhaMensal(input: FolhaInput): ResultadoCalculo {
  const parametros = input.parametros ?? obterParametros();
  const admissao = parseData(input.dataAdmissao);

  if (!admissao) {
    return {
      valido: false,
      erroBloqueante: 'Informe uma data de admissão válida para calcular a folha.',
      modo: 'folha',
      anoParametros: parametros.ano,
      rotuloBruto: 'Salário bruto',
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
      modo: 'folha',
      anoParametros: parametros.ano,
      rotuloBruto: 'Salário bruto',
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
  const dias = Math.min(30, Math.max(1, Math.floor(input.diasTrabalhados ?? 30)));
  const salarioBrutoMes = dias >= 30 ? salarioBase : Math.round((salarioBase * dias) / 30);

  const baseInss =
    input.baseInssCentavos !== undefined && input.baseInssCentavos > 0
      ? Math.round(input.baseInssCentavos)
      : salarioBrutoMes;

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

  if (baseInss !== salarioBrutoMes) {
    avisos.push({
      codigo: 'BASE_INSS_PERSONALIZADA',
      nivel: 'info',
      titulo: 'Base do INSS diferenciada',
      mensagem: `O INSS foi calculado sobre a base informada de ${formatarCentavos(baseInss)}, distinta do salário bruto de ${formatarCentavos(salarioBrutoMes)}.`,
    });
  }

  const linhasProventos: LinhaResultado[] = [
    {
      id: 'salario-mensal',
      rotulo: dias === 30 ? 'Salário base mensal' : `Saldo de salário (${dias} dias)`,
      natureza: 'provento',
      baseCentavos: salarioBase,
      formula:
        dias === 30
          ? `${formatarCentavos(salarioBase)} (mês comercial de 30 dias)`
          : `${formatarCentavos(salarioBase)} ÷ 30 × ${dias}`,
      valorCentavos: salarioBrutoMes,
      passos:
        dias === 30
          ? [`Remuneração mensal integral contratada: ${formatarCentavos(salarioBrutoMes)}.`]
          : [
              `Valor diário comercial: ${formatarCentavos(salarioBase)} ÷ 30 = ${formatarCentavos(Math.round(salarioBase / 30))}.`,
              `Multiplicado por ${dias} dias trabalhados: ${formatarCentavos(salarioBrutoMes)}.`,
            ],
    },
  ];

  const linhasDescontos: LinhaResultado[] = [];

  const inss = calcularInssProgressivo(baseInss, parametros);
  if (inss.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'desconto-inss',
      rotulo: 'INSS',
      natureza: 'desconto',
      baseCentavos: inss.baseConsideradaCentavos,
      aliquotaTexto: inss.aliquotaTexto,
      formula: inss.formulaLegivel,
      valorCentavos: inss.valorCentavos,
      passos: inss.passos,
    });
  }

  const irrf = calcularIrrf(
    salarioBrutoMes,
    inss.valorCentavos,
    input.dependentes ?? 0,
    parametros
  );
  if (irrf.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'desconto-irrf',
      rotulo: 'IRRF',
      natureza: 'desconto',
      baseCentavos: irrf.baseCalculoCentavos,
      aliquotaTexto: irrf.aliquotaTexto,
      formula: irrf.formulaLegivel,
      valorCentavos: irrf.valorCentavos,
      passos: irrf.passos,
    });
  }

  const vt = calcularValeTransporte(
    salarioBase,
    dias,
    Boolean(input.valeTransporteAtivo),
    input.valorValeTransporteMensalCentavos ?? 0,
    parametros.limiteValeTransporte
  );
  if (vt.valorCentavos > 0) {
    linhasDescontos.push({
      id: 'desconto-vt',
      rotulo: 'Vale-transporte',
      natureza: 'desconto',
      baseCentavos: vt.baseProporcionalCentavos,
      aliquotaTexto: vt.aliquotaTexto,
      formula: vt.formulaLegivel,
      valorCentavos: vt.valorCentavos,
      passos: vt.passos,
    });
  }

  (input.outrosDescontos ?? []).forEach((item, idx) => {
    const val = Math.max(0, Math.round(item.valorCentavos));
    if (val > 0) {
      const desc = item.descricao.trim() || 'Outros descontos';
      linhasDescontos.push({
        id: `outro-desconto-${idx}`,
        rotulo: desc,
        natureza: 'desconto',
        baseCentavos: salarioBrutoMes,
        aliquotaTexto: 'Valor fixo',
        formula: `Desconto informado: ${formatarCentavos(val)}`,
        valorCentavos: val,
        passos: [`Desconto manual registrado sob "${desc}": ${formatarCentavos(val)}.`],
      });
    }
  });

  const fgts = calcularFgtsDeposito(salarioBrutoMes, tipoContrato, parametros);
  const linhasEncargos: LinhaResultado[] = [
    {
      id: 'encargo-fgts-mes',
      rotulo: `FGTS do mês (${fgts.aliquotaTexto})`,
      natureza: 'encargo',
      baseCentavos: salarioBrutoMes,
      aliquotaTexto: fgts.aliquotaTexto,
      formula: fgts.formulaLegivel,
      valorCentavos: fgts.valorCentavos,
      passos: fgts.passos,
    },
  ];

  const totalBrutoCentavos = linhasProventos.reduce((acc, l) => acc + l.valorCentavos, 0);
  const totalDescontosCentavos = linhasDescontos.reduce((acc, l) => acc + l.valorCentavos, 0);
  const valorLiquidoCentavos = Math.max(0, totalBrutoCentavos - totalDescontosCentavos);

  return {
    valido: true,
    modo: 'folha',
    anoParametros: parametros.ano,
    rotuloBruto: 'Salário bruto',
    totalBrutoCentavos,
    totalDescontosCentavos,
    valorLiquidoCentavos,
    linhasProventos,
    linhasDescontos,
    linhasEncargos,
    avisos,
  };
}
