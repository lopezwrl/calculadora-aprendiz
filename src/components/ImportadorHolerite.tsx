import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, Edit3, FileUp } from 'lucide-react';
import { parseMoedaParaCentavos, TipoContrato } from '../calc';
import {
  ChaveCampoHolerite,
  conferirExtracaoHolerite,
  ErroImportacaoHolerite,
  EtapaProcessamentoHolerite,
  inferirTipoContratoDoCargo,
  NivelConfianca,
  processarArquivoHolerite,
  ResultadoProcessamentoHolerite,
} from '../import';

export interface DadosAplicadosHolerite {
  nome?: string;
  dataAdmissao?: string;
  tipoContrato?: TipoContrato;
  salarioBaseFormatado?: string;
  baseInssFormatado?: string;
  valeTransporteAtivo: boolean;
  valorValeTransporteFormatado?: string;
  outrosDescontos: Array<{ descricao: string; valorFormatado: string }>;
}

interface ImportadorHoleriteProps {
  onAplicarDados: (dados: DadosAplicadosHolerite) => void;
  onPreencherManualmente: () => void;
}

const ETAPAS_LEITURA: EtapaProcessamentoHolerite[] = [
  'Lendo arquivo',
  'Identificando campos',
  'Conferindo valores',
];

const CAMPOS_PRINCIPAIS_REVISAO: ChaveCampoHolerite[] = [
  'competencia',
  'nomeFuncionario',
  'dataAdmissao',
  'cargo',
  'salarioBase',
  'baseInss',
  'inss',
  'irrf',
  'valeTransporte',
  'valeRefeicao',
  'adiantamento',
  'faltas',
  'convenio',
  'outrosDescontos',
  'baseFgts',
  'fgtsMes',
  'totalProventos',
  'totalDescontos',
  'liquido',
];

function EtiquetaConfianca({ nivel }: { nivel: NivelConfianca }) {
  if (nivel === 'alta') {
    return (
      <span className="rounded-md border border-status-success bg-status-success-bg px-2.5 py-0.5 text-xs font-bold text-status-success">
        Alta
      </span>
    );
  }
  if (nivel === 'media') {
    return (
      <span className="rounded-md border border-border-strong bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-fg">
        Média
      </span>
    );
  }
  return (
    <span className="rounded-md border border-laranja bg-status-warning-bg px-2.5 py-0.5 text-xs font-bold text-status-warning">
      Baixa
    </span>
  );
}

