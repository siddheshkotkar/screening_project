import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Eye, RefreshCw, Scale } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: "View All Feeds and Keywords",
      description: "Display a searchable tabular overview of all feeds, keywords, and Business Units directly parsed from the local server file.",
      icon: <Database className="card-icon" size={32} />,
      path: "/view-all",
      colorClass: "card-all"
    },
    {
      title: "View Keywords of a Specific Feed",
      description: "Filter and view keywords associated with a selected feed name represented as readable tags and chips.",
      icon: <Eye className="card-icon" size={32} />,
      path: "/view-specific",
      colorClass: "card-specific"
    },
    {
      title: "Update the File",
      description: "Safely add keywords to feeds (including CLP & CORE_LIST logic) or remove keywords with complete system-wide deletion options.",
      icon: <RefreshCw className="card-icon" size={32} />,
      path: "/update",
      colorClass: "card-update"
    },
    {
      title: "Compare Local with GitLab",
      description: "Perform line-by-side comparison with the remote GitLab repository version, view structured diff summaries, and export changes.",
      icon: <Scale className="card-icon" size={32} />,
      path: "/compare",
      colorClass: "card-compare"
    }
  ];

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">Screening Automator</h1>
        <p className="hero-subtitle">
          Manage and compare list mappings, keywords, and policy configurations with ease.
        </p>
      </div>

      <div className="dashboard-grid">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            className={`dashboard-card ${card.colorClass}`}
            onClick={() => navigate(card.path)}
          >
            <div className="card-icon-container">
              {card.icon}
            </div>
            <h2 className="card-title">{card.title}</h2>
            <p className="card-description">{card.description}</p>
            <div className="card-action-hint">
              Launch Feature &rarr;
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
