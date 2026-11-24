import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// Fonte bitmap 5x7 minimalista para renderizar texto legível nos PNGs sintéticos de teste
const GLIFOS_5X7 = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x12, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ':': [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
  ',': [0x00, 0x00, 0x00, 0x00, 0x06, 0x04, 0x08],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x06],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  '$': [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function criarChunkPng(tipo, dados) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const tamBuf = Buffer.alloc(4);
  tamBuf.writeUInt32BE(dados.length, 0);
  const crcInput = Buffer.concat([tipoBuf, dados]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([tamBuf, tipoBuf, dados, crcBuf]);
}

function gerarPngEscalaCinza(largura, altura, linhasTexto) {
  const pixels = new Uint8Array(largura * altura);
  pixels.fill(255);

  const escala = 2;
  let cursorY = 18;

  for (const linhaOriginal of linhasTexto) {
    const limpa = linhaOriginal
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    let cursorX = 18;
    for (const ch of limpa) {
      const glifo = GLIFOS_5X7[ch];
      if (glifo && cursorX + 6 * escala < largura && cursorY + 8 * escala < altura) {
        for (let gy = 0; gy < 7; gy += 1) {
          const bits = glifo[gy];
          for (let gx = 0; gx < 5; gx += 1) {
            if ((bits >> (4 - gx)) & 1) {
              for (let sy = 0; sy < escala; sy += 1) {
                for (let sx = 0; sx < escala; sx += 1) {
                  const py = cursorY + gy * escala + sy;
                  const px = cursorX + gx * escala + sx;
                  pixels[py * largura + px] = 20;
                }
              }
            }
          }
        }
      }
      cursorX += 6 * escala;
    }
    cursorY += 11 * escala;
  }

  // Monta scanlines PNG (filtro 0 por linha, grayscale 8 bits)
  const raw = Buffer.alloc(altura * (1 + largura));
  for (let y = 0; y < altura; y += 1) {
    const offsetLinha = y * (1 + largura);
    raw[offsetLinha] = 0;
    for (let x = 0; x < largura; x += 1) {
      raw[offsetLinha + 1 + x] = pixels[y * largura + x];
    }
  }

  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type 0 (grayscale)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  return Buffer.concat([
    assinatura,
    criarChunkPng('IHDR', ihdr),
    criarChunkPng('IDAT', idat),
    criarChunkPng('IEND', Buffer.alloc(0)),
  ]);
}

const pastaDestino = join(process.cwd(), 'src', 'import', '__fixtures__', 'imagens');
mkdirSync(pastaDestino, { recursive: true });

const layouts = [
  {
    arquivo: 'holerite_layout_1_referencia.png',
    linhas: [
      'COMERCIAL PIAUIENSE DE ALIMENTOS LTDA',
      'COMPETENCIA: 10/2026',
      'NOME DO FUNCIONARIO: LUCAS MARTINS OLIVEIRA',
      'DATA DE ADMISSAO: 02/03/2026',
      'CARGO: JOVEM APRENDIZ ADMINISTRATIVO',
      '001 SALARIO BASE 30,00 712,00',
      '101 INSS 7,50 53,25',
      'BASE INSS: 710,00 | BASE FGTS: 712,00 | FGTS DO MES: 14,24',
      'TOTAL DE PROVENTOS: 712,00 | TOTAL DE DESCONTOS: 53,25',
      'VALOR LIQUIDO: 658,75',
    ],
  },
  {
    arquivo: 'holerite_layout_2_corporativo.png',
    linhas: [
      'DISTRIBUIDORA NORDESTE SA',
      'MES/ANO: 11/2026',
      'COLABORADOR: HELENA COSTA SOUSA',
      'DT. ADMISSAO: 15/02/2024',
      'SALARIO MENSAL 2.500,00',
      'HORAS EXTRAS 220,00',
      'VALE-TRANSPORTE 150,00',
      'INSS 220,49',
      'BASE INSS: 2.720,00 | FGTS DO MES: 217,60',
      'LIQUIDO A RECEBER: 2.349,51',
    ],
  },
  {
    arquivo: 'holerite_layout_3_ponto_decimal.png',
    linhas: [
      'TECNOLOGIA POTY LTDA',
      'COMPETENCIA: 10/2026',
      'EMPREGADO: RAFAEL MENDES LIMA',
      'DATA ADMISSAO: 10/01/2025',
      'VENCIMENTO BASE: 3200.00',
      'VALE ALIMENTACAO: 120.00',
      'PREVIDENCIA SOCIAL: 272.60',
      'SALARIO LIQUIDO: 2807.40',
    ],
  },
  {
    arquivo: 'holerite_layout_4_comercio.png',
    linhas: [
      'LOJAS CENTRO TERESINA LTDA',
      'FOLHA MENSAL: 09/2026',
      'TRABALHADOR: CAMILA ROCHA FERREIRA',
      'SALARIO CONTRATUAL: 1.800,00',
      'COMISSOES: 400,00',
      'DSR: 80,00',
      'CONVENIO MEDICO: 95,00',
      'INSS FOLHA: 180,89',
      'TOTAL LIQUIDO: 2.004,11',
    ],
  },
  {
    arquivo: 'imagem_sem_texto.png',
    linhas: [],
  },
];

for (const item of layouts) {
  const png = gerarPngEscalaCinza(680, 280, item.linhas);
  writeFileSync(join(pastaDestino, item.arquivo), png);
}

console.log('Fixtures PNG geradas com sucesso em src/import/__fixtures__/imagens');
