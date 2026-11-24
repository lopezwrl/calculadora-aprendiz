import { describe, expect, it } from 'vitest';
import { obterParametros } from '../config/parametros';
import {
  calcularDecimoTerceiro,
  calcularFolhaMensal,
  calcularInssProgressivo,
  calcularIrrf,
  calcularRescisao,
  calcularValeTransporte,
  validarSalarioPiso,
} from './index';

const params2026 = obterParametros(2026);

describe('Casos de referência oficiais (R$ 712,00 calculados à mão)', () => {
  it('Caso 1(a): Folha do mês com salário R$ 712,00 e Base INSS R$ 710,00 resulta em INSS R$ 53,25 e líquido R$ 658,75', () => {
    const res = calcularFolhaMensal({
      dataAdmissao: '02/03/2026',
      salarioBaseCentavos: 71200,
      baseInssCentavos: 71000,
      dependentes: 0,
      valeTransporteAtivo: false,
      parametros: params2026,
    });

    expect(res.valido).toBe(true);
    expect(res.totalBrutoCentavos).toBe(71200);
    expect(res.totalDescontosCentavos).toBe(5325);
    expect(res.valorLiquidoCentavos).toBe(65875);

    const linhaInss = res.linhasDescontos.find((d) => d.id === 'desconto-inss');
    expect(linhaInss?.valorCentavos).toBe(5325);
    expect(res.linhasDescontos.find((d) => d.id === 'desconto-irrf')).toBeUndefined();
  });

  it('Caso 1(b): Folha do mês com salário R$ 712,00 e Base INSS R$ 712,00 resulta em INSS R$ 53,40 e líquido R$ 658,60 (diferença de R$ 0,15)', () => {
    const res = calcularFolhaMensal({
      dataAdmissao: '02/03/2026',
      salarioBaseCentavos: 71200,
      baseInssCentavos: 71200,
      dependentes: 0,
      valeTransporteAtivo: false,
      parametros: params2026,
    });

    expect(res.valido).toBe(true);
    expect(res.totalBrutoCentavos).toBe(71200);
    expect(res.totalDescontosCentavos).toBe(5340);
    expect(res.valorLiquidoCentavos).toBe(65860);
    expect(65875 - res.valorLiquidoCentavos).toBe(15);
  });

  it('Caso 1 adicional: Vale-transporte de 6% ativado sobre R$ 712,00 desconta R$ 42,72 e resulta em líquido R$ 615,88', () => {
    const res = calcularFolhaMensal({
      dataAdmissao: '02/03/2026',
      salarioBaseCentavos: 71200,
      baseInssCentavos: 71200,
      dependentes: 0,
      valeTransporteAtivo: true,
      valorValeTransporteMensalCentavos: 22000,
      parametros: params2026,
    });

    const linhaVt = res.linhasDescontos.find((d) => d.id === 'desconto-vt');
    expect(linhaVt?.valorCentavos).toBe(4272);
    expect(res.totalBrutoCentavos).toBe(71200);
    expect(res.totalDescontosCentavos).toBe(9612);
    expect(res.valorLiquidoCentavos).toBe(61588);
  });

  it('Caso 2: 13º salário de 12 meses com bruto R$ 712,00, INSS R$ 53,40, líquido R$ 658,60, 1ª parcela R$ 356,00 e 2ª parcela R$ 302,60', () => {
    const res = calcularDecimoTerceiro({
      dataAdmissao: '02/01/2026',
      anoReferencia: 2026,
      mesesTrabalhados: 12,
      salarioBaseCentavos: 71200,
      dependentes: 0,
      parametros: params2026,
    });

    expect(res.valido).toBe(true);
    expect(res.totalBrutoCentavos).toBe(71200);
    expect(res.totalDescontosCentavos).toBe(5340);
    expect(res.valorLiquidoCentavos).toBe(65860);
    expect(res.parcelasDecimoTerceiro).toHaveLength(2);
    expect(res.parcelasDecimoTerceiro?.[0].valorCentavos).toBe(35600);
    expect(res.parcelasDecimoTerceiro?.[1].valorCentavos).toBe(30260);
  });

  it('Caso 3: 13º proporcional de 7 meses com bruto R$ 415,33, INSS R$ 31,15 e líquido R$ 384,18', () => {
    const res = calcularDecimoTerceiro({
      dataAdmissao: '01/06/2026',
      anoReferencia: 2026,
      salarioBaseCentavos: 71200,
      dependentes: 0,
      parametros: params2026,
    });

    expect(res.valido).toBe(true);
    expect(res.totalBrutoCentavos).toBe(41533);
    expect(res.totalDescontosCentavos).toBe(3115);
    expect(res.valorLiquidoCentavos).toBe(38418);
  });
});

