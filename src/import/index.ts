import { obterParametros, ParametrosAno } from '../config/parametros';
import { InconsistenciaHolerite } from '../calc/validacao';
import { conferirExtracaoHolerite } from './conferir';
import {
  ErroImportacaoHolerite,
  validarArquivoEntrada,
} from './erros';
import {
  ExtratorDeHolerite,
  ExtratorLocalDeHolerite,
  ResultadoExtracaoHolerite,
} from './extrairCampos';
import { lerPdfHolerite } from './lerPdf';
import { lerImagemHoleriteComOcr } from './ocr';

export * from './dicionario';
export * from './normalizar';
export * from './extrairCampos';
export * from './conferir';
export * from './erros';
export * from './lerPdf';
export * from './ocr';

export type EtapaProcessamentoHolerite =
  | 'Lendo arquivo'
  | 'Identificando campos'
  | 'Conferindo valores';

export interface ResultadoProcessamentoHolerite {
  extracao: ResultadoExtracaoHolerite;
  inconsistencias: InconsistenciaHolerite[];
  miniaturaDataUrl: string;
  paginaSelecionada?: number;
  totalPaginas?: number;
}

export interface OpcoesProcessamentoArquivo {
  senhaPdf?: string;
  onEtapa?: (etapa: EtapaProcessamentoHolerite) => void;
  extrator?: ExtratorDeHolerite;
  parametros?: ParametrosAno;
}

/**
 * Processa 100% no navegador um arquivo PDF, JPG ou PNG de holerite,
 * sem armazenar o arquivo nem o texto extraído em localStorage ou IndexedDB.
 */
export async function processarArquivoHolerite(
  arquivo: File,
  opcoes: OpcoesProcessamentoArquivo = {}
): Promise<ResultadoProcessamentoHolerite> {
  validarArquivoEntrada(arquivo);

  const extrator = opcoes.extrator ?? new ExtratorLocalDeHolerite();
  const parametros = opcoes.parametros ?? obterParametros();

  opcoes.onEtapa?.('Lendo arquivo');

  const ehPdf =
    arquivo.type.toLowerCase() === 'application/pdf' ||
    arquivo.name.toLowerCase().endsWith('.pdf');

  let textoExtraido = '';
  let origemLeitura: 'pdf_texto' | 'ocr_imagem' = 'pdf_texto';
  let confiancaOcr: number | undefined;
  let miniaturaDataUrl = '';
  let paginaSelecionada: number | undefined;
  let totalPaginas: number | undefined;

  if (ehPdf) {
    const leituraPdf = await lerPdfHolerite(arquivo, opcoes.senhaPdf);
    textoExtraido = leituraPdf.texto;
    origemLeitura = leituraPdf.usouOcr ? 'ocr_imagem' : 'pdf_texto';
    confiancaOcr = leituraPdf.confiancaMediaOcr;
    miniaturaDataUrl = leituraPdf.miniaturaDataUrl;
    paginaSelecionada = leituraPdf.paginaSelecionada;
    totalPaginas = leituraPdf.totalPaginas;
  } else {
    const leituraImg = await lerImagemHoleriteComOcr(arquivo);
    textoExtraido = leituraImg.texto;
    origemLeitura = 'ocr_imagem';
    confiancaOcr = leituraImg.confiancaMedia;
    miniaturaDataUrl = leituraImg.miniaturaDataUrl;
  }

  opcoes.onEtapa?.('Identificando campos');

  const extracao = await extrator.extrairDeTexto(textoExtraido, {
    origemLeitura,
    confiancaMediaOcr: confiancaOcr,
  });

  // Libera referência à string bruta
  textoExtraido = '';

  if (extracao.quantidadeReconhecida === 0) {
    throw new ErroImportacaoHolerite(
      'NENHUM_CAMPO_RECONHECIDO',
      'Nenhum campo de folha foi reconhecido neste arquivo. Você pode preencher o formulário manualmente.'
    );
  }

  opcoes.onEtapa?.('Conferindo valores');

  const inconsistencias = conferirExtracaoHolerite(extracao, {}, parametros);

  return {
    extracao,
    inconsistencias,
    miniaturaDataUrl,
    paginaSelecionada,
    totalPaginas,
  };
}
