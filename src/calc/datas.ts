/**
 * Funções puras de datas trabalhistas (sem fuso horário ou acesso ao DOM).
 */

export interface DataCalendario {
  dia: number;
  mes: number;
  ano: number;
}

export interface DerivacaoDatas {
  valido: boolean;
  erro?: string;
  admissao?: DataCalendario;
  saida?: DataCalendario;
  diasCorridosTotais: number;
  anosCompletos: number;
  mesesEstimadosFgts: number;
  diasTrabalhadosMesSaida: number;
}

export function ehAnoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === 2) return ehAnoBissexto(ano) ? 29 : 28;
  if ([4, 6, 9, 11].includes(mes)) return 30;
  return 31;
}

/**
 * Interpreta datas em formato DD/MM/AAAA ou AAAA-MM-DD com validação real de calendário.
 */
export function parseData(texto: string | undefined | null): DataCalendario | null {
  if (!texto || typeof texto !== 'string') return null;
  const limpo = texto.trim();
  if (!limpo) return null;

  let dia = 0;
  let mes = 0;
  let ano = 0;

  const matchBr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpo);
  const matchIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo);

  if (matchBr) {
    dia = parseInt(matchBr[1], 10);
    mes = parseInt(matchBr[2], 10);
    ano = parseInt(matchBr[3], 10);
  } else if (matchIso) {
    ano = parseInt(matchIso[1], 10);
    mes = parseInt(matchIso[2], 10);
    dia = parseInt(matchIso[3], 10);
  } else {
    return null;
  }

  if (ano < 1940 || ano > 2100) return null;
  if (mes < 1 || mes > 12) return null;
  const maxDia = ultimoDiaDoMes(ano, mes);
  if (dia < 1 || dia > maxDia) return null;

  return { dia, mes, ano };
}

export function formatarDataBr(data: DataCalendario): string {
  const d = String(data.dia).padStart(2, '0');
  const m = String(data.mes).padStart(2, '0');
  return `${d}/${m}/${data.ano}`;
}