describe('Datas, saldo comercial de 30 dias e avos de 15 dias', () => {
  it('bloqueia o cálculo quando falta data ou quando saída é anterior à admissão', () => {
    const semData = calcularRescisao({
      dataAdmissao: '',
      dataSaida: '10/05/2026',
      modalidade: 'sem_justa_causa',
      salarioBaseCentavos: 200000,
      parametros: params2026,
    });
    expect(semData.valido).toBe(false);

    const invertida = calcularRescisao({
      dataAdmissao: '15/05/2026',
      dataSaida: '10/05/2026',
      modalidade: 'sem_justa_causa',
      salarioBaseCentavos: 200000,
      parametros: params2026,
    });
    expect(invertida.valido).toBe(false);
  });

  it('limita o saldo de salário ao salário integral na saída no dia 31 (mês comercial)', () => {
    const res = calcularRescisao({
      dataAdmissao: '10/01/2025',
      dataSaida: '31/05/2026',
      modalidade: 'pedido_demissao',
      salarioBaseCentavos: 300000,
      parametros: params2026,
    });

    const saldo = res.linhasProventos.find((p) => p.id === 'saldo-salario');
    expect(saldo?.valorCentavos).toBe(300000);
  });

  it('calcula saldo proporcional exato em mês parcial (12 dias de R$ 3.000,00 = R$ 1.200,00)', () => {
    const res = calcularRescisao({
      dataAdmissao: '10/01/2025',
      dataSaida: '12/05/2026',
      modalidade: 'pedido_demissao',
      salarioBaseCentavos: 300000,
      parametros: params2026,
    });

    const saldo = res.linhasProventos.find((p) => p.id === 'saldo-salario');
    expect(saldo?.valorCentavos).toBe(120000);
  });

  it('considera como mês completo no 13º aquele com 15 dias ou mais trabalhados e descarta com 14 dias', () => {
    const com15Dias = calcularRescisao({
      dataAdmissao: '01/01/2026',
      dataSaida: '15/08/2026',
      modalidade: 'pedido_demissao',
      salarioBaseCentavos: 240000,
      parametros: params2026,
    });
    const com14Dias = calcularRescisao({
      dataAdmissao: '01/01/2026',
      dataSaida: '14/08/2026',
      modalidade: 'pedido_demissao',
      salarioBaseCentavos: 240000,
      parametros: params2026,
    });

    // 8/12 de R$ 2.400,00 = R$ 1.600,00 (160000) vs 7/12 = R$ 1.400,00 (140000)
    expect(
      com15Dias.linhasProventos.find((p) => p.id === 'decimo-terceiro-rescisao')?.valorCentavos
    ).toBe(160000);
    expect(
      com14Dias.linhasProventos.find((p) => p.id === 'decimo-terceiro-rescisao')?.valorCentavos
    ).toBe(140000);
  });
});

