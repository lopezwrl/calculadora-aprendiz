/**
 * Quatro layouts sintéticos distintos de holerites brasileiros (100% dados fictícios)
 * utilizados nos testes automatizados do extrator e da conferência cruzada.
 */

export const HOLERITE_LAYOUT_1_REFERENCIA = `
COMERCIAL PIAUIENSE DE ALIMENTOS LTDA
CNPJ: 00.000.000/0001-00   Teresina, PI
Competência: 10/2026
Nome do Funcionário: Lucas Martins Oliveira
CPF: 111.222.333-44   PIS: 123.45678.90-1   Matrícula: 004821
Endereço: Rua das Acácias, 1200, Centro, Teresina
Data de Admissão: 02/03/2026
Cargo: Jovem Aprendiz Administrativo

Cód   Descrição                      Ref.      Proventos    Descontos
001   Salário Base                   30,00     712,00
101   INSS                           7,50                   53,25

Base INSS: 710,00 | Base FGTS: 712,00 | FGTS do Mês: 14,24 | Base IRRF: 0,00
Total de Proventos: 712,00 | Total de Descontos: 53,25 | Valor Líquido: 658,75
`;

export const HOLERITE_LAYOUT_2_TABULAR_CORPORATIVO = `
DISTRIBUIDORA NORDESTE S/A
Demonstrativo de Pagamento de Salário   Mês/Ano: 11/2026
Colaborador: Helena Costa Sousa
Dt. Admissão: 15/02/2024   Função: Analista Administrativo

0010  Salário Mensal                 220,00    2.500,00
0050  Horas Extras                   10,00       220,00
0201  Vale-Transporte                 6,00                    150,00
0501  Contribuição Previdenciária     8,11                    220,49

Salário Base     Sal. Contr. INSS     Base Cálc. FGTS     FGTS do Mês     Base Cálc. IRRF
2.500,00         2.720,00             2.720,00            217,60          2.112,80

Total de Vencimentos     Total de Descontos     Líquido a Receber
2.720,00                 370,49                 2.349,51
`;

export const HOLERITE_LAYOUT_3_FORMATO_PONTO_DECIMAL = `
TECNOLOGIA POTY LTDA
Periodo de Referencia: Outubro/2026
Empregado: Rafael Mendes Lima | Data Admissao: 10/01/2025 | Cargo: Desenvolvedor Junior
Vencimento Base: 3200.00
Vale Alimentacao: 120.00
Previdencia Social: 272.60
Base INSS: 3200.00 | Base FGTS: 3200.00 | Valor do FGTS: 256.00
Total Bruto: 3200.00 | Soma dos Descontos: 392.60 | Salario Liquido: 2807.40
`;

export const HOLERITE_LAYOUT_4_COMERCIO_COMISSOES = `
LOJAS CENTRO TERESINA LTDA
Folha Mensal: 09/2026
Trabalhador: Camila Rocha Ferreira
Admitido em: 05/05/2023
Ocupação: Consultora de Vendas

100 Salário Contratual               30,00     1.800,00
120 Comissões                                    400,00
125 Descanso Semanal Remunerado                   80,00
410 Convênio Médico                               95,00
500 INSS Folha                        7,93       180,89

Base Cálculo INSS: 2.280,00
Base Cálculo FGTS: 2.280,00
Depósito FGTS: 182,40
Total Proventos: 2.280,00
Total Descontos: 275,89
Total Líquido: 2.004,11
`;
