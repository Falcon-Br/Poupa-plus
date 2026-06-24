import { FileSpreadsheet, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Category, Transaction } from '../../domain/types'
import {
  buildImportCandidates,
  parseStatementCsv,
  type StatementImportCandidate,
} from './statementImport'

interface StatementImportPanelProps {
  categories: Category[]
  transactions: Transaction[]
  onImport: (candidates: StatementImportCandidate[]) => Promise<void>
}

const exampleCsv = `data,descrição,valor\n2026-06-10,Uber centro,-18.50\n2026-06-11,Salario,5000`

export function StatementImportPanel({ categories, transactions, onImport }: StatementImportPanelProps) {
  const [csv, setCsv] = useState(exampleCsv)
  const [message, setMessage] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const rows = useMemo(() => parseStatementCsv(csv), [csv])
  const candidates = useMemo(
    () => buildImportCandidates(rows, categories, transactions),
    [categories, rows, transactions],
  )
  const importableCount = candidates.filter((candidate) => !candidate.duplicate).length

  async function handleImport() {
    setIsImporting(true)
    setMessage(null)

    try {
      await onImport(candidates)
      setMessage(`${importableCount} lançamento${importableCount === 1 ? '' : 's'} importado${importableCount === 1 ? '' : 's'}.`)
    } catch {
      setMessage('Não foi possível importar agora.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="panel import-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Importação</p>
          <h2>Extrato CSV</h2>
        </div>
        <FileSpreadsheet size={20} />
      </div>

      <div className="import-grid">
        <label>
          Dados do extrato
          <textarea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            spellCheck={false}
            rows={8}
          />
        </label>

        <div className="import-preview" aria-live="polite">
          <div className="preview-summary">
            <strong>{candidates.length} linha{candidates.length === 1 ? '' : 's'} lida{candidates.length === 1 ? '' : 's'}</strong>
            <span>{importableCount} nova{importableCount === 1 ? '' : 's'}</span>
          </div>

          {candidates.length === 0 ? (
            <p className="muted">Cole um CSV com colunas data, descrição e valor.</p>
          ) : (
            <ul className="compact-list import-list">
              {candidates.slice(0, 6).map((candidate, index) => (
                <li key={`${candidate.occurredAt}-${candidate.description}-${index}`}>
                  <span>
                    {candidate.description}
                    <small>
                      {candidate.occurredAt} · {candidate.kind === 'income' ? 'Ganho' : 'Gasto'}
                    </small>
                  </span>
                  <strong className={candidate.duplicate ? 'duplicate-tag' : ''}>
                    {candidate.duplicate ? 'Duplicado' : candidate.categoryId ? 'Classificado' : 'Novo'}
                  </strong>
                </li>
              ))}
            </ul>
          )}

          {message ? <p className="form-success">{message}</p> : null}

          <button
            className="primary-action"
            type="button"
            disabled={isImporting || importableCount === 0}
            onClick={handleImport}
          >
            <Upload size={18} aria-hidden="true" />
            Importar novos
          </button>
        </div>
      </div>
    </section>
  )
}