export type ChaveCampoHolerite =
  | 'competencia'
  | 'nomeFuncionario'
  | 'dataAdmissao'
  | 'cargo'
  | 'salarioBase'
  | 'horasExtras'
  | 'adicionais'
  | 'comissoes'
  | 'dsr'
  | 'ferias'
  | 'decimoTerceiro'
  | 'outrosProventos'
  | 'inss'
  | 'irrf'
  | 'valeTransporte'
  | 'valeRefeicao'
  | 'adiantamento'
  | 'faltas'
  | 'contribuicaoSindical'
  | 'convenio'
  | 'outrosDescontos'
  | 'baseInss'
  | 'baseFgts'
  | 'fgtsMes'
  | 'baseIrrf'
  | 'totalProventos'
  | 'totalDescontos'
  | 'liquido';

export type TipoValorCampo = 'moeda' | 'data' | 'competencia' | 'texto';

export type CategoriaCampoHolerite = 'cabecalho' | 'provento' | 'desconto' | 'base' | 'total';

export interface DefinicaoCampoDicionario {
  chave: ChaveCampoHolerite;
  rotulo: string;
  tipo: TipoValorCampo;
  categoria: CategoriaCampoHolerite;
  /** Rótulos exatos normalizados (sem acento, minúsculos) que conferem confiança Alta */
  rotulosExatos: string[];
  /** Sinônimos e abreviações comuns em sistemas de folha que conferem confiança Média */
  sinonimos: string[];
  /** Indica se a linha pode trazer referência percentual ou de dias antes do valor principal */
  aceitaReferencia?: boolean;
}

/**
 * Padrões de dados pessoais sensíveis que nunca devem ser extraídos nem exibidos na interface.
 */
export const PADROES_DADOS_SENSIVEIS: RegExp[] = [
  /\bcpf\s*[:.]?\s*\d{3}\.?\d{3}\.?\d{3}[-./]?\d{2}\b/gi,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  /\b(?:pis|pasep|nis|nit)\s*[:.]?\s*[\d.-]{10,15}\b/gi,
  /\b\d{3}\.\d{5}\.\d{2}-\d\b/g,
  /\b(?:matricula|matr\.?|registro)\s*[:.]?\s*[a-z0-9/-]+\b/gi,
  /\b(?:endereco|logradouro|residencia|cep)\s*[:.]?.*$/gim,
];

/**
 * Palavras-chave que identificam uma linha exclusiva de dados sensíveis a ser ignorada por inteiro.
 */
export const ROTULOS_LINHA_SENSIVEL: string[] = [
  'cpf',
  'pis/pasep',
  'pis',
  'pasep',
  'nis',
  'matricula',
  'endereco',
  'logradouro',
  'cep',
  'ctps',
  'rg',
  'agencia',
  'conta corrente',
];

