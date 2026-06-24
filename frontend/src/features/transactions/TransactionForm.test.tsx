import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '../../domain/types'
import { TransactionForm } from './TransactionForm'

const categories: Category[] = [
  { id: 'food', userId: 'user-1', name: 'Alimentação', color: '#f97316' },
  { id: 'home', userId: 'user-1', name: 'Casa', color: '#176b5b' },
]

describe('TransactionForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows validation feedback and does not submit incomplete data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<TransactionForm categories={categories} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /adicionar gasto/i }))

    expect(await screen.findByText('Informe uma descrição.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid expense with cents, category and date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<TransactionForm categories={categories} onSubmit={onSubmit} />)

    const expenseForm = screen.getByRole('heading', { name: 'Gastos' }).closest('form') as HTMLFormElement
    await user.type(within(expenseForm).getByLabelText('Descrição do gasto'), 'Mercado')
    await user.type(within(expenseForm).getByLabelText('Valor'), '123,45')
    await user.selectOptions(within(expenseForm).getByLabelText('Categoria'), 'food')
    await user.clear(within(expenseForm).getByLabelText('Data'))
    await user.type(within(expenseForm).getByLabelText('Data'), '2026-06-18')
    await user.click(within(expenseForm).getByRole('button', { name: /adicionar gasto/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        kind: 'variable_expense',
        description: 'Mercado',
        amount: 123.45,
        categoryId: 'food',
        occurredAt: '2026-06-18',
      })
    })
  })
})
