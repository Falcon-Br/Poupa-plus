import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanningForms } from './PlanningForms'
import type { Household } from '../../domain/types'

const household: Household = {
  id: 'household-1',
  ownerUserId: 'user-1',
  name: 'Casa Souza',
  createdAt: '2026-06-19T00:00:00.000Z',
}

describe('PlanningForms', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('submits a category with the active household when sharing is enabled', async () => {
    const user = userEvent.setup()
    const onAddCategory = vi.fn().mockResolvedValue(undefined)

    render(
      <PlanningForms
        household={household}
        onAddCategory={onAddCategory}
        onAddGoal={vi.fn().mockResolvedValue(undefined)}
        onAddPredictableIncome={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const categoryForm = screen.getByRole('heading', { name: 'Categoria' }).closest('form')
    expect(categoryForm).not.toBeNull()

    await user.type(within(categoryForm as HTMLFormElement).getByLabelText('Nome'), 'Mercado')
    await user.click(within(categoryForm as HTMLFormElement).getByRole('checkbox', { name: 'Compartilhar com grupo' }))
    await user.click(within(categoryForm as HTMLFormElement).getByRole('button', { name: 'Salvar categoria' }))

    expect(onAddCategory).toHaveBeenCalledWith({
      name: 'Mercado',
      color: '#176b5b',
      householdId: 'household-1',
    })
  })
})