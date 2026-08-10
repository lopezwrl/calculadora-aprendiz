const CONFIG = {
    FGTS_APRENDIZ_ALIQUOTA: 0.02,
    TERCO_CONSTITUCIONAL_ALIQUOTA: 1/3,
    VALE_TRANSPORTE_MAX: 0.06,
    DIAS_MES_CALCULO: 30,
    MESES_ANO: 12,
    DURACAO_CONTRATO_APRENDIZ: 2,

    INSS_FAIXAS: [
        { limite: 1621.00, aliquota: 0.075 },
        { limite: 2902.84, aliquota: 0.09 },
        { limite: 4354.27, aliquota: 0.12 },
        { limite: 8475.55, aliquota: 0.14 },
    ],
};

const MENSAGENS = {
    validacao: {
        campo_obrigatorio: 'Este campo é obrigatório',
        valor_invalido: 'Digite um valor válido',
        valor_positivo: 'O valor deve ser maior que zero',
        data_invalida: 'Data inválida',
        data_saida_posterior: 'Data de saída deve ser posterior à admissão',
        intervalo_invalido: 'Valor fora do intervalo permitido',
        selecione_um_calculo: 'Selecione ao menos um cálculo para continuar',
    }
};

const CALC_TIPOS = [
    { id: 'saldo', checkboxId: 'calcSaldo', groupId: 'grupoSaldo', campos: ['diasTrabalhados'] },
    { id: 'decimo13', checkboxId: 'calcDecimo13', groupId: 'grupoDecimo13', campos: ['meses13Salario'] },
    { id: 'ferias', checkboxId: 'calcFerias', groupId: 'grupoFerias', campos: ['mesesFerias'] },
    { id: 'fgts', checkboxId: 'calcFgts', groupId: 'grupoFgts', campos: ['diasFGTS'] },
    { id: 'indenizacao', checkboxId: 'calcIndenizacao', groupId: 'grupoIndenizacao', campos: ['mesesRestantes'] },

    { id: 'liquido', checkboxId: 'calcLiquido', groupId: 'grupoLiquido', campos: [] },
];

const DOM = {

    form: document.getElementById('rescisaoForm'),
    fields: {
        nome: document.getElementById('nomeFuncionario'),
        dataAdmissao: document.getElementById('dataAdmissao'),
        dataSaida: document.getElementById('dataSaida'),
        salario: document.getElementById('salarioBase'),
        dias: document.getElementById('diasTrabalhados'),
        meses13: document.getElementById('meses13Salario'),
        mesesFerias: document.getElementById('mesesFerias'),
        valeTransporte: document.getElementById('useValeTransporte'),
        diasFGTS: document.getElementById('diasFGTS'),
        mesesRestantes: document.getElementById('mesesRestantes'),
        valorValeAlimentacao: document.getElementById('valorValeAlimentacao'),
    },
    buttons: {
        submit: document.getElementById('submitBtn'),
        reset: document.getElementById('resetBtn'),
        print: document.getElementById('printBtn'),
        exportPdf: document.getElementById('exportPdfBtn'),
        newCalc: document.getElementById('newCalcBtn'),
        navHelp: document.getElementById('navHelp'),
        modalClose: document.getElementById('modalClose'),
        themeToggle: document.getElementById('themeToggle'),
        historyBtn: document.getElementById('historyBtn'),
        historyModalClose: document.getElementById('historyModalClose'),
        historyClear: document.getElementById('historyClearBtn'),
    },
    sections: {
        results: document.getElementById('resultsSection'),
        resultsContainer: document.getElementById('resultadosContainer'),
        modal: document.getElementById('infoModal'),
        modalOverlay: document.getElementById('modalOverlay'),
        historyModal: document.getElementById('historyModal'),
        historyModalOverlay: document.getElementById('historyModalOverlay'),
        historyList: document.getElementById('historyList'),
        historyEmpty: document.getElementById('historyEmpty'),
    },
    grupoSalario: document.getElementById('grupoSalario'),
};

class GerenciadorSeletor {
    static init() {
        CALC_TIPOS.forEach(tipo => {
            const checkbox = document.getElementById(tipo.checkboxId);
            checkbox.addEventListener('change', () => this.atualizarVisibilidade());
        });
        this.atualizarVisibilidade();
    }

    static getSelecionados() {
        return CALC_TIPOS.filter(tipo => document.getElementById(tipo.checkboxId).checked)
                          .map(tipo => tipo.id);
    }

    static atualizarVisibilidade() {
        const selecionados = this.getSelecionados();

        CALC_TIPOS.forEach(tipo => {
            const checkbox = document.getElementById(tipo.checkboxId);
            const grupo = document.getElementById(tipo.groupId);
            const marcado = checkbox.checked;

            grupo.classList.toggle('hidden', !marcado);

            tipo.campos.forEach(campoId => {
                const campoEl = document.getElementById(campoId);
                if (campoEl) {
                    campoEl.required = marcado;
                }
            });

            checkbox.closest('.calc-option').classList.toggle('selected', marcado);
        });

        const algumSelecionado = selecionados.length > 0;
        DOM.grupoSalario.classList.toggle('hidden', !algumSelecionado);
        DOM.fields.salario.required = algumSelecionado;

        if (algumSelecionado) {
            const erroEl = document.getElementById('error-calcTipos');
            if (erroEl) erroEl.textContent = '';
        }
    }
}

