import React from 'react';
import { HelpCircle, AlertTriangle, X } from 'lucide-react';

const Modal = ({ 
  isOpen, 
  title, 
  type = 'question', 
  children, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel' 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-container">
            {type === 'warning' ? (
              <AlertTriangle className="modal-icon text-warning" size={24} />
            ) : (
              <HelpCircle className="modal-icon text-info" size={24} />
            )}
            <h3>{title}</h3>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className={`btn ${type === 'warning' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