export function ImportadorHolerite({
  onAplicarDados,
  onPreencherManualmente,
}: ImportadorHoleriteProps) {
  const prefereMenosMovimento = useReducedMotion();
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  const inputCameraRef = useRef<HTMLInputElement | null>(null);

  const [arrastando, setArrastando] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState<EtapaProcessamentoHolerite | null>(null);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  const [arquivoAguardandoSenha, setArquivoAguardandoSenha] = useState<File | null>(null);
  const [senhaPdf, setSenhaPdf] = useState('');

  const [resultadoRevisao, setResultadoRevisao] =
    useState<ResultadoProcessamentoHolerite | null>(null);
  const [edicoes, setEdicoes] = useState<Partial<Record<ChaveCampoHolerite, string>>>({});
  const [confirmadosBaixa, setConfirmadosBaixa] = useState<Record<string, boolean>>({});
  const [mostrarMiniatura, setMostrarMiniatura] = useState(true);
  const [avisoConfirmacaoPendente, setAvisoConfirmacaoPendente] = useState(false);

  const limparMemoriaRevisao = () => {
    setResultadoRevisao(null);
    setEdicoes({});
    setConfirmadosBaixa({});
    setArquivoAguardandoSenha(null);
    setSenhaPdf('');
    setAvisoConfirmacaoPendente(false);
    if (inputArquivoRef.current) inputArquivoRef.current.value = '';
    if (inputCameraRef.current) inputCameraRef.current.value = '';
  };

  const iniciarProcessamento = async (arquivo: File, senhaOpcional?: string) => {
    setErroMensagem(null);
    setAvisoConfirmacaoPendente(false);

    try {
      const res = await processarArquivoHolerite(arquivo, {
        senhaPdf: senhaOpcional,
        onEtapa: (etapa) => setEtapaAtual(etapa),
      });
      setEtapaAtual(null);
      setArquivoAguardandoSenha(null);
      setSenhaPdf('');
      setEdicoes({});
      setConfirmadosBaixa({});
      setResultadoRevisao(res);
    } catch (erro: unknown) {
      setEtapaAtual(null);
      if (erro instanceof ErroImportacaoHolerite) {
        if (erro.codigo === 'PDF_PROTEGIDO_SENHA' || erro.codigo === 'SENHA_PDF_INCORRETA') {
          setArquivoAguardandoSenha(arquivo);
        }
        setErroMensagem(erro.message);
      } else {
        setErroMensagem(
          'Não foi possível ler o arquivo enviado. Tente outro formato ou preencha manualmente.'
        );
      }
    }
  };

  const aoSelecionarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    if (arq) {
      void iniciarProcessamento(arq);
    }
  };

  const aoSoltarArquivo = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const arq = e.dataTransfer.files?.[0];
    if (arq) {
      void iniciarProcessamento(arq);
    }
  };

  if (resultadoRevisao) {
    const inconsistenciasAtuais = conferirExtracaoHolerite(resultadoRevisao.extracao, edicoes);
    const camposExibidos = resultadoRevisao.extracao.listaCampos.filter(
      (c) => c.encontrado || CAMPOS_PRINCIPAIS_REVISAO.includes(c.chave)
    );

    const pendentesBaixaConfianca = camposExibidos.filter(
      (c) =>
        c.encontrado &&
        c.confianca === 'baixa' &&
        edicoes[c.chave] === undefined &&
        !confirmadosBaixa[c.chave]
    );

    const obterValorCampo = (chave: ChaveCampoHolerite): string => {
      if (edicoes[chave] !== undefined) return edicoes[chave] ?? '';
      return resultadoRevisao.extracao.campos[chave]?.valorDetectado ?? '';
    };

    const formatarMoedaSimples = (texto: string): string => {
      const centavos = parseMoedaParaCentavos(texto);
      if (centavos <= 0) return '';
      const reais = Math.floor(centavos / 100);
      const frac = String(centavos % 100).padStart(2, '0');
      return `${reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`;
    };

    const aplicarAoFormulario = () => {
      if (pendentesBaixaConfianca.length > 0) {
        setAvisoConfirmacaoPendente(true);
        return;
      }

      const salarioStr = formatarMoedaSimples(obterValorCampo('salarioBase'));
      const baseInssStr = formatarMoedaSimples(obterValorCampo('baseInss')) || salarioStr;
      const vtCentavos = parseMoedaParaCentavos(obterValorCampo('valeTransporte'));
      const vtFormatado =
        vtCentavos > 0 ? formatarMoedaSimples(obterValorCampo('valeTransporte')) : '';

      const rubricasOutrosDescontos: Array<{ chave: ChaveCampoHolerite; label: string }> = [
        { chave: 'valeRefeicao', label: 'Vale-refeição' },
        { chave: 'adiantamento', label: 'Adiantamento' },
        { chave: 'faltas', label: 'Faltas' },
        { chave: 'contribuicaoSindical', label: 'Contribuição sindical' },
        { chave: 'convenio', label: 'Convênio' },
        { chave: 'outrosDescontos', label: 'Outros descontos' },
      ];

      const outrosDescontos: Array<{ descricao: string; valorFormatado: string }> = [];
      for (const rub of rubricasOutrosDescontos) {
        const valStr = formatarMoedaSimples(obterValorCampo(rub.chave));
        if (valStr) {
          outrosDescontos.push({ descricao: rub.label, valorFormatado: valStr });
        }
      }

      const cargoFinal = obterValorCampo('cargo');
      const dadosAplicados: DadosAplicadosHolerite = {
        nome: obterValorCampo('nomeFuncionario').trim() || undefined,
        dataAdmissao: obterValorCampo('dataAdmissao').trim() || undefined,
        tipoContrato: cargoFinal ? inferirTipoContratoDoCargo(cargoFinal) : undefined,
        salarioBaseFormatado: salarioStr || undefined,
        baseInssFormatado: baseInssStr || undefined,
        valeTransporteAtivo: vtCentavos > 0,
        valorValeTransporteFormatado: vtFormatado || undefined,
        outrosDescontos,
      };

      limparMemoriaRevisao();
      onAplicarDados(dadosAplicados);
    };

    return (
      <motion.section
        initial={prefereMenosMovimento ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        aria-labelledby="titulo-revisao-holerite"
        className="cartao-identidade mb-6 overflow-hidden"
      >
        <div className="h-2 w-full bg-laranja" aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-between gap-3 bg-azul px-5 py-4 text-branco">
          <div>
            <h3 id="titulo-revisao-holerite" className="font-display text-base font-extrabold">
              Revisão do holerite importado
            </h3>
            <p className="mt-0.5 text-xs text-azul-claro">
              Confira ou edite os valores detectados antes de aplicar ao cálculo.
              {resultadoRevisao.totalPaginas && resultadoRevisao.totalPaginas > 1
                ? ` Página lida: ${resultadoRevisao.paginaSelecionada} de ${resultadoRevisao.totalPaginas}.`
                : ''}
            </p>
          </div>

          {resultadoRevisao.miniaturaDataUrl && (
            <button
              type="button"
              onClick={() => setMostrarMiniatura((v) => !v)}
              className="rounded-xl border-2 border-tinta bg-branco px-3.5 py-1.5 text-xs font-extrabold text-tinta"
            >
              {mostrarMiniatura ? 'Ocultar pré-visualização' : 'Mostrar pré-visualização'}
            </button>
          )}
        </div>

        <div className="p-5">
          {mostrarMiniatura && resultadoRevisao.miniaturaDataUrl && (
            <div className="mb-4 flex items-center gap-4 rounded-xl border-2 border-border bg-surface-subtle p-3.5">
              <img
                src={resultadoRevisao.miniaturaDataUrl}
                alt="Miniatura temporária do holerite"
                className="max-h-24 rounded-lg border border-border object-contain"
              />
              <p className="text-xs font-medium text-fg-muted">
                Pré-visualização local temporária. O arquivo e o texto são descartados da memória
                assim que você aplicar ou descartar esta revisão.
              </p>
            </div>
          )}

          {inconsistenciasAtuais.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 rounded-xl border-2 border-laranja bg-status-warning-bg p-4"
            >
              <p className="text-xs font-extrabold text-status-warning">
                Conferência cruzada identificou divergências
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs font-medium text-fg">
                {inconsistenciasAtuais.map((inc, i) => (
                  <li key={`${inc.codigo}-${i}`}>{inc.mensagem}</li>
                ))}
              </ul>
            </div>
          )}

          {avisoConfirmacaoPendente && pendentesBaixaConfianca.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-xl border-2 border-status-error bg-status-error-bg p-3 text-xs font-bold text-status-error"
            >
              Confirme ou edite os campos com confiança Baixa antes de aplicar ao formulário.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border-2 border-border">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-surface-subtle text-xs font-extrabold text-fg">
                  <th className="px-3.5 py-2.5">Campo</th>
                  <th className="px-3.5 py-2.5">Valor detectado</th>
                  <th className="px-3.5 py-2.5">Confiança</th>
                  <th className="px-3.5 py-2.5">Trecho original</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {camposExibidos.map((campo) => {
                  const valorAtual = obterValorCampo(campo.chave);
                  const exigeConfirmacao =
                    campo.encontrado &&
                    campo.confianca === 'baixa' &&
                    edicoes[campo.chave] === undefined;

                  return (
                    <tr
                      key={campo.chave}
                      className={
                        exigeConfirmacao && !confirmadosBaixa[campo.chave]
                          ? 'bg-status-warning-bg'
                          : ''
                      }
                    >
                      <td className="px-3.5 py-2.5 font-bold text-fg">
                        <label htmlFor={`revisao-${campo.chave}`}>{campo.rotulo}</label>
                        {campo.referencia && (
                          <span className="ml-1.5 text-xs font-normal text-fg-muted">
                            (ref. {campo.referencia})
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            id={`revisao-${campo.chave}`}
                            type="text"
                            value={valorAtual}
                            placeholder="Não encontrado"
                            onChange={(e) =>
                              setEdicoes((ant) => ({ ...ant, [campo.chave]: e.target.value }))
                            }
                            className="campo-tactile tabular-nums !h-9 max-w-[175px] !px-2.5 !text-sm"
                          />
                          {!campo.encontrado && edicoes[campo.chave] === undefined && (
                            <span className="shrink-0 text-xs font-medium text-fg-subtle">
                              Não encontrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        {campo.encontrado ? (
                          <div className="flex items-center gap-2">
                            <EtiquetaConfianca nivel={campo.confianca} />
                            {exigeConfirmacao && (
                              <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-fg">
                                <input
                                  type="checkbox"
                                  checked={Boolean(confirmadosBaixa[campo.chave])}
                                  onChange={(e) =>
                                    setConfirmadosBaixa((ant) => ({
                                      ...ant,
                                      [campo.chave]: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 accent-azul"
                                />
                                <span>Confirmar</span>
                              </label>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-fg-subtle">Ausente</span>
                        )}
                      </td>
                      <td
                        className="max-w-[210px] truncate px-3.5 py-2.5 text-xs text-fg-muted"
                        title={campo.trechoOriginal}
                      >
                        {campo.trechoOriginal || 'Sem correspondência'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={limparMemoriaRevisao}
              className="btn-superficie-tactile text-sm"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={aplicarAoFormulario}
              className="btn-laranja-tactile text-sm"
            >
              Aplicar ao formulário
            </button>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      aria-labelledby="titulo-importar-holerite"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltarArquivo}
      whileHover={prefereMenosMovimento ? undefined : { y: -2 }}
      animate={arrastando && !prefereMenosMovimento ? { scale: 1.01 } : { scale: 1 }}
      className={`cartao-identidade mb-6 overflow-hidden transition-colors duration-150 ${
        arrastando ? '!border-laranja bg-surface-warm' : ''
      }`}
    >
      <div className="faixa-tricolor" aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <input
          ref={inputArquivoRef}
          type="file"
          id="input-upload-holerite"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={aoSelecionarInput}
          className="sr-only"
        />
        <input
          ref={inputCameraRef}
          type="file"
          id="input-camera-holerite"
          accept="image/jpeg,image/png"
          capture="environment"
          onChange={aoSelecionarInput}
          className="sr-only"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              id="titulo-importar-holerite"
              className="font-display text-base font-extrabold text-fg sm:text-lg"
            >
              Tem o holerite?
            </h3>
            <p className="mt-1 text-xs font-medium text-fg-muted">
              Importe seu PDF, JPG ou PNG (até 10 MB) para preencher automaticamente ou digite
              abaixo.
            </p>
          </div>

          {!etapaAtual && (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <label
                htmlFor="input-upload-holerite"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputArquivoRef.current?.click();
                  }
                }}
                className="btn-azul-tactile text-xs sm:text-sm"
              >
                <FileUp className="h-4 w-4 shrink-0 text-laranja" aria-hidden="true" />
                <span>Selecionar holerite</span>
              </label>

              <label
                htmlFor="input-camera-holerite"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputCameraRef.current?.click();
                  }
                }}
                className="btn-superficie-tactile text-xs sm:hidden"
              >
                <Camera className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span>Câmera</span>
              </label>

              <button
                type="button"
                onClick={onPreencherManualmente}
                className="btn-superficie-tactile text-xs sm:text-sm"
              >
                <Edit3 className="h-4 w-4 shrink-0 text-laranja" aria-hidden="true" />
                <span>Preencher manualmente</span>
              </button>
            </div>
          )}
        </div>

        {etapaAtual && (
          <div role="status" aria-live="polite" className="mt-4 border-t-2 border-border pt-3.5">
            <div className="flex items-center justify-between text-xs font-extrabold text-fg">
              <span>{etapaAtual}</span>
              <span className="tabular-nums">
                {ETAPAS_LEITURA.indexOf(etapaAtual) + 1}/{ETAPAS_LEITURA.length}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-border-strong bg-surface-subtle">
              <motion.div
                className="h-full bg-laranja"
                initial={false}
                animate={{
                  width: `${((ETAPAS_LEITURA.indexOf(etapaAtual) + 1) / ETAPAS_LEITURA.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {arquivoAguardandoSenha && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border-2 border-border bg-surface-subtle p-3.5">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="senha-pdf-input" className="block text-xs font-bold text-fg">
                Senha do PDF protegido
              </label>
              <input
                id="senha-pdf-input"
                type="password"
                value={senhaPdf}
                onChange={(e) => setSenhaPdf(e.target.value)}
                placeholder="Digite a senha para abrir"
                className="campo-tactile mt-1"
              />
            </div>
            <button
              type="button"
              onClick={() => void iniciarProcessamento(arquivoAguardandoSenha, senhaPdf)}
              className="btn-azul-tactile text-xs"
            >
              Desbloquear PDF
            </button>
          </div>
        )}

        {erroMensagem && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-status-error bg-status-error-bg px-4 py-3 text-xs font-bold text-status-error"
          >
            <span>{erroMensagem}</span>
            <button
              type="button"
              onClick={() => {
                setErroMensagem(null);
                onPreencherManualmente();
              }}
              className="rounded-lg border border-status-error bg-surface px-2.5 py-1 font-extrabold text-status-error underline"
            >
              Preencher manualmente
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