class Validador {
    static validarFormulario(dados, selecionados) {
        const erros = {};

        if (selecionados.length === 0) {
            erros.calcTipos = MENSAGENS.validacao.selecione_um_calculo;
            return erros;
        }

        if (dados.dataAdmissao && dados.dataSaida) {
            const admissao = new Date(dados.dataAdmissao);
            const saida = new Date(dados.dataSaida);
            if (saida <= admissao) {
                erros.dataSaida = MENSAGENS.validacao.data_saida_posterior;
            }
        }

        const salario = parseFloat(dados.salario);
        if (!dados.salario || isNaN(salario) || salario <= 0) {
            erros.salarioBase = MENSAGENS.validacao.valor_positivo;
        }

        if (selecionados.includes('saldo')) {
            const dias = parseInt(dados.dias, 10);
            if (isNaN(dias) || dias < 0 || dias > 31) {
                erros.diasTrabalhados = 'Digite entre 0 e 31 dias';
            }
        }

        if (selecionados.includes('decimo13')) {
            const meses13 = parseInt(dados.meses13, 10);
            if (isNaN(meses13) || meses13 < 0 || meses13 > 12) {
                erros.meses13Salario = 'Digite entre 0 e 12 meses';
            }
        }

        if (selecionados.includes('ferias')) {
            const mesesFerias = parseInt(dados.mesesFerias, 10);
            if (isNaN(mesesFerias) || mesesFerias < 0 || mesesFerias > 60) {
                erros.mesesFerias = 'Digite entre 0 e 60 meses';
            }
        }

        if (selecionados.includes('fgts')) {
            const diasFGTS = parseInt(dados.diasFGTS, 10);
            if (isNaN(diasFGTS) || diasFGTS < 0) {
                erros.diasFGTS = MENSAGENS.validacao.valor_invalido;
            }
        }

        if (selecionados.includes('indenizacao')) {
            const mesesRestantes = parseInt(dados.mesesRestantes, 10);
            if (isNaN(mesesRestantes) || mesesRestantes < 0 || mesesRestantes > 24) {
                erros.mesesRestantes = 'Digite entre 0 e 24 meses';
            }
        }

        if (selecionados.includes('liquido') && dados.valorValeAlimentacao) {
            const valorVA = parseFloat(dados.valorValeAlimentacao);
            if (isNaN(valorVA) || valorVA < 0) {
                erros.valorValeAlimentacao = MENSAGENS.validacao.valor_invalido;
            }
        }

        return erros;
    }

    static exibirErros(erros) {

        document.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
        });
        document.querySelectorAll('input, select').forEach(el => {
            el.classList.remove('error');
            el.setAttribute('aria-invalid', 'false');
        });

        Object.entries(erros).forEach(([campo, mensagem]) => {
            const errorEl = document.getElementById(`error-${campo}`);
            const inputEl = document.getElementById(campo);

            if (errorEl) {
                errorEl.textContent = mensagem;
            }
            if (inputEl) {
                inputEl.classList.add('error');
                inputEl.setAttribute('aria-invalid', 'true');
            }
        });

        if (erros.calcTipos) {
            document.getElementById('calcSelectorGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    static limparErros() {
        document.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
        });
        document.querySelectorAll('input, select').forEach(el => {
            el.classList.remove('error');
            el.setAttribute('aria-invalid', 'false');
        });
    }
}

class Formatador {
    static formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(valor);
    }

    static formatarData(dataString) {
        const data = new Date(dataString + 'T00:00:00');
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(data);
    }

    static formatarInputMoeda(evento) {
        let valor = evento.target.value.replace(/\D/g, '');

        if (valor.length === 0) {
            evento.target.value = '';
            return;
        }

        const valorNumerico = parseInt(valor, 10) / 100;
        evento.target.value = valorNumerico.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    static prefereMenosMovimento() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    static animarValor(elemento, valorFinal, sinal = '', duracaoMs = 650) {
        if (Formatador.prefereMenosMovimento()) {
            elemento.textContent = `${sinal}${Formatador.formatarMoeda(valorFinal)}`;
            return;
        }

        const inicio = performance.now();

        const passo = (agora) => {
            const progresso = Math.min((agora - inicio) / duracaoMs, 1);
            const suavizado = 1 - Math.pow(1 - progresso, 3);
            const atual = valorFinal * suavizado;
            elemento.textContent = `${sinal}${Formatador.formatarMoeda(atual)}`;

            if (progresso < 1) {
                requestAnimationFrame(passo);
            } else {
                elemento.textContent = `${sinal}${Formatador.formatarMoeda(valorFinal)}`;
            }
        };

        requestAnimationFrame(passo);
    }
}

class CalculadoraRescisao {
    constructor(dados) {
        this.dados = dados;
        this.salarioBase = parseFloat(dados.salario);
        this.diasTrabalhados = parseInt(dados.dias, 10);
        this.meses13Salario = parseInt(dados.meses13, 10);
        this.mesesFerias = parseInt(dados.mesesFerias, 10);
        this.diasFGTS = parseInt(dados.diasFGTS, 10);
        this.mesesRestantes = parseInt(dados.mesesRestantes, 10);

        this.valorValeAlimentacao = dados.valorValeAlimentacao ? parseFloat(dados.valorValeAlimentacao) : 0;
    }

    calcularSaldoSalario() {
        const diaria = this.salarioBase / CONFIG.DIAS_MES_CALCULO;
        return diaria * this.diasTrabalhados;
    }

