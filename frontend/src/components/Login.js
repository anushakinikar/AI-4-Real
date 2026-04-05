"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  // State for form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  // State for UI feedback
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent page reload
    setError("");
    setIsLoading(true);

    try {
      // Send POST request to your Fastify Backend
      const res = await fetch("http://localhost:8081/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to login");
      }

      // Login Successful!
      // Save the JWT token (for security, consider HttpOnly cookies in production, but localStorage is okay for fast development)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect the user to their dashboard or home page
      router.push("/upload");

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form-container">
      <div className="title">Welcome Back</div>
      <div className="subtitle">Sign in to continue your journey</div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleLogin} className="auth-form">
        <label className="label">Sign In as</label>
        <div className="toggle-group auth-role-group">
          <button
            type="button"
            className={`toggle-btn ${role === "user" ? "active" : ""}`}
            onClick={() => setRole("user")}
          >
            User
          </button>
          <button
            type="button"
            className={`toggle-btn ${role === "linguist" ? "active" : ""}`}
            onClick={() => setRole("linguist")}
          >
            Linguist
          </button>
          <button
            type="button"
            className={`toggle-btn ${role === "org" ? "active" : ""}`}
            onClick={() => setRole("org")}
          >
            Org Rep
          </button>
        </div>

        <div className="input-wrapper">
          <label className="label" htmlFor="email">Email Address</label>
          <input
            className="input"
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="input-wrapper">
          <label className="label" htmlFor="password">Password</label>
          <input
            className="input"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <div className="footer-link">Forgot Password?</div>

        <button
          type="submit"
          className="btn-primary auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
