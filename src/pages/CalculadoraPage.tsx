import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  Calculator,
  CheckCircle2,
  GraduationCap,
  Plus,
  Trash2,
} from 'lucide-react';
import { ANO_VIGENTE, obterParametros } from '../config/parametros';
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
import {
  CampoDependenciaHolerite,
  ResumoCalculoAoVivo,
} from '../components/ResumoCalculoAoVivo';
import { gerarPdfDemonstrativo } from '../utils/gerarPdf';
import {
  ItemHistoricoCalculo,
  lerHistoricoLocal,
  limparHistoricoLocal,
  removerItemHistoricoLocal,
  salvarItemHistoricoLocal,
} from '../utils/historico';

/**
 * Coreografia alternada do Quadrado do Holerite em cada aba:
 * 1ª aba (Folha do mês) -> ESQUERDA ('left')
 * 2ª aba (Décimo terceiro) -> DIREITA ('right')
 * 3ª aba (Rescisão) -> ESQUERDA ('left')
 */
export const PANEL_SIDE = {
  folha: 'left',
  decimo: 'right',
  rescisao: 'left',
} as const;

export function obterLadoPainel(modo: ModoCalculo): 'left' | 'right' {
  if (modo === 'rescisao') return PANEL_SIDE.rescisao;
  if (modo === 'decimo_terceiro') return PANEL_SIDE.decimo;
  return PANEL_SIDE.folha;
}

interface EstadoFluxo {
  modo: ModoCalculo;
  etapa: 'editando' | 'concluido';
  subEtapaRescisao: 'dados' | 'verbas';
}

type AcaoFluxo =
  | { type: 'MUDAR_MODO'; modo: ModoCalculo }
  | { type: 'IR_PARA_VERBAS' }
  | { type: 'VOLTAR_AOS_DADOS' }
  | { type: 'CONCLUIR' }
  | { type: 'EDITAR_DADOS' };

function reducerFluxo(estado: EstadoFluxo, acao: AcaoFluxo): EstadoFluxo {
  switch (acao.type) {
    case 'MUDAR_MODO':
      return {
        modo: acao.modo,
        etapa: 'editando',
        subEtapaRescisao: 'dados',
      };
    case 'IR_PARA_VERBAS':
      return {
        ...estado,
        etapa: 'editando',
        subEtapaRescisao: 'verbas',
      };
    case 'VOLTAR_AOS_DADOS':
      return {
        ...estado,
        etapa: 'editando',
        subEtapaRescisao: 'dados',
      };
    case 'CONCLUIR':
      return {
        ...estado,
        etapa: 'concluido',
      };
    case 'EDITAR_DADOS':
      return {
        ...estado,
        etapa: 'editando',
      };
    default:
      return estado;
  }
}

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

const SUBTITULOS_MODO: Record<ModoCalculo, string> = {
  folha: 'Salário mensal, INSS, IRRF e FGTS',
  decimo_terceiro: '1ª e 2ª parcelas e avos proporcionais',
  rescisao: 'Verbas, férias + 1/3, aviso e multa FGTS',
};

const ROTULOS_MODALIDADE: Record<ModalidadeRescisao, string> = {
  sem_justa_causa: 'Sem justa causa',
  pedido_demissao: 'Pedido de demissão',
  justa_causa: 'Justa causa',
  acordo: 'Acordo entre as partes (art. 484 A)',
  termino_contrato: 'Término de contrato a termo ou experiência',
};

const HORAS_MENSAIS_POR_JORNADA: Record<string, number> = {
  '44h': 220,
  '40h': 200,
  '36h': 180,
  '30h': 150,
  '24h': 120,
  '20h': 100,
};