    calcularDecimoTerceiro() {
        const proporcao = this.salarioBase / CONFIG.MESES_ANO;
        return proporcao * this.meses13Salario;
    }

    calcularFeriasProporcionais() {
        const proporcao = this.salarioBase / CONFIG.MESES_ANO;
        return proporcao * this.mesesFerias;
    }

    calcularTercoFerias() {
        const ferias = this.calcularFeriasProporcionais();
        return ferias * CONFIG.TERCO_CONSTITUCIONAL_ALIQUOTA;
    }

    calcularFGTSEstimado() {
        const mesesDecorridos = this.diasFGTS / CONFIG.DIAS_MES_CALCULO;
        const depositoMensal = this.salarioBase * CONFIG.FGTS_APRENDIZ_ALIQUOTA;
        return depositoMensal * mesesDecorridos;
    }

    calcularDescontoValeTransporte() {
        if (!this.dados.valeTransporte) return 0;
        return this.salarioBase * CONFIG.VALE_TRANSPORTE_MAX;
    }

    calcularIndenizacao() {
        const salariosRestantes = this.salarioBase * this.mesesRestantes;
        return salariosRestantes / 2;
    }

    calcularINSS() {
        let restante = this.salarioBase;
        let anterior = 0;
        let desconto = 0;

        for (const faixa of CONFIG.INSS_FAIXAS) {
            if (restante <= 0) break;
            const larguraFaixa = faixa.limite - anterior;
            const valorNaFaixa = Math.min(restante, larguraFaixa);
            desconto += valorNaFaixa * faixa.aliquota;
            restante -= valorNaFaixa;
            anterior = faixa.limite;
        }

        return desconto;
    }

    calcularSalarioLiquido() {
        const inss = this.calcularINSS();
        const vt = this.calcularDescontoValeTransporte();
        const va = this.valorValeAlimentacao;
        return this.salarioBase - inss - vt - va;
    }
}

const Explicacoes = {
    saldo(calc) {
        const diaria = calc.salarioBase / CONFIG.DIAS_MES_CALCULO;
        return `Como calculamos: seu salário (${Formatador.formatarMoeda(calc.salarioBase)}) dividido por 30 dias dá `
            + `${Formatador.formatarMoeda(diaria)} por dia. Você trabalhou ${calc.diasTrabalhados} dia(s), então: `
            + `${Formatador.formatarMoeda(diaria)} × ${calc.diasTrabalhados} = ${Formatador.formatarMoeda(calc.calcularSaldoSalario())}.`;
    },
    decimo13(calc) {
        const porMes = calc.salarioBase / CONFIG.MESES_ANO;
        return `Como calculamos: o 13º é 1/12 do salário para cada mês completo trabalhado no ano. Seu salário `
            + `(${Formatador.formatarMoeda(calc.salarioBase)}) dividido por 12 dá ${Formatador.formatarMoeda(porMes)} por mês. `
            + `Você tem ${calc.meses13Salario} mês(es) completo(s), então: ${Formatador.formatarMoeda(porMes)} × ${calc.meses13Salario} `
            + `= ${Formatador.formatarMoeda(calc.calcularDecimoTerceiro())}.`;
    },
    feriasProporcionais(calc) {
        const porMes = calc.salarioBase / CONFIG.MESES_ANO;
        return `Como calculamos: assim como o 13º, as férias valem 1/12 do salário para cada mês trabalhado sem tirar férias. `
            + `${Formatador.formatarMoeda(calc.salarioBase)} ÷ 12 = ${Formatador.formatarMoeda(porMes)} por mês. Você acumulou `
            + `${calc.mesesFerias} mês(es), então: ${Formatador.formatarMoeda(porMes)} × ${calc.mesesFerias} `
            + `= ${Formatador.formatarMoeda(calc.calcularFeriasProporcionais())}.`;
    },
    tercoFerias(calc) {
        const ferias = calc.calcularFeriasProporcionais();
        return `Como calculamos: por lei, além das férias você recebe mais 1/3 (um terço) desse valor. Pegamos o valor das férias `
            + `(${Formatador.formatarMoeda(ferias)}) e dividimos por 3: ${Formatador.formatarMoeda(ferias)} ÷ 3 `
            + `= ${Formatador.formatarMoeda(calc.calcularTercoFerias())} a mais.`;
    },
    fgts(calc) {
        const mensal = calc.salarioBase * CONFIG.FGTS_APRENDIZ_ALIQUOTA;
        const meses = (calc.diasFGTS / CONFIG.DIAS_MES_CALCULO).toFixed(1);
        return `Como calculamos: o FGTS do aprendiz é 2% do salário por mês (bem menor que os 8% da CLT comum). `
            + `${Formatador.formatarMoeda(calc.salarioBase)} × 2% = ${Formatador.formatarMoeda(mensal)} guardados por mês. `
            + `Com ${calc.diasFGTS} dias trabalhados (cerca de ${meses} meses): ${Formatador.formatarMoeda(mensal)} × ${meses} `
            + `= ${Formatador.formatarMoeda(calc.calcularFGTSEstimado())}. Isso é uma estimativa — o valor exato está na sua conta do FGTS, `
            + `no site ou app da Caixa.`;
    },
    indenizacao(calc) {
        const salariosRestantes = calc.salarioBase * calc.mesesRestantes;
        return `Como calculamos: quando a empresa encerra o contrato antes do prazo, sem justa causa, ela paga metade dos salários `
            + `que você ainda receberia. ${Formatador.formatarMoeda(calc.salarioBase)} × ${calc.mesesRestantes} mês(es) restante(s) `
            + `= ${Formatador.formatarMoeda(salariosRestantes)}. Esse valor dividido por 2 `
            + `= ${Formatador.formatarMoeda(calc.calcularIndenizacao())}.`;
    },
    valeTransporte(calc) {
        return `Como calculamos: a empresa pode descontar até 6% do salário para o vale-transporte. `
            + `${Formatador.formatarMoeda(calc.salarioBase)} × 6% = ${Formatador.formatarMoeda(calc.calcularDescontoValeTransporte())} descontado.`;
    },
    liquido(calc) {
        const inss = calc.calcularINSS();
        const vt = calc.calcularDescontoValeTransporte();
        const va = calc.valorValeAlimentacao;
        let texto = `Como calculamos: partimos do seu salário bruto (${Formatador.formatarMoeda(calc.salarioBase)}) e tiramos, `
            + `um a um, os descontos que incidem sobre ele. O INSS é calculado por faixa progressiva (tabela vigente desde `
            + `jan/2026): cada "fatia" do salário paga uma alíquota diferente (7,5% a 14%), e somamos o resultado de cada faixa — `
            + `por isso o total (${Formatador.formatarMoeda(inss)}) não é simplesmente o salário vezes uma alíquota única.`;
        if (vt > 0) {
            texto += ` Do vale-transporte marcado, descontamos até 6%: ${Formatador.formatarMoeda(vt)}.`;
        }
        if (va > 0) {
            texto += ` Do vale-alimentação/refeição informado, descontamos ${Formatador.formatarMoeda(va)}.`;
        }
        texto += ` No fim: ${Formatador.formatarMoeda(calc.salarioBase)} − ${Formatador.formatarMoeda(inss)}`
            + (vt > 0 ? ` − ${Formatador.formatarMoeda(vt)}` : '')
            + (va > 0 ? ` − ${Formatador.formatarMoeda(va)}` : '')
            + ` = ${Formatador.formatarMoeda(calc.calcularSalarioLiquido())} de salário líquido.`;
        return texto;
    },
};

