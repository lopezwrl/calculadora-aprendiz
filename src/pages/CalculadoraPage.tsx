import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ANO_VIGENTE, DATA_ULTIMA_CONFERENCIA, obterParametros } from '../config/parametros';
import {
  aplicarMascaraData,
  aplicarMascaraMoeda,
  calcularAvosNoAno,
  calcularDecimoTerceiro,
  calcularFolhaMensal,
  calcularRescisao,
  compararDatas,
  formatarCentavos,
  listarVerbasEtapaRescisao,
  ModalidadeRescisao,
  ModoCalculo,
  parseData,
  parseMoedaParaCentavos,
  ResultadoCalculo,
  TipoContrato,
} from '../calc';
import { Cabecalho } from '../components/Cabecalho';
import { DadosAplicadosHolerite, ImportadorHolerite } from '../components/ImportadorHolerite';
import { ModalComoCalculamos } from '../components/ModalComoCalculamos';
import { PainelHistorico } from '../components/PainelHistorico';
import { PainelResultado } from '../components/PainelResultado';
import { ResumoCalculoAoVivo } from '../components/ResumoCalculoAoVivo';
import { gerarPdfDemonstrativo } from '../utils/gerarPdf';
import {
  ItemHistoricoCalculo,
  lerHistoricoLocal,
  limparHistoricoLocal,
  removerItemHistoricoLocal,
  salvarItemHistoricoLocal,
} from '../utils/historico';

const esquemaFormulario = z
  .object({
    modo: z.enum(['folha', 'decimo_terceiro', 'rescisao']),
    tipoContrato: z.enum(['clt', 'aprendiz']),
    modalidadeRescisao: z.enum([
      'sem_justa_causa',
      'pedido_demissao',
      'justa_causa',
      'acordo',
      'termino_contrato',
    ]),
    dataAdmissao: z
      .string()
      .min(1, 'Informe a data de admissão.')
      .refine((v) => parseData(v) !== null, 'Use uma data válida no formato DD/MM/AAAA.'),
    dataSaida: z.string().optional(),
    salarioBase: z
      .string()
      .min(1, 'Informe o salário base.')
      .refine((v) => parseMoedaParaCentavos(v) > 0, 'O salário base deve ser maior que zero.'),
    baseInss: z
      .string()
      .min(1, 'Informe a base do INSS.')
      .refine((v) => parseMoedaParaCentavos(v) > 0, 'A base do INSS deve ser maior que zero.'),
    pisoCategoria: z.string().optional(),
    jornada: z.string().min(1, 'Selecione a jornada.'),
    diasTrabalhadosFolha: z
      .number({ invalid_type_error: 'Informe os dias trabalhados.' })
      .int()
      .min(1, 'Mínimo de 1 dia.')
      .max(30, 'Máximo de 30 dias comerciais.'),
    mesesDecimoTerceiro: z
      .number({ invalid_type_error: 'Informe os meses trabalhados.' })
      .int()
      .min(1, 'Mínimo de 1 mês.')
      .max(12, 'Máximo de 12 meses.'),
    valeTransporteAtivo: z.boolean(),
    valorValeTransporteMensal: z.string().optional(),
    dependentes: z
      .number({ invalid_type_error: 'Informe um número inteiro.' })
      .int()
      .min(0, 'Não pode ser negativo.')
      .max(30, 'Valor inválido.'),
    nome: z.string().optional(),
    outrosDescontos: z.array(
      z.object({
        descricao: z.string(),
        valor: z.string(),
      })
    ),
    avisoPrevioIndenizado: z.boolean(),
    descontarAvisoNaoTrabalhado: z.boolean(),
    feriasVencidas: z.boolean(),
    feriasVencidasEmDobro: z.boolean(),
    encerradoAntesDoPrazo: z.boolean(),
    dataFimPrevistaContrato: z.string().optional(),
    saldoFgtsInformado: z.string().optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.valeTransporteAtivo) {
      if (
        !dados.valorValeTransporteMensal ||
        parseMoedaParaCentavos(dados.valorValeTransporteMensal) <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valorValeTransporteMensal'],
          message: 'Informe o valor mensal de vale-transporte fornecido.',
        });
      }
    }

    if (dados.modo === 'rescisao') {
      const adm = parseData(dados.dataAdmissao);
      const sai = parseData(dados.dataSaida);
      if (!sai) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataSaida'],
          message: 'Informe uma data de saída válida no formato DD/MM/AAAA.',
        });
      } else if (adm && compararDatas(sai, adm) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataSaida'],
          message: 'A data de saída não pode ser anterior à data de admissão.',
        });
      }

      if (dados.modalidadeRescisao === 'termino_contrato' && dados.encerradoAntesDoPrazo) {
        const dtPrevista = parseData(dados.dataFimPrevistaContrato);
        if (!dtPrevista) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataFimPrevistaContrato'],
            message: 'Informe a data final prevista do contrato.',
          });
        } else if (sai && compararDatas(dtPrevista, sai) <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataFimPrevistaContrato'],
            message: 'A data final prevista deve ser posterior à data de saída.',
          });
        }
      }
    }
  });

type ValoresFormulario = z.infer<typeof esquemaFormulario>;

const VALORES_CASO_REFERENCIA_1: ValoresFormulario = {
  modo: 'folha',
  tipoContrato: 'clt',
  modalidadeRescisao: 'sem_justa_causa',
  dataAdmissao: '02/03/2026',
  dataSaida: '30/11/2026',
  salarioBase: '712,00',
  baseInss: '710,00',
  pisoCategoria: '',
  jornada: '44h',
  diasTrabalhadosFolha: 30,
  mesesDecimoTerceiro: 12,
  valeTransporteAtivo: false,
  valorValeTransporteMensal: '',
  dependentes: 0,
  nome: '',
  outrosDescontos: [],
  avisoPrevioIndenizado: true,
  descontarAvisoNaoTrabalhado: false,
  feriasVencidas: false,
  feriasVencidasEmDobro: false,
  encerradoAntesDoPrazo: false,
  dataFimPrevistaContrato: '',
  saldoFgtsInformado: '',
};

