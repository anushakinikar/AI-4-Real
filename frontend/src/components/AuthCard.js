"use client";

import { useState } from "react";

export default function AuthCard() {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("user");

  return (
    <div className="card">

      {/* TOP SWITCH */}
      <div className="top-toggle">
        <button
          className={mode==="login" ? "top-active" : ""}
          onClick={()=>setMode("login")}
        >
          Sign In
        </button>
        <button
          className={mode==="register" ? "top-active" : ""}
          onClick={()=>setMode("register")}
        >
          Register
        </button>
      </div>

      {/* TITLE */}
      <div className="title">
        {mode === "login" ? "Welcome Back" : "Create Account"}
      </div>

      <div className="subtitle">
        {mode === "login"
          ? "Sign in to continue to VaaniSetu"
          : "Join VaaniSetu to start translating"}
      </div>

      {/* ROLE TOGGLE */}
      <div className="role-toggle">
        <button
          className={role==="user" ? "role-active" : ""}
          onClick={()=>setRole("user")}
        >
          User
        </button>
        <button
          className={role==="linguist" ? "role-active" : ""}
          onClick={()=>setRole("linguist")}
        >
          Linguist
        </button>
      </div>

      {/* LOGIN FORM */}
      {mode === "login" && (
        <>
          <input className="input" placeholder="Email Address" />
          <input className="input" type="password" placeholder="Password" />
          <div className="link">Forgot Password?</div>
          <button className="btn">Sign In</button>
        </>
      )}

      {/* REGISTER FORM */}
      {mode === "register" && (
        <>
          <input className="input" placeholder="Full Name" />
          <input className="input" placeholder="Email Address" />
          
          {role === "linguist" && (
            <input
              className="input"
              placeholder="Language (e.g. English, Hindi)"
            />
          )}

          <input className="input" type="password" placeholder="Password" />
          <input className="input" type="password" placeholder="Confirm Password" />

          <button className="btn">Create Account</button>
        </>
      )}

    </div>
  );
}