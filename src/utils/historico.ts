import { ModoCalculo } from '../calc';

export interface ItemHistoricoCalculo {
  id: string;
  criadoEmIso: string;
  modo: ModoCalculo;
  descricaoModo: string;
  nomeTrabalhador?: string;
  totalBrutoCentavos: number;
  totalDescontosCentavos: number;
  valorLiquidoCentavos: number;
  valoresFormulario: Record<string, unknown>;
}

const CHAVE_HISTORICO = 'clt-teresina-historico';
const LIMITE_ITENS = 20;

export function lerHistoricoLocal(): ItemHistoricoCalculo[] {
  if (typeof window === 'undefined') return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_HISTORICO);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarItemHistoricoLocal(
  novo: Omit<ItemHistoricoCalculo, 'id' | 'criadoEmIso'>
): ItemHistoricoCalculo[] {
  const atual = lerHistoricoLocal();
  const itemCompleto: ItemHistoricoCalculo = {
    ...novo,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    criadoEmIso: new Date().toISOString(),
  };
  const novaLista = [itemCompleto, ...atual].slice(0, LIMITE_ITENS);
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(novaLista));
  } catch {
    // Ignora falha caso armazenamento privado esteja bloqueado
  }
  return novaLista;
}

export function removerItemHistoricoLocal(id: string): ItemHistoricoCalculo[] {
  const novaLista = lerHistoricoLocal().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(novaLista));
  } catch {
    // Ignora falha de escrita
  }
  return novaLista;
}

export function limparHistoricoLocal(): ItemHistoricoCalculo[] {
  try {
    window.localStorage.removeItem(CHAVE_HISTORICO);
  } catch {
    // Ignora falha de escrita
  }
  return [];
}