describe('Modalidades de rescisão e FGTS', () => {
  it('calcula dispensa sem justa causa com aviso indenizado projetado, multa de 40% do FGTS e isenção de INSS sobre férias e aviso', () => {
    const res = calcularRescisao({
      dataAdmissao: '01/03/2025',
      dataSaida: '30/04/2026',
      modalidade: 'sem_justa_causa',
      salarioBaseCentavos: 300000,
      tipoContrato: 'clt',
      opcoes: {
        avisoPrevioIndenizado: true,
        feriasVencidas: false,
        saldoFgtsInformadoCentavos: 400000,
      },
      parametros: params2026,
    });

    expect(res.valido).toBe(true);
    // Saldo (30d): 300000; Aviso (33d): 330000; 13º projetado até 02/06 (5/12): 125000; Férias prop (3/12 + 1/3): 100000; Multa 40%: 160000
    expect(res.linhasProventos.find((p) => p.id === 'saldo-salario')?.valorCentavos).toBe(300000);
    expect(res.linhasProventos.find((p) => p.id === 'aviso-previo-indenizado')?.valorCentavos).toBe(330000);
    expect(res.linhasProventos.find((p) => p.id === 'decimo-terceiro-rescisao')?.valorCentavos).toBe(125000);
    expect(res.linhasProventos.find((p) => p.id === 'ferias-proporcionais')?.valorCentavos).toBe(100000);
    expect(res.linhasProventos.find((p) => p.id === 'multa-fgts')?.valorCentavos).toBe(160000);
    expect(res.totalBrutoCentavos).toBe(1015000);

    // INSS apenas sobre saldo (24860) e sobre 13º (9375) = 34235
    expect(res.linhasDescontos.find((d) => d.id === 'inss-saldo-salario')?.valorCentavos).toBe(24860);
    expect(res.linhasDescontos.find((d) => d.id === 'inss-13-rescisao')?.valorCentavos).toBe(9375);
    expect(res.totalDescontosCentavos).toBe(34235);
    expect(res.valorLiquidoCentavos).toBe(980765);

    // FGTS nunca entra nos descontos
    expect(res.linhasDescontos.some((d) => d.rotulo.includes('FGTS'))).toBe(false);
  });

  it('calcula pedido de demissão sem aviso indenizado e sem multa do FGTS', () => {
    const res = calcularRescisao({
      dataAdmissao: '01/01/2026',
      dataSaida: '30/06/2026',
      modalidade: 'pedido_demissao',
      salarioBaseCentavos: 240000,
      parametros: params2026,
    });

    expect(res.linhasProventos.find((p) => p.id === 'aviso-previo-indenizado')).toBeUndefined();
    expect(res.linhasProventos.find((p) => p.id === 'multa-fgts')).toBeUndefined();
    // Saldo 30d = 240000; 13º 6/12 = 120000; Férias prop 6/12 (120000) + 1/3 (40000) = 160000 -> Bruto = 520000
    expect(res.totalBrutoCentavos).toBe(520000);
  });

  it('calcula acordo entre as partes (art. 484 A) com aviso indenizado pela metade e multa de 20% do FGTS', () => {
    const res = calcularRescisao({
      dataAdmissao: '01/03/2026',
      dataSaida: '30/08/2026',
      modalidade: 'acordo',
      salarioBaseCentavos: 300000,
      opcoes: {
        avisoPrevioIndenizado: true,
        saldoFgtsInformadoCentavos: 200000,
      },
      parametros: params2026,
    });

    // 0 anos completos -> 30 dias de aviso -> metade de R$ 3.000,00 = R$ 1.500,00 (150000)
    expect(res.linhasProventos.find((p) => p.id === 'aviso-previo-indenizado')?.valorCentavos).toBe(150000);
    // Multa de 20% sobre R$ 2.000,00 = R$ 400,00 (40000)
    expect(res.linhasProventos.find((p) => p.id === 'multa-fgts')?.valorCentavos).toBe(40000);
  });

  it('aplica indenização do art. 479 exclusivamente em contrato por prazo determinado encerrado antes do prazo', () => {
    const semJustaCausa = calcularRescisao({
      dataAdmissao: '01/03/2026',
      dataSaida: '30/04/2026',
      modalidade: 'sem_justa_causa',
      salarioBaseCentavos: 300000,
      opcoes: {
        encerradoAntesDoPrazo: true,
        dataFimPrevistaContrato: '30/05/2026',
      },
      parametros: params2026,
    });
    expect(semJustaCausa.linhasProventos.find((p) => p.id === 'indenizacao-art-479')).toBeUndefined();

    const prazoDeterminado = calcularRescisao({
      dataAdmissao: '01/03/2026',
      dataSaida: '30/04/2026',
      modalidade: 'termino_contrato',
      salarioBaseCentavos: 300000,
      opcoes: {
        encerradoAntesDoPrazo: true,
        dataFimPrevistaContrato: '30/05/2026',
      },
      parametros: params2026,
    });
    // Faltam 30 dias (01/05 a 30/05): metade de R$ 3.000,00 = R$ 1.500,00 (150000)
    expect(prazoDeterminado.linhasProventos.find((p) => p.id === 'indenizacao-art-479')?.valorCentavos).toBe(150000);
  });
});

