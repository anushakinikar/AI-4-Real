// app/upload/layout.js

import "./upload_page.css";

export default function UploadLayout({ children }) {
  return (
    <section className="upload-container">
      {/* Do NOT use <html> or <body> here */}
      {children}
    </section>
  );
}