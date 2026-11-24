import { ParametrosAno } from '../config/parametros';
import { formatarCentavos } from './moeda';
import { calcularInssProgressivo } from './tributos';
import { AvisoCalculo, TipoContrato } from './types';

export interface ValidacaoPisoInput {
  salarioBaseCentavos: number;
  pisoCategoriaCentavos?: number;
  parametros: ParametrosAno;
}

export interface ValidacaoPisoResultado {
  abaixoDoPiso: boolean;
  pisoReferenciaCentavos: number;
  origemPiso: 'categoria' | 'estadual_piaui' | 'minimo_nacional';
  aviso: AvisoCalculo | null;
}

/**
 * Verifica se o salário base é inferior ao salário mínimo nacional, ao piso estadual do Piauí
 * ou ao piso da categoria (convenção coletiva, que substitui o piso legal quando informado).
 * Nunca bloqueia o cálculo.
 */
export function validarSalarioPiso(input: ValidacaoPisoInput): ValidacaoPisoResultado {
  const { salarioBaseCentavos, pisoCategoriaCentavos, parametros } = input;

  let pisoReferenciaCentavos: number;
  let origemPiso: 'categoria' | 'estadual_piaui' | 'minimo_nacional';
  let descricaoPiso: string;

  if (pisoCategoriaCentavos && pisoCategoriaCentavos > 0) {
    pisoReferenciaCentavos = Math.round(pisoCategoriaCentavos);
    origemPiso = 'categoria';
    descricaoPiso = `piso da categoria informado (${formatarCentavos(pisoReferenciaCentavos)})`;
  } else if (parametros.pisoEstadualPiauiCentavos > parametros.salarioMinimoCentavos) {
    pisoReferenciaCentavos = parametros.pisoEstadualPiauiCentavos;
    origemPiso = 'estadual_piaui';
    descricaoPiso = `piso estadual configurado do Piauí (${formatarCentavos(pisoReferenciaCentavos)})`;
  } else {
    pisoReferenciaCentavos = parametros.salarioMinimoCentavos;
    origemPiso = 'minimo_nacional';
    descricaoPiso = `salário mínimo vigente de ${parametros.ano} (${formatarCentavos(pisoReferenciaCentavos)})`;
  }

  if (salarioBaseCentavos > 0 && salarioBaseCentavos < pisoReferenciaCentavos) {
    return {
      abaixoDoPiso: true,
      pisoReferenciaCentavos,
      origemPiso,
      aviso: {
        codigo: 'SALARIO_ABAIXO_DO_PISO',
        nivel: 'aviso',
        titulo: 'Salário base abaixo do piso de referência',
        mensagem: `O salário informado (${formatarCentavos(salarioBaseCentavos)}) está abaixo do ${descricaoPiso}. Em contratos de jornada reduzida ou aprendizagem, confirme a proporcionalidade por hora.`,
      },
    };
  }

  return {
    abaixoDoPiso: false,
    pisoReferenciaCentavos,
    origemPiso,
    aviso: null,
  };
}

export interface DadosConferenciaHolerite {
  salarioBaseCentavos?: number;
  totalProventosCentavos?: number;
  totalDescontosCentavos?: number;
  liquidoCentavos?: number;
  baseInssCentavos?: number;
  inssCentavos?: number;
  baseFgtsCentavos?: number;
  fgtsMesCentavos?: number;
  pisoCategoriaCentavos?: number;
  tipoContrato?: TipoContrato;
}

export interface InconsistenciaHolerite {
  codigo: 'LIQUIDO_DIVERGENTE' | 'INSS_DIVERGENTE' | 'FGTS_DIVERGENTE' | 'SALARIO_ABAIXO_PISO';
  campoRelacionado: string;
  mensagem: string;
}

/**
 * Funções puras de conferência cruzada dos valores extraídos de um holerite.
 * Tolerância aritmética: R$ 0,01 (1 centavo).
 */
