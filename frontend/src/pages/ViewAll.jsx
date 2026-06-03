import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Loader2, Database, AlertCircle } from 'lucide-react';

const ViewAll = () => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        setLoading(true);
        const response = await api.get('/feeds/all');
        setFeeds(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load feeds data. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchFeeds();
  }, []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredFeeds = feeds.filter((feed) => {
    const query = searchQuery.toLowerCase().strip ? searchQuery.toLowerCase().trim() : searchQuery.toLowerCase();
    const matchesId = feed.id.toLowerCase().includes(query);
    const matchesBu = feed.bu && feed.bu.toLowerCase().includes(query);
    const matchesKeyword = feed.keywords.some((kw) => kw.toLowerCase().includes(query));
    return matchesId || matchesBu || matchesKeyword;
  });

  return (
    <div className="view-all-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Feeds and Keywords</h1>
          <p className="page-subtitle">Overview of current local feed-to-keyword configuration mapping.</p>
        </div>
        {!loading && !error && (
          <div className="badge-summary">
            <Database size={16} />
            <span>{feeds.length} Feeds Total</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner" size={48} />
          <p>Parsing feed files from local server...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <AlertCircle className="error-icon" size={32} />
          <div>
            <h3>Error Loading Feeds</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="search-bar-container">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search by feed name, BU, or specific keyword..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-input"
              />
            </div>
            {searchQuery && (
              <span className="search-results-badge">
                Found {filteredFeeds.length} results
              </span>
            )}
          </div>

          <div className="table-responsive">
            <table className="feeds-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Feed Name / ID</th>
                  <th style={{ width: '55%' }}>Keywords</th>
                  <th style={{ width: '20%' }}>Business Unit (BU)</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeeds.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="no-data-cell">
                      No matching feeds or keywords found.
                    </td>
                  </tr>
                ) : (
                  filteredFeeds.map((feed) => (
                    <tr key={feed.id} className={feed.id === 'CLP' || feed.id === 'CORE_LIST' ? 'special-row' : ''}>
                      <td className="feed-id-cell">
                        <span className="feed-id-text">{feed.id}</span>
                        {(feed.id === 'CLP' || feed.id === 'CORE_LIST') && (
                          <span className="special-badge">Special</span>
                        )}
                      </td>
                      <td>
                        <div className="keywords-chip-container">
                          {feed.keywords.map((kw, i) => (
                            <span key={i} className="keyword-chip-small">
                              {kw}
                            </span>
                          ))}
                          {feed.keywords.length === 0 && (
                            <span className="empty-keywords-text">No keywords assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="feed-bu-cell">
                        {feed.bu || <span className="empty-text">&mdash;</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ViewAll;