class GerenciadorResultados {
    static exibirResultados(dados, selecionados) {
        const calc = new CalculadoraRescisao(dados);

        DOM.sections.resultsContainer.innerHTML = '';

        const infoAprendiz = document.getElementById('infoAprendiz');
        const infoPeriodo = document.getElementById('infoPeriodo');

        if (dados.nome && dados.nome.trim().length > 0) {
            infoAprendiz.textContent = `Aprendiz: ${dados.nome}`;
            infoAprendiz.classList.remove('hidden');
        } else {
            infoAprendiz.classList.add('hidden');
        }

        if (dados.dataAdmissao && dados.dataSaida) {
            const periodo = `${Formatador.formatarData(dados.dataAdmissao)} até ${Formatador.formatarData(dados.dataSaida)}`;
            infoPeriodo.textContent = `Período: ${periodo}`;
            infoPeriodo.classList.remove('hidden');
        } else {
            infoPeriodo.classList.add('hidden');
        }

        const cards = [];

        if (selecionados.includes('saldo')) {
            cards.push({
                tipo: 'saldo',
                label: 'Saldo de Salário',
                valor: calc.calcularSaldoSalario(),
                explicacao: Explicacoes.saldo(calc),
                highlight: false,
            });
        }

        if (selecionados.includes('decimo13')) {
            cards.push({
                tipo: 'decimo13',
                label: '13º Salário Proporcional',
                valor: calc.calcularDecimoTerceiro(),
                explicacao: Explicacoes.decimo13(calc),
                highlight: false,
            });
        }

        if (selecionados.includes('ferias')) {
            cards.push({
                tipo: 'ferias',
                label: 'Férias Proporcionais',
                valor: calc.calcularFeriasProporcionais(),
                explicacao: Explicacoes.feriasProporcionais(calc),
                highlight: false,
            });
            cards.push({
                tipo: 'ferias',
                label: '1/3 Constitucional de Férias',
                valor: calc.calcularTercoFerias(),
                explicacao: Explicacoes.tercoFerias(calc),
                highlight: false,
            });
        }

        if (selecionados.includes('fgts')) {
            cards.push({
                tipo: 'fgts',
                label: 'FGTS Estimado (2%)',
                valor: calc.calcularFGTSEstimado(),
                explicacao: Explicacoes.fgts(calc),
                highlight: true,
            });
        }

        if (selecionados.includes('indenizacao')) {
            cards.push({
                tipo: 'indenizacao',
                label: 'Indenização (Art. 479)',
                valor: calc.calcularIndenizacao(),
                explicacao: Explicacoes.indenizacao(calc),
                highlight: true,
            });
        }

        const descontoVT = calc.calcularDescontoValeTransporte();
        if (descontoVT > 0 && !selecionados.includes('liquido')) {
            cards.push({
                tipo: 'saldo',
                label: 'Desconto Vale-Transporte',
                valor: -descontoVT,
                explicacao: Explicacoes.valeTransporte(calc),
                highlight: false,
            });
        }

        cards.forEach((card, indice) => this.renderizarCard(card, indice));

        if (selecionados.includes('liquido')) {
            this.renderizarCardLiquido(calc, cards.length);
        }

        const total = cards.reduce((soma, card) => soma + card.valor, 0);

        if (cards.length > 1) {
            this.renderizarCardTotal(total, cards.length);
        }

        DOM.sections.results.classList.remove('hidden');
        DOM.sections.results.scrollIntoView({ behavior: 'smooth', block: 'start' });

        GerenciadorHistorico.salvar({
            nome: dados.nome && dados.nome.trim() ? dados.nome.trim() : null,
            tipos: selecionados,
            total,
        });

        if (!Formatador.prefereMenosMovimento()) {
            setTimeout(() => GerenciadorDestaque.pulsar(), 300);
        }
    }

