"use client";

import useAuth from "../hooks/useAuth";

export default function Header() {
  const { userName } = useAuth();

  return (
    <>
      <div className="search-container">
        <input
          type="text"
          className="search-bar"
          placeholder="Search projects, segments, or documents..."
        />
        <button className="search-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </div>

      <div className="welcome-banner">
        <h2 style={{ margin: 0 }}>Welcome back, {userName} 👋</h2>
        <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>
          Configure your document translation using preferences below.
        </p>
      </div>
    </>
  );
}