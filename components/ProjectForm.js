"use client";
import { useState } from "react";
import { useRouter } from "next/navigation"; // 1. Import the router

export default function ProjectForm() {
  const router = useRouter(); // 2. Initialize the router
  const [selectedTone, setSelectedTone] = useState("Neutral");
  const [selectedPrivacy, setSelectedPrivacy] = useState("Standard");

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

  // 3. Create a submit handler
  const handleSubmit = () => {
    // You can grab your state here if you need to send it to an API or state manager
    console.log({ selectedTone, selectedPrivacy });
    
    // Navigate to the source quality page
    router.push("/sourcequality"); 
  };

  return (
    <div className="form-card">
      <h2 className="section-title">Upload Document</h2>
      <div className="upload-box">
        <p>Drop your file here, or click to browse</p>
        <span style={{fontSize: '12px', color: '#64748b'}}>Supported: PDF, DOCX, TXT</span>
      </div>

      <div className="language-grid" style={{marginTop: '30px'}}>
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
            <div style={{fontSize: '11px', opacity: 0.7}}>{t.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Privacy Level</h2>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px'}}>
        {["Standard", "Confidential", "Restricted"].map(level => (
          <div key={level} onClick={() => setSelectedPrivacy(level)} style={getPrivacyStyle(level)}>
            <strong>{level}</strong>
          </div>
        ))}
      </div>

      {/* 4. Attach the handler to the onClick event */}
      <button className="submit-btn" onClick={handleSubmit}>Submit→</button>
      <div style={{clear: 'both'}}></div>
    </div>
  );
}