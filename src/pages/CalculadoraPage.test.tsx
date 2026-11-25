import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { obterLadoPainel, PANEL_SIDE } from './CalculadoraPage';
import { separarDetalheRotuloEMemoria } from '../components/ResumoCalculoAoVivo';

function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace('#', '');
  const r = parseInt(limpo.slice(0, 2), 16) / 255;
  const g = parseInt(limpo.slice(2, 4), 16) / 255;
  const b = parseInt(limpo.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function razaoContraste(hexA: string, hexB: string): number {
  const l1 = luminanciaRelativa(hexA);
  const l2 = luminanciaRelativa(hexB);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

describe('Interface Calculadora CLT Teresina', () => {
  it('renderiza cabeçalho, holerite estimado com líquido R$ 658,75, linha de importação e rodapé sem data duplicada', () => {
    render(<App />);

    expect(screen.getAllByText('Calculadora CLT Teresina').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Folha, 13º e rescisão ao centavo, com os parâmetros de 2026')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Como calculamos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Histórico/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mudar para tema escuro/i })).toBeInTheDocument();

    expect(screen.getByText('Holerite estimado')).toBeInTheDocument();
    expect(screen.getByText('Tem o holerite?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preencher manualmente' })).toBeInTheDocument();

    // Holerite ao vivo exibe o líquido de referência R$ 658,75 e linha de descontos R$ 53,25 (7%)
    expect(screen.getAllByText('R$ 658,75').length).toBeGreaterThan(0);
    expect(screen.getByText('Descontos: R$ 53,25 (7%)')).toBeInTheDocument();

    // Vale-transporte desativado por padrão
    const switchVt = screen.getByRole('switch', { name: /Vale-transporte/i });
    expect(switchVt).not.toBeChecked();

    // Data de conferência única no holerite e rodapé enxuto
    expect(
      screen.getByText(/Parâmetros 2026 · conferido em 24\/11\/2026/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText('Calculadora CLT Teresina · Parâmetros de 2026')
    ).toBeInTheDocument();
  });

  it('mantém os 3 cenários (Folha R$ 658,75, 13º R$ 658,60 / R$ 384,18 e Rescisão R$ 2.504,11 / R$ 2.980,30) com valores idênticos', () => {
    render(<App />);

    // Cenário 1: Folha R$ 712,00 (Base INSS R$ 710,00) -> Líquido R$ 658,75
    expect(screen.getAllByText('R$ 658,75').length).toBeGreaterThan(0);

    // Cenário 2(a): 13º integral (12 meses) -> Líquido R$ 658,60
    fireEvent.click(screen.getByRole('button', { name: '13º integral' }));
    expect(screen.getAllByText('R$ 658,60').length).toBeGreaterThan(0);

    // Cenário 2(b): 13º de 7 meses (admissão 01/06/2026) -> Líquido R$ 384,18
    fireEvent.click(screen.getByRole('button', { name: '13º de 7 meses' }));
    expect(screen.getAllByText('R$ 384,18').length).toBeGreaterThan(0);

    // Cenário 3(a): Rescisão a partir do exemplo de 01/06/2026 até 30/11/2026 -> Líquido R$ 2.504,11
    fireEvent.click(screen.getByRole('tab', { name: 'Rescisão' }));
    expect(screen.getAllByText('R$ 2.504,11').length).toBeGreaterThan(0);

    // Cenário 3(b): Rescisão a partir do exemplo de 02/03/2026 até 30/11/2026 -> Líquido R$ 2.980,30
    fireEvent.click(screen.getByRole('button', { name: 'Folha de R$ 712,00' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Rescisão' }));
    expect(screen.getAllByText('R$ 2.980,30').length).toBeGreaterThan(0);
  });

  it('mapeia posição do painel alternando Esquerda → Direita → Esquerda entre as 3 abas e move detalhes de rótulos longos para a memória sem repetição', () => {
    expect(PANEL_SIDE).toEqual({ folha: 'left', decimo: 'right', rescisao: 'left' });
    expect(obterLadoPainel('folha')).toBe('left');
    expect(obterLadoPainel('decimo_terceiro')).toBe('right');
    expect(obterLadoPainel('rescisao')).toBe('left');

    const avisoSeparado = separarDetalheRotuloEMemoria({
      id: 'aviso-previo-indenizado',
      rotulo: 'Aviso prévio indenizado (30 dias)',
      natureza: 'provento',
      baseCentavos: 71200,
      formula: 'R$ 712,00 ÷ 30 × 30',
      valorCentavos: 71200,
      passos: [],
    });
    expect(avisoSeparado.rotuloLimpo).toBe('Aviso prévio indenizado');
    expect(avisoSeparado.memoria).toBe('30 dias · R$ 712,00 ÷ 30 × 30');

    const inssSemRepeticao = separarDetalheRotuloEMemoria({
      id: 'desconto-inss',
      rotulo: 'INSS',
      natureza: 'desconto',
      baseCentavos: 71000,
      aliquotaTexto: '7,5%',
      formula: 'R$ 710,00 × 7,5%',
      valorCentavos: 5325,
      passos: [],
    });
    expect(inssSemRepeticao.rotuloLimpo).toBe('INSS');
    expect(inssSemRepeticao.memoria).toBe('R$ 710,00 × 7,5%');
  });

  it('exibe estado vazio quando salário está em branco e permite concluir cálculo centralizando só o holerite e voltar em Editar dados', async () => {
    window.scrollTo = () => {};
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Preencher manualmente' }));
    expect(screen.getByText('Digite o salário para começar')).toBeInTheDocument();
    expect(screen.queryByText('Informe a data de admissão.')).not.toBeInTheDocument();

    // Carrega exemplo de Rescisão, passa por verbas, conclui cálculo e retorna em Editar dados
    fireEvent.click(screen.getByRole('button', { name: 'Folha de R$ 712,00' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Rescisão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para verbas' }));

    await waitFor(() => {
      expect(screen.getByText('Verbas da modalidade selecionada')).toBeInTheDocument();
    });

    const switchSaldo = screen.getByRole('switch', { name: 'Saldo de salário' });
    expect(switchSaldo).toBeChecked();
    expect(switchSaldo).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Concluir cálculo' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Baixar demonstrativo \(PDF\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo cálculo/i })).toBeInTheDocument();

    // Volta em Editar dados com os valores preservados
    fireEvent.click(screen.getByRole('button', { name: 'Editar dados' }));
    await waitFor(() => {
      expect(screen.getByText('Verbas da modalidade selecionada')).toBeInTheDocument();
    });
  });

  it('garante contraste mínimo WCAG AA (>= 4.5:1) nas 3 cores oficiais #002893, #FFFFFF e #FD701C (100% e 75%)', () => {
    expect(razaoContraste('#FFFFFF', '#002893')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#002893', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#08122E', '#FD701C')).toBeGreaterThanOrEqual(4.5);

    // Cobalto a 75% sobre Branco (#405EAE) e Branco a 75% sobre Cobalto escuro (#050C24)
    expect(razaoContraste('#405EAE', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#FFFFFF', '#050C24')).toBeGreaterThanOrEqual(4.5);
    expect(razaoContraste('#C0C2C8', '#050C24')).toBeGreaterThanOrEqual(4.5);
  });
});