const ROTULOS_MODO: Record<ModoCalculo, string> = {
  folha: 'Folha do mês',
  decimo_terceiro: 'Décimo terceiro',
  rescisao: 'Rescisão',
};

const ROTULOS_MODALIDADE: Record<ModalidadeRescisao, string> = {
  sem_justa_causa: 'Sem justa causa',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Justa causa',
  acordo: 'Acordo entre as partes (art. 484 A)',
  termino_contrato: 'Término de contrato a termo ou experiência',
};

interface InterruptorProps {
  id: string;
  ativo: boolean;
  desabilitado?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onAlternar: (novoEstado: boolean) => void;
}

function Interruptor({
  id,
  ativo,
  desabilitado = false,
  ariaLabel,
  ariaLabelledBy,
  onAlternar,
}: InterruptorProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={desabilitado}
      onClick={() => onAlternar(!ativo)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${
        ativo
          ? 'border-laranja bg-laranja'
          : 'border-border-input bg-input-bg'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full shadow-xs ${
          ativo ? 'translate-x-5 bg-tinta' : 'translate-x-0.5 bg-fg-muted'
        }`}
      />
    </button>
  );
}

export function CalculadoraPage() {
  const prefereMenosMovimento = useReducedMotion();
  const campoAdmissaoRef = useRef<HTMLInputElement | null>(null);
  const botaoAvancarRef = useRef<HTMLButtonElement | null>(null);

  const [tema, setTema] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [baseInssPersonalizada, setBaseInssPersonalizada] = useState<boolean>(true);
  const [modalComoCalculamos, setModalComoCalculamos] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [itensHistorico, setItensHistorico] = useState<ItemHistoricoCalculo[]>(() =>
    lerHistoricoLocal()
  );

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<ValoresFormulario>({
    resolver: zodResolver(esquemaFormulario),
    mode: 'onTouched',
    defaultValues: VALORES_CASO_REFERENCIA_1,
  });

  const {
    fields: camposDescontos,
    append: adicionarDesconto,
    remove: removerDesconto,
  } = useFieldArray({
    control,
    name: 'outrosDescontos',
  });

  const valores = watch();
  const parametros = useMemo(() => obterParametros(ANO_VIGENTE), []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try {
      window.localStorage.setItem('clt-teresina-tema', tema);
    } catch {
      // Ignora indisponibilidade de escrita
    }
  }, [tema]);

  const resultadoAoVivo: ResultadoCalculo = useMemo(() => {
    const salarioCentavos = parseMoedaParaCentavos(valores.salarioBase);
    const baseInssCentavos = parseMoedaParaCentavos(valores.baseInss);
    const pisoCategoriaCentavos = parseMoedaParaCentavos(valores.pisoCategoria ?? '');
    const vtMensalCentavos = parseMoedaParaCentavos(valores.valorValeTransporteMensal ?? '');
    const outros = (valores.outrosDescontos ?? [])
      .map((d) => ({
        descricao: d.descricao,
        valorCentavos: parseMoedaParaCentavos(d.valor),
      }))
      .filter((d) => d.valorCentavos > 0);

    if (valores.modo === 'folha') {
      return calcularFolhaMensal({
        dataAdmissao: valores.dataAdmissao,
        salarioBaseCentavos: salarioCentavos,
        baseInssCentavos,
        diasTrabalhados: valores.diasTrabalhadosFolha,
        tipoContrato: valores.tipoContrato,
        valeTransporteAtivo: valores.valeTransporteAtivo,
        valorValeTransporteMensalCentavos: vtMensalCentavos,
        dependentes: valores.dependentes,
        outrosDescontos: outros,
        pisoCategoriaCentavos,
        parametros,
      });
    }

    if (valores.modo === 'decimo_terceiro') {
      return calcularDecimoTerceiro({
        dataAdmissao: valores.dataAdmissao,
        anoReferencia: ANO_VIGENTE,
        mesesTrabalhados: valores.mesesDecimoTerceiro,
        salarioBaseCentavos: salarioCentavos,
        baseInssCentavos:
          baseInssPersonalizada && baseInssCentavos !== salarioCentavos
            ? baseInssCentavos
            : undefined,
        tipoContrato: valores.tipoContrato,
        dependentes: valores.dependentes,
        outrosDescontos: outros,
        pisoCategoriaCentavos,
        parametros,
      });
    }

    return calcularRescisao({
      dataAdmissao: valores.dataAdmissao,
      dataSaida: valores.dataSaida ?? '',
      modalidade: valores.modalidadeRescisao,
      salarioBaseCentavos: salarioCentavos,
      baseInssCentavos,
      tipoContrato: valores.tipoContrato,
      valeTransporteAtivo: valores.valeTransporteAtivo,
      valorValeTransporteMensalCentavos: vtMensalCentavos,
      dependentes: valores.dependentes,
      outrosDescontos: outros,
      pisoCategoriaCentavos,
      opcoes: {
        avisoPrevioIndenizado: valores.avisoPrevioIndenizado,
        descontarAvisoNaoTrabalhado: valores.descontarAvisoNaoTrabalhado,
        feriasVencidas: valores.feriasVencidas,
        feriasVencidasEmDobro: valores.feriasVencidasEmDobro,
        encerradoAntesDoPrazo: valores.encerradoAntesDoPrazo,
        dataFimPrevistaContrato: valores.dataFimPrevistaContrato,
        saldoFgtsInformadoCentavos: parseMoedaParaCentavos(valores.saldoFgtsInformado ?? ''),
      },
      parametros,
    });
  }, [valores, baseInssPersonalizada, parametros]);

  const verbasEtapa2 = useMemo(() => {
    if (valores.modo !== 'rescisao') return [];
    return listarVerbasEtapaRescisao({
      dataAdmissao: valores.dataAdmissao,
      dataSaida: valores.dataSaida ?? '',
      modalidade: valores.modalidadeRescisao,
      salarioBaseCentavos: parseMoedaParaCentavos(valores.salarioBase),
      tipoContrato: valores.tipoContrato,
      opcoes: {
        avisoPrevioIndenizado: valores.avisoPrevioIndenizado,
        descontarAvisoNaoTrabalhado: valores.descontarAvisoNaoTrabalhado,
        feriasVencidas: valores.feriasVencidas,
        feriasVencidasEmDobro: valores.feriasVencidasEmDobro,
        encerradoAntesDoPrazo: valores.encerradoAntesDoPrazo,
        dataFimPrevistaContrato: valores.dataFimPrevistaContrato,
        saldoFgtsInformadoCentavos: parseMoedaParaCentavos(valores.saldoFgtsInformado ?? ''),
      },
      parametros,
    });
  }, [
    valores.modo,
    valores.dataAdmissao,
    valores.dataSaida,
    valores.modalidadeRescisao,
    valores.salarioBase,
    valores.tipoContrato,
    valores.avisoPrevioIndenizado,
    valores.descontarAvisoNaoTrabalhado,
    valores.feriasVencidas,
    valores.feriasVencidasEmDobro,
    valores.encerradoAntesDoPrazo,
    valores.dataFimPrevistaContrato,
    valores.saldoFgtsInformado,
    parametros,
  ]);

  const descricaoModoAtual =
    valores.modo === 'rescisao'
      ? `Rescisão: ${ROTULOS_MODALIDADE[valores.modalidadeRescisao]}`
      : ROTULOS_MODO[valores.modo];

  const mudarModo = (novoModo: ModoCalculo) => {
    setValue('modo', novoModo, { shouldValidate: false });
    setEtapa(1);
  };

  const carregarCasoReferencia = (qual: 1 | 2 | 3) => {
    if (qual === 1) {
      reset(VALORES_CASO_REFERENCIA_1);
      setBaseInssPersonalizada(true);
      setEtapa(1);
      return;
    }
    if (qual === 2) {
      reset({
        ...VALORES_CASO_REFERENCIA_1,
        modo: 'decimo_terceiro',
        dataAdmissao: '02/01/2026',
        salarioBase: '712,00',
        baseInss: '712,00',
        mesesDecimoTerceiro: 12,
      });
      setBaseInssPersonalizada(false);
      setEtapa(1);
      return;
    }
    reset({
      ...VALORES_CASO_REFERENCIA_1,
      modo: 'decimo_terceiro',
      dataAdmissao: '01/06/2026',
      salarioBase: '712,00',
      baseInss: '712,00',
      mesesDecimoTerceiro: 7,
    });
    setBaseInssPersonalizada(false);
    setEtapa(1);
  };

  const iniciarPreenchimentoManualLimpo = () => {
    reset({
      ...VALORES_CASO_REFERENCIA_1,
      modo: valores.modo,
      dataAdmissao: '',
      dataSaida: '',
      salarioBase: '',
      baseInss: '',
      pisoCategoria: '',
      valeTransporteAtivo: false,
      valorValeTransporteMensal: '',
      dependentes: 0,
      nome: '',
      outrosDescontos: [],
      saldoFgtsInformado: '',
    });
    setBaseInssPersonalizada(false);
    setEtapa(1);
    setTimeout(() => campoAdmissaoRef.current?.focus(), 50);
  };

  const aoAplicarHoleriteImportado = (dados: DadosAplicadosHolerite) => {
    if (dados.nome) setValue('nome', dados.nome, { shouldValidate: true });
    if (dados.dataAdmissao) setValue('dataAdmissao', dados.dataAdmissao, { shouldValidate: true });
    if (dados.tipoContrato) setValue('tipoContrato', dados.tipoContrato);
    if (dados.salarioBaseFormatado) {
      setValue('salarioBase', dados.salarioBaseFormatado, { shouldValidate: true });
    }
    if (dados.baseInssFormatado) {
      setValue('baseInss', dados.baseInssFormatado, { shouldValidate: true });
      setBaseInssPersonalizada(dados.baseInssFormatado !== dados.salarioBaseFormatado);
    }
    setValue('valeTransporteAtivo', dados.valeTransporteAtivo);
    setValue('valorValeTransporteMensal', dados.valorValeTransporteFormatado ?? '');
    setValue(
      'outrosDescontos',
      dados.outrosDescontos.map((d) => ({ descricao: d.descricao, valor: d.valorFormatado }))
    );

    setTimeout(() => {
      if (!dados.dataAdmissao && !getValues('dataAdmissao')) {
        campoAdmissaoRef.current?.focus();
      } else {
        botaoAvancarRef.current?.focus();
      }
    }, 60);
  };

  const salvarResultadoNoHistorico = (res: ResultadoCalculo) => {
    if (!res.valido) return;
    const snap = getValues();
    const atualizados = salvarItemHistoricoLocal({
      modo: snap.modo,
      descricaoModo: descricaoModoAtual,
      nomeTrabalhador: snap.nome?.trim() || undefined,
      totalBrutoCentavos: res.totalBrutoCentavos,
      totalDescontosCentavos: res.totalDescontosCentavos,
      valorLiquidoCentavos: res.valorLiquidoCentavos,
      valoresFormulario: snap as unknown as Record<string, unknown>,
    });
    setItensHistorico(atualizados);
  };

  const avancarDaEtapa1 = async () => {
    const valido = await trigger();
    if (!valido) return;

    if (valores.modo === 'rescisao') {
      setEtapa(2);
    } else {
      salvarResultadoNoHistorico(resultadoAoVivo);
      setEtapa(3);
    }
    window.scrollTo({ top: 0, behavior: prefereMenosMovimento ? 'auto' : 'smooth' });
  };

  const concluirDaEtapa2 = async () => {
    const valido = await trigger();
    if (!valido || !resultadoAoVivo.valido) return;
    salvarResultadoNoHistorico(resultadoAoVivo);
    setEtapa(3);
    window.scrollTo({ top: 0, behavior: prefereMenosMovimento ? 'auto' : 'smooth' });
  };

  const percentualProgresso = etapa === 1 ? 34 : etapa === 2 ? 67 : 100;
  const regAdmissao = register('dataAdmissao');

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <Cabecalho
        tema={tema}
        onAlternarTema={() => setTema((t) => (t === 'dark' ? 'light' : 'dark'))}
        onAbrirComoCalculamos={() => setModalComoCalculamos(true)}
        onAbrirHistorico={() => setHistoricoAberto(true)}
        quantidadeHistorico={itensHistorico.length}
      />

      {/* Seletor animado de modos e exemplos */}
      <div className="no-print border-b border-border bg-surface shadow-2xs">
        <div className="mx-auto flex max-w-layout flex-col justify-between gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center">
          <div
            role="tablist"
            aria-label="Modo de cálculo"
            className="inline-flex flex-wrap rounded-xl border-2 border-border-strong bg-input-bg p-1"
          >
            {(['folha', 'decimo_terceiro', 'rescisao'] as ModoCalculo[]).map((m) => {
              const selecionado = valores.modo === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={selecionado}
                  onClick={() => mudarModo(m)}
                  className={`relative rounded-lg px-4 py-2 text-sm font-bold transition-colors duration-150 ${
                    selecionado ? 'text-branco' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {selecionado && (
                    <motion.span
                      layoutId="aba-modo-ativa"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-azul shadow-xs"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{ROTULOS_MODO[m]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-fg-muted">Exemplos prontos:</span>
            <button
              type="button"
              onClick={() => carregarCasoReferencia(1)}
              className="rounded-lg border-2 border-border-strong bg-surface px-2.5 py-1.5 font-semibold text-fg transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
            >
              Folha R$ 712,00
            </button>
            <button
              type="button"
              onClick={() => carregarCasoReferencia(2)}
              className="rounded-lg border-2 border-border-strong bg-surface px-2.5 py-1.5 font-semibold text-fg transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
            >
              13º integral
            </button>
            <button
              type="button"
              onClick={() => carregarCasoReferencia(3)}
              className="rounded-lg border-2 border-border-strong bg-surface px-2.5 py-1.5 font-semibold text-fg transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:text-brand"
            >
              13º 7 meses
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-layout flex-1 px-4 py-7 pb-28 sm:px-6 lg:pb-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">
          <div>
            {/* Trilho de etapas conectado */}
            <nav
              aria-label="Etapas do cálculo"
              className="no-print mb-6 rounded-2xl border-2 border-border bg-surface p-4 shadow-2xs"
            >
              <ol className="grid grid-cols-3 gap-2 text-sm font-bold">
                <li className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      etapa >= 1 ? 'bg-azul text-branco' : 'bg-surface-subtle text-fg-muted'
                    }`}
                  >
                    1
                  </span>
                  <button
                    type="button"
                    onClick={() => setEtapa(1)}
                    className="text-left text-fg hover:text-brand"
                  >
                    Dados
                  </button>
                </li>

                <li className="flex items-center justify-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      valores.modo !== 'rescisao'
                        ? 'bg-surface-subtle text-fg-subtle'
                        : etapa >= 2
                          ? 'bg-azul text-branco'
                          : 'bg-surface-subtle text-fg-muted'
                    }`}
                  >
                    2
                  </span>
                  {valores.modo === 'rescisao' ? (
                    <button
                      type="button"
                      disabled={etapa < 2}
                      onClick={() => setEtapa(2)}
                      className="disabled:cursor-default disabled:text-fg-muted enabled:text-fg enabled:hover:text-brand"
                    >
                      Verbas
                    </button>
                  ) : (
                    <span className="text-fg-subtle">Verbas</span>
                  )}
                </li>

                <li className="flex items-center justify-end gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      etapa === 3 ? 'bg-laranja text-tinta' : 'bg-surface-subtle text-fg-muted'
                    }`}
                  >
                    3
                  </span>
                  <span className={etapa === 3 ? 'text-fg' : 'text-fg-muted'}>Resultado</span>
                </li>
              </ol>

              <div
                role="progressbar"
                aria-label="Progresso do preenchimento"
                aria-valuenow={percentualProgresso}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
              >
                <motion.div
                  className="h-full rounded-full bg-laranja"
                  initial={false}
                  animate={{ width: `${percentualProgresso}%` }}
                  transition={{ duration: prefereMenosMovimento ? 0 : 0.3, ease: 'easeOut' }}
                />
              </div>
            </nav>

            <AnimatePresence mode="wait" initial={false}>
              {etapa === 1 && (
                <motion.div
                  key="etapa-1"
                  initial={prefereMenosMovimento ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefereMenosMovimento ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  transition={{ duration: prefereMenosMovimento ? 0 : 0.25, ease: 'easeOut' }}
                >
                  <ImportadorHolerite
                    onAplicarDados={aoAplicarHoleriteImportado}
                    onPreencherManualmente={iniciarPreenchimentoManualLimpo}
                  />

                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      void avancarDaEtapa1();
                    }}
                    className="space-y-7 rounded-2xl border-2 border-border bg-surface p-6 shadow-sm sm:p-7"
                  >
                    {/* Bloco principal: Remuneração em destaque */}
                    <div>
                      <h2 className="font-display text-lg font-bold text-fg">
                        Remuneração e bases
                      </h2>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Valores brutos do contrato. A base do INSS acompanha o salário, mas pode ser
                        ajustada conforme o holerite.
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="campo-salario-base"
                            className="block text-sm font-semibold text-fg"
                          >
                            Salário base
                          </label>
                          <div className="grupo-moeda-tactile mt-1.5">
                            <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3.5 font-display text-sm font-bold text-brand">
                              R$
                            </span>
                            <input
                              id="campo-salario-base"
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              aria-invalid={Boolean(errors.salarioBase)}
                              aria-describedby={errors.salarioBase ? 'erro-salario' : undefined}
                              {...register('salarioBase')}
                              onChange={(e) => {
                                const mascarado = aplicarMascaraMoeda(e.target.value);
                                setValue('salarioBase', mascarado, { shouldValidate: true });
                                if (!baseInssPersonalizada) {
                                  setValue('baseInss', mascarado, { shouldValidate: true });
                                }
                              }}
                              className="tabular-nums h-full w-full bg-transparent px-3.5 font-display text-lg font-bold text-fg focus:outline-none"
                            />
                          </div>
                          {errors.salarioBase && (
                            <p
                              id="erro-salario"
                              role="alert"
                              aria-live="polite"
                              className="mt-1.5 text-xs font-semibold text-status-error"
                            >
                              {errors.salarioBase.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <label
                              htmlFor="campo-base-inss"
                              className="block text-sm font-semibold text-fg"
                            >
                              Base do INSS
                            </label>
                            {baseInssPersonalizada && valores.baseInss !== valores.salarioBase && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBaseInssPersonalizada(false);
                                  setValue('baseInss', valores.salarioBase, {
                                    shouldValidate: true,
                                  });
                                }}
                                className="text-xs font-bold text-brand hover:underline"
                              >
                                Igualar ao salário
                              </button>
                            )}
                          </div>
                          <div className="grupo-moeda-tactile mt-1.5">
                            <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3.5 font-display text-sm font-bold text-brand">
                              R$
                            </span>
                            <input
                              id="campo-base-inss"
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              aria-invalid={Boolean(errors.baseInss)}
                              aria-describedby={errors.baseInss ? 'erro-base-inss' : undefined}
                              {...register('baseInss')}
                              onChange={(e) => {
                                const mascarado = aplicarMascaraMoeda(e.target.value);
                                setBaseInssPersonalizada(true);
                                setValue('baseInss', mascarado, { shouldValidate: true });
                              }}
                              className="tabular-nums h-full w-full bg-transparent px-3.5 font-display text-lg font-bold text-fg focus:outline-none"
                            />
                          </div>
                          {errors.baseInss && (
                            <p
                              id="erro-base-inss"
                              role="alert"
                              aria-live="polite"
                              className="mt-1.5 text-xs font-semibold text-status-error"
                            >
                              {errors.baseInss.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Contrato e datas */}
                    <div className="border-t-2 border-border pt-6">
                      <h2 className="font-display text-lg font-bold text-fg">
                        Contrato e datas
                      </h2>

                      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="campo-data-admissao"
                            className="block text-sm font-semibold text-fg"
                          >
                            Data de admissão
                          </label>
                          <input
                            id="campo-data-admissao"
                            type="text"
                            inputMode="numeric"
                            placeholder="DD/MM/AAAA"
                            aria-invalid={Boolean(errors.dataAdmissao)}
                            aria-describedby={errors.dataAdmissao ? 'erro-admissao' : undefined}
                            {...regAdmissao}
                            ref={(el) => {
                              regAdmissao.ref(el);
                              campoAdmissaoRef.current = el;
                            }}
                            onChange={(e) => {
                              const mascarada = aplicarMascaraData(e.target.value);
                              setValue('dataAdmissao', mascarada, { shouldValidate: true });
                              const dt = parseData(mascarada);
                              if (dt && valores.modo === 'decimo_terceiro') {
                                const avosAuto = calcularAvosNoAno(
                                  dt,
                                  { dia: 31, mes: 12, ano: ANO_VIGENTE },
                                  ANO_VIGENTE
                                );
                                if (avosAuto >= 1) {
                                  setValue('mesesDecimoTerceiro', avosAuto);
                                }
                              }
                            }}
                            className="campo-tactile tabular-nums mt-1.5"
                          />
                          {errors.dataAdmissao && (
                            <p
                              id="erro-admissao"
                              role="alert"
                              aria-live="polite"
                              className="mt-1.5 text-xs font-semibold text-status-error"
                            >
                              {errors.dataAdmissao.message}
                            </p>
                          )}
                        </div>

                        {valores.modo === 'rescisao' && (
                          <div>
                            <label
                              htmlFor="campo-data-saida"
                              className="block text-sm font-semibold text-fg"
                            >
                              Data de saída
                            </label>
                            <input
                              id="campo-data-saida"
                              type="text"
                              inputMode="numeric"
                              placeholder="DD/MM/AAAA"
                              aria-invalid={Boolean(errors.dataSaida)}
                              aria-describedby={errors.dataSaida ? 'erro-saida' : undefined}
                              {...register('dataSaida')}
                              onChange={(e) =>
                                setValue('dataSaida', aplicarMascaraData(e.target.value), {
                                  shouldValidate: true,
                                })
                              }
                              className="campo-tactile tabular-nums mt-1.5"
                            />
                            {errors.dataSaida && (
                              <p
                                id="erro-saida"
                                role="alert"
                                aria-live="polite"
                                className="mt-1.5 text-xs font-semibold text-status-error"
                              >
                                {errors.dataSaida.message}
                              </p>
                            )}
                          </div>
                        )}

                        {valores.modo === 'folha' && (
                          <div>
                            <label
                              htmlFor="campo-dias-folha"
                              className="block text-sm font-semibold text-fg"
                            >
                              Dias trabalhados no mês
                            </label>
                            <input
                              id="campo-dias-folha"
                              type="number"
                              min={1}
                              max={30}
                              {...register('diasTrabalhadosFolha', { valueAsNumber: true })}
                              className="campo-tactile tabular-nums mt-1.5"
                            />
                            {errors.diasTrabalhadosFolha && (
                              <p
                                role="alert"
                                aria-live="polite"
                                className="mt-1.5 text-xs font-semibold text-status-error"
                              >
                                {errors.diasTrabalhadosFolha.message}
                              </p>
                            )}
                          </div>
                        )}

                        {valores.modo === 'decimo_terceiro' && (
                          <div>
                            <label
                              htmlFor="campo-meses-13"
                              className="block text-sm font-semibold text-fg"
                            >
                              Meses trabalhados no ano (15 dias ou mais)
                            </label>
                            <input
                              id="campo-meses-13"
                              type="number"
                              min={1}
                              max={12}
                              {...register('mesesDecimoTerceiro', { valueAsNumber: true })}
                              className="campo-tactile tabular-nums mt-1.5"
                            />
                            {errors.mesesDecimoTerceiro && (
                              <p
                                role="alert"
                                aria-live="polite"
                                className="mt-1.5 text-xs font-semibold text-status-error"
                              >
                                {errors.mesesDecimoTerceiro.message}
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="campo-tipo-contrato"
                            className="block text-sm font-semibold text-fg"
                          >
                            Regime contratual
                          </label>
                          <select
                            id="campo-tipo-contrato"
                            {...register('tipoContrato')}
                            onChange={(e) => {
                              setValue('tipoContrato', e.target.value as TipoContrato);
                            }}
                            className="campo-tactile mt-1.5"
                          >
                            <option value="clt">CLT padrão (FGTS de 8%)</option>
                            <option value="aprendiz">Aprendizagem (FGTS de 2%)</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="campo-jornada"
                            className="block text-sm font-semibold text-fg"
                          >
                            Jornada semanal
                          </label>
                          <select
                            id="campo-jornada"
                            {...register('jornada')}
                            className="campo-tactile mt-1.5"
                          >
                            <option value="44h">44 horas semanais</option>
                            <option value="40h">40 horas semanais</option>
                            <option value="36h">36 horas semanais</option>
                            <option value="30h">30 horas semanais</option>
                            <option value="20h">20 horas semanais</option>
                          </select>
                        </div>
                      </div>

                      {valores.modo === 'rescisao' && (
                        <div className="mt-5 space-y-4 rounded-xl border-2 border-border bg-surface-subtle/50 p-4">
                          <div>
                            <label
                              htmlFor="campo-modalidade"
                              className="block text-sm font-semibold text-fg"
                            >
                              Modalidade da rescisão
                            </label>
                            <select
                              id="campo-modalidade"
                              {...register('modalidadeRescisao')}
                              className="campo-tactile mt-1.5"
                            >
                              {Object.entries(ROTULOS_MODALIDADE).map(([valor, texto]) => (
                                <option key={valor} value={valor}>
                                  {texto}
                                </option>
                              ))}
                            </select>
                          </div>

                          {valores.modalidadeRescisao === 'termino_contrato' && (
                            <div className="space-y-3 pt-1">
                              <div className="flex items-center justify-between gap-3">
                                <span
                                  id="label-encerrado-antes"
                                  className="text-sm font-semibold text-fg"
                                >
                                  Contrato encerrado antes do prazo pela empresa
                                </span>
                                <Interruptor
                                  id="switch-encerrado-antes"
                                  ariaLabelledBy="label-encerrado-antes"
                                  ativo={valores.encerradoAntesDoPrazo}
                                  onAlternar={(v) => setValue('encerradoAntesDoPrazo', v)}
                                />
                              </div>

                              <AnimatePresence initial={false}>
                                {valores.encerradoAntesDoPrazo && (
                                  <motion.div
                                    initial={prefereMenosMovimento ? false : { opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <label
                                      htmlFor="campo-data-fim-prevista"
                                      className="block text-sm font-semibold text-fg"
                                    >
                                      Data final prevista do contrato
                                    </label>
                                    <input
                                      id="campo-data-fim-prevista"
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="DD/MM/AAAA"
                                      aria-invalid={Boolean(errors.dataFimPrevistaContrato)}
                                      aria-describedby={
                                        errors.dataFimPrevistaContrato
                                          ? 'erro-fim-prevista'
                                          : undefined
                                      }
                                      value={valores.dataFimPrevistaContrato ?? ''}
                                      onChange={(e) =>
                                        setValue(
                                          'dataFimPrevistaContrato',
                                          aplicarMascaraData(e.target.value),
                                          { shouldValidate: true }
                                        )
                                      }
                                      className="campo-tactile tabular-nums mt-1.5 max-w-xs"
                                    />
                                    {errors.dataFimPrevistaContrato && (
                                      <p
                                        id="erro-fim-prevista"
                                        role="alert"
                                        aria-live="polite"
                                        className="mt-1.5 text-xs font-semibold text-status-error"
                                      >
                                        {errors.dataFimPrevistaContrato.message}
                                      </p>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bloco 3: Opções adicionais, Vale-transporte e Descontos */}
                    <div className="border-t-2 border-border pt-6">
                      <h2 className="font-display text-lg font-bold text-fg">
                        Benefícios, dependentes e descontos
                      </h2>

                      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="campo-piso-categoria"
                            className="block text-sm font-semibold text-fg"
                          >
                            Piso da categoria (convenção coletiva){' '}
                            <span className="font-normal text-fg-muted">(opcional)</span>
                          </label>
                          <div className="grupo-moeda-tactile mt-1.5 !h-11">
                            <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3 text-xs font-bold text-brand">
                              R$
                            </span>
                            <input
                              id="campo-piso-categoria"
                              type="text"
                              inputMode="decimal"
                              placeholder="Substitui o piso geral"
                              value={valores.pisoCategoria ?? ''}
                              onChange={(e) =>
                                setValue('pisoCategoria', aplicarMascaraMoeda(e.target.value))
                              }
                              className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-medium text-fg focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="campo-dependentes"
                            className="block text-sm font-semibold text-fg"
                          >
                            Dependentes para IRRF{' '}
                            <span className="font-normal text-fg-muted">(opcional)</span>
                          </label>
                          <input
                            id="campo-dependentes"
                            type="number"
                            min={0}
                            max={30}
                            {...register('dependentes', { valueAsNumber: true })}
                            className="campo-tactile tabular-nums mt-1.5"
                          />
                        </div>

                        {valores.modo === 'rescisao' && (
                          <div>
                            <label
                              htmlFor="campo-saldo-fgts"
                              className="block text-sm font-semibold text-fg"
                            >
                              Saldo acumulado do FGTS{' '}
                              <span className="font-normal text-fg-muted">(opcional)</span>
                            </label>
                            <div className="grupo-moeda-tactile mt-1.5 !h-11">
                              <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3 text-xs font-bold text-brand">
                                R$
                              </span>
                              <input
                                id="campo-saldo-fgts"
                                type="text"
                                inputMode="decimal"
                                placeholder="Em branco estima pelos meses"
                                value={valores.saldoFgtsInformado ?? ''}
                                onChange={(e) =>
                                  setValue('saldoFgtsInformado', aplicarMascaraMoeda(e.target.value))
                                }
                                className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-medium text-fg focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label htmlFor="campo-nome" className="block text-sm font-semibold text-fg">
                            Nome do trabalhador{' '}
                            <span className="font-normal text-fg-muted">(opcional)</span>
                          </label>
                          <input
                            id="campo-nome"
                            type="text"
                            placeholder="Para constar no demonstrativo PDF"
                            {...register('nome')}
                            className="campo-tactile mt-1.5"
                          />
                        </div>
                      </div>

                      {valores.modo !== 'decimo_terceiro' && (
                        <div className="mt-5 rounded-xl border-2 border-border bg-surface-subtle/50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <span
                                id="label-switch-vt"
                                className="block text-sm font-semibold text-fg"
                              >
                                Vale-transporte
                              </span>
                              <span className="text-xs text-fg-muted">
                                Desconto de até 6% do salário proporcional, limitado ao valor fornecido.
                              </span>
                            </div>
                            <Interruptor
                              id="switch-vale-transporte"
                              ariaLabelledBy="label-switch-vt"
                              ativo={valores.valeTransporteAtivo}
                              onAlternar={(v) => setValue('valeTransporteAtivo', v)}
                            />
                          </div>

                          <AnimatePresence initial={false}>
                            {valores.valeTransporteAtivo && (
                              <motion.div
                                initial={prefereMenosMovimento ? false : { opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 max-w-xs">
                                  <label
                                    htmlFor="campo-valor-vt"
                                    className="block text-sm font-semibold text-fg"
                                  >
                                    Valor mensal fornecido
                                  </label>
                                  <div className="grupo-moeda-tactile mt-1.5 !h-11">
                                    <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3 text-xs font-bold text-brand">
                                      R$
                                    </span>
                                    <input
                                      id="campo-valor-vt"
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0,00"
                                      aria-invalid={Boolean(errors.valorValeTransporteMensal)}
                                      aria-describedby={
                                        errors.valorValeTransporteMensal ? 'erro-vt' : undefined
                                      }
                                      value={valores.valorValeTransporteMensal ?? ''}
                                      onChange={(e) =>
                                        setValue(
                                          'valorValeTransporteMensal',
                                          aplicarMascaraMoeda(e.target.value),
                                          { shouldValidate: true }
                                        )
                                      }
                                      className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-semibold text-fg focus:outline-none"
                                    />
                                  </div>
                                  {errors.valorValeTransporteMensal && (
                                    <p
                                      id="erro-vt"
                                      role="alert"
                                      aria-live="polite"
                                      className="mt-1.5 text-xs font-semibold text-status-error"
                                    >
                                      {errors.valorValeTransporteMensal.message}
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-fg">
                            Outros descontos{' '}
                            <span className="font-normal text-fg-muted">(opcional)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => adicionarDesconto({ descricao: '', valor: '' })}
                            className="rounded-xl border-2 border-border-strong bg-surface px-3 py-1.5 text-xs font-bold text-fg transition-colors duration-150 hover:border-brand hover:text-brand"
                          >
                            Adicionar desconto
                          </button>
                        </div>

                        <AnimatePresence initial={false}>
                          {camposDescontos.map((campo, idx) => (
                            <motion.div
                              key={campo.id}
                              initial={prefereMenosMovimento ? false : { opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_160px_auto]"
                            >
                              <input
                                type="text"
                                placeholder="Descrição (ex.: Convênio, Adiantamento)"
                                aria-label={`Descrição do desconto ${idx + 1}`}
                                {...register(`outrosDescontos.${idx}.descricao`)}
                                className="campo-tactile"
                              />
                              <div className="grupo-moeda-tactile !h-11">
                                <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-2.5 text-xs font-bold text-brand">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  aria-label={`Valor do desconto ${idx + 1}`}
                                  value={valores.outrosDescontos?.[idx]?.valor ?? ''}
                                  onChange={(e) =>
                                    setValue(
                                      `outrosDescontos.${idx}.valor`,
                                      aplicarMascaraMoeda(e.target.value)
                                    )
                                  }
                                  className="tabular-nums h-full w-full bg-transparent px-2.5 text-sm font-medium text-fg focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removerDesconto(idx)}
                                aria-label={`Remover desconto ${idx + 1}`}
                                className="h-11 rounded-xl border-2 border-border-strong px-3.5 text-xs font-semibold text-fg-muted transition-colors duration-150 hover:border-status-error hover:text-status-error"
                              >
                                Remover
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex justify-end border-t-2 border-border pt-5">
                      <motion.button
                        ref={botaoAvancarRef}
                        type="submit"
                        whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                        whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
                        className="rounded-xl bg-laranja px-7 py-3.5 font-display text-base font-bold text-tinta shadow-md transition-colors duration-150 hover:bg-laranja-hover"
                      >
                        {valores.modo === 'rescisao'
                          ? 'Continuar para verbas'
                          : 'Calcular resultado'}
                      </motion.button>
                    </div>
                  </form>
                </motion.div>
              )}

              {etapa === 2 && valores.modo === 'rescisao' && (
                <motion.div
                  key="etapa-2"
                  initial={prefereMenosMovimento ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefereMenosMovimento ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  transition={{ duration: prefereMenosMovimento ? 0 : 0.25, ease: 'easeOut' }}
                  className="overflow-hidden rounded-2xl border-2 border-border bg-surface shadow-sm"
                >
                  <div className="border-b-2 border-border px-6 py-5">
                    <h2 className="font-display text-lg font-bold text-fg">
                      Verbas da modalidade selecionada
                    </h2>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {ROTULOS_MODALIDADE[valores.modalidadeRescisao]}. As verbas obrigatórias vêm
                      ativadas e fixadas por lei.
                    </p>
                  </div>

                  <div className="divide-y divide-border">
                    {verbasEtapa2.map((verba, idx) => {
                      const alternar = (checked: boolean) => {
                        if (verba.id === 'avisoPrevioIndenizado') {
                          setValue('avisoPrevioIndenizado', checked);
                        } else if (verba.id === 'descontarAvisoNaoTrabalhado') {
                          setValue('descontarAvisoNaoTrabalhado', checked);
                        } else if (verba.id === 'feriasVencidas') {
                          setValue('feriasVencidas', checked);
                          if (!checked) setValue('feriasVencidasEmDobro', false);
                        } else if (verba.id === 'feriasVencidasEmDobro') {
                          setValue('feriasVencidasEmDobro', checked);
                        }
                      };

                      const idRotulo = `rotulo-verba-${verba.id}`;

                      return (
                        <motion.div
                          key={verba.id}
                          initial={prefereMenosMovimento ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: prefereMenosMovimento ? 0 : 0.2,
                            delay: prefereMenosMovimento ? 0 : idx * 0.04,
                          }}
                          className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                        >
                          <div className="max-w-md space-y-1">
                            <div className="flex items-center gap-2">
                              <span id={idRotulo} className="text-sm font-bold text-fg">
                                {verba.rotulo}
                              </span>
                              {verba.obrigatoria && (
                                <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-brand">
                                  Obrigatória
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-fg-muted">{verba.descricaoCurta}</p>
                            {verba.obrigatoria && verba.motivoBloqueio && (
                              <p className="text-xs font-medium text-brand">{verba.motivoBloqueio}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="tabular-nums font-display text-base font-bold text-fg">
                              {formatarCentavos(verba.valorPrevistoCentavos)}
                            </span>
                            <Interruptor
                              id={`switch-verba-${verba.id}`}
                              ariaLabelledBy={idRotulo}
                              ativo={verba.ativa}
                              desabilitado={verba.obrigatoria}
                              onAlternar={alternar}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-surface-subtle/50 px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setEtapa(1)}
                      className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-fg transition-colors duration-150 hover:border-brand"
                    >
                      Voltar aos dados
                    </button>

                    <motion.button
                      type="button"
                      whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
                      whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
                      onClick={() => void concluirDaEtapa2()}
                      className="rounded-xl bg-laranja px-6 py-3 font-display text-sm font-bold text-tinta shadow-sm transition-colors duration-150 hover:bg-laranja-hover"
                    >
                      Ver resultado
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {etapa === 3 && resultadoAoVivo.valido && (
                <motion.div
                  key="etapa-3"
                  initial={prefereMenosMovimento ? false : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefereMenosMovimento ? { opacity: 0 } : { opacity: 0, x: -24 }}
                  transition={{ duration: prefereMenosMovimento ? 0 : 0.25, ease: 'easeOut' }}
                >
                  <PainelResultado
                    resultado={resultadoAoVivo}
                    descricaoModo={descricaoModoAtual}
                    nomeTrabalhador={valores.nome?.trim() || undefined}
                    onBaixarPdf={() =>
                      gerarPdfDemonstrativo(resultadoAoVivo, {
                        nomeTrabalhador: valores.nome?.trim() || undefined,
                        dataAdmissao: valores.dataAdmissao,
                        dataSaida: valores.modo === 'rescisao' ? valores.dataSaida : undefined,
                        descricaoModo: descricaoModoAtual,
                      })
                    }
                    onImprimir={() => window.print()}
                    onNovoCalculo={iniciarPreenchimentoManualLimpo}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ResumoCalculoAoVivo
            resultado={resultadoAoVivo}
            descricaoModo={descricaoModoAtual}
          />
        </div>
      </main>

      <footer className="no-print border-t-2 border-border bg-surface py-4">
        <div className="mx-auto flex max-w-layout flex-wrap items-center justify-between gap-2 px-4 text-xs text-fg-muted sm:px-6">
          <span className="font-display font-bold text-fg">Calculadora CLT Teresina</span>
          <span>
            Parâmetros de {ANO_VIGENTE}, conferidos em {DATA_ULTIMA_CONFERENCIA}
          </span>
        </div>
      </footer>

      <ModalComoCalculamos
        aberto={modalComoCalculamos}
        onFechar={() => setModalComoCalculamos(false)}
      />

      <PainelHistorico
        aberto={historicoAberto}
        itens={itensHistorico}
        onFechar={() => setHistoricoAberto(false)}
        onRestaurar={(item) => {
          const salvo = item.valoresFormulario as unknown as ValoresFormulario;
          if (salvo && salvo.salarioBase) {
            reset(salvo);
            setBaseInssPersonalizada(salvo.baseInss !== salvo.salarioBase);
            setEtapa(3);
          }
          setHistoricoAberto(false);
        }}
        onRemover={(id) => setItensHistorico(removerItemHistoricoLocal(id))}
        onLimparTudo={() => setItensHistorico(limparHistoricoLocal())}
      />
    </div>
  );
}
