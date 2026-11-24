import { createWorker } from 'tesseract.js';
import { ErroImportacaoHolerite } from './erros';

export interface ResultadoOcr {
  texto: string;
  confiancaMedia: number;
}

/**
 * Estima pequeno ângulo de inclinação (-4 a +4 graus) maximizando a variância
 * da projeção horizontal das linhas de texto.
 */
function estimarAnguloInclinacao(gray: Uint8Array, largura: number, altura: number): number {
  let melhorAngulo = 0;
  let maiorVariancia = -1;
  const cx = largura / 2;
  const cy = altura / 2;

  for (let angulo = -4; angulo <= 4; angulo += 1) {
    const rad = (angulo * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const somasLinhas = new Float64Array(altura);

    for (let y = 0; y < altura; y += 2) {
      const dy = y - cy;
      for (let x = 0; x < largura; x += 2) {
        const dx = x - cx;
        const rx = Math.round(dx * cos - dy * sin + cx);
        const ry = Math.round(dx * sin + dy * cos + cy);
        if (rx >= 0 && rx < largura && ry >= 0 && ry < altura) {
          const escuro = 255 - gray[ry * largura + rx];
          somasLinhas[y] += escuro;
        }
      }
    }

    let media = 0;
    let cont = 0;
    for (let y = 0; y < altura; y += 2) {
      media += somasLinhas[y];
      cont += 1;
    }
    media = cont > 0 ? media / cont : 0;

    let variancia = 0;
    for (let y = 0; y < altura; y += 2) {
      const diff = somasLinhas[y] - media;
      variancia += diff * diff;
    }

    if (variancia > maiorVariancia) {
      maiorVariancia = variancia;
      melhorAngulo = angulo;
    }
  }

  return melhorAngulo;
}

/**
 * Pré-processa imagem no navegador: conversão para escala de cinza, correção de rotação leve
 * e normalização de contraste para aumentar a nitidez dos caracteres no OCR.
 */
export function preProcessarCanvasParaOcr(
  origem: HTMLImageElement | HTMLCanvasElement,
  larguraOrigem: number,
  alturaOrigem: number
): HTMLCanvasElement {
  const maxDim = 2000;
  const escala = Math.min(1, maxDim / Math.max(larguraOrigem, alturaOrigem, 1));
  const w = Math.max(1, Math.round(larguraOrigem * escala));
  const h = Math.max(1, Math.round(alturaOrigem * escala));

  const canvasBase = document.createElement('canvas');
  canvasBase.width = w;
  canvasBase.height = h;
  const ctxBase = canvasBase.getContext('2d');
  if (!ctxBase) return canvasBase;

  ctxBase.drawImage(origem, 0, 0, w, h);

  // Amostra reduzida para estimar rotação rapidamente sem travar a thread
  const wAmostra = Math.min(260, w);
  const hAmostra = Math.max(1, Math.round((h * wAmostra) / w));
  const canvasAmostra = document.createElement('canvas');
  canvasAmostra.width = wAmostra;
  canvasAmostra.height = hAmostra;
  const ctxAmostra = canvasAmostra.getContext('2d');

  let anguloCorrecao = 0;
  if (ctxAmostra && wAmostra > 30 && hAmostra > 30) {
    ctxAmostra.drawImage(canvasBase, 0, 0, wAmostra, hAmostra);
    const dadosAmostra = ctxAmostra.getImageData(0, 0, wAmostra, hAmostra).data;
    const grayAmostra = new Uint8Array(wAmostra * hAmostra);
    for (let i = 0, j = 0; i < dadosAmostra.length; i += 4, j += 1) {
      grayAmostra[j] = Math.round(
        0.299 * dadosAmostra[i] + 0.587 * dadosAmostra[i + 1] + 0.114 * dadosAmostra[i + 2]
      );
    }
    anguloCorrecao = estimarAnguloInclinacao(grayAmostra, wAmostra, hAmostra);
  }
  canvasAmostra.width = 0;
  canvasAmostra.height = 0;

  if (Math.abs(anguloCorrecao) >= 1) {
    const canvasRot = document.createElement('canvas');
    canvasRot.width = w;
    canvasRot.height = h;
    const ctxRot = canvasRot.getContext('2d');
    if (ctxRot) {
      ctxRot.fillStyle = '#FFFFFF';
      ctxRot.fillRect(0, 0, w, h);
      ctxRot.translate(w / 2, h / 2);
      ctxRot.rotate((-anguloCorrecao * Math.PI) / 180);
      ctxRot.drawImage(canvasBase, -w / 2, -h / 2);
      ctxBase.clearRect(0, 0, w, h);
      ctxBase.drawImage(canvasRot, 0, 0);
    }
    canvasRot.width = 0;
    canvasRot.height = 0;
  }

  // Escala de cinza e alargamento de contraste por percentis (p2 a p98)
  const imgData = ctxBase.getImageData(0, 0, w, h);
  const px = imgData.data;
  const histograma = new Uint32Array(256);
  const totalPixels = w * h;

  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = lum;
    histograma[lum] += 1;
  }

  let acumulado = 0;
  let minLum = 0;
  let maxLum = 255;
  const alvoMin = totalPixels * 0.02;
  const alvoMax = totalPixels * 0.98;

  for (let v = 0; v < 256; v += 1) {
    acumulado += histograma[v];
    if (acumulado >= alvoMin) {
      minLum = v;
      break;
    }
  }
  acumulado = 0;
  for (let v = 0; v < 256; v += 1) {
    acumulado += histograma[v];
    if (acumulado >= alvoMax) {
      maxLum = v;
      break;
    }
  }

  const faixa = Math.max(1, maxLum - minLum);
  for (let i = 0; i < px.length; i += 4) {
    const esticado = Math.min(255, Math.max(0, Math.round(((px[i] - minLum) * 255) / faixa)));
    px[i] = esticado;
    px[i + 1] = esticado;
    px[i + 2] = esticado;
    px[i + 3] = 255;
  }

  ctxBase.putImageData(imgData, 0, 0);
  return canvasBase;
}

