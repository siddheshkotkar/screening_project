import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Toast from '../components/Toast';
import { Loader2, AlertCircle, RefreshCw, Download, CheckCircle, ArrowRight, PlusCircle, MinusCircle, FileText, Database } from 'lucide-react';

const CompareFiles = () => {
  const [loading, setLoading] = useState(false);
  const [diffData, setDiffData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const runComparison = async () => {
    try {
      setLoading(true);
      setError('');
      setDiffData(null);
      const response = await api.get('/compare');
      setDiffData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'Could not compare files. Please ensure the backend is running and the GITLAB_FILE_URL is valid/reachable.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runComparison();
  }, []);

  const handleExportJSON = () => {
    if (!diffData) return;
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(diffData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "screening_automator_diff.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setToast({ message: 'Successfully exported comparison results as JSON.', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to export JSON file.', type: 'error' });
    }
  };

  const hasDifferences = () => {
    if (!diffData) return false;
    const { feeds_added, feeds_removed, feeds_modified } = diffData.summary;
    const specialListsHaveDiffs = diffData.special_lists.some(list => list.status !== 'unchanged');
    return feeds_added > 0 || feeds_removed > 0 || feeds_modified > 0 || specialListsHaveDiffs;
  };

  return (
    <div className="compare-page-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">GitLab File Comparison</h1>
          <p className="page-subtitle">Analyze difference between local copy and remote GitLab version.</p>
        </div>
        <div className="actions-row">
          <button 
            onClick={runComparison} 
            disabled={loading} 
            className="btn btn-secondary flex-center"
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            <span>Recalculate Diff</span>
          </button>
          {diffData && (
            <button 
              onClick={handleExportJSON} 
              className="btn btn-primary flex-center"
            >
              <Download size={16} />
              <span>Export Diff JSON</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner" size={48} />
          <p>Fetching remote GitLab file and computing diff analysis...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <AlertCircle className="error-icon" size={32} />
          <div>
            <h3>Comparison Failed</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : diffData ? (
        <div className="comparison-content-layout">
          {/* ================= SUMMARY SECTION ================= */}
          <div className="diff-summary-card card">
            <h2 className="section-title">Summary Dashboard</h2>
            <div className="summary-grid">
              <div className="summary-stat-box">
                <span className="stat-label">Total Compared</span>
                <span className="stat-value">{diffData.summary.total_feeds_compared}</span>
              </div>
              <div className="summary-stat-box border-success">
                <span className="stat-label text-success">Feeds Added</span>
                <span className="stat-value text-success">{diffData.summary.feeds_added}</span>
              </div>
              <div className="summary-stat-box border-danger">
                <span className="stat-label text-danger">Feeds Removed</span>
                <span className="stat-value text-danger">{diffData.summary.feeds_removed}</span>
              </div>
              <div className="summary-stat-box border-warning">
                <span className="stat-label text-warning">Feeds Modified</span>
                <span className="stat-value text-warning">{diffData.summary.feeds_modified}</span>
              </div>
            </div>

            {!hasDifferences() && (
              <div className="no-diff-banner">
                <CheckCircle size={28} className="text-success" />
                <div>
                  <strong>No differences found!</strong>
                  <p>All local feeds and keywords match the remote GitLab file version perfectly.</p>
                </div>
              </div>
            )}
          </div>

          {/* ================= SPECIAL LISTS DIFF ================= */}
          {diffData.special_lists && diffData.special_lists.length > 0 && (
            <div className="special-diff-section">
              <h2 className="section-title flex-center gap-2">
                <FileText size={20} />
                <span>Special Lists (CLP & CORE_LIST)</span>
              </h2>
              <div className="diff-cards-grid">
                {diffData.special_lists.map((list) => (
                  <DiffCard key={list.feed_name} diff={list} />
                ))}
              </div>
            </div>
          )}

          {/* ================= DETAILS SECTION ================= */}
          {hasDifferences() && (
            <div className="details-diff-section">
              <h2 className="section-title flex-center gap-2">
                <Database size={20} />
                <span>Standard Feeds Diff Details</span>
              </h2>
              
              {/* Only show changed cards to keep it highly structured and scannable */}
              <div className="diff-cards-grid">
                {diffData.details
                  .filter(item => item.status !== 'unchanged')
                  .map((item) => (
                    <DiffCard key={item.feed_name} diff={item} />
                  ))}
                {diffData.details.filter(item => item.status !== 'unchanged').length === 0 && (
                  <div className="info-box-styled">
                    <p>No standard feed modifications found. Only special lists differed or all match.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

// Sub-component to render individual feed diff card
const DiffCard = ({ diff }) => {
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'added': return 'badge-success';
      case 'removed': return 'badge-danger';
      case 'modified': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  const getStatusBorderClass = (status) => {
    switch (status) {
      case 'added': return 'border-left-success';
      case 'removed': return 'border-left-danger';
      case 'modified': return 'border-left-warning';
      default: return 'border-left-neutral';
    }
  };

  return (
    <div className={`diff-card card ${getStatusBorderClass(diff.status)}`}>
      <div className="diff-card-header">
        <h3 className="diff-feed-name">{diff.feed_name}</h3>
        <span className={`status-badge ${getStatusBadgeClass(diff.status)}`}>
          {diff.status.toUpperCase()}
        </span>
      </div>

      <div className="diff-card-body">
        {diff.status === 'added' && (
          <div className="diff-keywords-container">
            <h4 className="diff-sub-label">Keywords only in Local File:</h4>
            <div className="chips-grid">
              {diff.local_keywords.map((kw, i) => (
                <span key={i} className="keyword-chip-add">
                  <PlusCircle size={12} />
                  <span>{kw}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {diff.status === 'removed' && (
          <div className="diff-keywords-container">
            <h4 className="diff-sub-label">Keywords only in GitLab File:</h4>
            <div className="chips-grid">
              {diff.gitlab_keywords.map((kw, i) => (
                <span key={i} className="keyword-chip-remove">
                  <MinusCircle size={12} />
                  <span>{kw}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {diff.status === 'modified' && (
          <div className="diff-split-container">
            {/* Added Keywords */}
            {diff.added_keywords.length > 0 && (
              <div className="diff-column">
                <h4 className="diff-sub-label text-success flex-center gap-1">
                  <PlusCircle size={14} />
                  <span>Added in Local File ({diff.added_keywords.length})</span>
                </h4>
                <div className="chips-grid">
                  {diff.added_keywords.map((kw, i) => (
                    <span key={i} className="keyword-chip-add">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Removed Keywords */}
            {diff.removed_keywords.length > 0 && (
              <div className="diff-column">
                <h4 className="diff-sub-label text-danger flex-center gap-1">
                  <MinusCircle size={14} />
                  <span>Removed in Local File ({diff.removed_keywords.length})</span>
                </h4>
                <div className="chips-grid">
                  {diff.removed_keywords.map((kw, i) => (
                    <span key={i} className="keyword-chip-remove">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {diff.status === 'unchanged' && (
          <p className="unchanged-text text-muted">
            All {diff.local_keywords.length} keywords match.
          </p>
        )}
      </div>
    </div>
  );
};

export default CompareFiles;
