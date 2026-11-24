export type ModoCalculo = 'folha' | 'decimo_terceiro' | 'rescisao';

export type TipoContrato = 'clt' | 'aprendiz';

export type ModalidadeRescisao =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'justa_causa'
  | 'acordo'
  | 'termino_contrato';

export interface OutroDescontoItem {
  descricao: string;
  valorCentavos: number;
}

export interface LinhaResultado {
  id: string;
  rotulo: string;
  natureza: 'provento' | 'desconto' | 'encargo' | 'parcela';
  baseCentavos: number;
  aliquotaTexto?: string;
  formula: string;
  valorCentavos: number;
  passos: string[];
  estimativa?: boolean;
}

export interface AvisoCalculo {
  codigo: string;
  nivel: 'aviso' | 'info';
  titulo: string;
  mensagem: string;
}

export interface ResultadoCalculo {
  valido: boolean;
  erroBloqueante?: string;
  modo: ModoCalculo;
  anoParametros: number;
  rotuloBruto: string;
  totalBrutoCentavos: number;
  totalDescontosCentavos: number;
  valorLiquidoCentavos: number;
  linhasProventos: LinhaResultado[];
  linhasDescontos: LinhaResultado[];
  linhasEncargos: LinhaResultado[];
  parcelasDecimoTerceiro?: LinhaResultado[];
  avisos: AvisoCalculo[];
}

export interface VerbaRescisaoOpcoes {
  avisoPrevioIndenizado?: boolean;
  descontarAvisoNaoTrabalhado?: boolean;
  feriasVencidas?: boolean;
  feriasVencidasEmDobro?: boolean;
  encerradoAntesDoPrazo?: boolean;
  dataFimPrevistaContrato?: string;
  saldoFgtsInformadoCentavos?: number;
}
