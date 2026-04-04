"use client";

import { useState } from "react";
import Login from "../../components/Login";
import Register from "../../components/Register";

export default function Home() {
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="container">
      <header className="brand-header">
        <div className="brand-logo-container">
          <div className="brand-logo">文A</div>
          <h1 className="brand-title">VaaniSetu</h1>
        </div>
        <p className="brand-subtitle">Bridging Languages, Connecting Worlds</p>
      </header>

      <main className="card">
        <div className="header-tabs">
          <button 
            className={`header-tab ${!isRegister ? "active" : ""}`} 
            onClick={() => setIsRegister(false)}
          >
            Sign In
          </button>
          <button 
            className={`header-tab ${isRegister ? "active" : ""}`} 
            onClick={() => setIsRegister(true)}
          >
            Register
          </button>
        </div>

        {isRegister ? <Register /> : <Login />}
      </main>
    </div>
  );
}