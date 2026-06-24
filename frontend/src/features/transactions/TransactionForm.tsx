import { ArrowDownCircle, ArrowUpCircle, CalendarDays, PlusCircle, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { TransactionInput } from '../../data/db'
import { maskCurrencyInput, parseCurrencyInput, validateTransactionInput } from '../../data/db'
import type { Category, TransactionKind } from '../../domain/types'

interface TransactionFormProps {
  categories: Category[]
  onSubmit: (input: TransactionInput) => Promise<void>
  onSaved?: () => void
  variant?: 'split' | 'modal'
}

interface TransactionCardProps {
  categories: Category[]
  mode: 'expense' | 'income'
  onSaved?: () => void
  onSubmit: (input: TransactionInput) => Promise<void>
}

const today = new Date().toISOString().slice(0, 10)

export function TransactionForm({ categories, onSaved, onSubmit, variant = 'split' }: TransactionFormProps) {
  if (variant === 'modal') {
    return <UnifiedTransactionForm categories={categories} onSaved={onSaved} onSubmit={onSubmit} />
  }

  return (
    <div className="transaction-split" aria-label="Novos lan?amentos">
      <TransactionCard categories={categories} mode="expense" onSaved={onSaved} onSubmit={onSubmit} />
      <TransactionCard categories={categories} mode="income" onSaved={onSaved} onSubmit={onSubmit} />
    </div>
  )
}


function TransactionCard({ categories, mode, onSaved, onSubmit }: TransactionCardProps) {
  const [kind, setKind] = useState<TransactionKind>(mode === 'income' ? 'income' : 'variable_expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [occurredAt, setOccurredAt] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isIncome = mode === 'income'
  const effectiveKind = useMemo<TransactionKind>(() => (isIncome ? 'income' : kind), [isIncome, kind])
  const title = isIncome ? 'Ganhos' : 'Gastos'
  const cardHint = isIncome ? 'Registre entradas confirmadas do periodo.' : 'Classifique saidas fixas e variaveis.'
  const amountPreview = parseCurrencyInput(amount)
  const descriptionLabel = isIncome ? 'Descrição do ganho' : 'Descrição do gasto'
  const descriptionPlaceholder = isIncome ? 'Ex.: salário, freela' : 'Ex.: mercado, aluguel'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const input: TransactionInput = {
      kind: effectiveKind,
      description,
      amount: parseCurrencyInput(amount),
      categoryId: isIncome ? undefined : categoryId,
      occurredAt,
    }
    const validation = validateTransactionInput(input)

    if (validation) {
      setError(validation)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSubmit(input)
      setDescription('')
      setAmount('')
      setCategoryId('')
      setKind(mode === 'income' ? 'income' : 'variable_expense')
      setOccurredAt(today)
      onSaved?.()
    } catch {
      setError('Não foi possível salvar agora. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className={`transaction-form transaction-card ${mode}`} onSubmit={handleSubmit}>
      <div className="transaction-card-header">
        <div className="form-title">
          {isIncome ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
          <div>
            <h3>{title}</h3>
            <p>{cardHint}</p>
          </div>
        </div>
        <output className="amount-preview" aria-label={`Previa de ${isIncome ? 'ganho' : 'gasto'}`}>
          {amountPreview > 0 ? `${isIncome ? '+' : '-'} ${amount}` : 'R$ 0,00'}
        </output>
      </div>

      {!isIncome ? (
        <div className="expense-kind-toggle" role="group" aria-label="Tipo de gasto">
          <button
            className={kind === 'variable_expense' ? 'active' : ''}
            type="button"
            onClick={() => setKind('variable_expense')}
          >
            Variavel
          </button>
          <button
            className={kind === 'fixed_expense' ? 'active' : ''}
            type="button"
            onClick={() => setKind('fixed_expense')}
          >
            Conta fixa
          </button>
        </div>
      ) : null}

      <label>
        Valor
        <input
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(event) => setAmount(maskCurrencyInput(event.target.value))}
        />
      </label>

      <label>
        {descriptionLabel}
        <input
          placeholder={descriptionPlaceholder}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="form-row transaction-detail-row">
        {!isIncome ? (
          <label>
            <span className="field-label-icon"><Tag size={14} /> Categoria</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          <span className="field-label-icon"><CalendarDays size={14} /> Data</span>
          <input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="primary-action" disabled={isSaving} type="submit">
        <PlusCircle size={18} aria-hidden="true" />
        {isSaving ? 'Salvando' : `Adicionar ${isIncome ? 'ganho' : 'gasto'}`}
      </button>
    </form>
  )
}

function UnifiedTransactionForm({ categories, onSaved, onSubmit }: Omit<TransactionCardProps, 'mode'>) {
  const [kind, setKind] = useState<TransactionKind>('variable_expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [occurredAt, setOccurredAt] = useState(today)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isIncome = kind === 'income'
  const amountPreview = parseCurrencyInput(amount)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const input: TransactionInput = {
      kind,
      description,
      amount: parseCurrencyInput(amount),
      categoryId: isIncome ? undefined : categoryId,
      occurredAt,
    }
    const validation = validateTransactionInput(input)

    if (validation) {
      setError(validation)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSubmit(input)
      setKind('variable_expense')
      setDescription('')
      setAmount('')
      setCategoryId('')
      setOccurredAt(today)
      onSaved?.()
    } catch {
      setError('Nao foi possivel salvar agora. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="transaction-form transaction-modal-form" onSubmit={handleSubmit}>
      <div className="modal-kind-grid" role="group" aria-label="Tipo de lancamento">
        <button className={kind === 'variable_expense' ? 'active' : ''} type="button" onClick={() => setKind('variable_expense')}>
          <ArrowDownCircle size={17} />
          Gasto variavel
        </button>
        <button className={kind === 'fixed_expense' ? 'active' : ''} type="button" onClick={() => setKind('fixed_expense')}>
          <ArrowDownCircle size={17} />
          Conta fixa
        </button>
        <button className={kind === 'income' ? 'active' : ''} type="button" onClick={() => setKind('income')}>
          <ArrowUpCircle size={17} />
          Ganho
        </button>
      </div>

      <div className={`modal-amount-panel ${isIncome ? 'income' : 'expense'}`}>
        <span>{isIncome ? 'Entrada prevista' : 'Saida registrada'}</span>
        <output aria-label="Previa do valor">{amountPreview > 0 ? `${isIncome ? '+' : '-'} ${amount}` : 'R$ 0,00'}</output>
      </div>

      <label>
        Valor
        <input
          inputMode="decimal"
          placeholder="0,00"
          value={amount}
          onChange={(event) => setAmount(maskCurrencyInput(event.target.value))}
        />
      </label>

      <label>
        Descricao
        <input
          placeholder={isIncome ? 'Ex.: salario, freela' : 'Ex.: compra no mercado'}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="form-row transaction-detail-row">
        {!isIncome ? (
          <label>
            <span className="field-label-icon"><Tag size={14} /> Categoria</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          <span className="field-label-icon"><CalendarDays size={14} /> Data</span>
          <input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="primary-action modal-save-action" disabled={isSaving} type="submit">
        <PlusCircle size={18} aria-hidden="true" />
        {isSaving ? 'Salvando' : 'Salvar transação'}
      </button>
    </form>
  )
}
