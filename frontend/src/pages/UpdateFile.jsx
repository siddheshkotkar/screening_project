import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { PlusCircle, Trash2, Loader2, AlertCircle, Info, Download, GitBranch, CheckCircle, X } from 'lucide-react';

const UpdateFile = ({ setHasChanges }) => {
  // Global Feeds State
  const [feedsData, setFeedsData] = useState([]);
  const [feedsList, setFeedsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Tab: 'add' or 'remove'
  const [activeTab, setActiveTab] = useState('add');

  // Form State - Add Keyword
  const [addKeyword, setAddKeyword] = useState('');
  const [addFeeds, setAddFeeds] = useState([]);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Form State - Remove Keyword
  const [removeMode, setRemoveMode] = useState('specific'); // 'specific' or 'global'
  const [removeFeeds, setRemoveFeeds] = useState([]);
  const [removeKeyword, setRemoveKeyword] = useState('');
  const [submittingRemove, setSubmittingRemove] = useState(false);

  // Modal Control - Add New Keyword Propagation Options
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalOptions, setAddModalOptions] = useState({
    isNewKeyword: true,
    addToClp: false,
    addToCore: false
  });

  // Modal Control - Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Toast Notifications
  const [toast, setToast] = useState(null);

  // Post-operation Modal (Download or GitLab Deploy)
  const [showPostActionModal, setShowPostActionModal] = useState(false);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deployError, setDeployError] = useState('');
  const [deployLogs, setDeployLogs] = useState([]);
  
  const [deployFormData, setDeployFormData] = useState({
    token: 'glpat-gfsZdoAG7rd7zlp0j649Am86MQp1ojJybGkK.01.101fnisbt',
    repo_url: 'https://app.gitlab.barcapint.com/barclays/gcwcs/GCWS-FS.git',
    email: 'project_16293_bot_b10fdafee1c5883173afcd4306b45be8@noreply.app.gitlab.barcapint.com',
    name: 'project_16293_bot',
    file_path_in_repo: 'current/refData/Keywords and Lists.txt',
    jiraNumber: 'GCWS-31803',
    branch: 'feature/Keyword_Auto_V5',
    commit_message: 'GCWS-31803',
    tag_name: 'delta_build_GCWS-31803V5'
  });

  const handleJiraNumberChange = (value) => {
    setDeployFormData(prev => {
      const updated = { ...prev, jiraNumber: value };
      const jira = value.strip ? value.strip() : value.trim();
      
      updated.commit_message = jira;
      updated.tag_name = `delta_build_${jira}V5`;
      return updated;
    });
  };

  // Load all data
  const loadData = async () => {
    try {
      setLoading(true);
      const resAll = await api.get('/feeds/all');
      setFeedsData(resAll.data);

      const resList = await api.get('/feeds');
      setFeedsList(resList.data);

      if (resList.data.length > 0) {
        setAddFeeds([resList.data[0]]);
        setRemoveFeeds([resList.data[0]]);
      }
    } catch (err) {
      setError('Failed to load configuration. Please verify backend state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get all unique keywords present in ANY of the selected removeFeeds
  const selectedRemoveFeedsKeywords = Array.from(
    new Set(
      feedsData
        .filter(f => removeFeeds.includes(f.id))
        .flatMap(f => f.keywords)
    )
  ).sort();

  useEffect(() => {
    if (selectedRemoveFeedsKeywords.length > 0) {
      if (!selectedRemoveFeedsKeywords.includes(removeKeyword)) {
        setRemoveKeyword(selectedRemoveFeedsKeywords[0]);
      }
    } else {
      setRemoveKeyword('');
    }
  }, [removeFeeds, feedsData]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleCloseToast = () => {
    setToast(null);
  };

  const handleDownloadSessionFile = async () => {
    try {
      const response = await api.get('/session/download', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `keywords_updated.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('File downloaded successfully.');
    } catch (err) {
      console.error("Download failed:", err);
      showToast('Could not download the session file.', 'error');
    }
  };

  const handleDeploySubmit = async (e) => {
    e.preventDefault();
    setIsDeploying(true);
    setDeploySuccess(false);
    setDeployError('');
    setDeployLogs([]);
    
    try {
      const response = await api.post('/deploy/gitlab-uat', deployFormData);
      setDeployLogs(response.data.logs || []);
      setDeploySuccess(true);
      showToast('Successfully deployed changes to GitLab UAT!');
    } catch (err) {
      console.error("Deployment failed:", err);
      const errDetail = err.response?.data?.detail || 'Failed to deploy to GitLab UAT.';
      setDeployError(errDetail);
      if (err.response?.data?.logs) {
        setDeployLogs(err.response.data.logs);
      } else {
        setDeployLogs(prev => [...prev, `Error: ${errDetail}`]);
      }
      showToast('Deployment failed.', 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  // Check if keyword is new system-wide
  const isKeywordNewSystemWide = (kw) => {
    const target = kw.trim().toLowerCase();
    return !feedsData.some(feed => 
      feed.keywords.some(k => k.toLowerCase() === target)
    );
  };

  // Add Keyword Submit Click
  const handleAddSubmit = (e) => {
    e.preventDefault();
    const kw = addKeyword.trim();

    if (!kw) {
      showToast('Keyword must not be empty.', 'error');
      return;
    }
    if (addFeeds.length === 0) {
      showToast('At least one feed must be selected.', 'error');
      return;
    }

    // Check duplicate in selected feeds
    const duplicateFeeds = [];
    addFeeds.forEach(feedName => {
      const targetFeedData = feedsData.find(f => f.id === feedName);
      if (targetFeedData && targetFeedData.keywords.some(k => k.toLowerCase() === kw.toLowerCase())) {
        duplicateFeeds.push(feedName);
      }
    });

    if (duplicateFeeds.length > 0) {
      showToast(`Keyword "${kw}" already exists in feed(s): ${duplicateFeeds.join(', ')}.`, 'error');
      return;
    }

    // If new system-wide, open confirmation modal to ask propagation questions
    if (isKeywordNewSystemWide(kw)) {
      setAddModalOptions({
        isNewKeyword: true,
        addToClp: false,
        addToCore: false
      });
      setShowAddModal(true);
    } else {
      // Just submit directly
      executeAddKeyword(kw, addFeeds, false, false);
    }
  };

  // API Call: Add Keyword
  const executeAddKeyword = async (keyword, feedNames, addToClp, addToCore) => {
    try {
      setSubmittingAdd(true);
      await api.post('/keywords/add-multiple', {
        keyword,
        feed_names: feedNames,
        add_to_clp: addToClp,
        add_to_core: addToCore
      });
      
      showToast(`Successfully added keyword "${keyword}" to ${feedNames.length} feed(s).`);
      if (setHasChanges) setHasChanges(true);
      setAddKeyword('');
      setAddFeeds(feedsList.length > 0 ? [feedsList[0]] : []);
      setShowAddModal(false);
      // Reload feeds to update state
      await loadData();
      setShowPostActionModal(true);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add keyword.', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleConfirmAddModal = () => {
    executeAddKeyword(
      addKeyword.trim(),
      addFeeds,
      addModalOptions.addToClp,
      addModalOptions.addToCore
    );
  };

  // Remove Keyword Submit Click
  const handleRemoveSubmit = (e) => {
    e.preventDefault();
    if (removeMode === 'specific' && removeFeeds.length === 0) {
      showToast('At least one feed must be selected.', 'error');
      return;
    }
    if (!removeKeyword.trim()) {
      showToast('Please select or input a keyword to remove.', 'error');
      return;
    }
    setShowDeleteConfirm(true);
  };

  // API Call: Remove Keyword
  const executeRemoveKeyword = async () => {
    setShowDeleteConfirm(false);
    try {
      setSubmittingRemove(true);
      if (removeMode === 'specific') {
        await api.post('/keywords/remove-from-multiple-feeds', {
          keyword: removeKeyword,
          feed_names: removeFeeds
        });
        showToast(`Removed keyword "${removeKeyword}" from ${removeFeeds.length} feed(s).`);
      } else {
        await api.post('/keywords/remove-completely', {
          keyword: removeKeyword
        });
        showToast(`Globally removed keyword "${removeKeyword}" from all lists.`);
      }
      if (setHasChanges) setHasChanges(true);
      // Reload feeds
      await loadData();
      setShowPostActionModal(true);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to remove keyword.', 'error');
    } finally {
      setSubmittingRemove(false);
    }
  };

  // Get all unique keywords across the whole system (for autocomplete datalist in Global remove)
  const allUniqueKeywords = Array.from(
    new Set(feedsData.flatMap(f => f.keywords))
  ).sort();

  return (
    <div className="update-page-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={handleCloseToast} 
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Update Keywords Config</h1>
          <p className="page-subtitle">Add keywords to specific feeds or completely remove them from the system.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner" size={48} />
          <p>Loading files & metadata...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <AlertCircle className="error-icon" size={32} />
          <div>
            <h3>Error Loading Feed Data</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="update-layout card">
          <div className="tab-buttons-container">
            <button 
              className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
            >
              <PlusCircle size={18} />
              <span>Add Keyword</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'remove' ? 'active' : ''}`}
              onClick={() => setActiveTab('remove')}
            >
              <Trash2 size={18} />
              <span>Remove Keyword</span>
            </button>
          </div>

          <div className="tab-content-panel">
            {activeTab === 'add' ? (
              /* ================= ADD FLOW ================= */
              <form onSubmit={handleAddSubmit} className="update-form">
                <div className="form-group">
                  <label htmlFor="add-keyword-input" className="input-label">
                    Keyword Value
                  </label>
                  <input
                    id="add-keyword-input"
                    type="text"
                    placeholder="Enter new keyword (e.g. OFAC-NEW)..."
                    value={addKeyword}
                    onChange={(e) => setAddKeyword(e.target.value)}
                    className="form-input"
                  />
                  <small className="form-help-text">
                    Trailing spaces will be trimmed and case is normalized.
                  </small>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>Target Feeds (Select one or more)</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        type="button" 
                        onClick={() => setAddFeeds(feedsList)} 
                        className="btn btn-secondary btn-xs"
                        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                      >
                        Select All
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setAddFeeds([])} 
                        className="btn btn-secondary btn-xs"
                        style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="feeds-toggle-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                    {feedsList.map(feed => {
                      const isSelected = addFeeds.includes(feed);
                      return (
                        <button
                          key={feed}
                          type="button"
                          onClick={() => {
                            setAddFeeds(prev => 
                              prev.includes(feed) 
                                ? prev.filter(f => f !== feed) 
                                : [...prev, feed]
                            );
                          }}
                          className={`feed-toggle-pill ${isSelected ? 'active' : ''}`}
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          <span>{feed}</span>
                          {(feed === 'CLP' || feed === 'CORE_LIST') && (
                            <span className="pill-badge">Special</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submittingAdd}
                  className="btn btn-primary submit-btn"
                >
                  {submittingAdd ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      <span>Saving to local file...</span>
                    </>
                  ) : (
                    <span>Add Keyword</span>
                  )}
                </button>
              </form>
            ) : (
              /* ================= REMOVE FLOW ================= */
              <form onSubmit={handleRemoveSubmit} className="update-form">
                <div className="form-group">
                  <label className="input-label">Removal Option</label>
                  <div className="radio-group-container">
                    <label className="radio-label-card">
                      <input
                        type="radio"
                        name="removeMode"
                        value="specific"
                        checked={removeMode === 'specific'}
                        onChange={() => {
                          setRemoveMode('specific');
                          if (selectedRemoveFeedsKeywords.length > 0) {
                            setRemoveKeyword(selectedRemoveFeedsKeywords[0]);
                          } else {
                            setRemoveKeyword('');
                          }
                        }}
                      />
                      <div className="radio-card-content">
                        <strong>Remove from Specific Feed</strong>
                        <span>Delete keyword only from the selected feed.</span>
                      </div>
                    </label>

                    <label className="radio-label-card">
                      <input
                        type="radio"
                        name="removeMode"
                        value="global"
                        checked={removeMode === 'global'}
                        onChange={() => {
                          setRemoveMode('global');
                          setRemoveKeyword('');
                        }}
                      />
                      <div className="radio-card-content">
                        <strong>Complete Removal</strong>
                        <span>Globally purge the keyword from ALL feeds, CLP, and CORE_LIST.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {removeMode === 'specific' ? (
                  <>
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="input-label" style={{ marginBottom: 0 }}>Target Feeds (Select one or more)</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            onClick={() => setRemoveFeeds(feedsList)} 
                            className="btn btn-secondary btn-xs"
                            style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                          >
                            Select All
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setRemoveFeeds([])} 
                            className="btn btn-secondary btn-xs"
                            style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                      <div className="feeds-toggle-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.1)' }}>
                        {feedsList.map(feed => {
                          const isSelected = removeFeeds.includes(feed);
                          return (
                            <button
                              key={feed}
                              type="button"
                              onClick={() => {
                                setRemoveFeeds(prev => 
                                  prev.includes(feed) 
                                    ? prev.filter(f => f !== feed) 
                                    : [...prev, feed]
                                );
                              }}
                              className={`feed-toggle-pill ${isSelected ? 'active' : ''}`}
                              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            >
                              <span>{feed}</span>
                              {(feed === 'CLP' || feed === 'CORE_LIST') && (
                                <span className="pill-badge">Special</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="remove-keyword-select" className="input-label">
                        Select Keyword to Remove
                      </label>
                      {selectedRemoveFeedsKeywords.length === 0 ? (
                        <div className="alert-info-box">
                          <Info size={16} />
                          <span>No keywords exist in the selected feeds to remove.</span>
                        </div>
                      ) : (
                        <select
                          id="remove-keyword-select"
                          value={removeKeyword}
                          onChange={(e) => setRemoveKeyword(e.target.value)}
                          className="form-select"
                        >
                          {selectedRemoveFeedsKeywords.map(kw => (
                            <option key={kw} value={kw}>
                              {kw}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label htmlFor="remove-keyword-input" className="input-label">
                      Select or Enter Keyword
                    </label>
                    <input
                      id="remove-keyword-input"
                      type="text"
                      list="global-keywords"
                      placeholder="Type a keyword to globally remove..."
                      value={removeKeyword}
                      onChange={(e) => setRemoveKeyword(e.target.value)}
                      className="form-input"
                    />
                    <datalist id="global-keywords">
                      {allUniqueKeywords.map(kw => (
                        <option key={kw} value={kw} />
                      ))}
                    </datalist>
                    <small className="form-help-text">
                      Type to search system keywords. This list contains {allUniqueKeywords.length} unique values.
                    </small>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={submittingRemove || (removeMode === 'specific' && selectedRemoveFeedsKeywords.length === 0)}
                  className="btn btn-danger submit-btn"
                >
                  {submittingRemove ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Keyword</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD PROPAGATION CHECKLIST ================= */}
      <Modal
        isOpen={showAddModal}
        title="Configure New Keyword"
        onConfirm={handleConfirmAddModal}
        onCancel={() => setShowAddModal(false)}
        confirmText="Confirm & Save"
        cancelText="Cancel"
      >
        <div className="propagation-modal-body">
          <div className="alert-info-box mb-4">
            <Info size={18} />
            <p>
              The keyword <strong>"{addKeyword.trim()}"</strong> is completely new to the system (not found in any feed). Please select additional listings:
            </p>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-item-card">
              <input
                type="checkbox"
                checked={addModalOptions.isNewKeyword}
                disabled
              />
              <div className="checkbox-content">
                <strong>Is this a new keyword?</strong>
                <span>Confirmed. This keyword is not present anywhere in the configuration.</span>
              </div>
            </label>

            <label className="checkbox-item-card">
              <input
                type="checkbox"
                checked={addModalOptions.addToClp}
                onChange={(e) => setAddModalOptions({
                  ...addModalOptions,
                  addToClp: e.target.checked
                })}
              />
              <div className="checkbox-content">
                <strong>Should it also be added to the CLP line?</strong>
                <span>Add this keyword to the standard CLP list (ID: CLP).</span>
              </div>
            </label>

            <label className="checkbox-item-card">
              <input
                type="checkbox"
                checked={addModalOptions.addToCore}
                onChange={(e) => setAddModalOptions({
                  ...addModalOptions,
                  addToCore: e.target.checked
                })}
              />
              <div className="checkbox-content">
                <strong>Is this a core policy keyword?</strong>
                <span>Add this keyword to the core policy lists (ID: CORE_LIST).</span>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      <Modal
        isOpen={showDeleteConfirm}
        title="Confirm Keyword Deletion"
        type="warning"
        onConfirm={executeRemoveKeyword}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Yes, Delete"
        cancelText="No, Keep"
      >
        <div className="delete-confirm-body">
          <p>
            Are you sure you want to proceed?
          </p>
          {removeMode === 'specific' ? (
            <p>
              You are about to remove <strong>"{removeKeyword}"</strong> from feed(s): <strong>{removeFeeds.join(', ')}</strong>. This action only modifies the selected feed(s).
            </p>
          ) : (
            <div className="destructive-warning-box">
              <p>
                <strong>CRITICAL ACTION:</strong> This will globally delete <strong>"{removeKeyword}"</strong> from:
              </p>
              <ul>
                <li>All individual feeds</li>
                <li>The <code>CLP</code> row mapping</li>
                <li>The <code>CORE_LIST</code> policy list</li>
              </ul>
              <p>This action cannot be undone!</p>
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: POST-OPERATION ACTION PROMPT ================= */}
      {showPostActionModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div className="modal-title-container">
                <CheckCircle className="modal-icon text-success" size={24} />
                <h3>Save or Deploy Your Changes</h3>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => {
                  setShowPostActionModal(false);
                  setShowDeployForm(false);
                  setDeployLogs([]);
                  setDeploySuccess(false);
                  setDeployError('');
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <p style={{ marginBottom: '20px' }}>
                Your keywords have been successfully updated in your active session. Choose how you want to save or deploy these updates:
              </p>
              
              <div className="action-buttons-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', height: 'auto' }}
                  onClick={handleDownloadSessionFile}
                >
                  <Download size={24} className="text-info" />
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Download File</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Save a copy of keywords locally to your machine.</span>
                </button>
                
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', height: 'auto' }}
                  onClick={() => {
                    setShowDeployForm(!showDeployForm);
                    setDeploySuccess(false);
                    setDeployError('');
                  }}
                >
                  <GitBranch size={24} className="text-warning" />
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Deploy to GitLab UAT</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Directly push changes to the repository in a new branch.</span>
                </button>
              </div>
              
              {showDeployForm && (
                <div className="deploy-form-container" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', animation: 'fadeIn 0.2s ease-out' }}>
                  <h4 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>GitLab UAT Deployment Details</h4>
                  
                  <form onSubmit={handleDeploySubmit}>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>JIRA Number</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ borderColor: 'var(--text-warning)' }}
                          placeholder="e.g. GCWS-31803"
                          value={deployFormData.jiraNumber}
                          onChange={(e) => handleJiraNumberChange(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Feature Branch Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={deployFormData.branch}
                          onChange={(e) => setDeployFormData(prev => ({ ...prev, branch: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Commit Message</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={deployFormData.commit_message}
                          onChange={(e) => setDeployFormData(prev => ({ ...prev, commit_message: e.target.value }))}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Tag Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={deployFormData.tag_name}
                          onChange={(e) => setDeployFormData(prev => ({ ...prev, tag_name: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    {deployError && (
                      <div className="error-alert" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--text-danger)', borderRadius: '6px', color: 'var(--text-danger)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <AlertCircle size={16} />
                          <span>{deployError}</span>
                        </div>
                      </div>
                    )}
                    
                    {deploySuccess && (
                      <div className="success-alert" style={{ marginBottom: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--text-success)', borderRadius: '6px', color: 'var(--text-success)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <CheckCircle size={16} />
                          <span>Deployment completed successfully! Pushed branch and tag to GitLab UAT.</span>
                        </div>
                      </div>
                    )}
                    
                    {deployLogs.length > 0 && (
                      <div className="logs-console" style={{ marginBottom: '16px' }}>
                        <label className="form-label">Deployment Logs</label>
                        <div style={{ 
                          background: '#0a0d14', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '6px', 
                          padding: '12px', 
                          fontFamily: 'monospace', 
                          fontSize: '0.8rem', 
                          color: '#34d399', 
                          maxHeight: '180px', 
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {deployLogs.map((log, idx) => (
                            <div key={idx} style={{ 
                              color: log.startsWith("stderr:") ? '#f87171' : 
                                     log.startsWith("Running command:") ? '#60a5fa' : 
                                     log.startsWith("Error:") ? '#ef4444' : '#34d399',
                              marginBottom: '4px',
                              textAlign: 'left'
                            }}>
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowDeployForm(false)}
                        disabled={isDeploying}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={isDeploying}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {isDeploying ? (
                          <>
                            <Loader2 className="spinner" size={16} />
                            <span>Deploying...</span>
                          </>
                        ) : (
                          <>
                            <GitBranch size={16} />
                            <span>Submit Deployment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowPostActionModal(false);
                  setShowDeployForm(false);
                  setDeployLogs([]);
                  setDeploySuccess(false);
                  setDeployError('');
                }}
                disabled={isDeploying}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateFile;
