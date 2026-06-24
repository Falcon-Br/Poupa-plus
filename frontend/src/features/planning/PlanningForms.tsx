import { Palette, PiggyBank, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { CategoryInput, GoalInput, PredictableIncomeInput } from '../../data/db'
import {
  defaultCategoryTemplates,
  maskCurrencyInput,
  parseCurrencyInput,
  validateCategoryInput,
  validateGoalInput,
  validatePredictableIncomeInput,
} from '../../data/db'
import type { Household } from '../../domain/types'

interface PlanningFormsProps {
  household?: Household
  onAddCategory: (input: CategoryInput) => Promise<void>
  onAddGoal: (input: GoalInput) => Promise<void>
  onAddPredictableIncome: (input: PredictableIncomeInput) => Promise<void>
  showCategory?: boolean
  showGoal?: boolean
}

interface HouseholdOption {
  id: string
  name: string
}

const fallbackCategoryColors = ['#176b5b', '#f97316', '#2563eb', '#dc2626', '#7c3aed', '#0f766e', '#ca8a04', '#be123c']
const categoryColors = Array.from(new Set([...defaultCategoryTemplates.map((template) => template.color), ...fallbackCategoryColors]))

export function PlanningForms({ household, onAddCategory, onAddGoal, onAddPredictableIncome, showCategory = true, showGoal = true }: PlanningFormsProps) {
  const householdOption = household ? { id: household.id, name: household.name } : null

  return (
    <section className="tool-grid" aria-label="Ferramentas de planejamento">
      {showCategory ? <CategoryForm household={householdOption} onSubmit={onAddCategory} /> : null}
      {showGoal ? <GoalForm household={householdOption} onSubmit={onAddGoal} /> : null}
      <PredictableIncomeForm onSubmit={onAddPredictableIncome} />
    </section>
  )
}

function CategoryForm({
  household,
  onSubmit,
}: {
  household: HouseholdOption | null
  onSubmit: (input: CategoryInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#176b5b')
  const [shareWithHousehold, setShareWithHousehold] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { name, color, householdId: shareWithHousehold ? household?.id : undefined }
    const validation = validateCategoryInput(input)

    if (validation) {
      setError(validation)
      return
    }

    await onSubmit(input)
    setName('')
    setColor('#176b5b')
    setShareWithHousehold(false)
    setError(null)
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <div className="form-title">
        <Palette size={18} />
        <h3>Categoria</h3>
      </div>
      <label>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: estudos" />
      </label>
      <fieldset className="color-field">
        <legend>Cor</legend>
        <div className="color-preset-grid">
          {categoryColors.map((preset) => (
            <button
              className={color.toLowerCase() === preset.toLowerCase() ? 'color-preset active' : 'color-preset'}
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              title={preset}
              aria-label={`Usar cor ${preset}`}
              style={{ background: preset }}
            />
          ))}
        </div>
        <label className="custom-color-field">
          Personalizada
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
      </fieldset>
      {household ? (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={shareWithHousehold}
            onChange={(event) => setShareWithHousehold(event.target.checked)}
          />
          Compartilhar com grupo
        </label>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="secondary-action" type="submit">Salvar categoria</button>
    </form>
  )
}

function GoalForm({
  household,
  onSubmit,
}: {
  household: HouseholdOption | null
  onSubmit: (input: GoalInput) => Promise<void>
}) {
  const [kind, setKind] = useState<GoalInput['kind']>('saving')
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('0')
  const [shareWithHousehold, setShareWithHousehold] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const goalPlaceholder = kind === 'saving' ? 'Ex.: reserva de emergência' : 'Ex.: quitar cartão'
  const progressLabel = kind === 'saving' ? 'Já guardado' : 'Já pago'
  const targetLabel = kind === 'saving' ? 'Valor alvo' : 'Valor da dívida'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = {
      kind,
      name,
      targetAmount: parseCurrencyInput(targetAmount),
      currentAmount: parseCurrencyInput(currentAmount),
      householdId: shareWithHousehold ? household?.id : undefined,
    }
    const validation = validateGoalInput(input)

    if (validation) {
      setError(validation)
      return
    }

    await onSubmit(input)
    setKind('saving')
    setName('')
    setTargetAmount('')
    setCurrentAmount('0')
    setShareWithHousehold(false)
    setError(null)
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <div className="form-title">
        <PiggyBank size={18} />
        <h3>Meta</h3>
      </div>
      <div className="form-row">
        <label>
          Tipo
          <select value={kind} onChange={(event) => setKind(event.target.value as GoalInput['kind'])}>
            <option value="saving">Juntar</option>
            <option value="debt">Pagar dívida</option>
          </select>
        </label>
        <label>
          {progressLabel}
          <input inputMode="decimal" value={currentAmount} onChange={(event) => setCurrentAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
        </label>
      </div>
      <label>
        Nome
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={goalPlaceholder} />
      </label>
      <label>
        {targetLabel}
        <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
      </label>
      {household ? (
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={shareWithHousehold}
            onChange={(event) => setShareWithHousehold(event.target.checked)}
          />
          Compartilhar com grupo
        </label>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="secondary-action" type="submit">Salvar meta</button>
    </form>
  )
}

function PredictableIncomeForm({ onSubmit }: { onSubmit: (input: PredictableIncomeInput) => Promise<void> }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { description, amount: parseCurrencyInput(amount) }
    const validation = validatePredictableIncomeInput(input)

    if (validation) {
      setError(validation)
      return
    }

    await onSubmit(input)
    setDescription('')
    setAmount('')
    setError(null)
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <div className="form-title">
        <TrendingUp size={18} />
        <h3>Renda previsível</h3>
      </div>
      <label>
        Descrição
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: salário" />
      </label>
      <label>
        Valor mensal
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="secondary-action" type="submit">Salvar renda</button>
    </form>
  )
}


