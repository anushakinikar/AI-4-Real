import FloatingCard from '../components/FloatingCard';
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ backgroundColor: 'var(--bg-dark)' }}>
      {/* Navigation */}
      <nav style={{ padding: '25px 8%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.6rem', fontWeight: '800' }}>
          <div style={{ background: 'var(--primary-purple)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 15px rgba(138, 63, 252, 0.4)' }}>文A</div>
          VaaniSetu
        </div>
        <div style={{ display: 'flex', gap: '45px' }}>
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#use-cases" className="nav-link">Use Cases</a>
        </div>
        {/* Redirecting Get Started to a new page */}
        {/* Updated Link: points to the folder name, not the filename */}
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ boxShadow: '0 4px 15px rgba(138, 63, 252, 0.3)' }}>
            Get Started
          </button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section style={{ padding: '120px 8%', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '60px', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '4.8rem', lineHeight: '1.05', marginBottom: '30px', fontWeight: '800' }}>
            Break Language Barriers with <span style={{ color: 'var(--primary-purple)', textShadow: '0 0 30px rgba(138, 63, 252, 0.3)' }}>AI Precision</span>
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.25rem', marginBottom: '45px', maxWidth: '580px', lineHeight: '1.7' }}>
            Enterprise-grade translation platform powered by advanced AI, combining <strong>Glossary Management</strong>, RAG technology, and human expertise.
          </p>
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Start Free Trial Button Removed */}
            
            {/* Watch Demo Button Commented Out below */}
            {/* <Link href="/demo" className="btn-outline" style={{ padding: '16px 35px' }}>
              <span>▶</span> Watch Demo
            </Link> 
            */}

         
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <FloatingCard file="Document.pdf" lang="English → Spanish" pct={95} delay={0} yOffset={0} />
          <FloatingCard file="Contract.docx" lang="French → Japanese" pct={72} delay={0.6} yOffset={10} />
          <FloatingCard file="Report.pdf" lang="German → Hindi" pct={88} delay={1.2} yOffset={20} />
        </div>
      </section>

      {/* Enterprise-Grade Features Section */}
      <section id="features" style={{ padding: '120px 8%', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <span style={{ color: 'var(--primary-purple)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', fontSize: '0.9rem' }}>Core Capabilities</span>
          <h2 style={{ fontSize: '3.2rem', marginTop: '15px', fontWeight: '800' }}>Enterprise-Grade Features</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '1.15rem', maxWidth: '650px', margin: '20px auto 0', lineHeight: '1.6' }}>
            Powerful capabilities designed for global organizations that demand accuracy, consistency, and rapid scalability.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
          <FeatureCard 
            icon="🛡️" 
            title="Source Quality Validation" 
            desc="Advanced AI scans and validates source documents for clarity and consistency before translation begins." 
          />
          <FeatureCard 
            icon="🗄️" 
            title="RAG Translation Memory" 
            desc="Intelligent retrieval system learns from past translations to maintain terminology consistency across projects." 
          />
          <FeatureCard 
            icon="🧠" 
            title="Context-Aware AI Engine" 
            desc="State-of-the-art language models understand nuance, idioms, and cultural context for natural translations." 
          />
          <FeatureCard 
            icon="🔀" 
            title="Sensitivity-Aware Routing" 
            desc="Automatically routes sensitive or complex content to human experts while handling routine translations with AI." 
          />
          <FeatureCard 
            icon="👥" 
            title="Human-in-the-Loop Review" 
            desc="Seamless collaboration between AI and professional linguists ensures quality and cultural appropriateness." 
          />
          <FeatureCard 
            icon="🎨" 
            title="Style & Tone Control" 
            desc="Customize translation style, formality level, and brand voice to match your organization's requirements." 
          />
        </div>
      </section>

      {/* Minimalist Footer */}
      <footer style={{ padding: '40px 8%', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: '0.9rem' }}>© 2026 VaaniSetu. Built for Excellence.</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="icon-box">{icon}</div>
      <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', fontWeight: '700' }}>{title}</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: '1rem', lineHeight: '1.7' }}>{desc}</p>
    </div>
  );
}