    static renderizarCard(card, indice = 0) {
        const cardEl = document.createElement('div');
        cardEl.className = `result-card ${card.highlight ? 'highlight' : ''}`;
        cardEl.dataset.tipo = card.tipo;
        cardEl.style.animationDelay = `${indice * 90}ms`;

        const valor = card.valor;
        const ehNegativo = valor < 0;
        const valorAbsoluto = Math.abs(valor);
        const sinal = ehNegativo ? '- ' : '';

        cardEl.innerHTML = `
            <div class="result-card-label">${card.label}</div>
            <div class="result-card-value">${sinal}${Formatador.formatarMoeda(0)}</div>
            <div class="result-explanation">${card.explicacao}</div>
        `;

        DOM.sections.resultsContainer.appendChild(cardEl);

        const valorEl = cardEl.querySelector('.result-card-value');
        Formatador.animarValor(valorEl, valorAbsoluto, sinal);
    }

    static renderizarCardLiquido(calc, indice = 0) {
        const inss = calc.calcularINSS();
        const vt = calc.calcularDescontoValeTransporte();
        const va = calc.valorValeAlimentacao;
        const liquido = calc.calcularSalarioLiquido();

        const linhas = [
            { label: 'Salário Bruto', valor: calc.salarioBase, sinal: '' },
            { label: 'INSS (progressivo)', valor: inss, sinal: '− ' },
        ];
        if (vt > 0) linhas.push({ label: 'Vale-Transporte (6%)', valor: vt, sinal: '− ' });
        if (va > 0) linhas.push({ label: 'Vale-Alimentação/Refeição', valor: va, sinal: '− ' });

        const cardEl = document.createElement('div');
        cardEl.className = 'result-card result-card-liquido highlight';
        cardEl.dataset.tipo = 'liquido';
        cardEl.style.animationDelay = `${indice * 90}ms`;

        cardEl.innerHTML = `
            <div class="result-card-label">Salário Bruto x Líquido</div>
            <ul class="liquido-breakdown">
                ${linhas.map(l => `
                    <li>
                        <span>${l.label}</span>
                        <span>${l.sinal}${Formatador.formatarMoeda(l.valor)}</span>
                    </li>
                `).join('')}
                <li class="liquido-breakdown-total">
                    <span>Salário Líquido</span>
                    <span>${Formatador.formatarMoeda(liquido)}</span>
                </li>
            </ul>
            <div class="result-explanation">${Explicacoes.liquido(calc)}</div>
        `;

        DOM.sections.resultsContainer.appendChild(cardEl);
    }

    static renderizarCardTotal(total) {
        const cardEl = document.createElement('div');
        cardEl.className = 'result-card total';
        cardEl.innerHTML = `
            ${this.svgCarimbo()}
            <div class="result-card-label">
                <svg class="icon-svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
                </svg>
                Total Bruto a Receber
            </div>
            <div class="result-card-value">${Formatador.formatarMoeda(0)}</div>
            <div class="result-card-detail">
                <strong>Soma de todos os itens marcados acima.</strong> Valores brutos (sem impostos federais adicionais).<br>
                Consulte RH ou advogado para valores oficiais.
            </div>
        `;

        DOM.sections.resultsContainer.appendChild(cardEl);

        const valorEl = cardEl.querySelector('.result-card-value');
        Formatador.animarValor(valorEl, total, '', 900);
    }

