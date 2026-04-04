export default function Sidebar() {
  const projects = [
    { name: "Legal Contract Translation", time: "2 hours ago", status: "Completed" },
    { name: "Medical Report - Hindi", time: "5 hours ago", status: "In Progress" },
    { name: "Technical Manual DE-EN", time: "1 day ago", status: "Completed" },
  ];

  return (
    <nav className="sidebar">
      <div className="logo">VaaniSetu</div>
      <button className="new-project-btn">+ New Project</button>
      
      <p className="recent-label">Recent Projects</p>
      <div className="project-list">
        {projects.map((p, i) => (
          <div key={i} className="project-item">
            <p className="project-name">{p.name}</p>
            <span className="project-time">{p.time}</span>
            <br />
            <span className={`status-badge ${p.status === 'Completed' ? 'status-completed' : 'status-progress'}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>

      <div className="user-profile">
        <img 
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" 
          alt="User" 
          className="profile-pic" 
        />
        <div className="user-info">
          <p style={{margin: 0, fontWeight: '600', fontSize: '14px'}}>John Doe</p>
          <span style={{fontSize: '11px', color: '#94a3b8'}}>Active Now</span>
        </div>
      </div>
    </nav>
  );
}