import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ErroImportacaoHolerite } from './erros';
import { normalizarParaComparacao } from './normalizar';
import {
  executarOcrEmCanvas,
  gerarMiniaturaCanvas,
  preProcessarCanvasParaOcr,
} from './ocr';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

interface ItemPosicionadoPdf {
  texto: string;
  x: number;
  y: number;
  largura: number;
}

const TERMOS_RELEVANCIA_PAGINA = [
  'proventos',
  'vencimentos',
  'descontos',
  'salario',
  'inss',
  'liquido',
  'fgts',
  'holerite',
  'demonstrativo',
];

/**
 * Reconstrói linhas e colunas a partir das coordenadas espaciais dos itens de texto do PDF.
 */
export function reconstruirLinhasDeItensPdf(itens: ItemPosicionadoPdf[]): string {
  const validos = itens.filter((i) => i.texto.trim().length > 0);
  if (validos.length === 0) return '';

  // Ordena de cima para baixo (Y decrescente no PDF) e da esquerda para a direita (X crescente)
  const ordenados = [...validos].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
    return a.x - b.x;
  });

  const gruposLinhas: ItemPosicionadoPdf[][] = [];
  for (const item of ordenados) {
    const ultimoGrupo = gruposLinhas[gruposLinhas.length - 1];
    if (!ultimoGrupo) {
      gruposLinhas.push([item]);
    } else {
      const yReferencia = ultimoGrupo[0].y;
      if (Math.abs(item.y - yReferencia) <= 3.5) {
        ultimoGrupo.push(item);
      } else {
        gruposLinhas.push([item]);
      }
    }
  }

  return gruposLinhas
    .map((grupo) => {
      grupo.sort((a, b) => a.x - b.x);
      let linha = '';
      let fimAnteriorX: number | null = null;

      for (const item of grupo) {
        if (fimAnteriorX !== null) {
          const distancia = item.x - fimAnteriorX;
          if (distancia > 35) {
            linha += '   ';
          } else if (distancia > 4) {
            linha += ' ';
          }
        }
        linha += item.texto.trim();
        fimAnteriorX = item.x + Math.max(item.largura, item.texto.length * 4);
      }
      return linha.trim();
    })
    .filter(Boolean)
    .join('\n');
}

function pontuarPaginaHolerite(textoPagina: string): number {
  const norm = normalizarParaComparacao(textoPagina);
  if (!norm) return 0;
  let pontos = 0;
  for (const termo of TERMOS_RELEVANCIA_PAGINA) {
    if (norm.includes(termo)) {
      pontos += termo === 'proventos' || termo === 'descontos' || termo === 'liquido' ? 3 : 1;
    }
  }
  return pontos;
}

export interface ResultadoLeituraPdf {
  texto: string;
  usouOcr: boolean;
  confiancaMediaOcr?: number;
  paginaSelecionada: number;
  totalPaginas: number;
  miniaturaDataUrl: string;
}

export async function lerPdfHolerite(
  arquivo: File,
  senha?: string
): Promise<ResultadoLeituraPdf> {
  const buffer = await arquivo.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let tarefaCarregamento: pdfjsLib.PDFDocumentLoadingTask | null = null;
  let doc: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    tarefaCarregamento = pdfjsLib.getDocument({
      data: bytes,
      password: senha || undefined,
    });
    doc = await tarefaCarregamento.promise;
  } catch (erro: unknown) {
    const errObj = erro as { name?: string; code?: number };
    if (errObj?.name === 'PasswordException') {
      if (senha) {
        throw new ErroImportacaoHolerite(
          'SENHA_PDF_INCORRETA',
          'Senha incorreta para este PDF. Confira a senha informada e tente novamente.'
        );
      }
      throw new ErroImportacaoHolerite(
        'PDF_PROTEGIDO_SENHA',
        'Este PDF está protegido por senha. Informe a senha do documento para prosseguir.'
      );
    }
    throw new ErroImportacaoHolerite(
      'FALHA_LEITURA',
      'Não foi possível abrir o arquivo PDF. Verifique se o documento não está corrompido.'
    );
  }

  try {
    const totalPaginas = doc.numPages;
    if (totalPaginas < 1) {
      throw new ErroImportacaoHolerite('NENHUM_CAMPO_RECONHECIDO', 'O PDF não possui páginas.');
    }

    let melhorPaginaNumero = 1;
    let melhorPontuacao = -1;
    let melhorTexto = '';

    for (let num = 1; num <= totalPaginas; num += 1) {
      const pagina = await doc.getPage(num);
      const conteudo = await pagina.getTextContent();
      type ItemTextoNat = Extract<(typeof conteudo.items)[number], { str: string }>;
      const itens: ItemPosicionadoPdf[] = conteudo.items
        .filter((it): it is ItemTextoNat => 'str' in it)
        .map((it) => ({
          texto: it.str,
          x: Number(it.transform[4] ?? 0),
          y: Number(it.transform[5] ?? 0),
          largura: Number(it.width ?? 0),
        }));

      const textoReconstruido = reconstruirLinhasDeItensPdf(itens);
      const pontuacao = pontuarPaginaHolerite(textoReconstruido);

      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhorPaginaNumero = num;
        melhorTexto = textoReconstruido;
      }
    }

    const paginaEscolhida = await doc.getPage(melhorPaginaNumero);

    // Renderiza página escolhida em canvas para miniatura e eventual OCR caso seja escaneado
    const escalaRender = melhorTexto.trim().length < 25 ? 2.0 : 0.8;
    const viewport = paginaEscolhida.getViewport({ scale: escalaRender });
    const canvasPdf = document.createElement('canvas');
    canvasPdf.width = Math.max(1, Math.floor(viewport.width));
    canvasPdf.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvasPdf.getContext('2d');

    let miniaturaDataUrl = '';
    if (ctx) {
      await paginaEscolhida.render({ canvasContext: ctx, viewport }).promise;
      miniaturaDataUrl = gerarMiniaturaCanvas(canvasPdf, canvasPdf.width, canvasPdf.height);
    }

    if (melhorTexto.trim().length >= 25) {
      canvasPdf.width = 0;
      canvasPdf.height = 0;
      return {
        texto: melhorTexto,
        usouOcr: false,
        paginaSelecionada: melhorPaginaNumero,
        totalPaginas,
        miniaturaDataUrl,
      };
    }

    // PDF escaneado sem camada de texto: aplica pré-processamento e OCR em Web Worker
    const canvasPre = preProcessarCanvasParaOcr(canvasPdf, canvasPdf.width, canvasPdf.height);
    canvasPdf.width = 0;
    canvasPdf.height = 0;

    try {
      const resultadoOcr = await executarOcrEmCanvas(canvasPre);
      return {
        texto: resultadoOcr.texto,
        usouOcr: true,
        confiancaMediaOcr: resultadoOcr.confiancaMedia,
        paginaSelecionada: melhorPaginaNumero,
        totalPaginas,
        miniaturaDataUrl,
      };
    } finally {
      canvasPre.width = 0;
      canvasPre.height = 0;
    }
  } finally {
    await doc.destroy();
  }
}
