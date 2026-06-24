import {
  BarChart2,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  LogOut,
  MoreVertical,
  Pencil,
  PieChart as PieChartIcon,
  PlusCircle,
  ReceiptText,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput, validateBudgetInput, validateGoalInput } from '../../data/db'
import type { BudgetInput, GoalInput } from '../../data/db'
import {
  createFinancialInsights,
  getGoalProgress,
  projectNextMonth,
  summarizeExpensesByCategory,
  summarizeExpensesByDayAndCategory,
  summarizeMonth,
} from '../../domain/finance'
import type { FinanceSnapshot, SyncQueueItem, TransactionKind } from '../../domain/types'

export interface DashboardSyncStatus {
  state: 'idle' | 'syncing' | 'success' | 'error'
  message: string
}

interface DashboardProps {
  snapshot: FinanceSnapshot
  isOnline: boolean
  syncStatus?: DashboardSyncStatus
  onAddBudget: (input: BudgetInput) => Promise<void>
  onAddGoal: (input: GoalInput) => Promise<void>
  onDeleteBudget: (budgetId: string) => Promise<void>
  onDeleteGoal: (goalId: string) => Promise<void>
  onDeleteTransactions: (transactionIds: string[]) => Promise<void>
  onLogout: () => void
  onUpdateBudget: (budgetId: string, input: BudgetInput) => Promise<void>
  onUpdateGoal: (goalId: string, input: GoalInput) => Promise<void>
  household?: FinanceSnapshot['household']
  planningTools: React.ReactNode
  importTools: React.ReactNode
  sharingTools: React.ReactNode
  children: React.ReactNode
  transactionModal?: React.ReactNode
}

type ChartMode = 'pie' | 'timeline'
type KindFilter = 'all' | TransactionKind | 'expenses'
type DashboardTab = 'dashboard' | 'transactions' | 'budgets' | 'goals' | 'sharing' | 'reports' | 'settings'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const currentMonth = () => new Date().toISOString().slice(0, 7)
type TabItem = { id: DashboardTab; label: string; icon: typeof Gauge }
const tabItems: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'transactions', label: 'Transações', icon: ReceiptText },
  { id: 'budgets', label: 'Orçamento', icon: CircleDollarSign },
  { id: 'reports', label: 'Análises', icon: BarChart2 },
  { id: 'goals', label: 'Metas', icon: Target },
  { id: 'sharing', label: 'Grupo', icon: Share2 },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