    static svgCarimbo() {
        return `
            <svg class="result-stamp" viewBox="0 0 160 160" aria-hidden="true">
                <defs>
                    <path id="stampCirclePath" d="M 80,80 m -62,0 a 62,62 0 1,1 124,0 a 62,62 0 1,1 -124,0"/>
                </defs>
                <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" stroke-width="3"/>
                <circle cx="80" cy="80" r="54" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <text font-size="12.5" letter-spacing="3" fill="currentColor">
                    <textPath href="#stampCirclePath" startOffset="2%">CALCULADO • ESTIMATIVA •</textPath>
                </text>
                <path d="M56 82l15 15 33-36" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
}

class GerenciadorDestaque {
    static pulsar() {
        const cardTotal = DOM.sections.resultsContainer.querySelector('.result-card.total');
        if (!cardTotal) return;

        cardTotal.classList.add('pulso-confirmacao');
        cardTotal.addEventListener('animationend', () => {
            cardTotal.classList.remove('pulso-confirmacao');
        }, { once: true });
    }
}

class GerenciadorTema {
    static CHAVE = 'rescisao-tema';

    static obterPreferencia() {
        const salvo = localStorage.getItem(this.CHAVE);
        if (salvo === 'light' || salvo === 'dark') return salvo;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    static aplicar(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', tema === 'dark' ? '#0a0e1f' : '#26478c');
        }
    }

    static alternar() {
        const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const novo = atual === 'dark' ? 'light' : 'dark';

        document.documentElement.classList.add('theme-transition');
        this.aplicar(novo);
        try {
            localStorage.setItem(this.CHAVE, novo);
        } catch (erro) {
            console.warn('Não foi possível salvar a preferência de tema:', erro);
        }
        setTimeout(() => document.documentElement.classList.remove('theme-transition'), 400);
    }

    static init() {
        this.aplicar(this.obterPreferencia());
        DOM.buttons.themeToggle.addEventListener('click', () => this.alternar());
    }
}

class GerenciadorHistorico {
    static CHAVE = 'rescisao-historico';
    static MAX_ITENS = 15;

    static LABELS_TIPO = {
        saldo: 'Saldo de Salário',
        decimo13: '13º Salário',
        ferias: 'Férias + 1/3',
        fgts: 'FGTS',
        indenizacao: 'Indenização',
    };

    static obterTodos() {
        try {
            const bruto = localStorage.getItem(this.CHAVE);
            return bruto ? JSON.parse(bruto) : [];
        } catch (erro) {
            console.warn('Histórico corrompido, resetando:', erro);
            return [];
        }
    }

    static salvar(entrada) {
        try {
            const lista = this.obterTodos();
            lista.unshift({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                data: new Date().toISOString(),
                ...entrada,
            });
            localStorage.setItem(this.CHAVE, JSON.stringify(lista.slice(0, this.MAX_ITENS)));
        } catch (erro) {

            console.warn('Não foi possível salvar no histórico:', erro);
        }
    }

    static remover(id) {
        const lista = this.obterTodos().filter(item => item.id !== id);
        localStorage.setItem(this.CHAVE, JSON.stringify(lista));
        this.renderizar();
    }

    static limpar() {
        localStorage.removeItem(this.CHAVE);
        this.renderizar();
    }

    static renderizar() {
        const lista = this.obterTodos();
        DOM.sections.historyList.innerHTML = '';

        const vazio = lista.length === 0;
        DOM.sections.historyEmpty.classList.toggle('hidden', !vazio);
        DOM.buttons.historyClear.classList.toggle('hidden', vazio);
        if (vazio) return;

        lista.forEach(item => {
            const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            }).format(new Date(item.data));

            const tiposTexto = item.tipos.map(t => this.LABELS_TIPO[t] || t).join(' · ');

            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `
                <div class="history-item-info">
                    <span class="history-item-name">${item.nome || 'Cálculo sem nome'}</span>
                    <span class="history-item-meta">${dataFormatada} · ${tiposTexto}</span>
                </div>
                <span class="history-item-total">${Formatador.formatarMoeda(item.total)}</span>
                <button type="button" class="history-item-delete" aria-label="Remover este item do histórico" data-id="${item.id}">
                    <svg class="icon-svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;
            DOM.sections.historyList.appendChild(el);
        });

        DOM.sections.historyList.querySelectorAll('.history-item-delete').forEach(btn => {
            btn.addEventListener('click', () => this.remover(btn.dataset.id));
        });
    }

    static abrir() {
        this.renderizar();
        DOM.sections.historyModal.classList.remove('hidden');
        DOM.sections.historyModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    static fechar() {
        DOM.sections.historyModal.classList.add('hidden');
        DOM.sections.historyModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    static init() {
        DOM.buttons.historyBtn.addEventListener('click', () => this.abrir());
        DOM.buttons.historyModalClose.addEventListener('click', () => this.fechar());
        DOM.sections.historyModalOverlay.addEventListener('click', () => this.fechar());
        DOM.buttons.historyClear.addEventListener('click', () => {
            if (confirm('Apagar todo o histórico salvo neste navegador?')) {
                this.limpar();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !DOM.sections.historyModal.classList.contains('hidden')) {
                this.fechar();
            }
        });
    }
}

class GerenciadorExportacao {

    static AREA_MAXIMA_CANVAS = 14_000_000;

    static calcularScaleSeguro(alvo) {
        const scaleDesejado = Math.min(window.devicePixelRatio || 1, 2);
        const areaEstimada = alvo.scrollWidth * alvo.scrollHeight * scaleDesejado * scaleDesejado;

        if (areaEstimada <= this.AREA_MAXIMA_CANVAS) {
            return scaleDesejado;
        }

        const scaleSeguro = Math.sqrt(this.AREA_MAXIMA_CANVAS / (alvo.scrollWidth * alvo.scrollHeight));
        return Math.max(scaleSeguro, 1);
    }

    static async baixarPDF() {

        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            alert('Não foi possível carregar o gerador de PDF (parece um problema de conexão). Vamos abrir a opção de impressão — nela é só escolher "Salvar como PDF".');
            GerenciadorImpressao.imprimir();
            return;
        }

        const botao = DOM.buttons.exportPdf;
        const textoOriginal = botao.querySelector('.btn-text').textContent;
        botao.disabled = true;
        botao.querySelector('.btn-text').textContent = 'Gerando...';

        try {
            const alvo = DOM.sections.results;
            const scale = this.calcularScaleSeguro(alvo);

            const canvas = await html2canvas(alvo, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-paper').trim() || '#ffffff',
                scale,
                useCORS: true,

                imageTimeout: 15000,

                windowWidth: alvo.scrollWidth,
                ignoreElements: (el) => el.classList && el.classList.contains('results-footer'),
            });

            if (!canvas.width || !canvas.height) {
                throw new Error('Canvas gerado sem conteúdo (largura/altura zero)');
            }

            const { jsPDF } = window.jspdf;
            const imgData = canvas.toDataURL('image/png');
            const larguraPagina = 210;
            const alturaImagem = (canvas.height * larguraPagina) / canvas.width;

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [larguraPagina, Math.max(alturaImagem, 297)],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, larguraPagina, alturaImagem);
            pdf.save('rescisao-calculo.pdf');
        } catch (erro) {
            console.error('Erro ao gerar PDF:', erro);

            alert('Não foi possível gerar o PDF por aqui agora. Vamos abrir a opção de impressão — nela é só escolher "Salvar como PDF".');
            GerenciadorImpressao.imprimir();
        } finally {
            botao.disabled = false;
            botao.querySelector('.btn-text').textContent = textoOriginal;
        }
    }
}