describe('INSS progressivo por faixa, IRRF com dependentes/redutor, vale-transporte e piso salarial', () => {
  it('calcula o INSS corretamente em cada uma das 4 faixas e respeita o teto de 2026', () => {
    expect(calcularInssProgressivo(100000, params2026).valorCentavos).toBe(7500);
    expect(calcularInssProgressivo(200000, params2026).valorCentavos).toBe(15569);
    expect(calcularInssProgressivo(350000, params2026).valorCentavos).toBe(30860);
    expect(calcularInssProgressivo(600000, params2026).valorCentavos).toBe(64151);
    expect(calcularInssProgressivo(1000000, params2026).valorCentavos).toBe(98809);
  });

  it('calcula o IRRF aplicando isenção até R$ 5.000,00, redutor parcial em R$ 6.000,00 e dedução por dependentes em R$ 8.000,00', () => {
    const isento4500 = calcularIrrf(450000, 43151, 0, params2026);
    expect(isento4500.valorCentavos).toBe(0);

    const parcial6000 = calcularIrrf(600000, 64151, 0, params2026);
    expect(parcial6000.valorCentavos).toBe(38510);

    const semDep8000 = calcularIrrf(800000, 92151, 0, params2026);
    const com2Dep8000 = calcularIrrf(800000, 92151, 2, params2026);
    expect(semDep8000.valorCentavos).toBe(103785);
    expect(com2Dep8000.valorCentavos).toBe(93358);
  });

  it('limita o desconto do vale-transporte ao valor efetivamente fornecido quando inferior a 6%', () => {
    const vtLimitado = calcularValeTransporte(200000, 30, true, 8500);
    expect(vtLimitado.valorCentavos).toBe(8500);
    expect(vtLimitado.limitadoAoFornecido).toBe(true);
  });

  it('emite aviso não bloqueante de salário abaixo do piso e permite substituição pelo piso da categoria', () => {
    const abaixoMinimo = validarSalarioPiso({
      salarioBaseCentavos: 150000,
      parametros: params2026,
    });
    expect(abaixoMinimo.abaixoDoPiso).toBe(true);
    expect(abaixoMinimo.aviso).not.toBeNull();

    const acimaMinimoMasAbaixoCategoria = validarSalarioPiso({
      salarioBaseCentavos: 185000,
      pisoCategoriaCentavos: 210000,
      parametros: params2026,
    });
    expect(acimaMinimoMasAbaixoCategoria.abaixoDoPiso).toBe(true);
    expect(acimaMinimoMasAbaixoCategoria.origemPiso).toBe('categoria');
    expect(acimaMinimoMasAbaixoCategoria.pisoReferenciaCentavos).toBe(210000);
  });
});
