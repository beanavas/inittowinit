import { useEffect, useState } from "react";
import { api } from "../api";

const STATUS_CONFIG = {
  Provisioned: { cls: "badge-success", label: "Provisioned" },
  Pending:     { cls: "badge-warning", label: "Waiting Approval" },
  Denied:      { cls: "badge-danger",  label: "Denied" },
};

const PROFILE_FIELDS = [
  { label: "Full Name",  key: "name" },
  { label: "User ID",    key: "employeeId" },
  { label: "Title",      key: "role" },
  { label: "Department", key: "department" },
  { label: "Manager",    key: "manager" },
  { label: "Team",       key: "team" },
];

function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatUsage(value) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function SelectedEmployeeDetails({ employee }) {
  const [showAllGroups, setShowAllGroups] = useState(false);

  if (!employee) {
    return (
      <div className="empty-state selected-employee-empty">
        Select a node in the graph to inspect that employee's access signals.
      </div>
    );
  }

  const accessGroups = employee.memberships || [];
  const visibleGroups = showAllGroups ? accessGroups : accessGroups.slice(0, 6);
  const hiddenCount = accessGroups.length - visibleGroups.length;
  const fields = [
    { label: "Access", value: employee.accessStatus },
    { label: "Usage", value: formatUsage(employee.usageIntensity) },
    { label: "Match", value: employee.isCurrentUser ? "Requester" : `${employee.relevanceScore}%` },
    {
      label: "Hop Distance",
      value: employee.hopDistance === 0 ? "You" : `${employee.hopDistance} hop${employee.hopDistance === 1 ? "" : "s"}`,
    },
    { label: "Department", value: employee.department },
  ];
  if (employee.mail) fields.push({ label: "Email", value: employee.mail });

  return (
    <div className="selected-employee-detail">
      <div className="team-member-header" style={{ marginBottom: 10 }}>
        <div className="user-avatar" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>
          {initials(employee.name)}
        </div>
        <div>
          <div className="team-member-name">{employee.isCurrentUser ? "You" : employee.name}</div>
          <div className="access-report-meta">
            {employee.title || employee.role} · {employee.team}
          </div>
        </div>
      </div>

      <div className="profile-fields">
        {fields.map(({ label, value }) => (
          <div className="profile-field-row" key={label}>
            <span className="profile-field-label">{label}</span>
            <span className="profile-field-value">{value}</span>
          </div>
        ))}
      </div>

      {accessGroups.length > 0 && (
        <>
          <div className="section-label">Access Groups ({accessGroups.length})</div>
          <div className="access-groups-wrap">
            {visibleGroups.map((g) => (
              <span className="badge badge-neutral" key={g}>{g}</span>
            ))}
            {hiddenCount > 0 && (
              <button className="badge badge-neutral access-groups-toggle" onClick={() => setShowAllGroups(true)}>
                +{hiddenCount} more
              </button>
            )}
            {showAllGroups && accessGroups.length > 6 && (
              <button className="badge badge-neutral access-groups-toggle" onClick={() => setShowAllGroups(false)}>
                Show less
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AccessReportPanel({ user, access, loading, error, platforms = [], selectedEmployee }) {
  const [view, setView]                 = useState("mine");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDataByTeam, setTeamDataByTeam] = useState({});
  const [teamLoading, setTeamLoading]   = useState(false);
  const [teamError, setTeamError]       = useState(null);

  const platformMap = Object.fromEntries(platforms.map((p) => [p.platform, p]));
  const userTeams = user ? [...new Set([user.team, ...(user.additionalTeams || [])])] : [];

  // Switching the selected employee invalidates any cached team data / selection.
  useEffect(() => {
    setSelectedTeam(null);
    setTeamDataByTeam({});
    setTeamError(null);
  }, [user?.employeeId]);

  const fetchTeam = (team) => {
    if (!team || teamDataByTeam[team]) return;
    setTeamLoading(true);
    api
      .getTeamHeatmap(team)
      .then((d) => { setTeamDataByTeam((prev) => ({ ...prev, [team]: d })); setTeamError(null); })
      .catch((e) => setTeamError(e.message))
      .finally(() => setTeamLoading(false));
  };

  useEffect(() => {
    if (selectedEmployee) setView("selected");
  }, [selectedEmployee]);

  const handleTeamClick = () => {
    setView("team");
    const team = selectedTeam || userTeams[0];
    if (!selectedTeam) setSelectedTeam(team);
    fetchTeam(team);
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    fetchTeam(team);
  };

  const teamData = selectedTeam ? teamDataByTeam[selectedTeam] : null;

  return (
    <div className="card access-report-panel">

      {/* Header + toggle */}
      <div className="card-title">Access Report</div>
      {user && (
        <div className="view-toggle view-toggle-full">
          <button
            className={`view-toggle-btn${view === "mine" ? " active" : ""}`}
            onClick={() => setView("mine")}
          >
            My Access
          </button>
          <button
            className={`view-toggle-btn${view === "team" ? " active" : ""}`}
            onClick={handleTeamClick}
          >
            Team Access
          </button>
          <button
            className={`view-toggle-btn${view === "selected" ? " active" : ""}`}
            onClick={() => setView("selected")}
          >
            Selected
          </button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-line">Loading...</div>}

      {/* MY ACCESS */}
      {view === "mine" && (
        <>
          {user && (
            <div className="profile-fields">
              {PROFILE_FIELDS.map(({ label, key }) => (
                <div className="profile-field-row" key={key}>
                  <span className="profile-field-label">{label}</span>
                  <span className="profile-field-value">{user[key]}</span>
                </div>
              ))}
            </div>
          )}

          {access && (
            <div className="access-report-list">
              <div className="section-label">Memberships ({access.access.length})</div>
              {access.access.length === 0 && (
                <div className="empty-state">No access provisioned yet.</div>
              )}
              {access.access.map((a) => {
                const catalog = platformMap[a.platform];
                const { cls, label } = STATUS_CONFIG[a.status] || { cls: "badge-neutral", label: a.status };
                return (
                  <div className="membership-item" key={a.platform}>
                    <div className="membership-info">
                      <div className="membership-platform">{a.platform}</div>
                      {catalog?.accessCode && (
                        <div className="membership-code">{catalog.accessCode}</div>
                      )}
                    </div>
                    <span className={`badge ${cls}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TEAM ACCESS */}
      {view === "team" && (
        <>
          {userTeams.length > 1 && (
            <div className="view-toggle team-switch">
              {userTeams.map((team) => (
                <button
                  key={team}
                  className={`view-toggle-btn${selectedTeam === team ? " active" : ""}`}
                  onClick={() => handleTeamSelect(team)}
                >
                  {team}
                </button>
              ))}
            </div>
          )}

          {teamError && <div className="error-banner">{teamError}</div>}
          {teamLoading && <div className="loading-line">Loading team data...</div>}

          {teamData && (
            <>
              <div className="team-stats-section">
                <div className="section-label">Team Adoption — {teamData.team}</div>
                {Object.entries(teamData.platformStats).map(([platform, pct]) => (
                  <div className="adoption-row" key={platform}>
                    <span className="adoption-platform">{platform}</span>
                    <div className="adoption-bar-wrap">
                      <div className="adoption-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="adoption-pct">{Math.round(pct)}%</span>
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ marginTop: 16 }}>
                {teamData.totalMembers} member{teamData.totalMembers !== 1 ? "s" : ""}
              </div>
              {teamData.members.map((member) => (
                <div className="team-member-row" key={member.employeeId}>
                  <div className="team-member-header">
                    <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
                      {initials(member.name)}
                    </div>
                    <div>
                      <div className="team-member-name">{member.name}</div>
                      <div className="access-report-meta">{member.role}</div>
                    </div>
                  </div>
                  <div className="team-member-access">
                    {member.access.length === 0 ? (
                      <span className="no-access-label">No provisioned access</span>
                    ) : (
                      member.access.map((p) => (
                        <span key={p} className="badge badge-primary access-chip">{p}</span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* SELECTED EMPLOYEE */}
      {view === "selected" && (
        <SelectedEmployeeDetails employee={selectedEmployee} key={selectedEmployee?.employeeId} />
      )}
    </div>
  );
}
