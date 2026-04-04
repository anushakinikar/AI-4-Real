// app/login/layout.js

import "./login_page.css";

export default function LoginLayout({ children }) {
  return (
    <div className="auth-wrapper" style={{ minHeight: '100vh', background: 'radial-gradient(circle, #3261ad, #0a2662)' }}>
      {/* This wraps ONLY the login and register components */}
      {children}
    </div>
  );
}