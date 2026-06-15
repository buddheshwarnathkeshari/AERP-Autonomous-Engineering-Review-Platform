import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Loader, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import ApprovalInterface from './ApprovalInterface'
import FindingsViewer from './FindingsViewer'

const API_BASE = ''

const STATUS_LABELS = {
  queued: 'Queued',
  running: 'Running Agents',
  collecting: 'Collecting PR Info',
  analyzing: 'Analyzing Code',
  reviewing: 'Reviewing Findings',
  consensus: 'Building Consensus',
  awaiting_human: 'Awaiting Approval',
  paused_for_review: 'Awaiting Approval',
  resuming: 'Resuming Workflow',
  complete: 'Completed',
  failed: 'Failed',
}

const ACTIVE_STATUSES = new Set([
  'queued', 'running', 'collecting', 'analyzing', 'reviewing', 'consensus', 'resuming'
])

export default function ReviewDashboard() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const prUrl = searchParams.get('pr_url') || ''
  
  const [review, setReview] = useState(null)
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/reviews/${id}/status`)
      setReview(res.data)
      
      // If complete, also fetch findings
      if (res.data.status === 'complete') {
        const findRes = await axios.get(`${API_BASE}/reviews/${id}/findings`)
        setFindings(findRes.data.findings || [])
      }
      setError('')
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.detail || 'Failed to load review.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Poll every 5 seconds while actively processing
  useEffect(() => {
    if (!review) return
    if (!ACTIVE_STATUSES.has(review.status)) return

    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [review?.status, fetchStatus])

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ flex: 1, marginTop: '20vh' }}>
        <div className="flex-col items-center gap-4 text-center">
          <Loader size={48} color="var(--accent-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
          <p>Loading review...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ marginTop: '2rem', borderColor: 'var(--accent-danger)' }}>
        <h3 style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle /> Error
        </h3>
        <p style={{ margin: '0.5rem 0 0 0' }}>{error}</p>
      </div>
    )
  }

  if (!review) return null

  const isHITL = ['awaiting_human', 'paused_for_review'].includes(review.status)

  if (isHITL) {
    return <ApprovalInterface reviewId={id} prUrl={prUrl} review={review} onApproved={fetchStatus} />
  }

  return (
    <div className="flex-col gap-6" style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div className="glass-panel animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 style={{ margin: 0 }}>Review</h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{id}</p>
          </div>
          <StatusBadge status={review.status} />
        </div>
        
        <div className="flex gap-6" style={{ fontSize: '0.875rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>PR: </span>
            {prUrl ? (
              <a href={prUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                {prUrl.replace('https://github.com/', '')}
              </a>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Started: </span>
            {new Date(review.created_at).toLocaleString()}
          </div>
          {review.risk_score != null && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Risk Score: </span>
              <strong style={{ color: review.risk_score > 60 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                {review.risk_score}/100
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Active: Show spinner */}
      {ACTIVE_STATUSES.has(review.status) && (
        <div className="glass-panel flex-col items-center justify-center animate-pulse" style={{ padding: '4rem', textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '1.5rem' }}>
            <Loader size={56} color="var(--accent-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
          </div>
          <h3 style={{ margin: 0 }}>{STATUS_LABELS[review.status] || 'Processing...'}</h3>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
            AI agents are analyzing your PR. This typically takes 2–5 minutes.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {['Collecting', 'Analyzing', 'Reviewing', 'Consensus'].map((step, i) => (
              <div key={step} style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                background: i < 2 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: i < 2 ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: `1px solid ${i < 2 ? 'rgba(59,130,246,0.4)' : 'var(--border-color)'}`,
              }}>{step}</div>
            ))}
          </div>
        </div>
      )}

      {/* Complete: Show results */}
      {review.status === 'complete' && (
        <div className="flex-col gap-6 animate-slide-up">
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle size={24} color="var(--accent-success)" />
                <h3 style={{ margin: 0 }}>Review Complete</h3>
              </div>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                Recommendation: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  {(review.recommendation || 'N/A').replace(/_/g, ' ')}
                </strong>
              </p>
            </div>
            {review.risk_score != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '2.5rem', fontWeight: 800, lineHeight: 1,
                  color: review.risk_score > 60 ? 'var(--accent-danger)' : review.risk_score > 30 ? 'var(--accent-warning)' : 'var(--accent-success)'
                }}>
                  {review.risk_score}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Risk Score / 100
                </div>
              </div>
            )}
          </div>

          <h3>Agent Findings ({findings.length})</h3>
          <FindingsViewer findings={findings} />
        </div>
      )}

      {review.status === 'failed' && (
        <div className="glass-panel" style={{ borderColor: 'var(--accent-danger)' }}>
          <h3 style={{ color: 'var(--accent-danger)' }}>Review Failed</h3>
          <p style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{review.error || 'An unknown error occurred.'}</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    queued: ['badge-pending', 'Queued'],
    running: ['badge-running', 'Running'],
    collecting: ['badge-running', 'Collecting'],
    analyzing: ['badge-running', 'Analyzing'],
    reviewing: ['badge-running', 'Reviewing'],
    consensus: ['badge-running', 'Consensus'],
    awaiting_human: ['badge-paused', 'Needs Approval'],
    paused_for_review: ['badge-paused', 'Needs Approval'],
    resuming: ['badge-running', 'Resuming'],
    complete: ['badge-complete', 'Complete'],
    failed: ['badge-paused', 'Failed'],
  }
  const [cls, label] = map[status] || ['badge-pending', status]
  return <span className={`badge ${cls}`}>{label}</span>
}