export function gerarMiniaturaCanvas(
  origem: HTMLImageElement | HTMLCanvasElement,
  larguraOrigem: number,
  alturaOrigem: number
): string {
  const larguraMax = 320;
  const escala = Math.min(1, larguraMax / Math.max(1, larguraOrigem));
  const w = Math.max(1, Math.round(larguraOrigem * escala));
  const h = Math.max(1, Math.round(alturaOrigem * escala));
  const mini = document.createElement('canvas');
  mini.width = w;
  mini.height = h;
  const ctx = mini.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(origem, 0, 0, w, h);
  const url = mini.toDataURL('image/jpeg', 0.72);
  mini.width = 0;
  mini.height = 0;
  return url;
}

/**
 * Executa OCR em português dentro de Web Worker local usando Tesseract.js,
 * liberando toda a memória de trabalho ao terminar.
 */
export async function executarOcrEmCanvas(canvas: HTMLCanvasElement): Promise<ResultadoOcr> {
  const worker = await createWorker('por', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tessdata',
    gzip: true,
  });

  try {
    const { data } = await worker.recognize(canvas);
    const texto = (data.text ?? '').trim();
    const confiancaMedia = Number.isFinite(data.confidence) ? data.confidence : 0;

    if (texto.length < 10 || confiancaMedia < 25) {
      throw new ErroImportacaoHolerite(
        'IMAGEM_ILEGIVEL',
        'Tente uma foto mais nítida, com o documento inteiro e boa iluminação.'
      );
    }

    return {
      texto,
      confiancaMedia,
    };
  } finally {
    await worker.terminate();
  }
}

function carregarElementoImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const urlObjeto = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(urlObjeto);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(urlObjeto);
      reject(
        new ErroImportacaoHolerite(
          'IMAGEM_ILEGIVEL',
          'Tente uma foto mais nítida, com o documento inteiro e boa iluminação.'
        )
      );
    };
    img.src = urlObjeto;
  });
}

export async function lerImagemHoleriteComOcr(
  arquivo: File
): Promise<{ texto: string; confiancaMedia: number; miniaturaDataUrl: string }> {
  const img = await carregarElementoImagem(arquivo);
  if (img.naturalWidth < 60 || img.naturalHeight < 60) {
    throw new ErroImportacaoHolerite(
      'IMAGEM_ILEGIVEL',
      'Tente uma foto mais nítida, com o documento inteiro e boa iluminação.'
    );
  }

  const miniaturaDataUrl = gerarMiniaturaCanvas(img, img.naturalWidth, img.naturalHeight);
  const canvasProcessado = preProcessarCanvasParaOcr(img, img.naturalWidth, img.naturalHeight);

  try {
    const resultado = await executarOcrEmCanvas(canvasProcessado);
    return {
      texto: resultado.texto,
      confiancaMedia: resultado.confiancaMedia,
      miniaturaDataUrl,
    };
  } finally {
    canvasProcessado.width = 0;
    canvasProcessado.height = 0;
  }
}
