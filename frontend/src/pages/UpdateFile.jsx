import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import { PlusCircle, Trash2, Loader2, AlertCircle, Info } from 'lucide-react';

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
  const [removeFeed, setRemoveFeed] = useState('');
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
        setRemoveFeed(resList.data[0]);
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

  // Update remove keyword selection based on selected feed
  const selectedRemoveFeedKeywords = feedsData.find(f => f.id === removeFeed)?.keywords || [];

  useEffect(() => {
    if (selectedRemoveFeedKeywords.length > 0) {
      setRemoveKeyword(selectedRemoveFeedKeywords[0]);
    } else {
      setRemoveKeyword('');
    }
  }, [removeFeed, feedsData]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleCloseToast = () => {
    setToast(null);
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
        await api.post('/keywords/remove-from-feed', {
          keyword: removeKeyword,
          feed_name: removeFeed
        });
        showToast(`Removed keyword "${removeKeyword}" from feed "${removeFeed}".`);
      } else {
        await api.post('/keywords/remove-completely', {
          keyword: removeKeyword
        });
        showToast(`Globally removed keyword "${removeKeyword}" from all lists.`);
      }
      if (setHasChanges) setHasChanges(true);
      // Reload feeds
      await loadData();
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
                          if (selectedRemoveFeedKeywords.length > 0) {
                            setRemoveKeyword(selectedRemoveFeedKeywords[0]);
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
                      <label htmlFor="remove-feed-select" className="input-label">
                        Select Target Feed
                      </label>
                      <select
                        id="remove-feed-select"
                        value={removeFeed}
                        onChange={(e) => setRemoveFeed(e.target.value)}
                        className="form-select"
                      >
                        {feedsList.map(feed => (
                          <option key={feed} value={feed}>
                            {feed}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="remove-keyword-select" className="input-label">
                        Select Keyword to Remove
                      </label>
                      {selectedRemoveFeedKeywords.length === 0 ? (
                        <div className="alert-info-box">
                          <Info size={16} />
                          <span>No keywords exist in this feed to remove.</span>
                        </div>
                      ) : (
                        <select
                          id="remove-keyword-select"
                          value={removeKeyword}
                          onChange={(e) => setRemoveKeyword(e.target.value)}
                          className="form-select"
                        >
                          {selectedRemoveFeedKeywords.map(kw => (
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
                  disabled={submittingRemove || (removeMode === 'specific' && selectedRemoveFeedKeywords.length === 0)}
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
              You are about to remove <strong>"{removeKeyword}"</strong> from feed <strong>"{removeFeed}"</strong>. This action only modifies this feed.
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
    </div>
  );
};

export default UpdateFile;
