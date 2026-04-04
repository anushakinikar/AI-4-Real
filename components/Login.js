"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [role, setRole] = useState("user");
  const router = useRouter();

  const handleSignIn = (e) => {
    e.preventDefault();
    if (role === "org") {
      router.push("/glossary");
    } else {
      router.push("/upload");
    }
  };

  return (
    <div className="login-container">
      <div className="title">Welcome Back</div>
      <div className="subtitle">Sign in to continue your journey</div>

      <label className="label">Sign in as</label>
      <div className="toggle-group">
        {["user", "linguist", "org"].map((r) => (
          <button 
            key={r}
            className={`toggle-btn ${role === r ? "active" : ""}`} 
            onClick={() => setRole(r)}
          >
            {r === "org" ? "Org Rep" : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      <div className="input-wrapper">
        <label className="label">Email Address</label>
        <input className="input" type="email" placeholder="you@example.com" />
      </div>

      <div className="input-wrapper">
        <label className="label">Password</label>
        <input className="input" type="password" placeholder="••••••••" />
      </div>

      <button className="btn-primary" onClick={handleSignIn}>Sign In</button>
    </div>
  );
}