export function aplicarMascaraData(valorBruto: string): string {
  const digitos = valorBruto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

function paraTimestampUtc(data: DataCalendario): number {
  return Date.UTC(data.ano, data.mes - 1, data.dia);
}

function deTimestampUtc(ms: number): DataCalendario {
  const d = new Date(ms);
  return {
    dia: d.getUTCDate(),
    mes: d.getUTCMonth() + 1,
    ano: d.getUTCFullYear(),
  };
}

export function compararDatas(a: DataCalendario, b: DataCalendario): number {
  if (a.ano !== b.ano) return a.ano - b.ano;
  if (a.mes !== b.mes) return a.mes - b.mes;
  return a.dia - b.dia;
}

export function adicionarDias(data: DataCalendario, dias: number): DataCalendario {
  const ms = paraTimestampUtc(data) + dias * 86_400_000;
  return deTimestampUtc(ms);
}

export function adicionarMesesAniversario(base: DataCalendario, mesesParaSomar: number): DataCalendario {
  const totalMeses = (base.ano * 12 + (base.mes - 1)) + mesesParaSomar;
  const novoAno = Math.floor(totalMeses / 12);
  const novoMes = (totalMeses % 12) + 1;
  const maxDia = ultimoDiaDoMes(novoAno, novoMes);
  return {
    dia: Math.min(base.dia, maxDia),
    mes: novoMes,
    ano: novoAno,
  };
}

/**
 * Diferença inclusiva de dias corridos entre duas datas (ex.: 01/05 a 10/05 = 10 dias).
 */
export function diasCorridosInclusivos(inicio: DataCalendario, fim: DataCalendario): number {
  const diffMs = paraTimestampUtc(fim) - paraTimestampUtc(inicio);
  return Math.floor(diffMs / 86_400_000) + 1;
}

/**
 * Calcula quantos ciclos anuais completos de contrato ocorreram entre admissão e saída.
 * Exemplo: 01/01/2025 até 31/12/2025 = 1 ano completo; 01/01/2025 até 30/12/2025 = 0 anos completos.
 */
export function calcularAnosCompletos(admissao: DataCalendario, fim: DataCalendario): number {
  if (compararDatas(fim, admissao) < 0) return 0;
  let anos = 0;
  while (true) {
    const proximoAniversario = adicionarMesesAniversario(admissao, (anos + 1) * 12);
    const fimDoCiclo = adicionarDias(proximoAniversario, -1);
    if (compararDatas(fim, fimDoCiclo) >= 0) {
      anos += 1;
    } else {
      break;
    }
  }
  return anos;
}

/**
 * Calcula os dias trabalhados no mês da saída para o Saldo de Salário,
 * respeitando o limite comercial de 30 dias. Mês completo equivale a 30 dias.
 */
export function calcularDiasSaldoMesSaida(admissao: DataCalendario, saida: DataCalendario): number {
  if (compararDatas(saida, admissao) < 0) return 0;
  const ultimoDia = ultimoDiaDoMes(saida.ano, saida.mes);
  const mesmoMesEAno = admissao.ano === saida.ano && admissao.mes === saida.mes;

  if (mesmoMesEAno) {
    if (admissao.dia === 1 && saida.dia === ultimoDia) {
      return 30;
    }
    const dias = saida.dia - admissao.dia + 1;
    return Math.min(30, Math.max(0, dias));
  }

  // Admitido em mês anterior: se trabalhou até o último dia do mês (ex.: 28/02, 30/04 ou 31/05), mês completo = 30
  if (saida.dia === ultimoDia || saida.dia >= 30) {
    return 30;
  }
  return Math.min(30, saida.dia);
}

/**
 * Conta quantos meses tiveram 15 dias ou mais trabalhados entre inicio e fim dentro de um ano específico.
 */
export function calcularAvosNoAno(
  admissao: DataCalendario,
  fim: DataCalendario,
  anoAlvo: number
): number {
  if (compararDatas(fim, admissao) < 0) return 0;
  let avos = 0;

  for (let mes = 1; mes <= 12; mes += 1) {
    const primeiroDoMes: DataCalendario = { dia: 1, mes, ano: anoAlvo };
    const ultimoDoMes: DataCalendario = {
      dia: ultimoDiaDoMes(anoAlvo, mes),
      mes,
      ano: anoAlvo,
    };

    const inicioEfetivo = compararDatas(admissao, primeiroDoMes) > 0 ? admissao : primeiroDoMes;
    const fimEfetivo = compararDatas(fim, ultimoDoMes) < 0 ? fim : ultimoDoMes;

    if (compararDatas(fimEfetivo, inicioEfetivo) >= 0) {
      const diasTrabalhadosNoMes = diasCorridosInclusivos(inicioEfetivo, fimEfetivo);
      if (diasTrabalhadosNoMes >= 15) {
        avos += 1;
      }
    }
  }

  return Math.min(12, avos);
}

/**
 * Conta avos de 13º na rescisão, considerando o ano da saída e eventual projeção de aviso prévio
 * que alcance meses com 15 dias ou mais no ano seguinte.
 */
export function calcularAvosDecimoTerceiroRescisao(
  admissao: DataCalendario,
  saidaEfetiva: DataCalendario,
  saidaProjetada: DataCalendario
): { avosAnoSaida: number; avosProjetadosAnoSeguinte: number; totalAvos: number } {
  const avosAnoSaida = calcularAvosNoAno(admissao, saidaProjetada, saidaEfetiva.ano);
  let avosProjetadosAnoSeguinte = 0;

  if (saidaProjetada.ano > saidaEfetiva.ano) {
    for (let ano = saidaEfetiva.ano + 1; ano <= saidaProjetada.ano; ano += 1) {
      avosProjetadosAnoSeguinte += calcularAvosNoAno(admissao, saidaProjetada, ano);
    }
  }

  return {
    avosAnoSaida,
    avosProjetadosAnoSeguinte,
    totalAvos: avosAnoSaida + avosProjetadosAnoSeguinte,
  };
}

/**
 * Calcula os períodos aquisitivos completos e os avos proporcionais de férias desde o último aniversário
 * da admissão até a data final considerada (incluindo projeção do aviso prévio indenizado quando cabível).
 */
export function calcularPeriodosEAvosFerias(
  admissao: DataCalendario,
  fim: DataCalendario
): { periodosCompletos: number; avosProporcionais: number } {
  if (compararDatas(fim, admissao) < 0) {
    return { periodosCompletos: 0, avosProporcionais: 0 };
  }

  let mesesCompletos = 0;
  while (true) {
    const proximoMarco = adicionarMesesAniversario(admissao, mesesCompletos + 1);
    const fimDoMesAquisitivo = adicionarDias(proximoMarco, -1);
    if (compararDatas(fim, fimDoMesAquisitivo) >= 0) {
      mesesCompletos += 1;
    } else {
      break;
    }
  }

  const inicioFracaoAtual = adicionarMesesAniversario(admissao, mesesCompletos);
  const diasFracao = compararDatas(fim, inicioFracaoAtual) >= 0
    ? diasCorridosInclusivos(inicioFracaoAtual, fim)
    : 0;

  const totalAvosAcumulados = mesesCompletos + (diasFracao >= 15 ? 1 : 0);
  const periodosCompletos = Math.floor(totalAvosAcumulados / 12);
  const avosProporcionais = totalAvosAcumulados % 12;

  return { periodosCompletos, avosProporcionais };
}

/**
 * Deriva dias, meses e anos a partir de admissão e saída.
 * Bloqueia o cálculo caso falte alguma data obrigatória ou caso saída seja anterior à admissão.
 */
export function derivarDatasContrato(
  dataAdmissaoStr: string | undefined,
  dataSaidaStr: string | undefined
): DerivacaoDatas {
  const admissao = parseData(dataAdmissaoStr);
  if (!admissao) {
    return {
      valido: false,
      erro: 'Informe uma data de admissão válida no formato DD/MM/AAAA.',
      diasCorridosTotais: 0,
      anosCompletos: 0,
      mesesEstimadosFgts: 0,
      diasTrabalhadosMesSaida: 0,
    };
  }

  const saida = parseData(dataSaidaStr);
  if (!saida) {
    return {
      valido: false,
      erro: 'Informe uma data de saída válida no formato DD/MM/AAAA.',
      admissao,
      diasCorridosTotais: 0,
      anosCompletos: 0,
      mesesEstimadosFgts: 0,
      diasTrabalhadosMesSaida: 0,
    };
  }

  if (compararDatas(saida, admissao) < 0) {
    return {
      valido: false,
      erro: 'A data de saída não pode ser anterior à data de admissão.',
      admissao,
      saida,
      diasCorridosTotais: 0,
      anosCompletos: 0,
      mesesEstimadosFgts: 0,
      diasTrabalhadosMesSaida: 0,
    };
  }

  const diasCorridosTotais = diasCorridosInclusivos(admissao, saida);
  const anosCompletos = calcularAnosCompletos(admissao, saida);
  const { periodosCompletos, avosProporcionais } = calcularPeriodosEAvosFerias(admissao, saida);
  const mesesEstimadosFgts = Math.max(1, periodosCompletos * 12 + avosProporcionais);
  const diasTrabalhadosMesSaida = calcularDiasSaldoMesSaida(admissao, saida);

  return {
    valido: true,
    admissao,
    saida,
    diasCorridosTotais,
    anosCompletos,
    mesesEstimadosFgts,
    diasTrabalhadosMesSaida,
  };
}
