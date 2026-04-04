"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Register() {
  const [role, setRole] = useState("user");
  const router = useRouter();

  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (role === "org") {
      router.push("/glossary");
    } else {
      router.push("/upload");
    }
  };

  return (
    <div className="register-container">
      <div className="title">Create Account</div>
      <div className="subtitle">Join the VaaniSetu network today</div>

      <label className="label">Register as</label>
      <div className="toggle-group">
        {["user", "linguist", "org"].map((r) => (
          <button 
            key={r}
            className={`toggle-btn ${role === r ? "active" : ""}`} 
            onClick={() => setRole(r)}
          >
            {r === "org" ? "Org Representative" : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      <div className="input-wrapper">
        <label className="label">Full Name</label>
        <input className="input" placeholder="John Doe" />
      </div>

      <div className="input-wrapper">
        <label className="label">{role === "linguist" ? "Languages" : "Organization"}</label>
        <input className="input" placeholder={role === "linguist" ? "e.g. English, Marathi" : "Your company"} />
      </div>

      <button className="btn-primary" onClick={handleCreateAccount}>Create Account</button>
    </div>
  );
}