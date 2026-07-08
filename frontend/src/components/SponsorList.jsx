export default function SponsorList({ sponsors }) {
  if (!sponsors || sponsors.length === 0) {
    return <div className="empty-state">No connected colleagues found for this tool yet.</div>;
  }

  return (
    <div>
      {sponsors.slice(0, 6).map((s, i) => (
        <div className="sponsor-list-item" key={s.employeeId}>
          <div className="sponsor-rank">{i + 1}</div>
          <div className="sponsor-info">
            <div className="sponsor-info-top">
              <div className="sponsor-name-row">
                {s.name}
                {s.isStrongSponsor && (
                  <span className="badge badge-primary" style={{ marginLeft: 6 }}>
                    Top Match
                  </span>
                )}
              </div>
              <div className="sponsor-score">{s.relevanceScore}</div>
            </div>
            <div className="sponsor-meta">
              {s.role} · {s.team}
            </div>
            <div className="sponsor-tags">
              {s.reasons.map((r, idx) => (
                <span className="badge badge-neutral" key={idx}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
