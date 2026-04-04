import IssueCard from '../../components/IssueCard';

export default function SourceQualityCheck() {
    const segments = [
        {
            id: "01",
            title: "The Ministry of Health and Family Welfare announces new health...",
            fullText: "The Ministry of Health and Family Welfare announces new health initiatives for rural areas.",
            status: "clean"
        },
        {
            id: "02",
            title: "This programe will provide acces to healthcare services in...",
            fullText: "This programe will provide acces to healthcare services in remote villages across the nation.",
            status: "error",
            errors: [
                { type: 'Spelling', original: 'programe', suggestion: 'programme' },
                { type: 'Spelling', original: 'acces', suggestion: 'access' }
            ]
        },
        {
            id: "03",
            title: "The initative includes mobile medical units, telemedicine...",
            fullText: "The initative includes mobile medical units, telemedicine and local clinics.",
            status: "error",
            errors: [
                { type: 'Spelling', original: 'initative', suggestion: 'initiative' }
            ]
        },
        {
            id: "04",
            title: "Priority will be given to areas with limited infrastructure...",
            fullText: "Priority will be given to areas with limited infrastructure and high poverty rates.",
            status: "clean"
        },
        {
            id: "05",
            title: "The government has allocated approximatly 500 crore rupees for...",
            fullText: "The government has allocated approximatly 500 crore rupees for this project in the current fiscal year.",
            status: "error",
            errors: [
                { type: 'Spelling', original: 'approximatly', suggestion: 'approximately' }
            ]
        },
        {
            id: "06",
            title: "State goverments are expected to contribute matching funds...",
            fullText: "State goverments are expected to contribute matching funds for the expansion phase.",
            status: "error",
            errors: [
                { type: 'Spelling', original: 'goverments', suggestion: 'governments' }
            ]
        },
        {
            id: "07",
            title: "The scheme aims to reduce maternal mortality rates and improve...",
            fullText: "The scheme aims to reduce maternal mortality rates and improve child nutrition outcomes.",
            status: "clean"
        },
        {
            id: "08",
            title: "Healthcare workers will recieve specialised training in...",
            fullText: "Healthcare workers will recieve specialised training in preventive care and emergency response.",
            status: "error",
            errors: [
                { type: 'Spelling', original: 'recieve', suggestion: 'receive' },
                { type: 'Grammar', original: 'specialised', suggestion: 'specialized', note: 'Use American English spelling for consistency' }
            ]
        },
        {
            id: "09",
            title: "The Ministry will also establish partnerships with NGOs and...",
            fullText: "The Ministry will also establish partnerships with NGOs and private sector providers.",
            status: "clean"
        },
        {
            id: "10",
            title: "Implementation will begin in Q2 2026 with pilot programs in...",
            fullText: "Implementation will begin in Q2 2026 with pilot programs in select districts.",
            status: "clean"
        }
    ];

    return (
        <div className="page-container">

            {/* ── Page Header ── */}
            <h1 className="page-title">Source quality check</h1>
            <p className="page-subtitle">
                Reviewing spelling and grammar before translation. Review and fix any issues found.
            </p>

            {/* ── Stat Cards ── */}
            <div className="stats-grid">
                <div className="stat-card-red">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#f87171' }}>Spelling Errors</p>
                        <p className="stat-number" style={{ color: '#dc2626' }}>6</p>
                    </div>
                </div>

                <div className="stat-card-orange">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#fb923c' }}>Grammar Issues</p>
                        <p className="stat-number" style={{ color: '#ea580c' }}>1</p>
                    </div>
                </div>

                <div className="stat-card-green">
                    <div className="stat-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                    </div>
                    <div>
                        <p className="stat-label" style={{ color: '#4ade80' }}>Segments Parsed</p>
                        <p className="stat-number" style={{ color: '#16a34a' }}>10</p>
                    </div>
                </div>
            </div>

            {/* ── Segments List ── */}
            <div className="segments-list">
                {segments.map(s => (
                    <IssueCard key={s.id} {...s} />
                ))}
            </div>

            {/* ── Proceed Button ── */}
            <div className="proceed-btn-wrap">
                <button className="btn-proceed">
                    Proceed to Translation
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>

        </div>
    );
}