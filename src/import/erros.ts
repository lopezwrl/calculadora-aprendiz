export type CodigoErroImportacao =
  | 'ARQUIVO_VAZIO'
  | 'ARQUIVO_MUITO_GRANDE'
  | 'FORMATO_NAO_SUPORTADO'
  | 'PDF_PROTEGIDO_SENHA'
  | 'SENHA_PDF_INCORRETA'
  | 'IMAGEM_ILEGIVEL'
  | 'NENHUM_CAMPO_RECONHECIDO'
  | 'FALHA_LEITURA';

export class ErroImportacaoHolerite extends Error {
  readonly codigo: CodigoErroImportacao;

  constructor(codigo: CodigoErroImportacao, mensagem: string) {
    super(mensagem);
    this.name = 'ErroImportacaoHolerite';
    this.codigo = codigo;
  }
}

export const LIMITE_TAMANHO_ARQUIVO_BYTES = 10 * 1024 * 1024;

export function validarArquivoEntrada(arquivo: File | null | undefined): void {
  if (!arquivo) {
    throw new ErroImportacaoHolerite('ARQUIVO_VAZIO', 'Selecione um arquivo PDF, JPG ou PNG.');
  }

  if (arquivo.size === 0) {
    throw new ErroImportacaoHolerite(
      'ARQUIVO_VAZIO',
      'O arquivo enviado está vazio. Selecione um documento válido.'
    );
  }

  if (arquivo.size > LIMITE_TAMANHO_ARQUIVO_BYTES) {
    throw new ErroImportacaoHolerite(
      'ARQUIVO_MUITO_GRANDE',
      'O arquivo ultrapassa o limite de 10 MB. Envie um arquivo menor.'
    );
  }

  const nome = arquivo.name.toLowerCase();
  const tipo = arquivo.type.toLowerCase();
  const ehPdf = tipo === 'application/pdf' || nome.endsWith('.pdf');
  const ehImagem =
    tipo === 'image/jpeg' ||
    tipo === 'image/jpg' ||
    tipo === 'image/png' ||
    nome.endsWith('.jpg') ||
    nome.endsWith('.jpeg') ||
    nome.endsWith('.png');

  if (!ehPdf && !ehImagem) {
    throw new ErroImportacaoHolerite(
      'FORMATO_NAO_SUPORTADO',
      'Formato não suportado. Envie um arquivo PDF, JPG ou PNG.'
    );
  }
}