const MOLA_COLUNAS = {
  type: 'spring' as const,
  stiffness: 170,
  damping: 22,
  mass: 0.88,
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
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
        ativo
          ? 'border-tinta bg-laranja shadow-[0_2px_0_0_#08122E]'
          : 'border-border-strong bg-surface-subtle'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full border border-tinta ${
          ativo ? 'translate-x-7 bg-branco' : 'translate-x-1 bg-azul'
        }`}
      />
    </button>
  );
}

export function CalculadoraPage() {
  const prefereMenosMovimento = Boolean(useReducedMotion());
  const campoAdmissaoRef = useRef<HTMLInputElement | null>(null);
  const botaoAvancarRef = useRef<HTMLButtonElement | null>(null);
  const debounceDigitacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTrocaModoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tema, setTema] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  const [fluxo, dispatchFluxo] = useReducer(reducerFluxo, {
    modo: 'folha',
    etapa: 'editando',
    subEtapaRescisao: 'dados',
  });

  const [baseInssPersonalizada, setBaseInssPersonalizada] = useState<boolean>(true);
  const [baseInssEditadaManualmente, setBaseInssEditadaManualmente] = useState<boolean>(false);
  const [cenarioAtivo, setCenarioAtivo] = useState<1 | 2 | 3 | null>(1);
  const [camposAlterados, setCamposAlterados] = useState<CampoDependenciaHolerite[]>([]);
  const [cicloDigitacao, setCicloDigitacao] = useState<number>(0);
  const [trocandoModo, setTrocandoModo] = useState<boolean>(false);
  const [mostrarRubricasConcluido, setMostrarRubricasConcluido] = useState<boolean>(false);

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

  useEffect(() => {
    return () => {
      if (debounceDigitacaoRef.current) clearTimeout(debounceDigitacaoRef.current);
      if (timeoutTrocaModoRef.current) clearTimeout(timeoutTrocaModoRef.current);
    };
  }, []);

  const notificarAlteracaoCampo = (deps: CampoDependenciaHolerite[]) => {
    if (debounceDigitacaoRef.current) {
      clearTimeout(debounceDigitacaoRef.current);
    }
    debounceDigitacaoRef.current = setTimeout(() => {
      setCamposAlterados(deps);
      setCicloDigitacao((c) => c + 1);
    }, 200);
  };

  const salarioCentavosAtual = parseMoedaParaCentavos(valores.salarioBase);
  const salarioVazio = !valores.salarioBase.trim() || salarioCentavosAtual <= 0;

  const metricasUnidadesContrato = useMemo(() => {
    const divisorHoras = HORAS_MENSAIS_POR_JORNADA[valores.jornada] ?? 220;
    const valorDiaCentavos = salarioCentavosAtual > 0 ? Math.round(salarioCentavosAtual / 30) : 0;
    const valorHoraCentavos =
      salarioCentavosAtual > 0 ? Math.round(salarioCentavosAtual / divisorHoras) : 0;
    const valorAvoCentavos = salarioCentavosAtual > 0 ? Math.round(salarioCentavosAtual / 12) : 0;
    const aliquotaFgts = valores.tipoContrato === 'aprendiz' ? 0.02 : 0.08;
    const fgtsMensalCentavos =
      salarioCentavosAtual > 0 ? Math.round(salarioCentavosAtual * aliquotaFgts) : 0;

    return {
      divisorHoras,
      valorDiaCentavos,
      valorHoraCentavos,
      valorAvoCentavos,
      aliquotaFgtsTexto: valores.tipoContrato === 'aprendiz' ? '2%' : '8%',
      fgtsMensalCentavos,
    };
  }, [salarioCentavosAtual, valores.jornada, valores.tipoContrato]);

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

  const textoRegimeHolerite =
    valores.tipoContrato === 'aprendiz' ? 'Aprendizagem' : 'CLT padrão';

  const subtituloHolerite =
    valores.modo === 'rescisao'
      ? `Rescisão · ${ROTULOS_MODALIDADE[valores.modalidadeRescisao].toLowerCase()} · ${textoRegimeHolerite} · ${valores.jornada}/semana`
      : `${ROTULOS_MODO[valores.modo]} · ${textoRegimeHolerite} · ${valores.jornada}/semana`;

  const ladoPainel = obterLadoPainel(valores.modo);

  const dispararPulsoTroca = () => {
    setTrocandoModo(true);
    if (timeoutTrocaModoRef.current) clearTimeout(timeoutTrocaModoRef.current);
    timeoutTrocaModoRef.current = setTimeout(() => setTrocandoModo(false), 560);
  };

  const mudarModo = (novoModo: ModoCalculo) => {
    setValue('modo', novoModo, { shouldValidate: false });
    dispatchFluxo({ type: 'MUDAR_MODO', modo: novoModo });
    setCamposAlterados([]);
    setCicloDigitacao(0);
    dispararPulsoTroca();
  };

  const carregarCasoReferencia = (qual: 1 | 2 | 3) => {
    setCamposAlterados([]);
    setCicloDigitacao(0);
    dispararPulsoTroca();
    if (qual === 1) {
      reset(VALORES_CASO_REFERENCIA_1);
      setBaseInssPersonalizada(true);
      setBaseInssEditadaManualmente(false);
      setCenarioAtivo(1);
      dispatchFluxo({ type: 'MUDAR_MODO', modo: 'folha' });
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
      setBaseInssEditadaManualmente(false);
      setCenarioAtivo(2);
      dispatchFluxo({ type: 'MUDAR_MODO', modo: 'decimo_terceiro' });
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
    setBaseInssEditadaManualmente(false);
    setCenarioAtivo(3);
    dispatchFluxo({ type: 'MUDAR_MODO', modo: 'decimo_terceiro' });
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
    setBaseInssEditadaManualmente(false);
    setCenarioAtivo(null);
    setCamposAlterados([]);
    setCicloDigitacao(0);
    dispatchFluxo({ type: 'VOLTAR_AOS_DADOS' });
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
      const diferente = dados.baseInssFormatado !== dados.salarioBaseFormatado;
      setBaseInssPersonalizada(diferente);
      setBaseInssEditadaManualmente(diferente);
    }
    setValue('valeTransporteAtivo', dados.valeTransporteAtivo);
    setValue('valorValeTransporteMensal', dados.valorValeTransporteFormatado ?? '');
    setValue(
      'outrosDescontos',
      dados.outrosDescontos.map((d) => ({ descricao: d.descricao, valor: d.valorFormatado }))
    );
    setCenarioAtivo(null);
    notificarAlteracaoCampo(['salario', 'inss', 'datas', 'vt', 'descontos', 'regime']);

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

  const concluirCalculo = async () => {
    const valido = await trigger();
    if (!valido || !resultadoAoVivo.valido) return;
    salvarResultadoNoHistorico(resultadoAoVivo);
    setCamposAlterados([]);
    setCicloDigitacao(0);
    dispatchFluxo({ type: 'CONCLUIR' });
    window.scrollTo({ top: 0, behavior: prefereMenosMovimento ? 'auto' : 'smooth' });
  };

  const avancarParaVerbasRescisao = async () => {
    const valido = await trigger();
    if (!valido) return;
    dispatchFluxo({ type: 'IR_PARA_VERBAS' });
    window.scrollTo({ top: 0, behavior: prefereMenosMovimento ? 'auto' : 'smooth' });
  };

  const passoNumero =
    fluxo.etapa === 'concluido' ? 3 : fluxo.subEtapaRescisao === 'verbas' ? 2 : 1;
  const percentualProgresso = passoNumero === 1 ? 34 : passoNumero === 2 ? 67 : 100;

  const regAdmissao = register('dataAdmissao');

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-fg">
      {/* Luzes ambientes animadas no fundo que acompanham a troca de lado Esquerda <-> Direita */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <motion.div
          animate={
            prefereMenosMovimento
              ? undefined
              : {
                  x: ladoPainel === 'left' ? '-8%' : '52%',
                  y: ladoPainel === 'left' ? '4%' : '12%',
                }
          }
          transition={{ type: 'spring', stiffness: 70, damping: 24 }}
          className="h-[460px] w-[460px] rounded-full bg-laranja/15 blur-3xl"
        />
        <motion.div
          animate={
            prefereMenosMovimento
              ? undefined
              : {
                  x: ladoPainel === 'left' ? '55%' : '-5%',
                  y: ladoPainel === 'left' ? '18%' : '6%',
                }
          }
          transition={{ type: 'spring', stiffness: 70, damping: 24 }}
          className="h-[520px] w-[520px] rounded-full bg-azul/20 blur-3xl"
        />
      </div>

      <Cabecalho
        tema={tema}
        onAlternarTema={() => setTema((t) => (t === 'dark' ? 'light' : 'dark'))}
        onAbrirComoCalculamos={() => setModalComoCalculamos(true)}
        onAbrirHistorico={() => setHistoricoAberto(true)}
        quantidadeHistorico={itensHistorico.length}
      />

      {/* Abas animadas e exemplos prontos (sem botões desnecessários de lado) */}
      <div className="no-print border-b-2 border-border-strong bg-surface shadow-sm">
        <div className="mx-auto max-w-layout px-4 py-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div
              role="tablist"
              aria-label="Modo de cálculo"
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
              {(['folha', 'decimo_terceiro', 'rescisao'] as ModoCalculo[]).map((m) => {
                const selecionado = valores.modo === m;
                return (
                  <motion.button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={selecionado}
                    whileHover={prefereMenosMovimento ? undefined : { y: -2, scale: 1.01 }}
                    whileTap={prefereMenosMovimento ? undefined : { y: 1, scale: 0.98 }}
                    onClick={() => mudarModo(m)}
                    className={`group relative flex min-h-[56px] cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl border-2 px-4 py-2.5 text-left transition-colors duration-150 ${
                      selecionado
                        ? 'border-tinta text-branco shadow-[0_4px_0_0_#FD701C]'
                        : 'border-border-strong bg-surface-subtle text-fg shadow-[0_3px_0_0_var(--border-default)] hover:border-laranja hover:bg-surface-warm'
                    }`}
                  >
                    {selecionado && (
                      <motion.span
                        layoutId="aba-21st-pill"
                        transition={
                          prefereMenosMovimento
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 320, damping: 28 }
                        }
                        aria-hidden="true"
                        className="absolute inset-0 bg-azul"
                      />
                    )}
                    <div className="relative z-10">
                      <span
                        className={`block font-display text-sm font-extrabold sm:text-base ${
                          selecionado ? 'text-branco' : 'text-fg'
                        }`}
                      >
                        {ROTULOS_MODO[m]}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`block text-xs font-medium ${
                          selecionado ? 'text-azul-claro' : 'text-fg-muted'
                        }`}
                      >
                        {SUBTITULOS_MODO[m]}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-brand">Exemplos:</span>
              {(
                [
                  { id: 1 as const, rotulo: 'Folha de R$ 712,00' },
                  { id: 2 as const, rotulo: '13º integral' },
                  { id: 3 as const, rotulo: '13º de 7 meses' },
                ] as const
              ).map((ex) => {
                const ativo = cenarioAtivo === ex.id;
                return (
                  <motion.button
                    key={ex.id}
                    type="button"
                    whileHover={prefereMenosMovimento ? undefined : { y: -1 }}
                    whileTap={prefereMenosMovimento ? undefined : { scale: 0.97 }}
                    onClick={() => carregarCasoReferencia(ex.id)}
                    aria-pressed={ativo}
                    className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-colors ${
                      ativo
                        ? 'border-tinta bg-laranja text-tinta shadow-[0_3px_0_0_#08122E]'
                        : 'border-border-strong bg-surface text-fg hover:border-laranja hover:bg-surface-warm'
                    }`}
                  >
                    {ativo && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    <span>{ex.rotulo}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-layout flex-1 px-4 py-7 pb-28 sm:px-6 min-[900px]:pb-14">
        <LayoutGroup>
          {fluxo.etapa === 'concluido' ? (
            <motion.div
              key="modo-concluido"
              layout={!prefereMenosMovimento}
              transition={prefereMenosMovimento ? { duration: 0.12 } : MOLA_COLUNAS}
              className="mx-auto w-full max-w-[640px] space-y-6"
            >
              <ResumoCalculoAoVivo
                resultado={resultadoAoVivo}
                modo={valores.modo}
                subtituloHolerite={subtituloHolerite}
                salarioVazio={salarioVazio}
                etapa="concluido"
                camposAlterados={[]}
                cicloDigitacao={0}
                ladoAtual={ladoPainel}
              />

              <div className="cartao-identidade no-print space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => dispatchFluxo({ type: 'EDITAR_DADOS' })}
                      className="btn-azul-tactile text-sm"
                    >
                      Editar dados
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        gerarPdfDemonstrativo(resultadoAoVivo, {
                          nomeTrabalhador: valores.nome?.trim() || undefined,
                          dataAdmissao: valores.dataAdmissao,
                          dataSaida: valores.modo === 'rescisao' ? valores.dataSaida : undefined,
                          descricaoModo: descricaoModoAtual,
                        })
                      }
                      className="btn-laranja-tactile text-sm"
                    >
                      Baixar demonstrativo (PDF)
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="btn-superficie-tactile text-sm"
                    >
                      Imprimir
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={iniciarPreenchimentoManualLimpo}
                    className="btn-superficie-tactile text-sm"
                  >
                    Novo cálculo
                  </button>
                </div>

                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setMostrarRubricasConcluido((v) => !v)}
                    className="cursor-pointer bg-transparent p-0 text-xs font-bold text-brand underline underline-offset-4"
                  >
                    {mostrarRubricasConcluido
                      ? 'Ocultar detalhamento passo a passo por rubrica'
                      : 'Ver detalhamento por rubrica (passo a passo)'}
                  </button>
                </div>

                {mostrarRubricasConcluido && (
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
                )}
              </div>
            </motion.div>
          ) : (
            /* Duas colunas do mesmo tamanho (50% / 50%) e mesma altura (items-stretch), sem rolagem interna */
            <div className="grid grid-cols-1 gap-8 min-[900px]:grid-cols-2 min-[900px]:items-stretch">
              {/* Coluna do Formulário */}
              <motion.div
                key="coluna-formulario"
                layout={!prefereMenosMovimento}
                transition={prefereMenosMovimento ? { duration: 0.12 } : MOLA_COLUNAS}
                className={`flex min-w-0 flex-col ${
                  ladoPainel === 'left' ? 'min-[900px]:order-2' : 'min-[900px]:order-1'
                }`}
              >
                <motion.div layout="position" className="flex flex-1 flex-col">
                  {/* Trilho de etapas animado */}
                  <nav
                    aria-label="Etapas do cálculo"
                    className="cartao-identidade no-print mb-6 overflow-hidden p-4"
                  >
                    <ol className="grid grid-cols-3 gap-2 text-sm font-extrabold">
                      <li className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                            passoNumero === 1
                              ? 'border-tinta bg-laranja text-tinta'
                              : 'border-tinta bg-azul text-branco'
                          }`}
                        >
                          1
                        </span>
                        <button
                          type="button"
                          onClick={() => dispatchFluxo({ type: 'VOLTAR_AOS_DADOS' })}
                          className="cursor-pointer rounded-lg px-2 py-1 text-left font-extrabold text-fg hover:bg-surface-subtle"
                        >
                          Dados
                        </button>
                      </li>

                      <li className="flex items-center justify-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                            valores.modo !== 'rescisao'
                              ? 'border-border bg-surface-subtle text-fg-subtle'
                              : passoNumero === 2
                                ? 'border-tinta bg-laranja text-tinta'
                                : 'border-border-strong bg-surface-subtle text-fg-muted'
                          }`}
                        >
                          2
                        </span>
                        {valores.modo === 'rescisao' ? (
                          <button
                            type="button"
                            onClick={() => void avancarParaVerbasRescisao()}
                            className="cursor-pointer rounded-lg px-2 py-1 font-extrabold text-fg hover:bg-surface-subtle"
                          >
                            Verbas
                          </button>
                        ) : (
                          <span className="text-fg-subtle">Verbas</span>
                        )}
                      </li>

                      <li className="flex items-center justify-end gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface-subtle text-xs font-extrabold text-fg-muted">
                          3
                        </span>
                        <span className="text-fg-muted">Resultado</span>
                      </li>
                    </ol>

                    <div
                      role="progressbar"
                      aria-label="Progresso do preenchimento"
                      aria-valuenow={percentualProgresso}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-border-strong bg-surface-subtle"
                    >
                      <motion.div
                        className="h-full rounded-full bg-laranja"
                        initial={false}
                        animate={{ width: `${percentualProgresso}%` }}
                        transition={{ duration: prefereMenosMovimento ? 0 : 0.35, ease: 'easeOut' }}
                      />
                    </div>
                  </nav>

                  {fluxo.subEtapaRescisao === 'dados' ? (
                    <div className="flex flex-1 flex-col">
                      <ImportadorHolerite
                        onAplicarDados={aoAplicarHoleriteImportado}
                        onPreencherManualmente={iniciarPreenchimentoManualLimpo}
                      />

                      <form
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          void concluirCalculo();
                        }}
                        className="cartao-identidade flex flex-1 flex-col justify-between overflow-hidden"
                      >
                        <div>
                          <div className="faixa-tricolor" aria-hidden="true" />

                          <div className="space-y-8 p-6 sm:p-7">
                            {/* Bloco 1: Remuneração e bases */}
                            <section>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-tinta bg-azul font-display text-xs font-extrabold text-branco">
                                    01
                                  </span>
                                  <h2 className="font-display text-lg font-extrabold text-fg">
                                    Remuneração e bases
                                  </h2>
                                </div>
                              </div>
                              <p className="mt-2 text-xs font-medium text-fg-muted">
                                Valores brutos do contrato. A base do INSS acompanha o salário, mas
                                pode ser ajustada conforme o seu holerite.
                              </p>

                              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                  <label
                                    htmlFor="campo-salario-base"
                                    className="block text-sm font-extrabold text-fg"
                                  >
                                    Salário base
                                  </label>
                                  <div className="grupo-moeda-tactile mt-1.5">
                                    <span className="flex h-full items-center border-r-2 border-border-input bg-azul px-3.5 font-display text-sm font-extrabold text-branco">
                                      R$
                                    </span>
                                    <input
                                      id="campo-salario-base"
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0,00"
                                      aria-invalid={Boolean(errors.salarioBase)}
                                      aria-describedby={
                                        errors.salarioBase ? 'erro-salario' : undefined
                                      }
                                      {...register('salarioBase')}
                                      onChange={(e) => {
                                        const mascarado = aplicarMascaraMoeda(e.target.value);
                                        setValue('salarioBase', mascarado, {
                                          shouldValidate: true,
                                        });
                                        setCenarioAtivo(null);
                                        if (!baseInssEditadaManualmente) {
                                          setValue('baseInss', mascarado, { shouldValidate: true });
                                          setBaseInssPersonalizada(false);
                                        }
                                        notificarAlteracaoCampo(['salario']);
                                      }}
                                      className="tabular-nums h-full w-full bg-transparent px-3.5 font-display text-lg font-extrabold text-fg focus:outline-none"
                                    />
                                  </div>
                                  {errors.salarioBase && (
                                    <p
                                      id="erro-salario"
                                      role="alert"
                                      aria-live="polite"
                                      className="mt-1.5 text-xs font-bold text-status-error"
                                    >
                                      {errors.salarioBase.message}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <label
                                      htmlFor="campo-base-inss"
                                      className="block text-sm font-extrabold text-fg"
                                    >
                                      Base do INSS
                                    </label>
                                    {valores.baseInss !== valores.salarioBase && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setBaseInssPersonalizada(false);
                                          setBaseInssEditadaManualmente(false);
                                          setValue('baseInss', valores.salarioBase, {
                                            shouldValidate: true,
                                          });
                                          notificarAlteracaoCampo(['inss']);
                                        }}
                                        className="cursor-pointer rounded-md border border-tinta bg-laranja px-2.5 py-0.5 text-xs font-extrabold text-tinta transition-colors hover:bg-laranja-vivo"
                                      >
                                        Igualar ao salário
                                      </button>
                                    )}
                                  </div>
                                  <div className="grupo-moeda-tactile mt-1.5">
                                    <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3.5 font-display text-sm font-extrabold text-fg">
                                      R$
                                    </span>
                                    <input
                                      id="campo-base-inss"
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0,00"
                                      aria-invalid={Boolean(errors.baseInss)}
                                      aria-describedby={
                                        errors.baseInss ? 'erro-base-inss' : undefined
                                      }
                                      {...register('baseInss')}
                                      onChange={(e) => {
                                        const mascarado = aplicarMascaraMoeda(e.target.value);
                                        setBaseInssEditadaManualmente(true);
                                        setBaseInssPersonalizada(mascarado !== valores.salarioBase);
                                        setCenarioAtivo(null);
                                        setValue('baseInss', mascarado, { shouldValidate: true });
                                        notificarAlteracaoCampo(['inss']);
                                      }}
                                      className="tabular-nums h-full w-full bg-transparent px-3.5 font-display text-lg font-extrabold text-fg focus:outline-none"
                                    />
                                  </div>
                                  {errors.baseInss && (
                                    <p
                                      id="erro-base-inss"
                                      role="alert"
                                      aria-live="polite"
                                      className="mt-1.5 text-xs font-bold text-status-error"
                                    >
                                      {errors.baseInss.message}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Quadrados interativos das unidades do contrato com contraste 100% nítido no claro e escuro */}
                              <div className="mt-5 rounded-xl border-2 border-border-strong bg-surface-subtle p-4">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-fg">
                                  <Calculator
                                    className="h-3.5 w-3.5 text-laranja"
                                    aria-hidden="true"
                                  />
                                  <span>Quanto vale cada unidade do contrato</span>
                                </span>

                                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                  <motion.div
                                    whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                                    className="rounded-lg border border-border-strong bg-surface p-2.5"
                                  >
                                    <span className="block text-xs font-bold text-fg-muted">
                                      Valor por dia (÷ 30)
                                    </span>
                                    <span className="tabular-nums mt-0.5 block font-display text-sm font-extrabold text-fg">
                                      {formatarCentavos(metricasUnidadesContrato.valorDiaCentavos)}
                                    </span>
                                  </motion.div>

                                  <motion.div
                                    whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                                    className="rounded-lg border border-border-strong bg-surface p-2.5"
                                  >
                                    <span className="block text-xs font-bold text-fg-muted">
                                      Valor por hora (÷ {metricasUnidadesContrato.divisorHoras}h)
                                    </span>
                                    <span className="tabular-nums mt-0.5 block font-display text-sm font-extrabold text-fg">
                                      {formatarCentavos(metricasUnidadesContrato.valorHoraCentavos)}
                                    </span>
                                  </motion.div>

                                  <motion.div
                                    whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                                    className="rounded-lg border border-border-strong bg-surface p-2.5"
                                  >
                                    <span className="block text-xs font-bold text-fg-muted">
                                      Fração de 1/12 avo
                                    </span>
                                    <span className="tabular-nums mt-0.5 block font-display text-sm font-extrabold text-fg">
                                      {formatarCentavos(metricasUnidadesContrato.valorAvoCentavos)}
                                    </span>
                                  </motion.div>

                                  <motion.div
                                    whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                                    className="rounded-lg border-2 border-laranja bg-surface-warm p-2.5"
                                  >
                                    <span className="block text-xs font-extrabold text-fg">
                                      FGTS mensal ({metricasUnidadesContrato.aliquotaFgtsTexto})
                                    </span>
                                    <span className="tabular-nums mt-0.5 block font-display text-sm font-extrabold text-brand">
                                      {formatarCentavos(
                                        metricasUnidadesContrato.fgtsMensalCentavos
                                      )}
                                    </span>
                                  </motion.div>
                                </div>
                              </div>
                            </section>

                            {/* Bloco 2: Contrato e datas */}
                            <section className="border-t-2 border-border pt-6">
                              <div className="flex items-center gap-2.5 border-b-2 border-border pb-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-tinta bg-laranja font-display text-xs font-extrabold text-tinta">
                                  02
                                </span>
                                <h2 className="font-display text-lg font-extrabold text-fg">
                                  Contrato e datas
                                </h2>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {(
                                  [
                                    {
                                      tipo: 'clt' as TipoContrato,
                                      titulo: 'CLT padrão',
                                      subtitulo: 'FGTS patronal de 8% (Lei 8.036/1990)',
                                      icone: Briefcase,
                                    },
                                    {
                                      tipo: 'aprendiz' as TipoContrato,
                                      titulo: 'Aprendizagem',
                                      subtitulo: 'FGTS patronal de 2% (Lei 10.097/2000)',
                                      icone: GraduationCap,
                                    },
                                  ] as const
                                ).map((item) => {
                                  const ativo = valores.tipoContrato === item.tipo;
                                  const Icone = item.icone;
                                  return (
                                    <motion.button
                                      key={item.tipo}
                                      type="button"
                                      whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                                      whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
                                      onClick={() => {
                                        setValue('tipoContrato', item.tipo);
                                        notificarAlteracaoCampo(['regime']);
                                      }}
                                      aria-pressed={ativo}
                                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-colors ${
                                        ativo
                                          ? 'border-tinta bg-azul text-branco shadow-[0_3px_0_0_#FD701C]'
                                          : 'border-border-strong bg-surface text-fg hover:border-laranja hover:bg-surface-warm'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                                            ativo
                                              ? 'border-tinta bg-laranja text-tinta'
                                              : 'border-border-strong bg-surface-subtle text-brand'
                                          }`}
                                        >
                                          <Icone className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div>
                                          <span className="block font-display text-sm font-extrabold">
                                            {item.titulo}
                                          </span>
                                          <span
                                            className={`block text-xs ${
                                              ativo ? 'text-azul-claro' : 'text-fg-muted'
                                            }`}
                                          >
                                            {item.subtitulo}
                                          </span>
                                        </div>
                                      </div>
                                    </motion.button>
                                  );
                                })}
                              </div>

                              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                  <label
                                    htmlFor="campo-data-admissao"
                                    className="block text-sm font-extrabold text-fg"
                                  >
                                    Data de admissão
                                  </label>
                                  <input
                                    id="campo-data-admissao"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="DD/MM/AAAA"
                                    aria-invalid={Boolean(errors.dataAdmissao)}
                                    aria-describedby={
                                      errors.dataAdmissao ? 'erro-admissao' : undefined
                                    }
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
                                      notificarAlteracaoCampo(['datas']);
                                    }}
                                    className="campo-tactile tabular-nums mt-1.5"
                                  />
                                  {errors.dataAdmissao && (
                                    <p
                                      id="erro-admissao"
                                      role="alert"
                                      aria-live="polite"
                                      className="mt-1.5 text-xs font-bold text-status-error"
                                    >
                                      {errors.dataAdmissao.message}
                                    </p>
                                  )}
                                </div>

                                {valores.modo === 'rescisao' && (
                                  <div>
                                    <label
                                      htmlFor="campo-data-saida"
                                      className="block text-sm font-extrabold text-fg"
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
                                      onChange={(e) => {
                                        setValue('dataSaida', aplicarMascaraData(e.target.value), {
                                          shouldValidate: true,
                                        });
                                        notificarAlteracaoCampo(['datas']);
                                      }}
                                      className="campo-tactile tabular-nums mt-1.5"
                                    />
                                    {errors.dataSaida && (
                                      <p
                                        id="erro-saida"
                                        role="alert"
                                        aria-live="polite"
                                        className="mt-1.5 text-xs font-bold text-status-error"
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
                                      className="block text-sm font-extrabold text-fg"
                                    >
                                      Dias trabalhados no mês
                                    </label>
                                    <input
                                      id="campo-dias-folha"
                                      type="number"
                                      min={1}
                                      max={30}
                                      {...register('diasTrabalhadosFolha', {
                                        valueAsNumber: true,
                                        onChange: () => notificarAlteracaoCampo(['datas']),
                                      })}
                                      className="campo-tactile tabular-nums mt-1.5"
                                    />
                                    {errors.diasTrabalhadosFolha && (
                                      <p
                                        role="alert"
                                        aria-live="polite"
                                        className="mt-1.5 text-xs font-bold text-status-error"
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
                                      className="block text-sm font-extrabold text-fg"
                                    >
                                      Meses trabalhados no ano (15 dias ou mais)
                                    </label>
                                    <input
                                      id="campo-meses-13"
                                      type="number"
                                      min={1}
                                      max={12}
                                      {...register('mesesDecimoTerceiro', {
                                        valueAsNumber: true,
                                        onChange: () => notificarAlteracaoCampo(['datas']),
                                      })}
                                      className="campo-tactile tabular-nums mt-1.5"
                                    />
                                    {errors.mesesDecimoTerceiro && (
                                      <p
                                        role="alert"
                                        aria-live="polite"
                                        className="mt-1.5 text-xs font-bold text-status-error"
                                      >
                                        {errors.mesesDecimoTerceiro.message}
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div>
                                  <label
                                    htmlFor="campo-jornada"
                                    className="block text-sm font-extrabold text-fg"
                                  >
                                    Jornada semanal
                                  </label>
                                  <select
                                    id="campo-jornada"
                                    {...register('jornada')}
                                    className="campo-tactile mt-1.5"
                                  >
                                    <option value="44h">44 horas semanais (220h/mês)</option>
                                    <option value="40h">40 horas semanais (200h/mês)</option>
                                    <option value="36h">36 horas semanais (180h/mês)</option>
                                    <option value="30h">30 horas semanais (150h/mês)</option>
                                    <option value="24h">24 horas semanais (120h/mês)</option>
                                    <option value="20h">20 horas semanais (100h/mês)</option>
                                  </select>
                                </div>
                              </div>

                              {valores.modo === 'rescisao' && (
                                <div className="mt-5 space-y-4 rounded-xl border-2 border-border-strong bg-surface-subtle p-4">
                                  <div>
                                    <label
                                      htmlFor="campo-modalidade"
                                      className="block text-sm font-extrabold text-fg"
                                    >
                                      Modalidade da rescisão
                                    </label>
                                    <select
                                      id="campo-modalidade"
                                      {...register('modalidadeRescisao', {
                                        onChange: () => notificarAlteracaoCampo(['verbas']),
                                      })}
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
                                          className="text-sm font-bold text-fg"
                                        >
                                          Contrato encerrado antes do prazo pela empresa
                                        </span>
                                        <Interruptor
                                          id="switch-encerrado-antes"
                                          ariaLabelledBy="label-encerrado-antes"
                                          ativo={valores.encerradoAntesDoPrazo}
                                          onAlternar={(v) => {
                                            setValue('encerradoAntesDoPrazo', v);
                                            notificarAlteracaoCampo(['verbas']);
                                          }}
                                        />
                                      </div>

                                      {valores.encerradoAntesDoPrazo && (
                                        <div>
                                          <label
                                            htmlFor="campo-data-fim-prevista"
                                            className="block text-sm font-extrabold text-fg"
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
                                            onChange={(e) => {
                                              setValue(
                                                'dataFimPrevistaContrato',
                                                aplicarMascaraData(e.target.value),
                                                { shouldValidate: true }
                                              );
                                              notificarAlteracaoCampo(['datas', 'verbas']);
                                            }}
                                            className="campo-tactile tabular-nums mt-1.5 max-w-xs"
                                          />
                                          {errors.dataFimPrevistaContrato && (
                                            <p
                                              id="erro-fim-prevista"
                                              role="alert"
                                              aria-live="polite"
                                              className="mt-1.5 text-xs font-bold text-status-error"
                                            >
                                              {errors.dataFimPrevistaContrato.message}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </section>

                            {/* Bloco 3: Benefícios, dependentes e descontos */}
                            <section className="border-t-2 border-border pt-6">
                              <div className="flex items-center gap-2.5 border-b-2 border-border pb-3">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-tinta bg-azul font-display text-xs font-extrabold text-branco">
                                  03
                                </span>
                                <h2 className="font-display text-lg font-extrabold text-fg">
                                  Benefícios, dependentes e descontos
                                </h2>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                  <label
                                    htmlFor="campo-piso-categoria"
                                    className="block text-sm font-extrabold text-fg"
                                  >
                                    Piso da categoria (convenção coletiva){' '}
                                    <span className="font-normal text-fg-muted">(opcional)</span>
                                  </label>
                                  <div className="grupo-moeda-tactile mt-1.5">
                                    <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3 text-xs font-extrabold text-fg">
                                      R$
                                    </span>
                                    <input
                                      id="campo-piso-categoria"
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="Substitui o piso geral"
                                      value={valores.pisoCategoria ?? ''}
                                      onChange={(e) =>
                                        setValue(
                                          'pisoCategoria',
                                          aplicarMascaraMoeda(e.target.value)
                                        )
                                      }
                                      className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-semibold text-fg focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label
                                    htmlFor="campo-dependentes"
                                    className="block text-sm font-extrabold text-fg"
                                  >
                                    Dependentes para IRRF{' '}
                                    <span className="font-normal text-fg-muted">(opcional)</span>
                                  </label>
                                  <input
                                    id="campo-dependentes"
                                    type="number"
                                    min={0}
                                    max={30}
                                    {...register('dependentes', {
                                      valueAsNumber: true,
                                      onChange: () => notificarAlteracaoCampo(['dependentes']),
                                    })}
                                    className="campo-tactile tabular-nums mt-1.5"
                                  />
                                </div>

                                {valores.modo === 'rescisao' && (
                                  <div>
                                    <label
                                      htmlFor="campo-saldo-fgts"
                                      className="block text-sm font-extrabold text-fg"
                                    >
                                      Saldo acumulado do FGTS{' '}
                                      <span className="font-normal text-fg-muted">(opcional)</span>
                                    </label>
                                    <div className="grupo-moeda-tactile mt-1.5">
                                      <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-3 text-xs font-extrabold text-fg">
                                        R$
                                      </span>
                                      <input
                                        id="campo-saldo-fgts"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Em branco estima pelos meses"
                                        value={valores.saldoFgtsInformado ?? ''}
                                        onChange={(e) => {
                                          setValue(
                                            'saldoFgtsInformado',
                                            aplicarMascaraMoeda(e.target.value)
                                          );
                                          notificarAlteracaoCampo(['verbas']);
                                        }}
                                        className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-semibold text-fg focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <label
                                    htmlFor="campo-nome"
                                    className="block text-sm font-extrabold text-fg"
                                  >
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
                                <div className="mt-5 rounded-xl border-2 border-border-strong bg-surface-subtle p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <span
                                        id="label-switch-vt"
                                        className="block text-sm font-extrabold text-fg"
                                      >
                                        Vale-transporte
                                      </span>
                                      <span className="text-xs font-medium text-fg-muted">
                                        Desconto de até 6% do salário proporcional, limitado ao
                                        valor fornecido.
                                      </span>
                                    </div>
                                    <Interruptor
                                      id="switch-vale-transporte"
                                      ariaLabelledBy="label-switch-vt"
                                      ativo={valores.valeTransporteAtivo}
                                      onAlternar={(v) => {
                                        setValue('valeTransporteAtivo', v);
                                        notificarAlteracaoCampo(['vt']);
                                      }}
                                    />
                                  </div>

                                  {valores.valeTransporteAtivo && (
                                    <div className="mt-4 max-w-xs">
                                      <label
                                        htmlFor="campo-valor-vt"
                                        className="block text-sm font-extrabold text-fg"
                                      >
                                        Valor mensal fornecido
                                      </label>
                                      <div className="grupo-moeda-tactile mt-1.5">
                                        <span className="flex h-full items-center border-r-2 border-border-input bg-azul px-3 text-xs font-extrabold text-branco">
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
                                          onChange={(e) => {
                                            setValue(
                                              'valorValeTransporteMensal',
                                              aplicarMascaraMoeda(e.target.value),
                                              { shouldValidate: true }
                                            );
                                            notificarAlteracaoCampo(['vt']);
                                          }}
                                          className="tabular-nums h-full w-full bg-transparent px-3 text-sm font-bold text-fg focus:outline-none"
                                        />
                                      </div>
                                      {errors.valorValeTransporteMensal && (
                                        <p
                                          id="erro-vt"
                                          role="alert"
                                          aria-live="polite"
                                          className="mt-1.5 text-xs font-bold text-status-error"
                                        >
                                          {errors.valorValeTransporteMensal.message}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mt-5 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-extrabold text-fg">
                                    Outros descontos{' '}
                                    <span className="font-normal text-fg-muted">(opcional)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => adicionarDesconto({ descricao: '', valor: '' })}
                                    className="btn-superficie-tactile !min-h-[38px] !px-3.5 !py-1.5 text-xs"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-laranja" aria-hidden="true" />
                                    <span>Adicionar desconto</span>
                                  </button>
                                </div>

                                {camposDescontos.map((campo, idx) => (
                                  <div
                                    key={campo.id}
                                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_170px_auto]"
                                  >
                                    <input
                                      type="text"
                                      placeholder="Descrição (ex.: Convênio, Adiantamento)"
                                      aria-label={`Descrição do desconto ${idx + 1}`}
                                      {...register(`outrosDescontos.${idx}.descricao`)}
                                      className="campo-tactile"
                                    />
                                    <div className="grupo-moeda-tactile">
                                      <span className="flex h-full items-center border-r-2 border-border-input bg-surface-subtle px-2.5 text-xs font-extrabold text-fg">
                                        R$
                                      </span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        aria-label={`Valor do desconto ${idx + 1}`}
                                        value={valores.outrosDescontos?.[idx]?.valor ?? ''}
                                        onChange={(e) => {
                                          setValue(
                                            `outrosDescontos.${idx}.valor`,
                                            aplicarMascaraMoeda(e.target.value)
                                          );
                                          notificarAlteracaoCampo(['descontos']);
                                        }}
                                        className="tabular-nums h-full w-full bg-transparent px-2.5 text-sm font-semibold text-fg focus:outline-none"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removerDesconto(idx);
                                        notificarAlteracaoCampo(['descontos']);
                                      }}
                                      aria-label={`Remover desconto ${idx + 1}`}
                                      className="btn-superficie-tactile !h-12 !px-3.5 text-xs"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Remover</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-border px-6 py-5 sm:px-7">
                          {valores.modo === 'rescisao' && (
                            <button
                              type="button"
                              onClick={() => void avancarParaVerbasRescisao()}
                              className="btn-superficie-tactile text-sm"
                            >
                              Continuar para verbas
                            </button>
                          )}

                          <motion.button
                            ref={botaoAvancarRef}
                            type="submit"
                            whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
                            whileTap={prefereMenosMovimento ? undefined : { scale: 0.98 }}
                            className="btn-laranja-tactile !min-h-[52px] !px-7 !py-3.5 text-base"
                          >
                            <span>Concluir cálculo</span>
                            <ArrowRight className="h-5 w-5" aria-hidden="true" />
                          </motion.button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="cartao-identidade flex flex-1 flex-col justify-between overflow-hidden">
                      <div>
                        <div className="faixa-tricolor" aria-hidden="true" />
                        <div className="border-b-2 border-border bg-surface-subtle px-6 py-5">
                          <h2 className="font-display text-lg font-extrabold text-fg">
                            Verbas da modalidade selecionada
                          </h2>
                          <p className="mt-0.5 text-xs font-medium text-fg-muted">
                            {ROTULOS_MODALIDADE[valores.modalidadeRescisao]}. As verbas obrigatórias
                            vêm ativadas e fixadas por lei.
                          </p>
                        </div>

                        <div className="divide-y-2 divide-border">
                          {verbasEtapa2.map((verba) => {
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
                              notificarAlteracaoCampo(['verbas']);
                            };

                            const idRotulo = `rotulo-verba-${verba.id}`;

                            return (
                              <div
                                key={verba.id}
                                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                              >
                                <div className="max-w-md space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span id={idRotulo} className="text-sm font-extrabold text-fg">
                                      {verba.rotulo}
                                    </span>
                                    {verba.obrigatoria && (
                                      <span className="rounded-md border border-border-strong bg-surface-subtle px-2 py-0.5 text-xs font-extrabold text-fg">
                                        Obrigatória
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-medium text-fg-muted">
                                    {verba.descricaoCurta}
                                  </p>
                                  {verba.obrigatoria && verba.motivoBloqueio && (
                                    <p className="text-xs font-bold text-brand">
                                      {verba.motivoBloqueio}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-4">
                                  <span className="tabular-nums font-display text-base font-extrabold text-fg">
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
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-surface-subtle px-6 py-4">
                        <button
                          type="button"
                          onClick={() => dispatchFluxo({ type: 'VOLTAR_AOS_DADOS' })}
                          className="btn-superficie-tactile text-sm"
                        >
                          Voltar aos dados
                        </button>

                        <button
                          type="button"
                          onClick={() => void concluirCalculo()}
                          className="btn-laranja-tactile text-sm"
                        >
                          <span>Concluir cálculo</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Coluna do Quadrado do Holerite (mesma largura e mesma altura, alterna Esquerda -> Direita -> Esquerda a cada aba) */}
              <motion.div
                key="coluna-holerite"
                layout={!prefereMenosMovimento}
                transition={prefereMenosMovimento ? { duration: 0.12 } : MOLA_COLUNAS}
                className={`flex min-w-0 flex-col ${
                  ladoPainel === 'left' ? 'min-[900px]:order-1' : 'min-[900px]:order-2'
                }`}
              >
                <motion.div layout="position" className="flex flex-1 flex-col">
                  <ResumoCalculoAoVivo
                    resultado={resultadoAoVivo}
                    modo={valores.modo}
                    subtituloHolerite={subtituloHolerite}
                    salarioVazio={salarioVazio}
                    etapa="editando"
                    camposAlterados={camposAlterados}
                    cicloDigitacao={cicloDigitacao}
                    trocandoModo={trocandoModo}
                    ladoAtual={ladoPainel}
                  />
                </motion.div>
              </motion.div>
            </div>
          )}
        </LayoutGroup>
      </main>

      <footer className="no-print border-t-2 border-tinta bg-azul py-5 text-branco">
        <div className="mx-auto flex max-w-layout flex-wrap items-center justify-between gap-3 px-4 text-xs sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-laranja" aria-hidden="true" />
            <span className="font-display font-extrabold text-branco">
              Calculadora CLT Teresina · Parâmetros de {ANO_VIGENTE}
            </span>
          </div>
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
            const diferente = salvo.baseInss !== salvo.salarioBase;
            setBaseInssPersonalizada(diferente);
            setBaseInssEditadaManualmente(diferente);
            dispatchFluxo({ type: 'CONCLUIR' });
          }
          setHistoricoAberto(false);
        }}
        onRemover={(id) => setItensHistorico(removerItemHistoricoLocal(id))}
        onLimparTudo={() => setItensHistorico(limparHistoricoLocal())}
      />
    </div>
  );
}
