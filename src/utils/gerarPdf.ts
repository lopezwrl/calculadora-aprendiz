import { jsPDF } from 'jspdf';
import { DATA_ULTIMA_CONFERENCIA } from '../config/parametros';
import { formatarCentavos, ResultadoCalculo } from '../calc';

export interface MetadadosPdf {
  nomeTrabalhador?: string;
  dataAdmissao?: string;
  dataSaida?: string;
  descricaoModo: string;
}

export function gerarPdfDemonstrativo(
  resultado: ResultadoCalculo,
  meta: MetadadosPdf
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margem = 40;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const larguraUtil = larguraPagina - margem * 2;
  let y = 40;

  // Faixa superior laranja (#FD701C) + cabeçalho azul (#002893)
  doc.setFillColor(253, 112, 28);
  doc.rect(margem, y, larguraUtil, 4, 'F');
  y += 4;

  doc.setFillColor(0, 40, 147);
  doc.rect(margem, y, larguraUtil, 84, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Calculadora CLT Teresina', margem + 18, y + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(meta.descricaoModo, margem + 18, y + 45);

  const subtituloDatas = [
    meta.nomeTrabalhador ? `Trabalhador: ${meta.nomeTrabalhador}` : null,
    meta.dataAdmissao ? `Admissao: ${meta.dataAdmissao}` : null,
    meta.dataSaida ? `Saida: ${meta.dataSaida}` : null,
  ]
    .filter(Boolean)
    .join('   |   ');

  if (subtituloDatas) {
    doc.setTextColor(210, 222, 250);
    doc.text(subtituloDatas, margem + 18, y + 64);
  }

  doc.setTextColor(253, 112, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('LIQUIDO APURADO', larguraPagina - margem - 18, y + 28, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(formatarCentavos(resultado.valorLiquidoCentavos), larguraPagina - margem - 18, y + 52, {
    align: 'right',
  });

  y += 104;

  // Grade resumo em 3 colunas com borda limpa
  const larguraBloco = larguraUtil / 3;
  const blocos = [
    { titulo: resultado.rotuloBruto.toUpperCase(), valor: formatarCentavos(resultado.totalBrutoCentavos) },
    { titulo: 'DESCONTOS', valor: formatarCentavos(resultado.totalDescontosCentavos) },
    { titulo: 'VALOR LIQUIDO', valor: formatarCentavos(resultado.valorLiquidoCentavos) },
  ];

  doc.setDrawColor(216, 224, 238);
  doc.rect(margem, y, larguraUtil, 48);

  blocos.forEach((b, i) => {
    const bx = margem + i * larguraBloco;
    if (i > 0) {
      doc.line(bx, y, bx, y + 48);
    }
    doc.setTextColor(81, 98, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(b.titulo, bx + 12, y + 17);
    doc.setTextColor(8, 18, 46);
    doc.setFontSize(12);
    doc.text(b.valor, bx + 12, y + 36);
  });

  y += 70;

  const desenharSecao = (titulo: string, linhas: ResultadoCalculo['linhasProventos']) => {
    if (linhas.length === 0) return;
    if (y > 720) {
      doc.addPage();
      y = 44;
    }

    doc.setTextColor(0, 40, 147);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(titulo.toUpperCase(), margem, y);
    y += 8;

    doc.setDrawColor(0, 40, 147);
    doc.setLineWidth(1);
    doc.line(margem, y, larguraPagina - margem, y);
    doc.setLineWidth(0.5);
    y += 16;

    for (const linha of linhas) {
      if (y > 750) {
        doc.addPage();
        y = 44;
      }

      doc.setTextColor(8, 18, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(linha.rotulo, margem, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(81, 98, 140);
      doc.setFontSize(8.5);
      doc.text(linha.formula, margem + 195, y);

      doc.setTextColor(8, 18, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(formatarCentavos(linha.valorCentavos), larguraPagina - margem, y, {
        align: 'right',
      });

      y += 8;
      doc.setDrawColor(232, 237, 245);
      doc.line(margem, y, larguraPagina - margem, y);
      y += 13;
    }

    y += 8;
  };

  desenharSecao('Proventos e verbas', resultado.linhasProventos);
  desenharSecao('Descontos legais e contratuais', resultado.linhasDescontos);
  if (resultado.parcelasDecimoTerceiro && resultado.parcelasDecimoTerceiro.length > 0) {
    desenharSecao('Cronograma de parcelas do 13o salario', resultado.parcelasDecimoTerceiro);
  }
  desenharSecao('Encargos patronais (informativo)', resultado.linhasEncargos);

  y += 12;
  if (y > 760) {
    doc.addPage();
    y = 44;
  }

  doc.setTextColor(81, 98, 140);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'Estimativa para fins informativos. Confirme os valores com o RH ou assessoria juridica.',
    margem,
    y
  );
  doc.text(
    `Parametros de ${resultado.anoParametros}, conferidos em ${DATA_ULTIMA_CONFERENCIA}.`,
    margem,
    y + 14
  );

  doc.save(`demonstrativo-clt-teresina-${resultado.modo}.pdf`);
}
