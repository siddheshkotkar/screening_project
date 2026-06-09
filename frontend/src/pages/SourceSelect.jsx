import React, { useState } from 'react';
import api from '../services/api';
import Toast from '../components/Toast';
import { Loader2, Database, UploadCloud, AlertCircle, FileSpreadsheet, Check } from 'lucide-react';

const SourceSelect = ({ onSelectSuccess }) => {
  const [source, setSource] = useState('master'); // 'master' or 'local'
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (source === 'local' && !selectedFile) {
      showToast('Please upload a keywords file.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('source', source);
      if (source === 'local') {
        formData.append('file', selectedFile);
      }

      // Initialize session on server
      await api.post('/session/initialize', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showToast('Session initialized successfully!');
      setTimeout(() => {
        onSelectSuccess();
      }, 800);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Initialization failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="source-select-page-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="source-select-header">
        <h1>Configure Data Workspace</h1>
        <p>Choose the keywords mapping file source to initialize your session.</p>
      </div>

      <div className="source-select-card card">
        <form onSubmit={handleSubmit} className="source-select-form">
          <div className="source-options-grid">
            {/* Master Option */}
            <div 
              className={`source-option-card ${source === 'master' ? 'active' : ''}`}
              onClick={() => setSource('master')}
            >
              <div className="option-checkbox">
                {source === 'master' && <Check size={14} className="text-primary" />}
              </div>
              <Database size={36} className="option-icon text-primary" />
              <h3>Use Master File</h3>
              <p>Fetches the baseline keyword list from the master GitLab repository server.</p>
            </div>

            {/* Local Upload Option */}
            <div 
              className={`source-option-card ${source === 'local' ? 'active' : ''}`}
              onClick={() => setSource('local')}
            >
              <div className="option-checkbox">
                {source === 'local' && <Check size={14} className="text-success" />}
              </div>
              <UploadCloud size={36} className="option-icon text-success" />
              <h3>Upload Local File</h3>
              <p>Upload a custom pipe-delimited keywords file from your system to start editing.</p>
            </div>
          </div>

          {source === 'local' && (
            <div 
              className={`uploader-drag-zone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                id="file-upload" 
                accept=".txt,.csv"
                onChange={handleFileChange}
                className="hidden-file-input"
              />
              <label htmlFor="file-upload" className="uploader-label">
                {selectedFile ? (
                  <>
                    <FileSpreadsheet size={48} className="text-success mb-2 animate-pulse" />
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    <span className="upload-change-hint">Click or drag another file to replace</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={48} className="text-muted mb-2" />
                    <strong>Drag and drop your file here</strong>
                    <span>or click to browse from system</span>
                    <span className="upload-requirements-hint">Only pipe-delimited .txt files with ID|Keywords header format</span>
                  </>
                )}
              </label>
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting}
            className="btn btn-primary source-select-submit-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="spinner" size={18} />
                <span>Initializing Sandbox...</span>
              </>
            ) : (
              <span>Load Selected Workspace</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SourceSelect;
