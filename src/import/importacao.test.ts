import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { obterParametros } from '../config/parametros';
import { conferirValoresHolerite } from '../calc/validacao';
import {
  conferirExtracaoHolerite,
  ErroImportacaoHolerite,
  extrairCamposDoTexto,
  LIMITE_TAMANHO_ARQUIVO_BYTES,
  reconstruirLinhasDeItensPdf,
  validarArquivoEntrada,
} from './index';
import {
  HOLERITE_LAYOUT_1_REFERENCIA,
  HOLERITE_LAYOUT_2_TABULAR_CORPORATIVO,
  HOLERITE_LAYOUT_3_FORMATO_PONTO_DECIMAL,
  HOLERITE_LAYOUT_4_COMERCIO_COMISSOES,
} from './__fixtures__/holeritesSinteticos';

const params2026 = obterParametros(2026);

describe('Importação de holerite: parser em 4 layouts sintéticos e supressão de dados sensíveis', () => {
  it('Layout 1 (Caso de referência R$ 712,00): lê campos com confiança alta, ignora CPF/PIS/matrícula/endereço, sem inconsistências e sem vale-transporte', () => {
    const extracao = extrairCamposDoTexto(HOLERITE_LAYOUT_1_REFERENCIA, {
      origemLeitura: 'pdf_texto',
    });

    expect(extracao.campos.competencia.valorDetectado).toBe('10/2026');
    expect(extracao.campos.competencia.confianca).toBe('alta');
    expect(extracao.campos.nomeFuncionario.valorDetectado).toBe('Lucas Martins Oliveira');
    expect(extracao.campos.dataAdmissao.valorDetectado).toBe('02/03/2026');
    expect(extracao.campos.cargo.valorDetectado).toBe('Jovem Aprendiz Administrativo');

    expect(extracao.campos.salarioBase.valorCentavos).toBe(71200);
    expect(extracao.campos.salarioBase.confianca).toBe('alta');
    expect(extracao.campos.baseInss.valorCentavos).toBe(71000);
    expect(extracao.campos.baseInss.confianca).toBe('alta');
    expect(extracao.campos.inss.valorCentavos).toBe(5325);
    expect(extracao.campos.inss.referencia).toBe('7,50');
    expect(extracao.campos.fgtsMes.valorCentavos).toBe(1424);
    expect(extracao.campos.liquido.valorCentavos).toBe(65875);

    // Vale-transporte não deve ser ativado nem detectado
    expect(extracao.campos.valeTransporte.encontrado).toBe(false);

    // Dados sensíveis nunca aparecem em nenhum valor ou trecho extraído
    const serializado = JSON.stringify(extracao.listaCampos);
    expect(serializado).not.toContain('111.222.333-44');
    expect(serializado).not.toContain('123.45678.90-1');
    expect(serializado).not.toContain('004821');
    expect(serializado).not.toContain('Rua das Acácias');

    // Conferência cruzada sem nenhum aviso de inconsistência
    const inconsistencias = conferirExtracaoHolerite(extracao, {}, params2026);
    expect(inconsistencias).toEqual([]);
  });

  it('Layout 2 (Tabular corporativo de duas linhas): reconstrói cabeçalhos pareados, horas extras e vale-transporte', () => {
    const extracao = extrairCamposDoTexto(HOLERITE_LAYOUT_2_TABULAR_CORPORATIVO, {
      origemLeitura: 'pdf_texto',
    });

    expect(extracao.campos.competencia.valorDetectado).toBe('11/2026');
    expect(extracao.campos.nomeFuncionario.valorDetectado).toBe('Helena Costa Sousa');
    expect(extracao.campos.nomeFuncionario.confianca).toBe('media');
    expect(extracao.campos.salarioBase.valorCentavos).toBe(250000);
    expect(extracao.campos.horasExtras.valorCentavos).toBe(22000);
    expect(extracao.campos.valeTransporte.valorCentavos).toBe(15000);
    expect(extracao.campos.inss.valorCentavos).toBe(22049);
    expect(extracao.campos.baseInss.valorCentavos).toBe(272000);
    expect(extracao.campos.fgtsMes.valorCentavos).toBe(21760);
    expect(extracao.campos.totalProventos.valorCentavos).toBe(272000);
    expect(extracao.campos.totalDescontos.valorCentavos).toBe(37049);
    expect(extracao.campos.liquido.valorCentavos).toBe(234951);

    const inconsistencias = conferirExtracaoHolerite(extracao, {}, params2026);
    expect(inconsistencias).toEqual([]);
  });

  it('Layout 3 (Separadores com ponto decimal 1234.56 e mês por extenso): normaliza moedas e competência', () => {
    const extracao = extrairCamposDoTexto(HOLERITE_LAYOUT_3_FORMATO_PONTO_DECIMAL, {
      origemLeitura: 'pdf_texto',
    });

    expect(extracao.campos.competencia.valorDetectado).toBe('10/2026');
    expect(extracao.campos.salarioBase.valorCentavos).toBe(320000);
    expect(extracao.campos.valeRefeicao.valorCentavos).toBe(12000);
    expect(extracao.campos.inss.valorCentavos).toBe(27260);
    expect(extracao.campos.fgtsMes.valorCentavos).toBe(25600);
    expect(extracao.campos.liquido.valorCentavos).toBe(280740);

    const inconsistencias = conferirExtracaoHolerite(extracao, {}, params2026);
    expect(inconsistencias).toEqual([]);
  });

  it('Layout 4 (Comércio com comissões, DSR, convênio e OCR com ruído): sinaliza confiança reduzida quando OCR tem score baixo', () => {
    const extracaoOcrRuidoso = extrairCamposDoTexto(HOLERITE_LAYOUT_4_COMERCIO_COMISSOES, {
      origemLeitura: 'ocr_imagem',
      confiancaMediaOcr: 65,
    });

    expect(extracaoOcrRuidoso.campos.salarioBase.valorCentavos).toBe(180000);
    expect(extracaoOcrRuidoso.campos.comissoes.valorCentavos).toBe(40000);
    expect(extracaoOcrRuidoso.campos.dsr.valorCentavos).toBe(8000);
    expect(extracaoOcrRuidoso.campos.convenio.valorCentavos).toBe(9500);
    expect(extracaoOcrRuidoso.campos.inss.valorCentavos).toBe(18089);
    expect(extracaoOcrRuidoso.campos.liquido.valorCentavos).toBe(200411);
    expect(extracaoOcrRuidoso.campos.salarioBase.confianca).toBe('baixa');
  });
});