export const DICIONARIO_CAMPOS_HOLERITE: DefinicaoCampoDicionario[] = [
  {
    chave: 'competencia',
    rotulo: 'Competência',
    tipo: 'competencia',
    categoria: 'cabecalho',
    rotulosExatos: ['competencia', 'mes/ano', 'periodo de referencia'],
    sinonimos: ['referencia folha', 'folha mensal', 'demonstrativo ref', 'mes ref'],
  },
  {
    chave: 'nomeFuncionario',
    rotulo: 'Nome do funcionário',
    tipo: 'texto',
    categoria: 'cabecalho',
    rotulosExatos: ['nome do funcionario', 'nome do empregado', 'funcionario', 'empregado'],
    sinonimos: ['colaborador', 'nome completo', 'trabalhador', 'aprendiz'],
  },
  {
    chave: 'dataAdmissao',
    rotulo: 'Data de admissão',
    tipo: 'data',
    categoria: 'cabecalho',
    rotulosExatos: ['data de admissao', 'admissao', 'data admissao'],
    sinonimos: ['dt admissao', 'dt. admissao', 'admitido em', 'inicio contrato'],
  },
  {
    chave: 'cargo',
    rotulo: 'Cargo',
    tipo: 'texto',
    categoria: 'cabecalho',
    rotulosExatos: ['cargo', 'funcao', 'cargo/funcao'],
    sinonimos: ['ocupacao', 'descricao do cargo', 'cbo cargo'],
  },
  {
    chave: 'salarioBase',
    rotulo: 'Salário base',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: [
      'salario base',
      'salario mensal',
      'vencimento base',
      'salario contratual',
      'salario normal',
    ],
    sinonimos: ['horas normais', 'dias normais', 'salario', 'vencimento mensal', 'sal base'],
    aceitaReferencia: true,
  },
  {
    chave: 'horasExtras',
    rotulo: 'Horas extras',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['horas extras', 'hora extra 50%', 'hora extra 100%'],
    sinonimos: ['h extra', 'h. extras', 'horas suplementares', 'he 50', 'he 100'],
    aceitaReferencia: true,
  },
  {
    chave: 'adicionais',
    rotulo: 'Adicionais',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: [
      'adicional noturno',
      'adicional de insalubridade',
      'adicional de periculosidade',
    ],
    sinonimos: ['insalubridade', 'periculosidade', 'adic noturno', 'anuénio', 'quinquenio', 'gratificacao'],
    aceitaReferencia: true,
  },
  {
    chave: 'comissoes',
    rotulo: 'Comissões',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['comissoes', 'comissao', 'comissao sobre vendas'],
    sinonimos: ['premio producao', 'premios', 'variavel vendas'],
  },
  {
    chave: 'dsr',
    rotulo: 'DSR',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['dsr', 'descanso semanal remunerado', 'repouso semanal remunerado'],
    sinonimos: ['reflexo dsr', 'dsr sobre horas extras', 'dsr s/ comissoes'],
  },
  {
    chave: 'ferias',
    rotulo: 'Férias',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['ferias', 'ferias gozadas', '1/3 ferias'],
    sinonimos: ['terco constitucional ferias', 'abono pecuniario', 'remuneracao ferias'],
  },
  {
    chave: 'decimoTerceiro',
    rotulo: '13º salário',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['13o salario', '13 salario', 'decimo terceiro salario'],
    sinonimos: ['adiantamento 13', '1a parcela 13', '2a parcela 13', 'gratificacao natalina'],
  },
  {
    chave: 'outrosProventos',
    rotulo: 'Outros proventos',
    tipo: 'moeda',
    categoria: 'provento',
    rotulosExatos: ['outros proventos', 'ajuda de custo', 'salario-familia'],
    sinonimos: ['salario familia', 'auxilio creche', 'reembolso', 'bonus'],
  },
  {
    chave: 'inss',
    rotulo: 'INSS',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['inss', 'inss folha', 'contribuicao previdenciaria', 'previdencia social'],
    sinonimos: ['inss sobre salario', 'inss mensal', 'desc inss', 'inss empregado'],
    aceitaReferencia: true,
  },
  {
    chave: 'irrf',
    rotulo: 'IRRF',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['irrf', 'imposto de renda retido na fonte', 'imposto de renda'],
    sinonimos: ['ir fonte', 'irrf mensal', 'desc irrf', 'retencao irrf'],
    aceitaReferencia: true,
  },
  {
    chave: 'valeTransporte',
    rotulo: 'Vale-transporte',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['vale-transporte', 'vale transporte', 'desconto vale-transporte'],
    sinonimos: ['desc vt', 'desconto vt', 'vt 6%', 'custeio vale transporte'],
    aceitaReferencia: true,
  },
  {
    chave: 'valeRefeicao',
    rotulo: 'Vale-refeição ou alimentação',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['vale-refeicao', 'vale refeicao', 'vale-alimentacao', 'vale alimentacao'],
    sinonimos: ['desc vr', 'desc va', 'pat alimentacao', 'refeitorio'],
  },
  {
    chave: 'adiantamento',
    rotulo: 'Adiantamento',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['adiantamento salarial', 'adiantamento quinzenal', 'desconto adiantamento'],
    sinonimos: ['adiantamento', 'vale quinzenal'],
  },
  {
    chave: 'faltas',
    rotulo: 'Faltas e atrasos',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['faltas', 'faltas e atrasos', 'horas faltas'],
    sinonimos: ['atrasos', 'dsr sobre faltas', 'ausencias injustificadas'],
    aceitaReferencia: true,
  },
  {
    chave: 'contribuicaoSindical',
    rotulo: 'Contribuição sindical',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['contribuicao sindical', 'mensalidade sindical', 'contribuicao assistencial'],
    sinonimos: ['sindicato', 'taxa negocial', 'confederativa'],
  },
  {
    chave: 'convenio',
    rotulo: 'Convênio',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['convenio medico', 'plano de saude', 'convenio farmacia'],
    sinonimos: ['assistencia medica', 'assistencia odontologica', 'plano odontologico', 'coparticipacao'],
  },
  {
    chave: 'outrosDescontos',
    rotulo: 'Outros descontos',
    tipo: 'moeda',
    categoria: 'desconto',
    rotulosExatos: ['outros descontos', 'emprestimo consignado', 'seguro de vida'],
    sinonimos: ['consignado', 'pensao alimenticia'],
  },
  {
    chave: 'baseInss',
    rotulo: 'Base do INSS',
    tipo: 'moeda',
    categoria: 'base',
    rotulosExatos: ['base inss', 'salario contrib. inss', 'sal. contr. inss', 'base calc. inss'],
    sinonimos: [
      'salario de contribuicao inss',
      'base calculo inss',
      'base previdencia',
      'sal contrib inss',
      'base de inss',
    ],
  },
  {
    chave: 'baseFgts',
    rotulo: 'Base do FGTS',
    tipo: 'moeda',
    categoria: 'base',
    rotulosExatos: ['base fgts', 'base calc. fgts', 'base de calculo fgts'],
    sinonimos: ['base calculo fgts', 'remuneracao fgts'],
  },
  {
    chave: 'fgtsMes',
    rotulo: 'FGTS do mês',
    tipo: 'moeda',
    categoria: 'base',
    rotulosExatos: ['fgts do mes', 'valor do fgts', 'deposito fgts'],
    sinonimos: ['fgts mes', 'fgts a recolher', 'fgts recolhido'],
  },
  {
    chave: 'baseIrrf',
    rotulo: 'Base do IRRF',
    tipo: 'moeda',
    categoria: 'base',
    rotulosExatos: ['base irrf', 'base calc. irrf', 'base de calculo irrf'],
    sinonimos: ['base calculo irrf', 'base ir', 'base calc ir'],
  },
  {
    chave: 'totalProventos',
    rotulo: 'Total de proventos',
    tipo: 'moeda',
    categoria: 'total',
    rotulosExatos: ['total de proventos', 'total de vencimentos', 'total proventos', 'total vencimentos'],
    sinonimos: ['soma dos proventos', 'total bruto', 'bruto total'],
  },
  {
    chave: 'totalDescontos',
    rotulo: 'Total de descontos',
    tipo: 'moeda',
    categoria: 'total',
    rotulosExatos: ['total de descontos', 'total descontos'],
    sinonimos: ['soma dos descontos', 'descontos totais'],
  },
  {
    chave: 'liquido',
    rotulo: 'Valor líquido',
    tipo: 'moeda',
    categoria: 'total',
    rotulosExatos: ['valor liquido', 'liquido a receber', 'salario liquido', 'total liquido'],
    sinonimos: ['valor a receber', 'liquido pago', 'liquido'],
  },
];