export function Dashboard({
  snapshot,
  isOnline,
  syncStatus = { state: 'idle', message: 'Sync pronto' },
  onAddBudget,
  onAddGoal,
  onDeleteBudget,
  onDeleteGoal,
  onDeleteTransactions,
  onLogout,
  onUpdateBudget,
  onUpdateGoal,
  household,
  planningTools,
  sharingTools,
  children,
  transactionModal,
}: DashboardProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('pie')
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard')
  const [month, setMonth] = useState(currentMonth())
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [transactionPage, setTransactionPage] = useState(1)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([])
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [isDeletingTransactions, setIsDeletingTransactions] = useState(false)
  const [goalModalState, setGoalModalState] = useState<{ mode: 'create' } | { mode: 'edit'; goal: FinanceSnapshot['goals'][number] } | null>(null)
  const [budgetModalState, setBudgetModalState] = useState<{ mode: 'create' } | { mode: 'edit'; budget: FinanceSnapshot['budgets'][number] } | null>(null)
  const filteredTransactions = useMemo(
    () => snapshot.transactions.filter((transaction) => {
      const matchesMonth = transaction.occurredAt.startsWith(month)
      const matchesKind =
        kindFilter === 'all'
        || transaction.kind === kindFilter
        || (kindFilter === 'expenses' && transaction.kind !== 'income')
      const matchesCategory = categoryFilter === 'all' || transaction.categoryId === categoryFilter
      return matchesMonth && matchesKind && matchesCategory
    }),
    [categoryFilter, kindFilter, month, snapshot.transactions],
  )
  const summary = useMemo(() => summarizeMonth(filteredTransactions, month), [filteredTransactions, month])
  const categoryTotals = useMemo(
    () => summarizeExpensesByCategory(filteredTransactions, snapshot.categories, month),
    [filteredTransactions, snapshot.categories, month],
  )
  const dailyExpenseBreakdown = useMemo(
    () => summarizeExpensesByDayAndCategory(filteredTransactions, snapshot.categories, month),
    [filteredTransactions, month, snapshot.categories],
  )
  const dailyExpenses = dailyExpenseBreakdown.days
  const dailyExpenseSeries = dailyExpenseBreakdown.series
  const hasDailyExpenses = dailyExpenses.some((item) => item.total > 0)
  const projection = useMemo(
    () => projectNextMonth(snapshot.predictableIncomes, snapshot.transactions),
    [snapshot.predictableIncomes, snapshot.transactions],
  )
  const insights = useMemo(
    () => createFinancialInsights(filteredTransactions, snapshot.categories, snapshot.goals, month),
    [filteredTransactions, snapshot.categories, snapshot.goals, month],
  )
  const pendingItems = snapshot.syncQueue.filter((item) => item.status === 'pending')
  const failedItems = snapshot.syncQueue.filter((item) => item.status === 'failed')
  const pendingSync = pendingItems.length
  const balanceState = summary.balance >= 0 ? 'positivo' : 'negativo'
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
  const savingsRate = summary.income > 0 ? Math.max(0, Math.round((summary.balance / summary.income) * 100)) : 0
  const visibleTransactions = filteredTransactions.slice(0, 8)
  const totalGoalTarget = snapshot.goals.reduce((total, goal) => total + goal.targetAmount, 0)
  const totalGoalProgress = snapshot.goals.reduce((total, goal) => total + goal.currentAmount, 0)
  const overallGoalProgress = totalGoalTarget > 0 ? Math.round((totalGoalProgress / totalGoalTarget) * 100) : 0
  const nextGoal = [...snapshot.goals].filter((goal) => getGoalProgress(goal) < 100).sort((a, b) => getGoalProgress(b) - getGoalProgress(a))[0] ?? snapshot.goals[0]
  const shouldShowSyncBanner = syncStatus.state !== 'idle' || pendingSync > 0 || failedItems.length > 0
  const filteredExpenseCount = filteredTransactions.filter((transaction) => transaction.kind !== 'income').length
  const filteredIncomeCount = filteredTransactions.filter((transaction) => transaction.kind === 'income').length
  const budgetActualByCategory = useMemo(() => getBudgetActualByCategory(snapshot.transactions, month), [month, snapshot.transactions])
  const transactionsPerPage = 10
  const transactionPageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionsPerPage))
  const currentTransactionPage = Math.min(transactionPage, transactionPageCount)
  const paginatedTransactions = filteredTransactions.slice((currentTransactionPage - 1) * transactionsPerPage, currentTransactionPage * transactionsPerPage)
  const selectedTransactionCount = selectedTransactionIds.length
  const pageTransactionIds = paginatedTransactions.map((transaction) => transaction.id)
  const isCurrentPageSelected = pageTransactionIds.length > 0 && pageTransactionIds.every((id) => selectedTransactionIds.includes(id))

  useEffect(() => {
    setTransactionPage(1)
    setSelectedTransactionIds([])
  }, [categoryFilter, kindFilter, month])

  useEffect(() => {
    if (transactionPage > transactionPageCount) setTransactionPage(transactionPageCount)
  }, [transactionPage, transactionPageCount])

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((current) => current.includes(transactionId)
      ? current.filter((id) => id !== transactionId)
      : [...current, transactionId])
  }

  function toggleCurrentPageSelection() {
    setSelectedTransactionIds((current) => {
      if (isCurrentPageSelected) return current.filter((id) => !pageTransactionIds.includes(id))
      return Array.from(new Set([...current, ...pageTransactionIds]))
    })
  }

  async function confirmTransactionDeletion() {
    setIsDeletingTransactions(true)
    try {
      await onDeleteTransactions(selectedTransactionIds)
      setSelectedTransactionIds([])
      setIsConfirmDeleteOpen(false)
    } finally {
      setIsDeletingTransactions(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">P+</span>
          <strong>Poupa+</strong>
        </div>
        <button aria-label="Criar transação pela navegação" className="sidebar-new-transaction" type="button" onClick={() => setIsTransactionModalOpen(true)}>
          <PlusCircle size={18} />
          <span>Nova transação</span>
        </button>
        <nav className="sidebar-tabs" role="tablist" aria-label="Áreas do app">
          {tabItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                aria-controls={`tab-panel-${item.id}`}
                aria-selected={activeTab === item.id}
                className={activeTab === item.id ? 'active' : ''}
                id={`tab-${item.id}`}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                role="tab"
                type="button"
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <button className="sidebar-account" type="button" onClick={onLogout}>
          <LogOut size={16} />
          <span>{snapshot.user.name}</span>
        </button>
      </aside>

      <section className="workspace tab-workspace">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">{monthLabel}</p>
            <h1>Olá, {snapshot.user.name}</h1>
          </div>
          <div className="topbar-actions">
            <div className="topbar-status">
              <div className={isOnline ? 'status-pill online' : 'status-pill offline'}>
                {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                {isOnline ? 'Online' : 'Offline'}
              </div>
              <div className={`status-pill sync ${syncStatus.state}`}>
                <CircleDollarSign size={16} />
                {syncStatus.message}
              </div>
              <div className="status-pill sync" title="Alteracoes salvas neste dispositivo que ainda precisam ir para a API.">
                <Clock3 size={16} />
                {pendingSync} aguardando sync
              </div>
            </div>
          </div>
        </header>

        <div className="tab-panel" id={`tab-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'dashboard' ? (
            <div className="single-tab dashboard-tab">
              {shouldShowSyncBanner ? (
                <section className={`sync-banner ${syncStatus.state}`} aria-live="polite">
                  <div className="sync-banner-icon">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <strong>{syncStatus.state === 'error' ? 'Sincronização precisa de atenção' : 'Sincronização atualizada'}</strong>
                    <p>{syncStatus.message}. {pendingSync > 0 ? `${pendingSync} item(ns) ainda aguardam envio.` : 'Dados locais e servidor estao alinhados.'}</p>
                  </div>
                </section>
              ) : null}

              <section className="dashboard-page-heading">
                <div>
                  <p className="eyebrow">Dashboard</p>
                  <h2>Resumo financeiro</h2>
                  <p className="muted">Acompanhe saldo, gastos, metas e atividade recente do periodo.</p>
                </div>
                <div className="dashboard-heading-actions">
                  <button className="primary-action new-transaction-action" type="button" onClick={() => setIsTransactionModalOpen(true)}>
                    <PlusCircle size={18} />
                    Nova transação
                  </button>
                  <button className="secondary-action" type="button" onClick={() => setActiveTab('transactions')}>
                    <ReceiptText size={18} />
                    Ver transações
                  </button>
                </div>
              </section>

              <FilterPanel
                categories={snapshot.categories}
                categoryFilter={categoryFilter}
                kindFilter={kindFilter}
                month={month}
                onCategoryFilterChange={setCategoryFilter}
                onKindFilterChange={setKindFilter}
                onMonthChange={setMonth}
              />

              <section className="summary-grid" aria-label="Resumo do mes">
                <article className="metric-card income">
                  <span>Ganhos</span>
                  <strong>{currency.format(summary.income)}</strong>
                </article>
                <article className="metric-card expense">
                  <span>Gastos</span>
                  <strong>{currency.format(summary.expenses)}</strong>
                </article>
                <article className={`metric-card balance ${balanceState}`}>
                  <span>Saldo</span>
                  <strong>{currency.format(summary.balance)}</strong>
                </article>
                <article className="metric-card neutral">
                  <span>Meta Principal</span>
                  <strong>{snapshot.goals[0] ? `${getGoalProgress(snapshot.goals[0])}%` : '0%'}</strong>
                </article>
              </section>

              <div className="tab-grid dashboard-bento-grid">
                <section className="panel span-2">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Transacoes Recentes</p>
                      <h2>Movimentacao do periodo</h2>
                    </div>
                    <ReceiptText size={18} />
                  </div>
                  <TransactionTable transactions={visibleTransactions} categories={snapshot.categories} />
                </section>
                <ChartPanel
                  categoryTotals={categoryTotals}
                  chartMode={chartMode}
                  dailyExpenses={dailyExpenses}
                  dailyExpenseSeries={dailyExpenseSeries}
                  hasDailyExpenses={hasDailyExpenses}
                  onChartModeChange={setChartMode}
                />
                <ProjectionPanel projection={projection.balance} incomes={snapshot.predictableIncomes} />
              </div>
            </div>
          ) : null}
          {activeTab === 'transactions' ? (
            <div className="single-tab transactions-tab">
              <section className="transaction-page-heading">
                <div>
                  <p className="eyebrow">Transações</p>
                  <h2>Controle do período</h2>
                  <p className="muted">Revise, filtre e registre movimentações sem sair do contexto mensal.</p>
                </div>
                <div className="transaction-heading-actions">
                  <button className="primary-action" type="button" onClick={() => setIsTransactionModalOpen(true)}>
                    <PlusCircle size={18} />
                    Nova transação
                  </button>
                  <button className="secondary-action" type="button">
                    <FileSpreadsheet size={18} />
                    Exportar
                  </button>
                </div>
              </section>

              <FilterPanel
                categories={snapshot.categories}
                categoryFilter={categoryFilter}
                kindFilter={kindFilter}
                month={month}
                onCategoryFilterChange={setCategoryFilter}
                onKindFilterChange={setKindFilter}
                onMonthChange={setMonth}
              />

              <section className="transaction-stat-grid" aria-label="Resumo das transações filtradas">
                <article className="transaction-stat-card income">
                  <span>Entradas</span>
                  <strong>{currency.format(summary.income)}</strong>
                  <small>{filteredIncomeCount} registro(s)</small>
                </article>
                <article className="transaction-stat-card expense">
                  <span>Saídas</span>
                  <strong>{currency.format(summary.expenses)}</strong>
                  <small>{filteredExpenseCount} registro(s)</small>
                </article>
                <article className={`transaction-stat-card balance ${balanceState}`}>
                  <span>Resultado</span>
                  <strong>{currency.format(summary.balance)}</strong>
                  <small>{filteredTransactions.length} transação(ões)</small>
                </article>
              </section>

              {selectedTransactionCount > 0 ? (
                <section className="transaction-selection-bar" aria-live="polite">
                  <strong>{selectedTransactionCount} selecionada{selectedTransactionCount === 1 ? '' : 's'}</strong>
                  <div>
                    <button className="secondary-action" type="button" onClick={() => setSelectedTransactionIds([])}>Limpar seleção</button>
                    <button className="danger-action" type="button" onClick={() => setIsConfirmDeleteOpen(true)}>
                      <Trash2 size={17} />
                      Excluir
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="panel transaction-ledger-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Histórico</p>
                    <h2>Transações filtradas</h2>
                  </div>
                  <span className="ledger-count">Página {currentTransactionPage} de {transactionPageCount} • {filteredTransactions.length} itens</span>
                </div>
                <TransactionTable
                  categories={snapshot.categories}
                  isCurrentPageSelected={isCurrentPageSelected}
                  onTogglePageSelection={toggleCurrentPageSelection}
                  onToggleTransactionSelection={toggleTransactionSelection}
                  selectedTransactionIds={selectedTransactionIds}
                  transactions={paginatedTransactions}
                  selectable
                />
                <PaginationControls
                  currentPage={currentTransactionPage}
                  onPageChange={setTransactionPage}
                  pageCount={transactionPageCount}
                />
              </section>
            </div>
          ) : null}


          {activeTab === 'budgets' ? (
            <BudgetPanel
              budgets={snapshot.budgets}
              categories={snapshot.categories}
              actualByCategory={budgetActualByCategory}
              onCreateBudget={() => setBudgetModalState({ mode: 'create' })}
              onDeleteBudget={onDeleteBudget}
              onEditBudget={(budget) => setBudgetModalState({ mode: 'edit', budget })}
            />
          ) : null}
          {activeTab === 'goals' ? (
            <GoalsView
              goals={snapshot.goals}
              nextGoal={nextGoal}
              onCreateGoal={() => setGoalModalState({ mode: 'create' })}
              onDeleteGoal={onDeleteGoal}
              onEditGoal={(goal) => setGoalModalState({ mode: 'edit', goal })}
              overallProgress={overallGoalProgress}
              totalProgress={totalGoalProgress}
              totalTarget={totalGoalTarget}
            />
          ) : null}
          {activeTab === 'sharing' ? <div className="single-tab">{sharingTools}</div> : null}

          {activeTab === 'reports' ? (
            <div className="tab-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Relatorio</p>
                    <h2>Como foi o mês</h2>
                  </div>
                  <Sparkles size={18} />
                </div>
                <p className="report-copy">{insights.narrative}</p>
                <ul className="compact-list">
                  {insights.trends.map((trend) => <li key={trend}>{trend}</li>)}
                  {insights.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
                </ul>
              </section>
              <ChartPanel
                categoryTotals={categoryTotals}
                chartMode={chartMode}
                dailyExpenses={dailyExpenses}
                dailyExpenseSeries={dailyExpenseSeries}
                hasDailyExpenses={hasDailyExpenses}
                onChartModeChange={setChartMode}
              />
              <SyncPanel failedItems={failedItems} pendingItems={pendingItems} />
            </div>
          ) : null}

          {activeTab === 'settings' ? (
            <div className="tab-grid">
              <section className="panel span-2">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Planejamento</p>
                    <h2>Renda previsivel</h2>
                  </div>
                  <Target size={18} />
                </div>
                {planningTools}
              </section>
              <GoalsPanel goals={snapshot.goals} />
              <ProjectionPanel projection={projection.balance} incomes={snapshot.predictableIncomes} />
              <SyncPanel failedItems={failedItems} pendingItems={pendingItems} />
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Sessão</p>
                    <h2>Conta ativa</h2>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <p className="muted">{snapshot.user.email}</p>
                <button className="secondary-action" type="button" onClick={onLogout}>
                  <LogOut size={18} />
                  Sair
                </button>
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {budgetModalState ? (
        <div className="transaction-modal-overlay" role="presentation" onMouseDown={() => setBudgetModalState(null)}>
          <section
            aria-labelledby="budget-modal-title"
            aria-modal="true"
            className="transaction-modal-card budget-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="transaction-modal-header">
              <div>
                <p className="eyebrow">Orçamento</p>
                <h2 id="budget-modal-title">{budgetModalState.mode === 'edit' ? 'Editar orçamento' : 'Novo orçamento'}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar modal" onClick={() => setBudgetModalState(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="transaction-modal-body">
              <BudgetModalForm
                budget={budgetModalState.mode === 'edit' ? budgetModalState.budget : undefined}
                categories={snapshot.categories}
                onCancel={() => setBudgetModalState(null)}
                onSubmit={async (input) => {
                  if (budgetModalState.mode === 'edit') {
                    await onUpdateBudget(budgetModalState.budget.id, input)
                  } else {
                    await onAddBudget(input)
                  }
                  setBudgetModalState(null)
                }}
              />
            </div>
          </section>
        </div>
      ) : null}
      {goalModalState ? (
        <div className="transaction-modal-overlay" role="presentation" onMouseDown={() => setGoalModalState(null)}>
          <section
            aria-labelledby="goal-modal-title"
            aria-modal="true"
            className="transaction-modal-card goal-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="transaction-modal-header">
              <div>
                <p className="eyebrow">Planejamento</p>
                <h2 id="goal-modal-title">{goalModalState.mode === 'edit' ? 'Editar meta' : 'Nova meta'}</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar modal" onClick={() => setGoalModalState(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="transaction-modal-body">
              <GoalModalForm
                goal={goalModalState.mode === 'edit' ? goalModalState.goal : undefined}
                household={household}
                onCancel={() => setGoalModalState(null)}
                onSubmit={async (input) => {
                  if (goalModalState.mode === 'edit') {
                    await onUpdateGoal(goalModalState.goal.id, input)
                  } else {
                    await onAddGoal(input)
                  }
                  setGoalModalState(null)
                }}
              />
            </div>
          </section>
        </div>
      ) : null}

      {isConfirmDeleteOpen ? (
        <div className="transaction-modal-overlay" role="presentation" onMouseDown={() => setIsConfirmDeleteOpen(false)}>
          <section
            aria-labelledby="confirm-delete-transactions-title"
            aria-modal="true"
            className="transaction-modal-card confirm-delete-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="transaction-modal-header">
              <div>
                <p className="eyebrow">Exclusão em lote</p>
                <h2 id="confirm-delete-transactions-title">Excluir transações?</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar modal" onClick={() => setIsConfirmDeleteOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="transaction-modal-body confirm-delete-body">
              <p className="muted">Você está prestes a excluir {selectedTransactionCount} transação{selectedTransactionCount === 1 ? '' : 'ões'}. Essa ação será sincronizada com a API quando houver conexão.</p>
              <div className="modal-footer-actions">
                <button className="secondary-action" disabled={isDeletingTransactions} type="button" onClick={() => setIsConfirmDeleteOpen(false)}>Cancelar</button>
                <button className="danger-action" disabled={isDeletingTransactions} type="button" onClick={confirmTransactionDeletion}>
                  <Trash2 size={17} />
                  {isDeletingTransactions ? 'Excluindo' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isTransactionModalOpen ? (
        <div className="transaction-modal-overlay" role="presentation" onMouseDown={() => setIsTransactionModalOpen(false)}>
          <section
            aria-labelledby="new-transaction-modal-title"
            aria-modal="true"
            className="transaction-modal-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="transaction-modal-header">
              <div>
                <p className="eyebrow">Lançamento manual</p>
                <h2 id="new-transaction-modal-title">Nova transação</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Fechar modal" onClick={() => setIsTransactionModalOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="transaction-modal-body">
              {transactionModal ?? children}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function FilterPanel({
  categories,
  categoryFilter,
  kindFilter,
  month,
  onCategoryFilterChange,
  onKindFilterChange,
  onMonthChange,
}: {
  categories: FinanceSnapshot['categories']
  categoryFilter: string
  kindFilter: KindFilter
  month: string
  onCategoryFilterChange: (value: string) => void
  onKindFilterChange: (value: KindFilter) => void
  onMonthChange: (value: string) => void
}) {
  return (
    <section className="panel filter-panel" aria-label="Filtros gerais">
      <label>
        Mês
        <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value || currentMonth())} />
      </label>
      <label>
        Tipo
        <select value={kindFilter} onChange={(event) => onKindFilterChange(event.target.value as KindFilter)}>
          <option value="all">Tudo</option>
          <option value="income">Ganhos</option>
          <option value="expenses">Todos os gastos</option>
          <option value="fixed_expense">Contas fixas</option>
          <option value="variable_expense">Gastos variáveis</option>
        </select>
      </label>
      <label>
        Categoria
        <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>
          <option value="all">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
    </section>
  )
}

function ChartPanel({
  categoryTotals,
  chartMode,
  dailyExpenses,
  dailyExpenseSeries,
  hasDailyExpenses,
  onChartModeChange,
}: {
  categoryTotals: ReturnType<typeof summarizeExpensesByCategory>
  chartMode: ChartMode
  dailyExpenses: ReturnType<typeof summarizeExpensesByDayAndCategory>['days']
  dailyExpenseSeries: ReturnType<typeof summarizeExpensesByDayAndCategory>['series']
  hasDailyExpenses: boolean
  onChartModeChange: (mode: ChartMode) => void
}) {
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Categorias</p>
          <h2>{chartMode === 'pie' ? 'Distribuição de gastos' : 'Gastos por dia'}</h2>
        </div>
        <div className="segmented" role="group" aria-label="Tipo de gráfico">
          <button className={chartMode === 'pie' ? 'active' : ''} type="button" onClick={() => onChartModeChange('pie')} aria-label="Gráfico de pizza" title="Gráfico de pizza">
            <PieChartIcon size={17} />
          </button>
          <button className={chartMode === 'timeline' ? 'active' : ''} type="button" onClick={() => onChartModeChange('timeline')} aria-label="Gráfico por tempo" title="Gráfico por tempo">
            <LayoutGrid size={17} />
          </button>
        </div>
      </div>

      <div className="chart-area">
        {categoryTotals.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={28} />
            <p>Adicione uma despesa para ver o gráfico.</p>
          </div>
        ) : chartMode === 'pie' ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryTotals} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={96}>
                {categoryTotals.map((entry) => <Cell key={entry.categoryId} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value) => currency.format(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        ) : hasDailyExpenses ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyExpenses} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(value) => currency.format(Number(value)).replace('R$', '')} width={56} />
              <Tooltip labelFormatter={(label) => `Dia ${label}`} formatter={(value, name) => [currency.format(Number(value)), name]} />
              {dailyExpenseSeries.map((series) => (
                <Bar key={series.id} dataKey={series.key} name={series.name} stackId="daily-expenses" fill={series.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <CalendarDays size={28} />
            <p>Nenhum gasto no período filtrado.</p>
          </div>
        )}
      </div>

      <ul className="category-list">
        {categoryTotals.map((category) => (
          <li key={category.categoryId}>
            <span style={{ background: category.color }} />
            {category.name}
            <strong>{currency.format(category.amount)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TransactionTable({
  categories,
  isCurrentPageSelected = false,
  onTogglePageSelection,
  onToggleTransactionSelection,
  selectedTransactionIds = [],
  selectable = false,
  transactions,
}: {
  categories: FinanceSnapshot['categories']
  isCurrentPageSelected?: boolean
  onTogglePageSelection?: () => void
  onToggleTransactionSelection?: (transactionId: string) => void
  selectedTransactionIds?: string[]
  selectable?: boolean
  transactions: FinanceSnapshot['transactions']
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))

  if (transactions.length === 0) {
    return <p className="muted">Nenhuma transação no período filtrado.</p>
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="select-column">
                <input
                  aria-label="Selecionar transações da página"
                  checked={isCurrentPageSelected}
                  type="checkbox"
                  onChange={onTogglePageSelection}
                />
              </th>
            ) : null}
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const category = transaction.categoryId ? categoryById.get(transaction.categoryId) : null
            const isIncome = transaction.kind === 'income'
            const transactionKindLabel = {
              income: 'Receita',
              fixed_expense: 'Conta fixa',
              variable_expense: 'Variável',
            }[transaction.kind]
            return (
              <tr key={transaction.id} data-selected={selectedTransactionIds.includes(transaction.id) || undefined}>
                {selectable ? (
                  <td className="select-column">
                    <input
                      aria-label={`Selecionar ${transaction.description}`}
                      checked={selectedTransactionIds.includes(transaction.id)}
                      type="checkbox"
                      onChange={() => onToggleTransactionSelection?.(transaction.id)}
                    />
                  </td>
                ) : null}
                <td>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${transaction.occurredAt}T00:00:00`))}</td>
                <td>
                  <span className={`transaction-description-cell ${isIncome ? 'income' : 'expense'}`}>
                    <span className="transaction-row-icon" aria-hidden="true">
                      <ReceiptText size={17} />
                    </span>
                    <span>
                      <strong className="transaction-description">{transaction.description}</strong>
                      <small className="transaction-kind-label">{transactionKindLabel}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="transaction-category-cell">
                    <span
                      className="color-swatch"
                      style={{ background: category?.color ?? (isIncome ? '#2ecc71' : '#d3e4fe') }}
                    />
                    {category?.name ?? (isIncome ? 'Receita' : 'Sem categoria')}
                  </span>
                </td>
                <td><span className="table-status">Confirmada</span></td>
                <td className={isIncome ? 'amount-positive' : 'amount-negative'}>{isIncome ? '+' : '-'} {currency.format(transaction.amount)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PaginationControls({
  currentPage,
  onPageChange,
  pageCount,
}: {
  currentPage: number
  onPageChange: (page: number) => void
  pageCount: number
}) {
  if (pageCount <= 1) return null

  return (
    <nav className="pagination-controls" aria-label="Paginação de transações">
      <button className="secondary-action" disabled={currentPage === 1} type="button" onClick={() => onPageChange(currentPage - 1)}>
        Anterior
      </button>
      <span>Página {currentPage} de {pageCount}</span>
      <button className="secondary-action" disabled={currentPage === pageCount} type="button" onClick={() => onPageChange(currentPage + 1)}>
        Próxima
      </button>
    </nav>
  )
}

const budgetPresets = [
  { id: 'essential', label: 'Essencial', percentage: 50, helper: 'Moradia, mercado e contas' },
  { id: 'lifestyle', label: 'Estilo de vida', percentage: 30, helper: 'Lazer, compras e rotina' },
  { id: 'reserve', label: 'Reserva', percentage: 20, helper: 'Segurança e objetivos' },
] as const

function roundBudgetAmount(amount: number) {
  return Math.round(amount * 100) / 100
}

function getBudgetKind(budget: Partial<FinanceSnapshot['budgets'][number]>): 'income' | 'expense' {
  return budget.budgetKind === 'income' ? 'income' : 'expense'
}

function getBudgetMonthlyAmount(budget: Partial<FinanceSnapshot['budgets'][number]>) {
  return budget.monthlyAmount && budget.monthlyAmount > 0 ? budget.monthlyAmount : budget.limitAmount ?? 0
}

function getBudgetActualKey(kind: 'income' | 'expense', categoryId: string) {
  return `${kind}:${categoryId}`
}

function getBudgetActualByCategory(transactions: FinanceSnapshot['transactions'], month: string) {
  return transactions
    .filter((transaction) => transaction.occurredAt.startsWith(month) && transaction.categoryId)
    .reduce((totals, transaction) => {
      const kind = transaction.kind === 'income' ? 'income' : 'expense'
      const categoryId = transaction.categoryId as string
      const key = getBudgetActualKey(kind, categoryId)
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount)
      return totals
    }, new Map<string, number>())
}

function getBudgetHealth(spent: number, limit: number) {
  const ratio = limit > 0 ? spent / limit : 0
  if (ratio >= 0.9) return 'danger'
  if (ratio >= 0.7) return 'warning'
  return 'safe'
}

function BudgetPanel({
  actualByCategory,
  budgets,
  categories,
  onCreateBudget,
  onDeleteBudget,
  onEditBudget,
}: {
  actualByCategory: Map<string, number>
  budgets: FinanceSnapshot['budgets']
  categories: FinanceSnapshot['categories']
  onCreateBudget: () => void
  onDeleteBudget: (budgetId: string) => Promise<void>
  onEditBudget: (budget: FinanceSnapshot['budgets'][number]) => void
}) {
  const totals = budgets.reduce((acc, budget) => {
    const kind = getBudgetKind(budget)
    const actual = actualByCategory.get(getBudgetActualKey(kind, budget.categoryId)) ?? 0
    acc[kind].limit += budget.limitAmount
    acc[kind].actual += actual
    if (actual > budget.limitAmount) acc.overBudget += 1
    return acc
  }, {
    expense: { actual: 0, limit: 0 },
    income: { actual: 0, limit: 0 },
    overBudget: 0,
  })
  const overallLimit = totals.expense.limit + totals.income.limit
  const overallActual = totals.expense.actual + totals.income.actual
  const overallProgress = overallLimit > 0 ? Math.round((overallActual / overallLimit) * 100) : 0

  return (
    <section className="budget-page-shell budget-goals-skin" aria-labelledby="budgets-title">
      <section className="goals-page-heading budget-page-heading">
        <div>
          <p className="eyebrow">Orçamento</p>
          <h2 id="budgets-title">Orçamento mensal</h2>
          <p className="muted">Configure limites mensais para ganhos e despesas por porcentagem ou valor fixo.</p>
        </div>
        <button className="primary-action" type="button" onClick={onCreateBudget}>
          <PlusCircle size={18} />
          Novo orçamento
        </button>
      </section>

      <section className="goals-summary-grid budget-summary-grid" aria-label="Resumo dos orçamentos">
        <article className="goal-summary-card primary">
          <span>Despesas planejadas</span>
          <strong>{currency.format(totals.expense.limit)}</strong>
          <small>{currency.format(totals.expense.actual)} usado no mês</small>
        </article>
        <article className="goal-summary-card milestone">
          <span>Ganhos planejados</span>
          <strong>{currency.format(totals.income.limit)}</strong>
          <small>{currency.format(totals.income.actual)} realizado no mês</small>
        </article>
        <article className="goal-summary-card">
          <span>Uso geral</span>
          <strong>{overallProgress}%</strong>
          <small>{totals.overBudget} alerta(s)</small>
        </article>
      </section>

      {budgets.length === 0 ? (
        <button className="budget-add-category-card is-empty" type="button" onClick={onCreateBudget}>
          <PlusCircle size={32} />
          <strong>Adicionar orçamento</strong>
          <span>Crie categorias para ganhos ou despesas sem ultrapassar o valor mensal configurado.</span>
        </button>
      ) : (
        <section className="goals-grid budget-goal-grid" aria-label="Lista de orçamentos">
          {budgets.map((budget) => {
            const kind = getBudgetKind(budget)
            return (
              <BudgetCard
                budget={budget}
                category={categories.find((category) => category.id === budget.categoryId)}
                key={budget.id}
                onDeleteBudget={onDeleteBudget}
                onEditBudget={onEditBudget}
                actual={actualByCategory.get(getBudgetActualKey(kind, budget.categoryId)) ?? 0}
              />
            )
          })}
          <button className="budget-add-goal-card" type="button" onClick={onCreateBudget}>
            <PlusCircle size={32} />
            <strong>Novo orçamento</strong>
            <span>Adicionar categoria</span>
          </button>
        </section>
      )}
    </section>
  )
}

function BudgetCard({
  actual,
  budget,
  category,
  onDeleteBudget,
  onEditBudget,
}: {
  actual: number
  budget: FinanceSnapshot['budgets'][number]
  category?: FinanceSnapshot['categories'][number]
  onDeleteBudget: (budgetId: string) => Promise<void>
  onEditBudget: (budget: FinanceSnapshot['budgets'][number]) => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const rawProgress = budget.limitAmount > 0 ? Math.round((actual / budget.limitAmount) * 100) : 0
  const progress = Math.min(100, rawProgress)
  const overLimit = actual > budget.limitAmount
  const remaining = budget.limitAmount - actual
  const kind = getBudgetKind(budget)
  const monthlyAmount = getBudgetMonthlyAmount(budget)
  const modeLabel = budget.allocationMode === 'percentage'
    ? `${budget.allocationValue}% de ${currency.format(monthlyAmount)}`
    : budget.allocationMode === 'fixed'
      ? `${currency.format(budget.allocationValue)} fixo`
      : budgetPresets.find((preset) => preset.id === budget.preset)?.label ?? 'Predefinido'

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await onDeleteBudget(budget.id)
    } finally {
      setIsDeleting(false)
      setIsMenuOpen(false)
    }
  }

  return (
    <article className="goal-card budget-goal-card" data-kind={kind} data-over-limit={overLimit ? 'true' : undefined}>
      {overLimit ? <span className="budget-over-limit-badge">Acima do limite</span> : null}
      <div className="goal-card-header budget-goal-header">
        <div className="goal-card-title-wrap">
          <div className="goal-icon-wrap budget-icon-wrap" style={{ color: category?.color ?? budget.color }}>
            <CircleDollarSign size={20} />
          </div>
          <div>
            <h3>{budget.name}</h3>
            <p>{kind === 'income' ? 'Ganhos' : 'Despesas'} · {modeLabel}</p>
          </div>
        </div>
        <div className="goal-menu-wrap">
          <button
            aria-expanded={isMenuOpen}
            aria-label={`Ações do orçamento ${budget.name}`}
            className="icon-button goal-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <MoreVertical size={18} />
          </button>
          {isMenuOpen ? (
            <div className="goal-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onEditBudget(budget) }}>
                <Pencil size={15} />
                Editar
              </button>
              <button className="danger" disabled={isDeleting} type="button" role="menuitem" onClick={handleDelete}>
                <Trash2 size={15} />
                {isDeleting ? 'Excluindo' : 'Excluir'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="goal-card-body budget-goal-body">
        <div className="goal-progress-ring budget-goal-ring" style={{ ['--progress' as string]: `${progress}%` }} aria-label={`${rawProgress}% realizado`}>
          <span>{rawProgress}%</span>
        </div>
        <div className="goal-values budget-goal-values">
          <div>
            <span>{kind === 'income' ? 'Realizado' : 'Usado'}</span>
            <strong>{currency.format(actual)}</strong>
          </div>
          <div>
            <span>Limite</span>
            <strong>{currency.format(budget.limitAmount)}</strong>
          </div>
        </div>
      </div>

      <div className="goal-linear-progress budget-goal-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="goal-card-footer budget-goal-footer">
        <span>{remaining >= 0 ? `${currency.format(remaining)} disponível` : `${currency.format(Math.abs(remaining))} excedido`}</span>
        <strong>{budget.isAutomatic ? 'Automático' : 'Manual'}</strong>
      </div>
    </article>
  )
}
function BudgetModalForm({
  budget,
  categories,
  onCancel,
  onSubmit,
}: {
  budget?: FinanceSnapshot['budgets'][number]
  categories: FinanceSnapshot['categories']
  onCancel: () => void
  onSubmit: (input: BudgetInput) => Promise<void>
}) {
  const [categoryMode, setCategoryMode] = useState<'new' | 'existing'>(budget ? 'existing' : 'new')
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? categories[0]?.id ?? '')
  const [categoryName, setCategoryName] = useState(budget?.name ?? '')
  const [color, setColor] = useState(budget?.color ?? '#176b5b')
  const [budgetKind, setBudgetKind] = useState<BudgetInput['budgetKind']>(getBudgetKind(budget ?? {}))
  const [monthlyAmount, setMonthlyAmount] = useState(formatCurrencyInput(getBudgetMonthlyAmount(budget ?? { limitAmount: 0 })))
  const [allocationMode, setAllocationMode] = useState<BudgetInput['allocationMode']>(budget?.allocationMode ?? 'percentage')
  const [allocationValue, setAllocationValue] = useState(budget ? (budget.allocationMode === 'fixed' ? formatCurrencyInput(budget.allocationValue) : String(budget.allocationValue)) : '50')
  const [preset, setPreset] = useState<BudgetInput['preset']>(budget?.preset ?? 'essential')
  const [isAutomatic, setIsAutomatic] = useState(budget?.isAutomatic ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const selectedCategory = categories.find((category) => category.id === categoryId)
  const parsedMonthlyAmount = parseCurrencyInput(monthlyAmount)
  const parsedAllocation = allocationMode === 'percentage' || allocationMode === 'preset' ? Number(allocationValue.replace(',', '.')) : parseCurrencyInput(allocationValue)
  const computedLimit = allocationMode === 'percentage' || allocationMode === 'preset'
    ? roundBudgetAmount((parsedMonthlyAmount * parsedAllocation) / 100)
    : roundBudgetAmount(parsedAllocation)

  function applyPreset(nextPreset: BudgetInput['preset']) {
    setPreset(nextPreset)
    setAllocationMode('preset')
    const found = budgetPresets.find((item) => item.id === nextPreset)
    if (found) setAllocationValue(String(found.percentage))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: BudgetInput = {
      categoryId: categoryMode === 'existing' ? categoryId || undefined : undefined,
      categoryName: categoryMode === 'existing' ? selectedCategory?.name ?? categoryName : categoryName,
      color: categoryMode === 'existing' ? selectedCategory?.color ?? color : color,
      budgetKind,
      monthlyAmount: parsedMonthlyAmount,
      limitAmount: computedLimit,
      allocationMode,
      allocationValue: parsedAllocation,
      preset: allocationMode === 'preset' ? preset : 'custom',
      isAutomatic,
    }
    const validation = validateBudgetInput(input)

    if (validation) {
      setError(validation)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSubmit(input)
    } catch {
      setError('Não foi possível salvar o orçamento agora.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="budget-modal-form" onSubmit={handleSubmit}>
      <div className="budget-category-mode" role="group" aria-label="Tipo de orçamento">
        <button className={budgetKind === 'expense' ? 'active' : ''} type="button" onClick={() => setBudgetKind('expense')}>Despesas</button>
        <button className={budgetKind === 'income' ? 'active' : ''} type="button" onClick={() => setBudgetKind('income')}>Ganhos</button>
      </div>

      <label>
        Valor mensal
        <input inputMode="decimal" value={monthlyAmount} onChange={(event) => setMonthlyAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
      </label>
      <label className="toggle-line">
        <input type="checkbox" checked={isAutomatic} onChange={(event) => setIsAutomatic(event.target.checked)} />
        Ativar orçamento automático
      </label>

      <div className="modal-kind-grid budget-mode-grid" role="group" aria-label="Tipo de distribuição">
        <button className={allocationMode === 'percentage' ? 'active' : ''} type="button" onClick={() => setAllocationMode('percentage')}>Porcentagem</button>
        <button className={allocationMode === 'fixed' ? 'active' : ''} type="button" onClick={() => setAllocationMode('fixed')}>Valor fixo</button>
        <button className={allocationMode === 'preset' ? 'active' : ''} type="button" onClick={() => applyPreset(preset)}>Predefinido</button>
      </div>

      {allocationMode === 'preset' ? (
        <div className="budget-preset-grid">
          {budgetPresets.map((item) => (
            <button className={preset === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => applyPreset(item.id)}>
              <strong>{item.label}</strong>
              <span>{item.percentage}%</span>
              <small>{item.helper}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="form-row goal-modal-amount-grid">
        <label>
          {allocationMode === 'fixed' ? 'Valor fixo da categoria' : 'Porcentagem do valor mensal'}
          <input
            inputMode="decimal"
            value={allocationValue}
            onChange={(event) => setAllocationValue(allocationMode === 'fixed' ? maskCurrencyInput(event.target.value) : event.target.value.replace(/[^0-9,]/g, ''))}
            placeholder={allocationMode === 'fixed' ? '0,00' : '50'}
          />
        </label>
        <div className="budget-computed-limit" aria-live="polite">
          <span>Limite calculado</span>
          <strong>{currency.format(computedLimit)}</strong>
          <small>Não pode exceder {currency.format(parsedMonthlyAmount)}</small>
        </div>
      </div>

      <div className="budget-category-mode" role="group" aria-label="Origem da categoria">
        <button className={categoryMode === 'new' ? 'active' : ''} type="button" onClick={() => setCategoryMode('new')}>Nova categoria</button>
        <button className={categoryMode === 'existing' ? 'active' : ''} type="button" onClick={() => setCategoryMode('existing')}>Usar existente</button>
      </div>

      {categoryMode === 'existing' ? (
        <label>
          Categoria
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
      ) : (
        <div className="form-row goal-modal-amount-grid">
          <label>
            Nome da categoria
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: mercado" />
          </label>
          <label>
            Cor
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
        </div>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="modal-footer-actions">
        <button className="secondary-action" type="button" onClick={onCancel}>Cancelar</button>
        <button className="primary-action" disabled={isSaving} type="submit">{isSaving ? 'Salvando' : budget ? 'Salvar alterações' : 'Salvar orçamento'}</button>
      </div>
    </form>
  )
}
function GoalsView({
  goals,
  nextGoal,
  onCreateGoal,
  onDeleteGoal,
  onEditGoal,
  overallProgress,
  totalProgress,
  totalTarget,
}: {
  goals: FinanceSnapshot['goals']
  nextGoal?: FinanceSnapshot['goals'][number]
  onCreateGoal: () => void
  onDeleteGoal: (goalId: string) => Promise<void>
  onEditGoal: (goal: FinanceSnapshot['goals'][number]) => void
  overallProgress: number
  totalProgress: number
  totalTarget: number
}) {
  const completedGoals = goals.filter((goal) => getGoalProgress(goal) >= 100).length
  const activeGoals = goals.length - completedGoals

  return (
    <div className="single-tab goals-tab">
      <section className="goals-page-heading">
        <div>
          <p className="eyebrow">Metas</p>
          <h2>Objetivos financeiros</h2>
          <p className="muted">Acompanhe reservas, dividas e marcos importantes em um unico painel.</p>
        </div>
        <button className="primary-action" type="button" onClick={onCreateGoal}>
          <PlusCircle size={18} />
          Nova meta
        </button>
      </section>

      <section className="goals-summary-grid" aria-label="Resumo das metas">
        <article className="goal-summary-card primary">
          <span>Total acumulado</span>
          <strong>{currency.format(totalProgress)}</strong>
          <small>{overallProgress}% do alvo consolidado</small>
        </article>
        <article className="goal-summary-card">
          <span>Metas ativas</span>
          <strong>{activeGoals}</strong>
          <small>{completedGoals} concluida(s)</small>
        </article>
        <article className="goal-summary-card milestone">
          <span>Proximo marco</span>
          <strong>{nextGoal?.name ?? 'Crie uma meta'}</strong>
          <small>{nextGoal ? `${getGoalProgress(nextGoal)}% completo` : 'Sem objetivo cadastrado'}</small>
        </article>
      </section>

      {goals.length === 0 ? (
        <section className="panel goals-empty-state">
          <Target size={30} />
          <h3>Nenhuma meta cadastrada</h3>
          <p className="muted">Crie uma meta para acompanhar progresso, alvo e valor restante.</p>
          <button className="primary-action" type="button" onClick={onCreateGoal}>Criar primeira meta</button>
        </section>
      ) : (
        <section className="goals-grid" aria-label="Lista de metas">
          {goals.map((goal) => (
            <GoalCard goal={goal} key={goal.id} onDeleteGoal={onDeleteGoal} onEditGoal={onEditGoal} />
          ))}
        </section>
      )}
    </div>
  )
}

function GoalCard({
  goal,
  onDeleteGoal,
  onEditGoal,
}: {
  goal: FinanceSnapshot['goals'][number]
  onDeleteGoal: (goalId: string) => Promise<void>
  onEditGoal: (goal: FinanceSnapshot['goals'][number]) => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const progress = getGoalProgress(goal)
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const isDebt = goal.kind === 'debt'
  const stroke = `${Math.min(100, progress)}%`

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await onDeleteGoal(goal.id)
    } finally {
      setIsDeleting(false)
      setIsMenuOpen(false)
    }
  }

  return (
    <article className={`goal-card ${isDebt ? 'debt' : 'saving'}`}>
      <div className="goal-card-header">
        <div className="goal-card-title-wrap">
          <div className="goal-icon-wrap">
            <Target size={20} />
          </div>
          <div>
            <h3>{goal.name}</h3>
            <p>{isDebt ? 'Pagamento de divida' : 'Reserva e objetivo'}</p>
          </div>
        </div>
        <div className="goal-menu-wrap">
          <button
            aria-expanded={isMenuOpen}
            aria-label={`Acoes da meta ${goal.name}`}
            className="icon-button goal-menu-button"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <MoreVertical size={18} />
          </button>
          {isMenuOpen ? (
            <div className="goal-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setIsMenuOpen(false); onEditGoal(goal) }}>
                <Pencil size={15} />
                Editar
              </button>
              <button className="danger" disabled={isDeleting} type="button" role="menuitem" onClick={handleDelete}>
                <Trash2 size={15} />
                {isDeleting ? 'Excluindo' : 'Excluir'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="goal-card-body">
        <div className="goal-progress-ring" style={{ ['--progress' as string]: stroke }} aria-label={`${progress}% completo`}>
          <span>{progress}%</span>
        </div>
        <div className="goal-values">
          <div>
            <span>{isDebt ? 'Pago' : 'Guardado'}</span>
            <strong>{currency.format(goal.currentAmount)}</strong>
          </div>
          <div>
            <span>Alvo</span>
            <strong>{currency.format(goal.targetAmount)}</strong>
          </div>
        </div>
      </div>

      <div className="goal-linear-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, progress)}%` }} />
      </div>

      <div className="goal-card-footer">
        <span>{currency.format(remaining)} restante</span>
        <strong>{progress >= 100 ? 'Concluida' : 'Em andamento'}</strong>
      </div>
    </article>
  )
}

function GoalModalForm({
  goal,
  household,
  onCancel,
  onSubmit,
}: {
  goal?: FinanceSnapshot['goals'][number]
  household?: FinanceSnapshot['household']
  onCancel: () => void
  onSubmit: (input: GoalInput) => Promise<void>
}) {
  const [kind, setKind] = useState<GoalInput['kind']>(goal?.kind ?? 'saving')
  const [name, setName] = useState(goal?.name ?? '')
  const [targetAmount, setTargetAmount] = useState(formatCurrencyInput(goal?.targetAmount ?? 0))
  const [currentAmount, setCurrentAmount] = useState(formatCurrencyInput(goal?.currentAmount ?? 0) || '0')
  const [shareWithHousehold, setShareWithHousehold] = useState(Boolean(goal?.householdId))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const parsedTarget = parseCurrencyInput(targetAmount)
  const parsedCurrent = parseCurrencyInput(currentAmount)
  const previewProgress = parsedTarget > 0 ? Math.min(100, Math.round((parsedCurrent / parsedTarget) * 100)) : 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input: GoalInput = {
      kind,
      name,
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      householdId: shareWithHousehold ? household?.id : undefined,
    }
    const validation = validateGoalInput(input)

    if (validation) {
      setError(validation)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onSubmit(input)
    } catch {
      setError('Nao foi possivel salvar a meta agora.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="goal-modal-form" onSubmit={handleSubmit}>
      <div className="modal-kind-grid goal-kind-grid" role="group" aria-label="Tipo de meta">
        <button className={kind === 'saving' ? 'active' : ''} type="button" onClick={() => setKind('saving')}>
          <Target size={17} />
          Juntar dinheiro
        </button>
        <button className={kind === 'debt' ? 'active' : ''} type="button" onClick={() => setKind('debt')}>
          <Trash2 size={17} />
          Pagar divida
        </button>
      </div>

      <div className={`modal-amount-panel ${kind === 'debt' ? 'expense' : 'income'}`}>
        <span>Progresso estimado</span>
        <output>{previewProgress}%</output>
      </div>

      <label>
        Nome da meta
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === 'saving' ? 'Ex.: reserva de emergencia' : 'Ex.: quitar cartao'} />
      </label>

      <div className="form-row goal-modal-amount-grid">
        <label>
          {kind === 'saving' ? 'Valor alvo' : 'Valor da divida'}
          <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
        </label>
        <label>
          {kind === 'saving' ? 'Ja guardado' : 'Ja pago'}
          <input inputMode="decimal" value={currentAmount} onChange={(event) => setCurrentAmount(maskCurrencyInput(event.target.value))} placeholder="0,00" />
        </label>
      </div>

      {household ? (
        <label className="checkbox-field">
          <input type="checkbox" checked={shareWithHousehold} onChange={(event) => setShareWithHousehold(event.target.checked)} />
          Compartilhar com grupo
        </label>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="modal-footer-actions">
        <button className="secondary-action" type="button" onClick={onCancel}>Cancelar</button>
        <button className="primary-action" disabled={isSaving} type="submit">{isSaving ? 'Salvando' : goal ? 'Salvar alteracoes' : 'Salvar meta'}</button>
      </div>
    </form>
  )
}

function GoalsPanel({ goals }: { goals: FinanceSnapshot['goals'] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Metas</p>
          <h2>Objetivos</h2>
        </div>
        <Target size={20} />
      </div>
      {goals.length === 0 ? (
        <p className="muted">Crie uma meta para acompanhar progresso.</p>
      ) : (
        goals.map((goal) => (
          <div className="goal-row" key={goal.id}>
            <span>{goal.name}</span>
            <strong>{getGoalProgress(goal)}%</strong>
          </div>
        ))
      )}
    </section>
  )
}

function ProjectionPanel({
  incomes,
  projection,
}: {
  incomes: FinanceSnapshot['predictableIncomes']
  projection: number
}) {
  return (
    <section className="panel projection-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Projeção</p>
          <h2>Próximo mês</h2>
        </div>
        <PieChartIcon size={18} />
      </div>
      <p className="projection-value">{currency.format(projection)}</p>
      <p className="muted">Estimativa com rendas previsíveis e contas fixas registradas.</p>
      {incomes.length > 0 ? (
        <ul className="compact-list">
          {incomes.map((income) => (
            <li key={income.id}>
              {income.description}
              <strong>{currency.format(income.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function SyncPanel({
  failedItems,
  pendingItems,
}: {
  failedItems: SyncQueueItem[]
  pendingItems: SyncQueueItem[]
}) {
  return (
    <section className="panel sync-details-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Sincronização</p>
          <h2>Fila local</h2>
        </div>
      </div>
      {pendingItems.length === 0 && failedItems.length === 0 ? (
        <p className="muted">Nada pendente para sincronizar.</p>
      ) : (
        <ul className="compact-list sync-list">
          {[...pendingItems, ...failedItems].slice(0, 6).map((item) => (
            <li key={item.id}>
              <span>{formatSyncItem(item)}</span>
              <strong>{item.status === 'pending' ? 'Pendente' : 'Falhou'}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatSyncItem(item: SyncQueueItem) {
  const entity = {
    transaction: 'Lançamento',
    category: 'Categoria',
    goal: 'Meta',
    budget: 'Orcamento',
    predictable_income: 'Renda previsível',
    household: 'Grupo',
    household_member: 'Membro',
  }[item.entity]
  return `${entity} - ${item.operation}`
}















