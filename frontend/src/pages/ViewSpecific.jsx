import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Loader2, Sliders, AlertCircle, Copy, Check, Info } from 'lucide-react';

const ViewSpecific = () => {
  const [feedsData, setFeedsData] = useState([]);
  const [selectedFeeds, setSelectedFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null); // format: 'feedId-index'

  useEffect(() => {
    const fetchAllFeedsData = async () => {
      try {
        setLoading(true);
        // Load feeds along with keywords at once for instant transitions
        const response = await api.get('/feeds/all');
        setFeedsData(response.data);
        // Select the first feed by default
        if (response.data.length > 0) {
          setSelectedFeeds([response.data[0].id]);
        }
      } catch (err) {
        setError('Failed to fetch feeds configuration. Please verify that the backend is active.');
      } finally {
        setLoading(false);
      }
    };
    fetchAllFeedsData();
  }, []);

  const handleToggleFeed = (feedId) => {
    setSelectedFeeds((prev) => {
      if (prev.includes(feedId)) {
        return prev.filter((id) => id !== feedId);
      } else {
        return [...prev, feedId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedFeeds(feedsData.map((f) => f.id));
  };

  const handleClearAll = () => {
    setSelectedFeeds([]);
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="view-specific-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Explore Mappings & Feeds</h1>
          <p className="page-subtitle">Select multiple feeds below to browse and compare keyword mappings concurrently.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner" size={48} />
          <p>Fetching all feeds and lists...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <AlertCircle className="error-icon" size={32} />
          <div>
            <h3>Error Loading Feed Details</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="specific-explorer-layout-stacked">
          <div className="selection-panel-stacked card mb-4">
            <div className="selection-panel-header">
              <label className="input-label">Select Feeds (click to toggle selection):</label>
              <div className="selection-actions">
                <button onClick={handleSelectAll} className="btn btn-secondary btn-xs">Select All</button>
                <button onClick={handleClearAll} className="btn btn-secondary btn-xs">Clear All</button>
              </div>
            </div>
            <div className="feeds-toggle-group">
              {feedsData.map((feed) => {
                const isSelected = selectedFeeds.includes(feed.id);
                return (
                  <button
                    key={feed.id}
                    onClick={() => handleToggleFeed(feed.id)}
                    className={`feed-toggle-pill ${isSelected ? 'active' : ''}`}
                  >
                    <span>{feed.id}</span>
                    {(feed.id === 'CLP' || feed.id === 'CORE_LIST') && (
                      <span className="pill-badge">Special</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="results-panel-stacked">
            {selectedFeeds.length === 0 ? (
              <div className="empty-keywords-placeholder card">
                <Info size={28} className="text-info mb-2" />
                <p>No feeds selected. Please click on one or more feed pills above to view keywords.</p>
              </div>
            ) : (
              selectedFeeds.map((feedId) => {
                const feed = feedsData.find((f) => f.id === feedId);
                if (!feed) return null;

                return (
                  <div className="feed-keywords-row card mb-4" key={feed.id}>
                    <div className="row-header">
                      <div className="row-title-container">
                        <h3 className="row-title">{feed.id}</h3>
                        {(feed.id === 'CLP' || feed.id === 'CORE_LIST') && (
                          <span className="special-badge">Special List</span>
                        )}
                        {feed.bu && (
                          <span className="bu-subtitle">({feed.bu})</span>
                        )}
                      </div>
                      <span className="count-badge">{feed.keywords.length} Keywords</span>
                    </div>

                    {feed.keywords.length === 0 ? (
                      <div className="empty-keywords-placeholder">
                        <p>No keywords exist in this feed yet.</p>
                      </div>
                    ) : (
                      <div className="chips-grid">
                        {feed.keywords.map((kw, index) => {
                          const itemKey = `${feed.id}-${index}`;
                          return (
                            <div key={index} className="keyword-chip-large">
                              <span className="chip-text">{kw}</span>
                              <button
                                className="chip-action-btn"
                                onClick={() => copyToClipboard(kw, itemKey)}
                                title="Copy keyword"
                              >
                                {copiedKey === itemKey ? (
                                  <Check size={14} className="text-success" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewSpecific;
