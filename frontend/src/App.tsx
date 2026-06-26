import { BarChart3, CloudUpload, Eye, EyeOff, Loader2, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import {
  addBudget,
  addCategory,
  addGoal,
  deleteBudget,
  deleteGoal,
  deleteTransactions,
  addHouseholdMember,
  addPredictableIncome,
  addTransaction,
  clearActiveSession,
  createHousehold,
  getActiveUserId,
  getSnapshot,
  importTransactions,
  storeAuthenticatedProfile,
  storeRegisteredProfiles,
  updateBudget,
  updateGoal,
} from './data/db'
import { ApiConnectionError, listRegisteredUsers, loginAccount, registerAccount } from './data/api'
import { syncPendingQueue } from './data/syncEngine'
import type {
  BudgetInput,
  CategoryInput,
  GoalInput,
  HouseholdInput,
  HouseholdMemberInput,
  PredictableIncomeInput,
  TransactionInput,
} from './data/db'
import type { FinanceSnapshot } from './domain/types'
import { Dashboard, type DashboardSyncStatus } from './features/dashboard/Dashboard'
import { StatementImportPanel } from './features/imports/StatementImportPanel'
import type { StatementImportCandidate } from './features/imports/statementImport'
import { PlanningForms } from './features/planning/PlanningForms'
import { SharingPanel } from './features/sharing/SharingPanel'
import { TransactionForm } from './features/transactions/TransactionForm'

type AuthMode = 'login' | 'register'

export default function App() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordRecoveryModalOpen, setIsPasswordRecoveryModalOpen] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<DashboardSyncStatus>({ state: 'idle', message: 'Sync pronto' })
  const pendingSyncCount = useMemo(
    () => snapshot?.syncQueue.filter((item) => item.status === 'pending').length ?? 0,
    [snapshot?.syncQueue],
  )

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!snapshot || !isOnline) return
    if (pendingSyncCount === 0) {
      setSyncStatus({ state: 'success', message: 'Tudo sincronizado' })
      return
    }

    let cancelled = false
    setSyncStatus({ state: 'syncing', message: 'Sincronizando...' })
    void syncPendingQueue(snapshot.user.id)
      .then(async (result) => {
        if (cancelled) return
        await refreshSnapshot(snapshot.user.id)
        setSyncStatus({
          state: result.failed > 0 ? 'error' : 'success',
          message: result.failed > 0
            ? `${result.failed} item(ns) com erro no sync`
            : `${result.synced} item(ns) sincronizado(s)`,
        })
      })
      .catch(() => {
        if (!cancelled) setSyncStatus({ state: 'error', message: 'Sync falhou. Tentaremos novamente.' })
      })

    return () => {
      cancelled = true
    }
  }, [isOnline, pendingSyncCount, snapshot?.user.id])

  async function bootstrap() {
    const activeUserId = await getActiveUserId()
    if (!activeUserId) {
      setIsLoading(false)
      return
    }

    await refreshSnapshot(activeUserId)
    setIsLoading(false)
  }

  async function refreshSnapshot(userId: string) {
    if (navigator.onLine) {
      try {
        await storeRegisteredProfiles(await listRegisteredUsers())
      } catch {
        // A lista online melhora o compartilhamento, mas não deve bloquear o uso offline.
      }
    }

    setSnapshot(await getSnapshot(userId))
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!loginEmail.trim() || !loginPassword.trim() || (authMode === 'register' && !loginName.trim())) {
      setLoginError(authMode === 'register' ? 'Informe nome, email e senha.' : 'Informe email e senha.')
      return
    }

    setLoginError(null)
    setIsLoading(true)

    try {
      const user = authMode === 'register'
        ? await registerAccount(loginName, loginEmail, loginPassword)
        : await loginAccount(loginEmail, loginPassword)
      await storeAuthenticatedProfile(user)
      setLoginPassword('')
      await refreshSnapshot(user.id)
      toast.success(authMode === 'register' ? 'Conta criada com sucesso.' : 'Login realizado com sucesso.')
    } catch (error) {
      if (error instanceof ApiConnectionError) {
        setLoginError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente em instantes.')
      } else {
        setLoginError(authMode === 'register' ? 'Não foi possível cadastrar. Verifique se o email já existe.' : 'Email ou senha inválidos.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handlePasswordReset() {
    setLoginError(null)
    setIsPasswordRecoveryModalOpen(true)
  }

  async function handleLogout() {
    await clearActiveSession()
    setSnapshot(null)
    setLoginPassword('')
    setSyncStatus({ state: 'idle', message: 'Sync pronto' })
  }

  async function handleAddTransaction(input: TransactionInput) {
    if (!snapshot) return
    await addTransaction(snapshot.user.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Lançamento salvo. A sincronização será feita automaticamente.')
  }

  async function handleDeleteTransactions(transactionIds: string[]) {
    if (!snapshot || transactionIds.length === 0) return
    await deleteTransactions(snapshot.user.id, transactionIds)
    await refreshSnapshot(snapshot.user.id)
    toast.success(`${transactionIds.length} transação${transactionIds.length === 1 ? '' : 'ões'} excluída${transactionIds.length === 1 ? '' : 's'}.`)
  }

  async function handleAddBudget(input: BudgetInput) {
    if (!snapshot) return
    await addBudget(snapshot.user.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Orçamento salvo.')
  }

  async function handleUpdateBudget(budgetId: string, input: BudgetInput) {
    if (!snapshot) return
    await updateBudget(snapshot.user.id, budgetId, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Orçamento atualizado.')
  }

  async function handleDeleteBudget(budgetId: string) {
    if (!snapshot) return
    await deleteBudget(snapshot.user.id, budgetId)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Orçamento excluído.')
  }
  async function handleAddCategory(input: CategoryInput) {
    if (!snapshot) return
    await addCategory(snapshot.user.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Categoria salva.')
  }

  async function handleAddGoal(input: GoalInput) {
    if (!snapshot) return
    await addGoal(snapshot.user.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Meta salva.')
  }

  async function handleUpdateGoal(goalId: string, input: GoalInput) {
    if (!snapshot) return
    await updateGoal(snapshot.user.id, goalId, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Meta atualizada.')
  }

  async function handleDeleteGoal(goalId: string) {
    if (!snapshot) return
    await deleteGoal(snapshot.user.id, goalId)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Meta excluida.')
  }

  async function handleAddPredictableIncome(input: PredictableIncomeInput) {
    if (!snapshot) return
    await addPredictableIncome(snapshot.user.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Renda previsível salva.')
  }

  async function handleImportTransactions(candidates: StatementImportCandidate[]) {
    if (!snapshot) return
    await importTransactions(snapshot.user.id, candidates)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Importação concluída.')
  }

  async function handleCreateHousehold(input: HouseholdInput) {
    if (!snapshot) return
    await createHousehold(snapshot.user, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Grupo criado.')
  }

  async function handleAddHouseholdMember(input: HouseholdMemberInput) {
    if (!snapshot?.household) return
    await addHouseholdMember(snapshot.user.id, snapshot.household.id, input)
    await refreshSnapshot(snapshot.user.id)
    toast.success('Membro adicionado.')
  }

  if (isLoading) {
    return (
      <>
        <main className="loading-screen" aria-busy="true">
          <section className="loading-card" role="status" aria-live="polite" aria-label="Carregando Poupa+">
            <div className="loading-brand">
              <span className="brand-mark loading-brand-mark">P+</span>
              <div>
                <p className="eyebrow">Poupa+</p>
                <h1>Preparando sua visão financeira</h1>
              </div>
            </div>

            <div className="loading-orbit" aria-hidden="true">
              <span className="loading-ring" />
              <Loader2 className="spin loading-spinner" size={38} />
              <span className="loading-core">P+</span>
            </div>

            <p className="loading-copy">
              Sincronizando dados locais, metas e lançamentos para você retomar de onde parou.
            </p>

            <div className="loading-progress" aria-hidden="true">
              <span />
            </div>

            <div className="loading-steps" aria-hidden="true">
              <span><ShieldCheck size={16} /> Sessão segura</span>
              <span><CloudUpload size={16} /> Sync offline-first</span>
              <span><BarChart3 size={16} /> Dashboard pronto</span>
            </div>
          </section>
        </main>
        <ToastContainer position="top-right" theme="light" />
      </>
    )
  }


  if (!snapshot) {
    return (
      <>
      <main className="login-screen">
        <section className="auth-shell">
          <div className="auth-hero">
            <span className="brand-mark large">P+</span>
            <p className="eyebrow">Financeiro offline-first</p>
            <h1>Controle do dinheiro com cara de produto, sem perder a simplicidade.</h1>
            <p className="login-copy">
              Entre ou crie sua conta online. Depois do acesso, seus ganhos, gastos, metas e compartilhamentos
              continuam funcionando offline e sincronizam quando a internet voltar.
            </p>

            <div className="auth-feature-grid" aria-label="Destaques do produto">
              <article className="auth-feature-card">
                <div className="auth-feature-icon">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <strong>Dashboard vivo</strong>
                  <p>Resumo mensal, gráficos e leitura do seu comportamento financeiro em um só lugar.</p>
                </div>
              </article>
              <article className="auth-feature-card">
                <div className="auth-feature-icon">
                  <CloudUpload size={18} />
                </div>
                <div>
                  <strong>Importação e sync</strong>
                  <p>Extratos, fila local e sincronização clara quando você volta a ficar online.</p>
                </div>
              </article>
              <article className="auth-feature-card">
                <div className="auth-feature-icon">
                  <Users size={18} />
                </div>
                <div>
                  <strong>Planejamento em grupo</strong>
                  <p>Metas, categorias e organização compartilhada para casal ou família.</p>
                </div>
              </article>
            </div>

            <div className="auth-preview-board" aria-hidden="true">
              <div className="preview-balance-card">
                <span>Saldo do mês</span>
                <strong>R$ 3.840,00</strong>
                <small>Ganhos previsíveis, metas e fila local alinhados.</small>
              </div>
              <div className="preview-mini-grid">
                <div className="preview-mini-card">
                  <ShieldCheck size={16} />
                  <span>Offline pronto</span>
                </div>
                <div className="preview-mini-card">
                  <CloudUpload size={16} />
                  <span>Sync visível</span>
                </div>
                <div className="preview-mini-card">
                  <Users size={16} />
                  <span>Compartilhável</span>
                </div>
                <div className="preview-mini-card">
                  <BarChart3 size={16} />
                  <span>Analítico</span>
                </div>
              </div>
            </div>
          </div>

          <section className="login-panel">
            <div className="login-panel-header">
              <p className="eyebrow">Conta online</p>
              <h2>{authMode === 'register' ? 'Criar acesso' : 'Entrar na sua conta'}</h2>
              <p className="muted">
                {authMode === 'register'
                  ? 'Comece agora e mantenha seus dados prontos para uso local.'
                  : 'Acesse sua base financeira e retome de onde parou.'}
              </p>
            </div>

            <div className="auth-tabs" role="group" aria-label="Modo de acesso">
              <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => setAuthMode('login')}>Entrar</button>
              <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => setAuthMode('register')}>Cadastrar</button>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              {authMode === 'register' ? (
                <label>
                  Nome
                  <input value={loginName} onChange={(event) => setLoginName(event.target.value)} />
                </label>
              ) : null}
              <label>
                Email
                <input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
              </label>
              <label>
                Senha
                <div className="password-input-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
                  <button
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {authMode === 'login' ? (
                <button
                  className="text-action"
                  type="button"
                  onClick={handlePasswordReset}
                >
                  Recuperar senha
                </button>
              ) : null}
              {loginError ? <p className="form-error">{loginError}</p> : null}
              <button className="primary-action" type="submit">
                {authMode === 'register' ? 'Cadastrar conta' : 'Entrar agora'}
              </button>
            </form>
          </section>
        </section>
      </main>
      {isPasswordRecoveryModalOpen ? (
        <div className="auth-modal-overlay" role="presentation" onClick={() => setIsPasswordRecoveryModalOpen(false)}>
          <section
            aria-labelledby="password-recovery-title"
            aria-modal="true"
            className="auth-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal-header">
              <p className="eyebrow">Recuperação de senha</p>
              <h2 id="password-recovery-title">Funcionalidade em desenvolvimento</h2>
            </div>
            <p className="muted">
              A recuperação de senha ainda não está disponível nesta versão. Estamos preparando esse fluxo para que você possa redefinir o acesso com segurança.
            </p>
            <button className="primary-action" type="button" onClick={() => setIsPasswordRecoveryModalOpen(false)}>
              Entendi
            </button>
          </section>
        </div>
      ) : null}
      <ToastContainer position="top-right" theme="light" />
      </>
    )
  }

  return (
    <>
    <Dashboard
      snapshot={snapshot}
      isOnline={isOnline}
      syncStatus={syncStatus}
      household={snapshot.household}
      onAddBudget={handleAddBudget}
      onAddGoal={handleAddGoal}
      onDeleteBudget={handleDeleteBudget}
      onDeleteGoal={handleDeleteGoal}
      onDeleteTransactions={handleDeleteTransactions}
      onLogout={handleLogout}
      onUpdateBudget={handleUpdateBudget}
      onUpdateGoal={handleUpdateGoal}
      planningTools={
        <PlanningForms
          household={snapshot.household}
          onAddCategory={handleAddCategory}
          onAddGoal={handleAddGoal}
          onAddPredictableIncome={handleAddPredictableIncome}
          showCategory={false}
          showGoal={false}
        />
      }
      importTools={
        <StatementImportPanel
          categories={snapshot.categories}
          transactions={snapshot.transactions}
          onImport={handleImportTransactions}
        />
      }
      sharingTools={
        <SharingPanel
          household={snapshot.household}
          members={snapshot.householdMembers}
          categories={snapshot.categories}
          goals={snapshot.goals}
          registeredUsers={snapshot.registeredUsers?.filter((user) => user.id !== snapshot.user.id && !user.passwordHash)}
          onCreateHousehold={handleCreateHousehold}
          onAddMember={handleAddHouseholdMember}
        />
      }
      transactionModal={
        <TransactionForm
          categories={snapshot.categories}
          onSubmit={handleAddTransaction}
          variant="modal"
        />
      }
    >
      <TransactionForm categories={snapshot.categories} onSubmit={handleAddTransaction} />
    </Dashboard>
    <ToastContainer position="top-right" theme="light" />
    </>
  )
}




