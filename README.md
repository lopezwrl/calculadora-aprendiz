# Calculadora de Rescisão — Jovem Aprendiz

Aplicação **100% front-end** (HTML + CSS + JavaScript puro, sem build/backend) que calcula estimativas de verbas rescisórias para contratos de **Jovem Aprendiz**, com base na Lei nº 10.097/2000 e na CLT. Permite escolher só o que precisa calcular, mostra a conta explicada passo a passo, guarda histórico local e exporta o resultado em PDF ou impressão.

---

## Índice

- [Principais funcionalidades](#principais-funcionalidades)
- [O que pode ser calculado](#o-que-pode-ser-calculado)
- [Como os cálculos funcionam](#como-os-cálculos-funcionam)
- [Arquitetura do código](#arquitetura-do-código)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Stack utilizada](#stack-utilizada)
- [Como rodar localmente](#como-rodar-localmente)
- [Persistência de dados](#persistência-de-dados)
- [Acessibilidade](#acessibilidade)
- [Avisos legais / limitações](#avisos-legais--limitações)

---

## Principais funcionalidades

- **Cálculo seletivo**: o usuário marca só os itens que quer calcular (um, vários ou todos) — os campos exigidos no formulário mudam dinamicamente conforme a seleção, e nada além do necessário é pedido.
- **Explicação didática**: cada resultado vem acompanhado de um texto que mostra a conta passo a passo (não é só o número final).
- **Formatação de moeda em tempo real**: o campo de salário/valores é formatado como `R$ 0,00` enquanto o usuário digita.
- **Campo de data segmentado** (dia/mês/ano em inputs separados) com validação e navegação automática entre os segmentos.
- **Histórico local**: os últimos 15 cálculos ficam salvos no navegador (`localStorage`), com opção de remover um item específico ou limpar tudo.
- **Exportação em PDF**: gera um PDF da tela de resultado usando `html2canvas` + `jsPDF`, com fallback automático para a opção de impressão do navegador se as bibliotecas não carregarem.
- **Impressão direta** do resultado.
- **Tema claro/escuro**: aplicado antes mesmo do CSS carregar (evita "flash" de tema errado), com detecção da preferência do sistema (`prefers-color-scheme`) e opção de alternância manual persistida.
- **Modal de legislação**: base legal, informações importantes sobre o contrato de aprendiz e disclaimer, acessível a qualquer momento pelo botão de ajuda.
- **Acessível**: uso extensivo de atributos ARIA, `role`, foco gerenciado nos modais e mensagens de erro associadas aos campos.
- **Respeita `prefers-reduced-motion`**: animações de entrada (scroll reveal) e efeito *ripple* dos botões são desativados se o usuário preferir menos movimento no sistema operacional.

---

## O que pode ser calculado

| Cálculo | Campo(s) exigido(s) | Base |
|---|---|---|
| **Saldo de Salário** | Dias trabalhados no último mês | Salário ÷ 30 dias × dias trabalhados |
| **13º Salário** | Meses completos no ano | Salário ÷ 12 × meses completos |
| **Férias + 1/3** | Meses acumulados para férias | Salário ÷ 12 × meses acumulados, + 1/3 constitucional sobre esse valor |
| **FGTS (2%)** | Dias com FGTS acumulado | 2% do salário por mês (alíquota reduzida do aprendiz, ante os 8% da CLT comum) |
| **Indenização (Art. 479 CLT)** | Meses que faltavam para o fim do contrato | Metade dos salários restantes até o fim do contrato — só se aplica quando a empresa encerra o contrato antes do prazo, sem justa causa |
| **Salário Bruto x Líquido** | (usa o salário base + desconto opcional de VT/VA) | Salário bruto − INSS (tabela progressiva) − vale-transporte (até 6%, opcional) − vale-alimentação/refeição (opcional) |

O **Salário Base** é sempre pedido assim que qualquer item acima é marcado, pois é usado como entrada de todos os cálculos.

---

## Como os cálculos funcionam

Toda a lógica está centralizada na classe `CalculadoraRescisao` (`script.js`), com as constantes legais isoladas em `CONFIG`:

```js
FGTS_APRENDIZ_ALIQUOTA: 0.02        // 2% (vs. 8% da CLT comum)
TERCO_CONSTITUCIONAL_ALIQUOTA: 1/3
VALE_TRANSPORTE_MAX: 0.06           // 6% do salário
DIAS_MES_CALCULO: 30
MESES_ANO: 12
DURACAO_CONTRATO_APRENDIZ: 2        // anos

INSS_FAIXAS: [                      // tabela progressiva vigente desde jan/2026
  { limite: 1621.00, aliquota: 0.075 },
  { limite: 2902.84, aliquota: 0.09  },
  { limite: 4354.27, aliquota: 0.12  },
  { limite: 8475.55, aliquota: 0.14  },
]
```

O **INSS** é calculado por faixas progressivas (não é uma alíquota única sobre o salário inteiro): cada faixa de salário paga sua própria alíquota, e o desconto total é a soma do valor de cada faixa — exatamente como funciona a tabela oficial.

Cada cálculo tem, além do método que retorna o valor numérico, uma função em `Explicacoes` que monta o texto explicativo mostrado junto ao resultado (ex.: "seu salário dividido por 30 dias dá X por dia, você trabalhou Y dias, então X × Y = resultado").

---

## Arquitetura do código

Tudo em um único `script.js`, organizado em classes utilitárias (a maioria com métodos estáticos, sem estado próprio de instância) com responsabilidades bem separadas:

| Classe | Responsabilidade |
|---|---|
| `GerenciadorSeletor` | Mostra/esconde os blocos de campos conforme os checkboxes de "o que calcular" marcados, e ajusta quais campos são `required`. |
| `Validador` | Valida o formulário (datas, valores numéricos, intervalos por tipo de cálculo) e exibe/limpa mensagens de erro por campo. |
| `Formatador` | Formatação de moeda (`Intl.NumberFormat`), datas, máscara de input de moeda em tempo real, e checagem de `prefers-reduced-motion`. |
| `CalculadoraRescisao` | O motor de cálculo: recebe os dados do formulário e expõe um método por tipo de verba. |
| `Explicacoes` | Gera o texto "como calculamos" para cada tipo de resultado. |
| `GerenciadorResultados` | Monta os cards de resultado na tela a partir dos tipos selecionados. |
| `GerenciadorDestaque` | Realces visuais no resultado (ex.: total). |
| `GerenciadorTema` | Alternância e persistência do tema claro/escuro. |
| `GerenciadorHistorico` | CRUD do histórico local (salvar, listar, remover item, limpar tudo) via `localStorage`. |
| `GerenciadorExportacao` | Geração do PDF (`html2canvas` + `jsPDF`), com cálculo de escala segura para não estourar o limite de área do canvas, e fallback para impressão em caso de erro. |
| `GerenciadorModal` | Abertura/fechamento do modal de legislação (com suporte a tecla Esc). |
| `GerenciadorScrollReveal` | Animação de entrada dos blocos do formulário ao rolar a página (via `IntersectionObserver`). |
| `GerenciadorImpressao` | Aciona `window.print()`. |
| `GerenciadorDataSegmentada` | Lógica dos inputs de data separados por dia/mês/ano (navegação automática entre segmentos, validação). |
| `GerenciadorSplash` | Tela de carregamento inicial (loader). |
| `GerenciadorFormulario` | Orquestra o envio do formulário: coleta os dados, valida, dispara o cálculo e exibe o resultado; também trata reset e "novo cálculo". |
| `GerenciadorRipple` | Efeito visual de "onda" ao clicar nos botões. |

Tudo é inicializado em um único listener de `DOMContentLoaded`, chamando o `init()` de cada gerenciador na ordem em que faz sentido (splash → tema → seletor de cálculo → campos de data → formulário → modal → histórico → animações → ripple).

---

## Estrutura do projeto

```
calculadora-aprendiz-main/
├── index.html        # Marcação da página: formulário, seção de resultado, modais
├── script.js          # Toda a lógica: cálculo, validação, formatação, histórico, exportação
├── style.css           # Estilos, incluindo tema claro/escuro
└── videoex.mp4          # Vídeo de exemplo/demonstração (não referenciado no código)
```

Não há build, bundler ou dependências de backend — é um site estático que roda abrindo o `index.html` direto no navegador ou hospedando em qualquer servidor de arquivos estáticos.

---

## Stack utilizada

- **HTML5** semântico, com atributos ARIA para acessibilidade.
- **CSS puro**, com variáveis CSS para o tema claro/escuro.
- **JavaScript puro (ES6+)**, sem frameworks nem bundler.
- **[html2canvas](https://html2canvas.hertzen.com/)** (via CDN) — captura a seção de resultado como imagem para montar o PDF.
- **[jsPDF](https://github.com/parallax/jsPDF)** (via CDN) — geração do arquivo PDF a partir da imagem capturada.

---

## Como rodar localmente

Por ser um site estático, basta abrir o arquivo diretamente ou servir a pasta:

```bash
# Opção 1: abrir direto
# basta dar duplo clique no index.html

# Opção 2: servir com um servidor HTTP simples (recomendado, evita
# restrições de alguns navegadores com arquivos abertos via file://)
cd calculadora-aprendiz-main
python -m http.server 8000
# depois acessar http://localhost:8000
```

---

## Persistência de dados

Não há backend nem banco de dados — tudo roda no navegador do próprio usuário:

- **Tema escolhido**: `localStorage`, chave `rescisao-tema`.
- **Histórico de cálculos** (até 15 itens mais recentes): `localStorage`, chave `rescisao-historico`.

Nada é enviado para um servidor; os dados ficam só no navegador de quem está usando, e o próprio app avisa isso na tela de histórico.

---

## Acessibilidade

- Uso de `role`, `aria-live`, `aria-labelledby`, `aria-hidden` e `aria-invalid` nos formulários, modais e mensagens de erro.
- Foco e fechamento por tecla `Esc` nos modais (legislação e histórico).
- Animações desativadas automaticamente quando o sistema indica preferência por menos movimento (`prefers-reduced-motion`).
- Tema aplicado antes da primeira pintura da página, evitando o "flash" de tema incorreto.

---

## Avisos legais / limitações

- A própria aplicação deixa claro (no modal de legislação e no rodapé do resultado) que os valores são uma **estimativa educacional**, baseada na legislação vigente até 2024/2026 — não substitui a consulta ao RH da empresa, a um advogado trabalhista, ao sindicato da categoria ou ao portal oficial `trabalho.gov.br`.
- A tabela de faixas do INSS está fixa no código (`CONFIG.INSS_FAIXAS`) e precisa ser atualizada manualmente quando o governo reajustar os valores.
- A exportação em PDF depende de dois scripts carregados via CDN (`html2canvas`, `jsPDF`); sem conexão com a internet, a exportação cai automaticamente para a opção de impressão do navegador.