describe('Conferência cruzada e entradas inválidas', () => {
  it('detecta líquido divergente quando proventos menos descontos não fecham', () => {
    const inc = conferirValoresHolerite(
      {
        salarioBaseCentavos: 200000,
        totalProventosCentavos: 200000,
        totalDescontosCentavos: 15569,
        liquidoCentavos: 180000,
      },
      params2026
    );
    expect(inc.some((i) => i.codigo === 'LIQUIDO_DIVERGENTE')).toBe(true);
  });

  it('detecta INSS divergente da tabela vigente sobre a base informada', () => {
    const inc = conferirValoresHolerite(
      {
        salarioBaseCentavos: 71200,
        baseInssCentavos: 71200,
        inssCentavos: 5325,
        tipoContrato: 'aprendiz',
      },
      params2026
    );
    expect(inc.some((i) => i.codigo === 'INSS_DIVERGENTE')).toBe(true);
  });

  it('detecta FGTS divergente de 8% no contrato CLT', () => {
    const inc = conferirValoresHolerite(
      {
        salarioBaseCentavos: 200000,
        baseFgtsCentavos: 200000,
        fgtsMesCentavos: 4000,
        tipoContrato: 'clt',
      },
      params2026
    );
    expect(inc.some((i) => i.codigo === 'FGTS_DIVERGENTE')).toBe(true);
  });

  it('rejeita arquivo vazio, arquivo acima de 10 MB, formato inválido, PDF sem campos e verifica fixtures de imagem', () => {
    const vazio = new File([], 'vazio.pdf', { type: 'application/pdf' });
    expect(() => validarArquivoEntrada(vazio)).toThrowError(ErroImportacaoHolerite);

    const grandeDemais = {
      name: 'grande.pdf',
      type: 'application/pdf',
      size: LIMITE_TAMANHO_ARQUIVO_BYTES + 1024,
    } as File;
    expect(() => validarArquivoEntrada(grandeDemais)).toThrowError(ErroImportacaoHolerite);

    const formatoInvalido = new File(['conteudo'], 'planilha.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(() => validarArquivoEntrada(formatoInvalido)).toThrowError(ErroImportacaoHolerite);

    // PDF sem camada de campos trabalhistas
    const textoPdfVazio = reconstruirLinhasDeItensPdf([
      { texto: 'Comunicado interno de feriado municipal', x: 40, y: 700, largura: 220 },
    ]);
    const semCampos = extrairCamposDoTexto(textoPdfVazio);
    expect(semCampos.quantidadeReconhecida).toBe(0);

    // Confere presença das 4 fixtures sintéticas como imagem PNG e da imagem em branco
    const pastaImagens = join(process.cwd(), 'src', 'import', '__fixtures__', 'imagens');
    const arquivosEsperados = [
      'holerite_layout_1_referencia.png',
      'holerite_layout_2_corporativo.png',
      'holerite_layout_3_ponto_decimal.png',
      'holerite_layout_4_comercio.png',
      'imagem_sem_texto.png',
    ];
    for (const nomeArq of arquivosEsperados) {
      const caminho = join(pastaImagens, nomeArq);
      expect(existsSync(caminho)).toBe(true);
      const cabecalhoPng = readFileSync(caminho).subarray(0, 8);
      expect(Array.from(cabecalhoPng)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }

    // Verifica ausência de travessões e trechos proibidos nos arquivos de interface
    const pastaComponentes = join(process.cwd(), 'src', 'components');
    for (const arq of readdirSync(pastaComponentes)) {
      const conteudo = readFileSync(join(pastaComponentes, arq), 'utf8');
      expect(conteudo).not.toContain('—');
      expect(conteudo).not.toContain('–');
      expect(conteudo).not.toMatch(/\bTODO\b/);
    }
  });
});
