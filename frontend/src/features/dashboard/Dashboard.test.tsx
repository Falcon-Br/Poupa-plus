import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinanceSnapshot } from '../../domain/types'
import { Dashboard } from './Dashboard'

const emptySnapshot: FinanceSnapshot = {
  user: {
    id: 'user-1',
    name: 'Ana',
    email: 'ana@example.com',
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  householdMembers: [],
  categories: [
    { id: 'food', userId: 'user-1', name: 'Alimentacao', color: '#f97316' },
  ],
  transactions: [],
  goals: [],
  budgets: [],
  predictableIncomes: [],
  syncQueue: [],
}

describe('Dashboard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the empty chart state and zeroed month summary', () => {
    render(
      <Dashboard
        snapshot={emptySnapshot}
        isOnline
        onAddBudget={vi.fn().mockResolvedValue(undefined)}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={vi.fn().mockResolvedValue(undefined)}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={vi.fn().mockResolvedValue(undefined)}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    expect(screen.getByRole('heading', { name: 'Olá, Ana' })).toBeInTheDocument()
    expect(screen.getByText(/Adicione uma despesa/)).toBeInTheDocument()
    expect(screen.getByText('0 aguardando sync')).toBeInTheDocument()
    const monthSummary = within(screen.getByLabelText('Resumo do mes'))

    expect(monthSummary.getByText('Ganhos')).toBeInTheDocument()
    expect(monthSummary.getAllByText('R$ 0,00')).toHaveLength(3)
  })

  it('keeps budget in its own tab and planning tools under settings', () => {
    render(
      <Dashboard
        snapshot={emptySnapshot}
        isOnline
        onAddBudget={vi.fn().mockResolvedValue(undefined)}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={vi.fn().mockResolvedValue(undefined)}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={vi.fn().mockResolvedValue(undefined)}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    expect(screen.getByRole('tab', { name: /orçamento/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /orçamento mensal/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Planejamento rapido')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /orçamento/i }))

    expect(screen.getByRole('heading', { name: /orçamento mensal/i })).toBeInTheDocument()
    expect(screen.queryByText('Planejamento rapido')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /ajustes/i }))

    expect(screen.getByText('Planejamento rapido')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /orçamento mensal/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Resumo do mes')).not.toBeInTheDocument()
  })

  it('opens the new transaction modal from the dashboard top action', () => {
    render(
      <Dashboard
        snapshot={emptySnapshot}
        isOnline
        onAddBudget={vi.fn().mockResolvedValue(undefined)}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={vi.fn().mockResolvedValue(undefined)}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={vi.fn().mockResolvedValue(undefined)}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
        transactionModal={<form aria-label="Formulário modal">Formulário nova transação</form>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    expect(screen.queryByRole('dialog', { name: /nova transação/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /nova transação/i }))

    expect(screen.getByRole('dialog', { name: /nova transação/i })).toBeInTheDocument()
    expect(screen.getByText('Formulário nova transação')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /fechar modal/i }))

    expect(screen.queryByRole('dialog', { name: /nova transação/i })).not.toBeInTheDocument()
  })


  it('replaces the import tab with the goals tab', () => {
    render(
      <Dashboard
        snapshot={emptySnapshot}
        isOnline
        onAddBudget={vi.fn().mockResolvedValue(undefined)}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={vi.fn().mockResolvedValue(undefined)}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={vi.fn().mockResolvedValue(undefined)}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    expect(screen.queryByRole('tab', { name: /importar/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /metas/i }))

    expect(screen.getByRole('heading', { name: /objetivos financeiros/i })).toBeInTheDocument()
    expect(screen.getByText(/nenhuma meta cadastrada/i)).toBeInTheDocument()
  })

  it('manages budgets from the budget tab with automatic allocation and contextual actions', async () => {
    const onAddBudget = vi.fn().mockResolvedValue(undefined)
    const onDeleteBudget = vi.fn().mockResolvedValue(undefined)
    const snapshot: FinanceSnapshot = {
      ...emptySnapshot,
      budgets: [
        {
          id: 'budget-food',
          userId: 'user-1',
          categoryId: 'food',
          name: 'Mercado',
          color: '#f97316',
          budgetKind: 'expense',
          monthlyAmount: 200,
          limitAmount: 100,
          allocationMode: 'percentage',
          allocationValue: 50,
          preset: 'custom',
          isAutomatic: true,
          period: 'monthly',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          userId: 'user-1',
          kind: 'variable_expense',
          description: 'Compra semanal',
          amount: 120,
          categoryId: 'food',
          occurredAt: new Date().toISOString().slice(0, 10),
          createdAt: '2026-06-10T00:00:00.000Z',
        },
      ],
    }

    render(
      <Dashboard
        snapshot={snapshot}
        isOnline
        onAddBudget={onAddBudget}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={onDeleteBudget}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={vi.fn().mockResolvedValue(undefined)}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /orçamento/i }))

    expect(screen.getByRole('heading', { name: /orçamento mensal/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mercado' }).closest('article')).toHaveAttribute('data-over-limit', 'true')
    expect(screen.getByText(/acima do limite/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ações do orçamento mercado/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /excluir/i }))

    expect(onDeleteBudget).toHaveBeenCalledWith('budget-food')

    fireEvent.click(screen.getByRole('button', { name: /^novo orçamento$/i }))
    fireEvent.change(screen.getByLabelText(/nome da categoria/i), { target: { value: 'Estudos' } })
    fireEvent.change(screen.getByLabelText(/^valor mensal$/i), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar orçamento/i }))

    expect(onAddBudget).toHaveBeenCalledWith(expect.objectContaining({
      categoryName: 'Estudos',
      budgetKind: 'expense',
      monthlyAmount: 500,
      allocationMode: 'percentage',
      allocationValue: 50,
      isAutomatic: true,
      limitAmount: 250,
    }))
  })

  it('paginates transactions and confirms bulk deletion', async () => {
    const onDeleteTransactions = vi.fn().mockResolvedValue(undefined)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const snapshot: FinanceSnapshot = {
      ...emptySnapshot,
      transactions: Array.from({ length: 11 }, (_, index) => ({
        id: `tx-${index + 1}`,
        userId: 'user-1',
        kind: 'variable_expense',
        description: `Compra ${index + 1}`,
        amount: 10 + index,
        categoryId: 'food',
        occurredAt: `${currentMonth}-${String(index + 1).padStart(2, '0')}`,
        createdAt: `${currentMonth}-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
    }

    render(
      <Dashboard
        snapshot={snapshot}
        isOnline
        onAddBudget={vi.fn().mockResolvedValue(undefined)}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteBudget={vi.fn().mockResolvedValue(undefined)}
        onDeleteGoal={vi.fn().mockResolvedValue(undefined)}
        onDeleteTransactions={onDeleteTransactions}
        onLogout={vi.fn()}
        onUpdateBudget={vi.fn().mockResolvedValue(undefined)}
        onUpdateGoal={vi.fn().mockResolvedValue(undefined)}
        planningTools={<div>Planejamento rapido</div>}
        importTools={<section>Importacao</section>}
        sharingTools={<section>Compartilhamento</section>}
      >
        <button type="button">Novo lancamento</button>
      </Dashboard>,
    )

    fireEvent.click(screen.getByRole('tab', { name: /transa/i }))

    expect(screen.getAllByText(/gina 1 de 2/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Compra 1')).toBeInTheDocument()
    expect(screen.queryByText('Compra 11')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /xima/i }))

    expect(screen.getAllByText(/gina 2 de 2/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Compra 11')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /selecionar compra 11/i }))
    fireEvent.click(screen.getByRole('button', { name: /^excluir$/i }))

    expect(screen.getByRole('dialog', { name: /excluir transa/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(onDeleteTransactions).toHaveBeenCalledWith(['tx-11'])
  })

})