export function conferirValoresHolerite(
  dados: DadosConferenciaHolerite,
  parametros: ParametrosAno
): InconsistenciaHolerite[] {
  const inconsistencias: InconsistenciaHolerite[] = [];
  const tipoContrato: TipoContrato = dados.tipoContrato ?? 'clt';

  // 1. Total de proventos menos total de descontos comparado ao líquido
  if (
    dados.totalProventosCentavos !== undefined &&
    dados.totalDescontosCentavos !== undefined &&
    dados.liquidoCentavos !== undefined
  ) {
    const liquidoEsperado = dados.totalProventosCentavos - dados.totalDescontosCentavos;
    if (Math.abs(liquidoEsperado - dados.liquidoCentavos) > 1) {
      inconsistencias.push({
        codigo: 'LIQUIDO_DIVERGENTE',
        campoRelacionado: 'liquido',
        mensagem: `O valor líquido informado (${formatarCentavos(dados.liquidoCentavos)}) difere de proventos menos descontos (${formatarCentavos(liquidoEsperado)}).`,
      });
    }
  }

  // 2. INSS detectado comparado com Base INSS (ou salário base caso Base INSS não conste)
  if (dados.inssCentavos !== undefined) {
    const baseReferencia = dados.baseInssCentavos ?? dados.salarioBaseCentavos;
    if (baseReferencia !== undefined && baseReferencia > 0) {
      const inssCalculadoSobreBase = calcularInssProgressivo(baseReferencia, parametros).valorCentavos;
      if (Math.abs(dados.inssCentavos - inssCalculadoSobreBase) > 1) {
        const complementoBase =
          dados.baseInssCentavos !== undefined &&
          dados.salarioBaseCentavos !== undefined &&
          dados.baseInssCentavos !== dados.salarioBaseCentavos
            ? ` Base do INSS no holerite: ${formatarCentavos(dados.baseInssCentavos)}.`
            : '';
        inconsistencias.push({
          codigo: 'INSS_DIVERGENTE',
          campoRelacionado: 'inss',
          mensagem: `O INSS informado (${formatarCentavos(dados.inssCentavos)}) difere do calculado sobre ${formatarCentavos(baseReferencia)} (${formatarCentavos(inssCalculadoSobreBase)}).${complementoBase}`,
        });
      }
    }
  }

  // 3. FGTS do mês comparado com Base FGTS vezes alíquota aplicável (8% CLT ou 2% Aprendiz)
  if (dados.fgtsMesCentavos !== undefined) {
    const baseFgts = dados.baseFgtsCentavos ?? dados.salarioBaseCentavos;
    if (baseFgts !== undefined && baseFgts > 0) {
      const aliquota =
        tipoContrato === 'aprendiz'
          ? parametros.aliquotaFgtsAprendiz
          : parametros.aliquotaFgtsClt;
      const fgtsEsperado = Math.round(baseFgts * aliquota);
      const fgtsAprendizAlternativo = Math.round(baseFgts * parametros.aliquotaFgtsAprendiz);

      // Se o contrato não foi especificado mas o FGTS fecha exatamente em 2%, só sinaliza se não for aprendiz
      const fechaComAliquota = Math.abs(dados.fgtsMesCentavos - fgtsEsperado) <= 1;
      if (!fechaComAliquota) {
        const notaAprendiz =
          tipoContrato === 'clt' && Math.abs(dados.fgtsMesCentavos - fgtsAprendizAlternativo) <= 1
            ? ' O valor coincide com a alíquota de 2% de contrato de aprendizagem.'
            : '';
        inconsistencias.push({
          codigo: 'FGTS_DIVERGENTE',
          campoRelacionado: 'fgtsMes',
          mensagem: `O FGTS informado (${formatarCentavos(dados.fgtsMesCentavos)}) difere de ${Math.round(aliquota * 100)}% sobre ${formatarCentavos(baseFgts)} (${formatarCentavos(fgtsEsperado)}).${notaAprendiz}`,
        });
      }
    }
  }

  // 4. Salário base comparado ao salário mínimo e piso configurados (para contrato CLT integral)
  if (dados.salarioBaseCentavos !== undefined && dados.salarioBaseCentavos > 0 && tipoContrato === 'clt') {
    const checkPiso = validarSalarioPiso({
      salarioBaseCentavos: dados.salarioBaseCentavos,
      pisoCategoriaCentavos: dados.pisoCategoriaCentavos,
      parametros,
    });
    if (checkPiso.abaixoDoPiso && checkPiso.aviso) {
      inconsistencias.push({
        codigo: 'SALARIO_ABAIXO_PISO',
        campoRelacionado: 'salarioBase',
        mensagem: checkPiso.aviso.mensagem,
      });
    }
  }

  return inconsistencias;
}
