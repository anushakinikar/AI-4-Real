"use client";
import { useState } from "react";

export default function ProjectForm() {
  const [selectedTone, setSelectedTone] = useState("Neutral");
  const [selectedPrivacy, setSelectedPrivacy] = useState("Standard");
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const handleFileSelection = (e) => {
    // Grab the first file the user selected
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  const handleUploadClick = async () => {
    if (!file) {
      setUploadStatus("Please select a file first.");
      return;
    }
    setUploadStatus("Uploading...");
    // CRITICAL: We must use FormData to send files over HTTP
    const formData = new FormData();
    formData.append("document", file); // "document" is the field name Fastify will look for (or default file field)
    try {
      const response = await fetch("http://localhost:8080/api/upload", {
        method: "POST",
        // Do NOT set "Content-Type" manually here. The browser automatically sets it to multipart/form-data with the correct boundary!
        body: formData,
      });
      if (response.ok) {
        setUploadStatus("Upload Successful!");
      } else {
        setUploadStatus("Upload Failed.");
      }
    } catch (error) {
      console.error(error);
      setUploadStatus("Error reaching the server.");
    }
  };
  const tones = [
    { name: "Formal", desc: "Professional, structured language" },
    { name: "Official", desc: "Strictly for government or corporate use" },
    { name: "Conversational", desc: "Friendly, natural tone" },
    { name: "Technical", desc: "Precise, industry-specific terms" },
    { name: "Neutral", desc: "Balanced, standard translation" }
  ];

  const languages = ["English", "Hindi", "Spanish", "French", "German"];
  const types = ["Business Email", "Technical Doc", "Legal", "HR", "Product", "Medical", "Finance"];

  const getPrivacyStyle = (level) => {
    const baseStyle = {
      padding: '25px',
      borderRadius: '16px',
      cursor: 'pointer',
      textAlign: 'center',
      transition: '0.2s',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e2e8f0',
      backgroundColor: '#ffffff',
      color: '#333'
    };

    if (selectedPrivacy === level) {
      switch (level) {
        case "Standard":
          return { ...baseStyle, backgroundColor: "#041530", color: "#fff", borderColor: "#041530" };
        case "Confidential":
          return { ...baseStyle, backgroundColor: "#fff7ed", color: "#9a3412", borderColor: "#fdba74" };
        case "Restricted":
          return { ...baseStyle, backgroundColor: "#fef2f2", color: "#991b1b", borderColor: "#fca5a5" };
        default: return baseStyle;
      }
    }
    return baseStyle;
  };

  return (
    <div className="form-card">
      <h2 className="section-title">Upload Document</h2>
      <div className="upload-box">
        <input type="file" onChange={handleFileSelection} />
        <button className="btn-primary">
          <p>Drop your file here, or click to browse</p>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Supported: PDF, DOCX, TXT</span>
        </button>
      </div>
      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        {file && <p style={{ fontSize: '14px', marginBottom: '10px' }}>Selected: {file.name}</p>}

        <button
          onClick={handleUploadClick}
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 24px', backgroundColor: '#8a3ffc' }}
        >
          Upload to Database
        </button>

        {uploadStatus && <div style={{ marginTop: '10px', fontSize: '14px', color: uploadStatus.includes("Failed") || uploadStatus.includes("Error") ? 'red' : 'green' }}>
          {uploadStatus}
        </div>}
      </div>
      {/* ------------------------------------------------ */}
      <div className="language-grid" style={{ marginTop: '30px' }}></div>

      <div className="language-grid" style={{ marginTop: '30px' }}>
        <div>
          <label className="input-label">Source Language</label>
          <select className="select-input" defaultValue="English">
            {languages.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Target Language</label>
          <select className="select-input" defaultValue="">
            <option value="" disabled>Select target language</option>
            {languages.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <h2 className="section-title">Document Type</h2>
      <select className="select-input">
        {types.map(type => <option key={type} value={type}>{type}</option>)}
      </select>

      <h2 className="section-title">Translation Tone</h2>
      <div className="card-grid">
        {tones.map((t) => (
          <div
            key={t.name}
            className={`option-card ${selectedTone === t.name ? 'active' : ''}`}
            onClick={() => setSelectedTone(t.name)}
          >
            <strong>{t.name}</strong>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Privacy Level</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
        {["Standard", "Confidential", "Restricted"].map(level => (
          <div key={level} onClick={() => setSelectedPrivacy(level)} style={getPrivacyStyle(level)}>
            <strong>{level}</strong>
          </div>
        ))}
      </div>

      <button className="submit-btn">Submit→</button>
      <div style={{ clear: 'both' }}></div>
    </div>
  );
}