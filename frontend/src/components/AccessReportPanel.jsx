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

// Fixed hue order — a platform's color never depends on any one employee's
// membership list, so the same platform always gets the same bubble color.
const PLATFORM_PALETTE = [
  { bg: "#e6f2fa", fg: "#0d5c96", dot: "#2a78d6" }, // blue
  { bg: "#e3f7f0", fg: "#0f7a58", dot: "#1baf7a" }, // aqua
  { bg: "#fdf3dc", fg: "#8a6300", dot: "#eda100" }, // yellow
  { bg: "#e3f3e3", fg: "#146214", dot: "#008300" }, // green
  { bg: "#ece9f9", fg: "#3c2f86", dot: "#4a3aa7" }, // violet
  { bg: "#fbe9e9", fg: "#a83231", dot: "#e34948" }, // red
  { bg: "#fbebf1", fg: "#a8446a", dot: "#e87ba4" }, // magenta
  { bg: "#fdecdf", fg: "#a8461a", dot: "#eb6834" }, // orange
];

function buildPlatformColorMap(platforms) {
  const map = new Map();
  platforms.forEach((p, i) => map.set(p.platform, PLATFORM_PALETTE[i % PLATFORM_PALETTE.length]));
  return map;
}

// Maps every access code (base or tier) back to the platform + tier label it belongs to.
function buildAccessIndex(platforms) {
  const map = new Map();
  platforms.forEach((p) => {
    if (p.accessCode) map.set(p.accessCode, { platform: p.platform, tier: null });
    (p.accessTiers || []).forEach((t) => {
      map.set(t.accessCode, { platform: p.platform, tier: t.name });
    });
  });
  return map;
}

function groupAccessCodes(codes, accessIndex) {
  const groups = new Map();
  const other = [];
  codes.forEach((code) => {
    const entry = accessIndex.get(code);
    if (!entry) {
      other.push(code);
      return;
    }
    if (!groups.has(entry.platform)) groups.set(entry.platform, []);
    groups.get(entry.platform).push({ code, tier: entry.tier });
  });
  return { groups, other };
}

// Groups a flat list of raw access codes into colored per-platform bubbles.
// Shared by the "My Access" and "Selected" tabs so both show every code an
// employee holds, not just the catalog's base code for each platform.
function AccessCodeGroups({ codes, platforms, statusByPlatform }) {
  const [showAll, setShowAll] = useState(false);

  if (!codes.length) return null;

  const colorMap = buildPlatformColorMap(platforms);
  const accessIndex = buildAccessIndex(platforms);
  const { groups, other } = groupAccessCodes(codes, accessIndex);
  const orderedPlatforms = platforms.map((p) => p.platform).filter((name) => groups.has(name));
  const totalSections = orderedPlatforms.length + (other.length > 0 ? 1 : 0);
  const visiblePlatforms = showAll ? orderedPlatforms : orderedPlatforms.slice(0, 5);
  const showOther = showAll || visiblePlatforms.length === orderedPlatforms.length;
  const hiddenCount = totalSections - visiblePlatforms.length - (showOther && other.length > 0 ? 1 : 0);

  return (
    <div className="access-groups-grouped">
      {visiblePlatforms.map((platformName) => {
        const items = groups.get(platformName);
        const color = colorMap.get(platformName) || PLATFORM_PALETTE[0];
        const status = statusByPlatform?.[platformName];
        const statusInfo = status && (STATUS_CONFIG[status] || { cls: "badge-neutral", label: status });
        return (
          <div className="platform-group" key={platformName}>
            <div className="platform-group-header">
              <div className="platform-bubble" style={{ background: color.bg, color: color.fg }}>
                <span className="platform-bubble-dot" style={{ background: color.dot }} />
                {platformName}
              </div>
              {statusInfo && <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>}
            </div>
            <div className="platform-group-items">
              {items.map(({ code, tier }) => (
                <span className="badge badge-neutral platform-tier-chip" key={code} title={tier || "Base access"}>
                  {code}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {showOther && other.length > 0 && (
        <div className="platform-group">
          <div className="platform-bubble platform-bubble-other">Other</div>
          <div className="platform-group-items">
            {other.map((code) => (
              <span className="badge badge-neutral" key={code}>{code}</span>
            ))}
          </div>
        </div>
      )}
      {hiddenCount > 0 && (
        <button className="badge badge-neutral access-groups-toggle" onClick={() => setShowAll(true)} style={{ alignSelf: "flex-start" }}>
          +{hiddenCount} more platform{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
      {showAll && totalSections > 5 && (
        <button className="badge badge-neutral access-groups-toggle" onClick={() => setShowAll(false)} style={{ alignSelf: "flex-start" }}>
          Show less
        </button>
      )}
    </div>
  );
}

function SelectedEmployeeDetails({ employee, users = [], platforms = [] }) {
  if (!employee) {
    return (
      <div className="empty-state selected-employee-empty">
        Select a node in the graph to inspect that employee's access signals.
      </div>
    );
  }

  const accessGroups = employee.memberships || [];
  const directoryEmployee = users.find((user) => user.employeeId === employee.employeeId);
  const manager = employee.manager || directoryEmployee?.manager || "Unknown";
  const fields = [
    { label: "Access", value: employee.accessStatus || "Not in current graph" },
    { label: "Usage", value: formatUsage(employee.usageIntensity) },
    ...(employee.relevanceScore != null
      ? [{ label: "Match", value: employee.isCurrentUser ? "Requester" : `${employee.relevanceScore}%` }]
      : []),
    ...(employee.hopDistance != null
      ? [{
          label: "Hop Distance",
          value: employee.hopDistance === 0 ? "You" : `${employee.hopDistance} hop${employee.hopDistance === 1 ? "" : "s"}`,
        }]
      : []),
    { label: "Department", value: employee.department },
    { label: "Manager", value: manager },
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
          <AccessCodeGroups codes={accessGroups} platforms={platforms} />
        </>
      )}
    </div>
  );
}

export default function AccessReportPanel({ user, access, loading, error, platforms = [], selectedEmployee, users = [] }) {
  const [view, setView]                 = useState("mine");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDataByTeam, setTeamDataByTeam] = useState({});
  const [teamLoading, setTeamLoading]   = useState(false);
  const [teamError, setTeamError]       = useState(null);

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
              <div className="section-label">Access Groups ({(user?.memberships || []).length})</div>
              {(user?.memberships || []).length === 0 ? (
                <div className="empty-state">No access provisioned yet.</div>
              ) : (
                <AccessCodeGroups
                  codes={user.memberships}
                  platforms={platforms}
                  statusByPlatform={Object.fromEntries(access.access.map((a) => [a.platform, a.status]))}
                />
              )}
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
        <SelectedEmployeeDetails employee={selectedEmployee} key={selectedEmployee?.employeeId} users={users} platforms={platforms} />
      )}
    </div>
  );
}
