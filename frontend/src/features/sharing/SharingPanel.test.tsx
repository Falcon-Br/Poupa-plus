import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Category, Goal, Household, HouseholdMember } from '../../domain/types'
import { SharingPanel } from './SharingPanel'

const household: Household = {
  id: 'household-1',
  ownerUserId: 'user-1',
  name: 'Casa Souza',
  createdAt: '2026-06-19T00:00:00.000Z',
}

const members: HouseholdMember[] = [
  {
    id: 'member-1',
    householdId: 'household-1',
    name: 'Ana',
    email: 'ana@example.com',
    role: 'owner',
    createdAt: '2026-06-19T00:00:00.000Z',
  },
]

const categories: Category[] = [
  {
    id: 'category-shared',
    userId: 'user-1',
    householdId: 'household-1',
    name: 'Mercado',
    color: '#176b5b',
  },
  {
    id: 'category-personal',
    userId: 'user-1',
    name: 'Pessoal',
    color: '#2563eb',
  },
]

const goals: Goal[] = [
  {
    id: 'goal-shared',
    userId: 'user-1',
    householdId: 'household-1',
    kind: 'saving',
    name: 'Reserva da casa',
    targetAmount: 1000,
    currentAmount: 250,
  },
  {
    id: 'goal-personal',
    userId: 'user-1',
    kind: 'debt',
    name: 'Cartao pessoal',
    targetAmount: 500,
    currentAmount: 100,
  },
]

describe('SharingPanel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists only categories and goals shared with the active household', () => {
    render(
      <SharingPanel
        household={household}
        members={members}
        categories={categories}
        goals={goals}
        onCreateHousehold={vi.fn().mockResolvedValue(undefined)}
        onAddMember={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(within(screen.getByLabelText('Categorias compartilhadas')).getByText('Mercado')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Metas compartilhadas')).getByText('Reserva da casa')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.queryByText('Pessoal')).not.toBeInTheDocument()
    expect(screen.queryByText('Cartao pessoal')).not.toBeInTheDocument()
  })
})