class GerenciadorModal {
    static abrir() {
        DOM.sections.modal.classList.remove('hidden');
        DOM.sections.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    static fechar() {
        DOM.sections.modal.classList.add('hidden');
        DOM.sections.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    static init() {
        DOM.buttons.navHelp.addEventListener('click', () => this.abrir());
        DOM.buttons.modalClose.addEventListener('click', () => this.fechar());
        DOM.sections.modalOverlay.addEventListener('click', () => this.fechar());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !DOM.sections.modal.classList.contains('hidden')) {
                this.fechar();
            }
        });
    }
}

class GerenciadorScrollReveal {
    static init() {
        if (Formatador.prefereMenosMovimento() || !('IntersectionObserver' in window)) {
            return;
        }

        const alvos = document.querySelectorAll('.form-fieldset:not(.calc-group)');
        alvos.forEach(el => el.classList.add('reveal'));

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        alvos.forEach(el => observer.observe(el));
    }
}

class GerenciadorImpressao {
    static imprimir() {
        window.print();
    }
}

class GerenciadorDataSegmentada {
    static ANO_MINIMO = 1900;

    static init() {
        document.querySelectorAll('.date-input-group').forEach(grupo => this.configurarGrupo(grupo));
    }

    static configurarGrupo(grupo) {
        const nomeCampo = grupo.dataset.dateGroup;
        const hiddenInput = document.getElementById(nomeCampo);
        const dia = grupo.querySelector('.date-segment-day');
        const mes = grupo.querySelector('.date-segment-month');
        const ano = grupo.querySelector('.date-segment-year');
        if (!hiddenInput || !dia || !mes || !ano) return;

        const segmentos = [dia, mes, ano];
        const sincronizar = () => this.sincronizar(nomeCampo, hiddenInput, grupo, dia, mes, ano);

        segmentos.forEach((campo, indice) => {
            campo.addEventListener('input', () => {
                campo.value = campo.value.replace(/\D/g, '').slice(0, campo.maxLength);
                if (campo.value.length === campo.maxLength && indice < segmentos.length - 1) {
                    segmentos[indice + 1].focus();
                    segmentos[indice + 1].select();
                }
                sincronizar();
            });

            campo.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && campo.value === '' && indice > 0) {
                    segmentos[indice - 1].focus();
                    segmentos[indice - 1].select();
                } else if (e.key === 'ArrowLeft' && campo.selectionStart === 0 && indice > 0) {
                    segmentos[indice - 1].focus();
                } else if (e.key === 'ArrowRight' && campo.selectionStart === campo.value.length && indice < segmentos.length - 1) {
                    segmentos[indice + 1].focus();
                }
            });

            campo.addEventListener('paste', (e) => {
                const texto = (e.clipboardData || window.clipboardData).getData('text');
                const numeros = texto.match(/\d+/g);
                if (!numeros) return;
                e.preventDefault();

                let partes = numeros;
                if (numeros.length === 1 && numeros[0].length === 8) {
                    const bruto = numeros[0];
                    partes = [bruto.slice(0, 2), bruto.slice(2, 4), bruto.slice(4, 8)];
                }

                if (partes[0]) dia.value = partes[0].replace(/\D/g, '').slice(0, 2);
                if (partes[1]) mes.value = partes[1].replace(/\D/g, '').slice(0, 2);
                if (partes[2]) ano.value = partes[2].replace(/\D/g, '').slice(0, 4);
                sincronizar();
                ano.focus();
            });

            campo.addEventListener('blur', sincronizar);
        });
    }

    static sincronizar(nomeCampo, hiddenInput, grupo, diaEl, mesEl, anoEl) {
        const errorEl = document.getElementById(`error-${nomeCampo}`);
        const algumPreenchido = diaEl.value || mesEl.value || anoEl.value;
        const todosPreenchidos = diaEl.value.length > 0 && mesEl.value.length > 0 && anoEl.value.length === 4;

        hiddenInput.value = '';
        hiddenInput.classList.remove('error');
        hiddenInput.setAttribute('aria-invalid', 'false');
        grupo.classList.remove('error');
        if (errorEl) errorEl.textContent = '';

        if (!algumPreenchido || !todosPreenchidos) return;

        const dia = parseInt(diaEl.value, 10);
        const mes = parseInt(mesEl.value, 10);
        const ano = parseInt(anoEl.value, 10);

        if (!this.dataValida(dia, mes, ano)) {
            grupo.classList.add('error');
            hiddenInput.classList.add('error');
            hiddenInput.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = MENSAGENS.validacao.data_invalida;
            return;
        }

        const dd = String(dia).padStart(2, '0');
        const mm = String(mes).padStart(2, '0');
        hiddenInput.value = `${ano}-${mm}-${dd}`;
    }

    static dataValida(dia, mes, ano) {
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
        if (ano < this.ANO_MINIMO || ano > new Date().getFullYear() + 1) return false;
        if (mes < 1 || mes > 12) return false;
        if (dia < 1 || dia > 31) return false;

        const data = new Date(ano, mes - 1, dia);
        return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
    }
}

