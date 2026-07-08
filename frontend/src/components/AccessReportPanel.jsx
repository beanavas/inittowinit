const STATUS_BADGE = {
  Provisioned: "badge-success",
  Pending: "badge-warning",
  Denied: "badge-danger",
};

export default function AccessReportPanel({ user, access, loading, error }) {
  return (
    <div className="card access-report-panel">
      <div className="card-title">Access Report</div>
      <p className="card-subtitle">Current provisioning status for the selected person.</p>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-line">Loading...</div>}

      {user && (
        <div className="access-report-profile">
          <div className="user-avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <div className="access-report-name">{user.name}</div>
            <div className="access-report-meta">
              {user.role} · {user.team}
            </div>
            <div className="access-report-meta">{user.department}</div>
          </div>
        </div>
      )}

      {access && (
        <div className="access-report-list">
          {access.access.length === 0 && (
            <div className="empty-state">No access provisioned yet.</div>
          )}
          {access.access.map((a) => (
            <div className="checklist-item" key={a.platform}>
              <span style={{ flex: 1 }}>{a.platform}</span>
              <span className={`badge ${STATUS_BADGE[a.status] || "badge-neutral"}`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
