# Calculadora CLT Teresina

Aplicação front-end para simulação de folha mensal, décimo terceiro salário e rescisão contratual de trabalhadores sob regime CLT e aprendizagem em Teresina, Piauí. Inclui importação 100% local de holerite em PDF ou imagem com revisão assistida e conferência cruzada.

## Como executar

```bash
npm install
npm run dev
```

Comandos auxiliares:

```bash
npm test
npm run build
```

## Arquitetura de pastas

* `src/calc`: funções puras de cálculo trabalhista e conferência cruzada em centavos inteiros, sem acesso ao DOM.
* `src/config`: parâmetros legais e tributários organizados por ano de vigência (`parametros.ts`).
* `src/import`: leitura de PDF (`lerPdf.ts`), pré-processamento e OCR em Web Worker (`ocr.ts`), normalização (`normalizar.ts`), dicionário de sinônimos (`dicionario.ts`), extração desacoplada (`extrairCampos.ts`) e conferência (`conferir.ts`).
* `src/components`: cabeçalho, importador de holerite, resumo ao vivo, resultado expansível, histórico local e modal explicativo.
* `src/pages`: fluxo em etapas integrado com React Hook Form, Zod e Framer Motion.
* `src/styles`: tokens visuais nos temas claro e escuro, tipografia tabular e regras de impressão.

## Parâmetros legais que exigem conferência oficial periódica

Todos os parâmetros ficam centralizados em `src/config/parametros.ts`, acompanhados da constante `DATA_ULTIMA_CONFERENCIA`:

1. **Salário mínimo nacional** (`salarioMinimoCentavos`): conferir decreto federal anual no Portal da Legislação do Planalto.
2. **Piso salarial aplicável no Piauí** (`pisoEstadualPiauiCentavos`): o Piauí não adota lei complementar estadual de piso regional geral privado, prevalecendo o salário mínimo nacional salvo piso de convenção coletiva local informado no campo opcional da calculadora (conferir no sistema Mediador do MTE para sindicatos de Teresina).
3. **Faixas e teto do INSS** (`faixasInss`, `tetoInssCentavos`): conferir Portaria Interministerial MPS/MF publicada em janeiro de cada ano.
4. **Tabela progressiva, dedução por dependente, desconto simplificado e redutor do IRRF** (`faixasIrrf`, `deducaoDependenteCentavos`, `descontoSimplificadoIrrfCentavos`, `redutorIrrf`): conferir tabelas de incidência mensal da Receita Federal (Lei nº 15.191/2025 e Lei nº 15.270/2025).
5. **Alíquotas e multas do FGTS** (`aliquotaFgtsClt` de 8%, `aliquotaFgtsAprendiz` de 2%, multas de 40% e 20%): conferir Lei nº 8.036/1990, Lei nº 10.097/2000 e art. 484 A da CLT.

## Fórmulas aplicadas

* **Saldo de salário**: `salário base ÷ 30 × dias trabalhados no mês da saída`, limitando os dias ao mês comercial de 30 dias.
* **Aviso prévio indenizado (Lei nº 12.506/2011)**: `30 dias + 3 dias por ano completo`, até 90 dias. Pago integralmente na dispensa sem justa causa e pela metade no acordo entre as partes (art. 484 A da CLT). Projeta a data final para contagem de avos de férias e 13º.
* **Décimo terceiro proporcional**: `salário base ÷ 12 × avos`, contando como mês integral toda fração igual ou superior a 15 dias trabalhados. Na modalidade anual, a 1ª parcela (até 30/11) paga 50% do bruto sem descontos, e a 2ª parcela (até 20/12) desconta integralmente INSS e IRRF.
* **Férias vencidas e proporcionais**: acrescidas de `1/3` constitucional (e dobradas quando vencido o período concessivo). Na rescisão são verbas indenizatórias isentas de INSS e IRRF.
* **FGTS**: encargo exclusivo do empregador (8% para CLT e 2% para aprendizagem), nunca deduzido do valor líquido do trabalhador.
* **INSS**: soma progressiva por faixa sobre a base de contribuição, apurada separadamente para o saldo de salário e para o 13º salário.
* **IRRF**: aplica a maior dedução entre as deduções legais (INSS mais dependentes) e o desconto simplificado mensal, seguida da tabela progressiva e do redutor mensal vigente.
* **Vale-transporte**: desativado por padrão; quando ativado, corresponde ao menor valor entre `6%` do salário base proporcional aos dias trabalhados e o benefício mensal efetivamente fornecido.

## Nota técnica sobre a diferença de R$ 0,15 no INSS do Caso 1

No caso de referência com salário bruto contratual de `R$ 712,00` (sem dependentes e sem vale-transporte):

* Aplicando `7,5%` diretamente sobre `R$ 712,00`, o desconto de INSS seria `R$ 53,40` e o líquido `R$ 658,60`.
* No holerite real confirmado, o líquido apurado foi `R$ 658,75`, com desconto de INSS de `R$ 53,25` (diferença de `R$ 0,15`).
* Essa diferença decorre da coluna **Base INSS** registrada no holerite em `R$ 710,00` (`R$ 710,00 × 7,5% = R$ 53,25`), o que ocorre na prática de folha quando há rubrica não integrante do salário de contribuição ou ajuste de arredondamento de horas contratuais. Por essa razão, a calculadora expõe o campo **Base do INSS** editável (por padrão sincronizado ao salário base) e o importador de holerite captura especificamente a Base do INSS impressa no documento.
