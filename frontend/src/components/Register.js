"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; //

export default function Register() {
  const [role, setRole] = useState("user");
  const router = useRouter(); // Initialize the router

  const handleCreateAccount = (e) => {
    e.preventDefault();
    // Logic for account creation would go here.
    // Redirecting to the upload dashboard:
    router.push("/upload"); //
  };

  return (
    <>
      <div className="title">Create Account</div>
      <div className="subtitle">Join the VaaniSetu network today</div>

      <label className="label">Register as</label>
      <div className="toggle-group">
        <button 
          className={`toggle-btn ${role === "user" ? "active" : ""}`} 
          onClick={() => setRole("user")}
        >
          User
        </button>
        <button 
          className={`toggle-btn ${role === "linguist" ? "active" : ""}`} 
          onClick={() => setRole("linguist")}
        >
          Linguist
        </button>
        <button 
          className={`toggle-btn ${role === "org" ? "active" : ""}`} 
          onClick={() => setRole("org")}
        >
          Org Representative
        </button>
      </div>

      <div className="input-wrapper">
        <label className="label">Full Name</label>
        <input className="input" placeholder="John Doe" />
      </div>

      <div className="input-wrapper">
        <label className="label">Email Address</label>
        <input className="input" type="email" placeholder="you@example.com" />
      </div>

      <div className="input-wrapper">
        <label className="label">
          {role === "linguist" ? "Languages" : "Organization"}
        </label>
        <input 
          className="input" 
          placeholder={role === "linguist" ? "e.g. English, Marathi, German" : "Your company or institution"} 
        />
      </div>

      <div className="input-wrapper">
        <label className="label">Password</label>
        <input className="input" type="password" placeholder="••••••••" />
      </div>

      {/* Added the onClick handler to the button */}
      <button className="btn-primary" onClick={handleCreateAccount}>
        Create Account
      </button>
    </>
  );
}