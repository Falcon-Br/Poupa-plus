import { Home, Palette, Target, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import type { HouseholdInput, HouseholdMemberInput } from '../../data/db'
import { validateHouseholdInput, validateHouseholdMemberInput } from '../../data/db'
import type { Category, Goal, Household, HouseholdMember, UserProfile } from '../../domain/types'

interface SharingPanelProps {
  household?: Household
  members: HouseholdMember[]
  categories: Category[]
  goals: Goal[]
  registeredUsers?: UserProfile[]
  onCreateHousehold: (input: HouseholdInput) => Promise<void>
  onAddMember: (input: HouseholdMemberInput) => Promise<void>
}

interface SharedPlanningItems {
  categories: Category[]
  goals: Goal[]
}

export function SharingPanel({
  household,
  members,
  categories,
  goals,
  registeredUsers = [],
  onCreateHousehold,
  onAddMember,
}: SharingPanelProps) {
  const sharedItems: SharedPlanningItems = household
    ? {
        categories: categories.filter((category) => category.householdId === household.id),
        goals: goals.filter((goal) => goal.householdId === household.id),
      }
    : { categories: [], goals: [] }
  const memberUserIds = new Set(members.map((member) => member.userId).filter(Boolean))
  const memberEmails = new Set(members.map((member) => member.email))
  const availableUsers = registeredUsers.filter((user) => !memberUserIds.has(user.id) && !memberEmails.has(user.email))

  return (
    <section className="panel sharing-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Compartilhamento</p>
          <h2>Casal ou família</h2>
        </div>
        <Users size={20} />
      </div>

      {!household ? (
        <HouseholdForm onSubmit={onCreateHousehold} />
      ) : (
        <div className="sharing-grid">
          <div>
            <div className="household-summary">
              <Home size={18} />
              <div>
                <strong>{household.name}</strong>
                <p className="muted">Grupo local pronto para sincronização futura.</p>
              </div>
            </div>
            <ul className="compact-list member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <span>
                    {member.name}
                    <small>{member.email}</small>
                  </span>
                  <strong>{member.role === 'owner' ? 'Dono' : 'Membro'}</strong>
                </li>
              ))}
            </ul>
            <SharedPlanningList sharedItems={sharedItems} />
          </div>
          <MemberForm users={availableUsers} onSubmit={onAddMember} />
        </div>
      )}
    </section>
  )
}

function SharedPlanningList({ sharedItems }: { sharedItems: SharedPlanningItems }) {
  const hasSharedItems = sharedItems.categories.length > 0 || sharedItems.goals.length > 0

  return (
    <div className="shared-planning-list" aria-label="Itens compartilhados do grupo">
      <div className="form-title">
        <Users size={18} />
        <h3>Planejamento compartilhado</h3>
      </div>
      {!hasSharedItems ? (
        <p className="muted">Nenhuma categoria ou meta compartilhada ainda.</p>
      ) : (
        <>
          <SharedCategoryList categories={sharedItems.categories} />
          <SharedGoalList goals={sharedItems.goals} />
        </>
      )}
    </div>
  )
}

function SharedCategoryList({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <div aria-label="Categorias compartilhadas">
      <p className="shared-list-title">Categorias</p>
      <ul className="compact-list">
        {categories.map((category) => (
          <li key={category.id}>
            <span className="shared-item-label">
              <Palette size={16} />
              {category.name}
            </span>
            <span className="color-swatch" style={{ background: category.color }} aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SharedGoalList({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null

  return (
    <div aria-label="Metas compartilhadas">
      <p className="shared-list-title">Metas</p>
      <ul className="compact-list">
        {goals.map((goal) => (
          <li key={goal.id}>
            <span className="shared-item-label">
              <Target size={16} />
              {goal.name}
            </span>
            <strong>{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HouseholdForm({ onSubmit }: { onSubmit: (input: HouseholdInput) => Promise<void> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { name }
    const validation = validateHouseholdInput(input)

    if (validation) {
      setError(validation)
      return
    }

    await onSubmit(input)
    setName('')
    setError(null)
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <div className="form-title">
        <Home size={18} />
        <h3>Criar grupo</h3>
      </div>
      <label>
        Nome do grupo
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Casa da Ana e Leo" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="secondary-action" type="submit">Criar grupo</button>
    </form>
  )
}

function MemberForm({ users, onSubmit }: { users: UserProfile[]; onSubmit: (input: HouseholdMemberInput) => Promise<void> }) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<HouseholdMemberInput['role']>('member')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = { userId, role }
    const validation = validateHouseholdMemberInput(input)

    if (validation) {
      setError(validation)
      return
    }

    try {
      await onSubmit(input)
      setUserId('')
      setRole('member')
      setError(null)
    } catch {
      setError('A pessoa selecionada precisa estar cadastrada no sistema.')
    }
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <div className="form-title">
        <UserPlus size={18} />
        <h3>Adicionar membro</h3>
      </div>
      {users.length === 0 ? (
        <p className="muted">Cadastre outra pessoa para adicioná-la ao grupo.</p>
      ) : (
        <label>
          Pessoa cadastrada
          <select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Selecione</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Papel
        <select value={role} onChange={(event) => setRole(event.target.value as HouseholdMemberInput['role'])}>
          <option value="member">Membro</option>
          <option value="owner">Dono</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="secondary-action" disabled={users.length === 0} type="submit">Adicionar</button>
    </form>
  )
}
