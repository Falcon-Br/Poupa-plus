import { describe, expect, it } from 'vitest'
import {
  validateCategoryInput,
  validateGoalInput,
  validateHouseholdInput,
  validateHouseholdMemberInput,
  validatePredictableIncomeInput,
} from './db'

describe('local finance input validation', () => {
  it('requires a category name', () => {
    expect(validateCategoryInput({ name: '   ', color: '#176b5b' })).toBe('Informe o nome da categoria.')
  })

  it('requires a valid goal target amount', () => {
    expect(
      validateGoalInput({
        kind: 'saving',
        name: 'Reserva',
        targetAmount: 0,
        currentAmount: 0,
      }),
    ).toBe('Informe uma meta maior que zero.')
  })

  it('rejects goal current amount below zero', () => {
    expect(
      validateGoalInput({
        kind: 'debt',
        name: 'Cartao',
        targetAmount: 1000,
        currentAmount: -1,
      }),
    ).toBe('Informe um progresso maior ou igual a zero.')
  })

  it('requires positive predictable income amount', () => {
    expect(
      validatePredictableIncomeInput({
        description: 'Salario',
        amount: 0,
      }),
    ).toBe('Informe uma renda maior que zero.')
  })

  it('requires a household name', () => {
    expect(validateHouseholdInput({ name: '   ' })).toBe('Informe o nome do grupo.')
  })

  it('requires member name and email', () => {
    expect(validateHouseholdMemberInput({ name: '', email: '', role: 'member' })).toBe(
      'Informe nome e email do membro.',
    )
  })
})