class GerenciadorSplash {
    static DURACAO_MINIMA_MS = 550;
    // Em rede lenta/instável (ex.: preview do Acode sem acesso liberado aos
    // CDNs do html2canvas/jsPDF), o evento 'load' pode nunca disparar, porque
    // ele só acontece quando TODOS os recursos da página terminam — inclusive
    // scripts externos. Sem esse limite de segurança, o splash fica preso na
    // tela pra sempre e o app parece "não estar rodando".
    static LIMITE_SEGURANCA_MS = 2500;

    static init() {
        const loader = document.getElementById('appLoader');
        if (!loader) return;

        const inicio = Date.now();
        let escondido = false;

        const esconder = () => {
            if (escondido) return;
            escondido = true;
            const decorrido = Date.now() - inicio;
            const espera = Formatador.prefereMenosMovimento() ? 0 : Math.max(0, this.DURACAO_MINIMA_MS - decorrido);
            setTimeout(() => {
                loader.classList.add('app-loader--hidden');
                loader.setAttribute('aria-hidden', 'true');
                const remover = () => loader.remove();
                loader.addEventListener('transitionend', remover, { once: true });
                setTimeout(remover, 700);
            }, espera);
        };

        if (document.readyState === 'complete') {
            esconder();
        } else {
            window.addEventListener('load', esconder, { once: true });
            // Rede de segurança: garante que o app sempre abra, mesmo se os
            // scripts externos (CDN) não carregarem por falta de internet.
            setTimeout(esconder, this.LIMITE_SEGURANCA_MS);
        }
    }
}

class GerenciadorFormulario {
    static init() {

        DOM.form.addEventListener('submit', (e) => this.handleSubmit(e));

        DOM.form.addEventListener('reset', () => this.handleReset());

        DOM.fields.salario.addEventListener('input', (e) => Formatador.formatarInputMoeda(e));
        DOM.fields.valorValeAlimentacao.addEventListener('input', (e) => Formatador.formatarInputMoeda(e));

        DOM.buttons.print.addEventListener('click', () => GerenciadorImpressao.imprimir());
        DOM.buttons.exportPdf.addEventListener('click', () => GerenciadorExportacao.baixarPDF());
        DOM.buttons.newCalc.addEventListener('click', () => this.novoCalculo());
    }

    static handleSubmit(e) {
        e.preventDefault();

        const selecionados = GerenciadorSeletor.getSelecionados();

        const dados = {
            nome: DOM.fields.nome.value,
            dataAdmissao: DOM.fields.dataAdmissao.value,
            dataSaida: DOM.fields.dataSaida.value,
            salario: DOM.fields.salario.value.replace(/[.]/g, '').replace(/[,]/, '.'),
            dias: DOM.fields.dias.value,
            meses13: DOM.fields.meses13.value,
            mesesFerias: DOM.fields.mesesFerias.value,
            valeTransporte: DOM.fields.valeTransporte.checked,
            diasFGTS: DOM.fields.diasFGTS.value,
            mesesRestantes: DOM.fields.mesesRestantes.value,
            valorValeAlimentacao: DOM.fields.valorValeAlimentacao.value.replace(/[.]/g, '').replace(/[,]/, '.'),
        };

        const erros = Validador.validarFormulario(dados, selecionados);
        if (Object.keys(erros).length > 0) {
            Validador.exibirErros(erros);
            return;
        }

        Validador.limparErros();

        GerenciadorResultados.exibirResultados(dados, selecionados);
    }

    static handleReset() {
        Validador.limparErros();
        document.querySelectorAll('.date-input-group.error').forEach(grupo => grupo.classList.remove('error'));
        DOM.sections.results.classList.add('hidden');

        setTimeout(() => GerenciadorSeletor.atualizarVisibilidade(), 0);
    }

    static novoCalculo() {
        DOM.form.reset();
        this.handleReset();
        DOM.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

class GerenciadorRipple {
    static init() {
        if (Formatador.prefereMenosMovimento()) return;

        document.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.btn');
            if (!btn || btn.disabled) return;

            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            ripple.style.setProperty('--x', `${x}px`);
            ripple.style.setProperty('--y', `${y}px`);
            btn.appendChild(ripple);

            ripple.addEventListener('animationend', () => ripple.remove());
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    GerenciadorSplash.init();
    GerenciadorTema.init();
    GerenciadorSeletor.init();
    GerenciadorDataSegmentada.init();
    GerenciadorFormulario.init();
    GerenciadorModal.init();
    GerenciadorHistorico.init();
    GerenciadorScrollReveal.init();
    GerenciadorRipple.init();

    console.log('Calculadora de Rescisão - Jovem Aprendiz | pronta');
    console.log('Lei nº 10.097/2000 | CLT Art. 475-490');
});