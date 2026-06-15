import React from 'react'
import { ShieldAlert, Bug, FileCode, CheckCircle, Info } from 'lucide-react'

export default function FindingsViewer({ findings }) {
  if (!findings || findings.length === 0) {
    return (
      <div className="glass-panel text-center" style={{ padding: '3rem' }}>
        <CheckCircle size={48} color="var(--accent-success)" style={{ margin: '0 auto 1rem auto' }} />
        <h3 style={{ margin: 0 }}>No Issues Found</h3>
        <p style={{ margin: '0.5rem 0 0 0' }}>The agents did not find any significant issues with this PR.</p>
      </div>
    )
  }

  // Group by agent
  const grouped = findings.reduce((acc, finding) => {
    const agent = finding.agent || finding.agent_name || 'General'
    if (!acc[agent]) acc[agent] = []
    acc[agent].push(finding)
    return acc
  }, {})

  return (
    <div className="flex-col gap-6">
      {Object.entries(grouped).map(([agentName, agentFindings]) => (
        <div key={agentName} className="glass-panel">
          <h3 style={{ 
            textTransform: 'capitalize', 
            borderBottom: '1px solid var(--border-color)', 
            paddingBottom: '0.75rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {getAgentIcon(agentName)}
            {agentName.replace('_agent', ' Agent')}
          </h3>
          
          <div className="flex-col gap-4">
            {agentFindings.map((f, i) => (
              <FindingCard key={i} finding={f} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FindingCard({ finding }) {
  const severityColors = {
    critical: 'var(--accent-danger)',
    high: 'var(--accent-danger)',
    medium: 'var(--accent-warning)',
    low: 'var(--accent-primary)',
    info: 'var(--text-secondary)'
  }

  const severity = (finding.severity || 'info').toLowerCase()
  const color = severityColors[severity] || severityColors.info

  return (
    <div style={{ 
      background: 'rgba(15, 23, 42, 0.4)', 
      borderLeft: `4px solid ${color}`,
      borderRadius: '0 8px 8px 0',
      padding: '1rem',
      position: 'relative'
    }}>
      <div className="flex justify-between items-center mb-2">
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{finding.title || 'Finding'}</h4>
        <span className="badge" style={{ backgroundColor: `${color}33`, color: color }}>
          {severity.toUpperCase()}
        </span>
      </div>
      
      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {finding.description}
      </p>
      
      <div className="flex justify-between items-end" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div>
          {finding.file_path && <span><FileCode size={12} className="inline mr-1" /> {finding.file_path}</span>}
          {finding.line_number && <span style={{ marginLeft: '0.5rem' }}>Line {finding.line_number}</span>}
        </div>
        <div>
          Confidence: {finding.confidence || 0}%
        </div>
      </div>
    </div>
  )
}

function getAgentIcon(agentName) {
  if (agentName.includes('security')) return <ShieldAlert size={20} color="var(--accent-danger)" />
  if (agentName.includes('bug') || agentName.includes('code')) return <Bug size={20} color="var(--accent-warning)" />
  if (agentName.includes('architecture')) return <FileCode size={20} color="var(--accent-primary)" />
  return <Info size={20} color="var(--text-secondary)" />
}
