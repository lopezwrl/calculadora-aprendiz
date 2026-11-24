import { obterParametros, ParametrosAno } from '../config/parametros';
import { parseMoedaParaCentavos } from '../calc/moeda';
import { TipoContrato } from '../calc/types';
import { conferirValoresHolerite, InconsistenciaHolerite } from '../calc/validacao';
import { ChaveCampoHolerite } from './dicionario';
import { CampoExtraido, ResultadoExtracaoHolerite } from './extrairCampos';
import { normalizarParaComparacao } from './normalizar';

export function inferirTipoContratoDoCargo(cargoTexto?: string): TipoContrato {
  if (!cargoTexto) return 'clt';
  const norm = normalizarParaComparacao(cargoTexto);
  if (norm.includes('aprendiz')) return 'aprendiz';
  return 'clt';
}

/**
 * Executa a conferência cruzada combinando os campos extraídos com eventuais edições manuais
 * feitas pelo usuário na tela de revisão.
 */
export function conferirExtracaoHolerite(
  extracao: ResultadoExtracaoHolerite,
  edicoesUsuario: Partial<Record<ChaveCampoHolerite, string>> = {},
  parametros: ParametrosAno = obterParametros()
): InconsistenciaHolerite[] {
  const obterCentavos = (chave: ChaveCampoHolerite): number | undefined => {
    const editado = edicoesUsuario[chave];
    if (editado !== undefined) {
      const limpo = editado.trim();
      if (!limpo) return undefined;
      return parseMoedaParaCentavos(limpo);
    }
    const campo: CampoExtraido | undefined = extracao.campos[chave];
    if (!campo || !campo.encontrado) return undefined;
    return campo.valorCentavos ?? parseMoedaParaCentavos(campo.valorDetectado);
  };

  const cargoFinal =
    edicoesUsuario.cargo !== undefined
      ? edicoesUsuario.cargo
      : extracao.campos.cargo?.valorDetectado;

  const tipoContrato = inferirTipoContratoDoCargo(cargoFinal);

  return conferirValoresHolerite(
    {
      salarioBaseCentavos: obterCentavos('salarioBase'),
      totalProventosCentavos: obterCentavos('totalProventos'),
      totalDescontosCentavos: obterCentavos('totalDescontos'),
      liquidoCentavos: obterCentavos('liquido'),
      baseInssCentavos: obterCentavos('baseInss'),
      inssCentavos: obterCentavos('inss'),
      baseFgtsCentavos: obterCentavos('baseFgts'),
      fgtsMesCentavos: obterCentavos('fgtsMes'),
      tipoContrato,
    },
    parametros
  );
}
