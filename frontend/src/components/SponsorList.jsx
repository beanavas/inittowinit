import { useState } from "react";

const AVATAR_COLORS = ["#007bc3", "#1e7b45", "#a15c00", "#6d4aa8", "#c2410c", "#0f766e"];

function avatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function hopLabel(hopDistance) {
  if (hopDistance === undefined || hopDistance === null) return null;
  if (hopDistance <= 0) return "You";
  if (hopDistance === 1) return "1 hop away";
  return `${hopDistance} hops away`;
}

function usageTag(sponsor) {
  switch (sponsor.usageIntensity) {
    case "daily":
      return { label: "Uses daily", cls: "badge-success" };
    case "weekly":
      return { label: "Uses weekly", cls: "badge-success" };
    case "provisioned":
      return { label: "Has access", cls: "badge-success" };
    case "pending":
      return { label: "Pending access", cls: "badge-warning" };
    default:
      return null;
  }
}

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2L2 9.5l6.2 2.1L10.5 18 18 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function SponsorList({ sponsors, onAskForHelp }) {
  const [showAll, setShowAll] = useState(false);

  if (!sponsors || sponsors.length === 0) {
    return <div className="empty-state">No connected colleagues found for this tool yet.</div>;
  }

  const visible = showAll ? sponsors : sponsors.slice(0, 3);
  const remaining = sponsors.length - 3;

  return (
    <div>
      {visible.map((s, i) => {
        const usage = usageTag(s);
        const hop = hopLabel(s.hopDistance);
        return (
          <div className="sponsor-list-item" key={s.employeeId}>
            <div className="sponsor-rank">{i + 1}</div>
            <div className="sponsor-avatar" style={{ background: avatarColor(s.employeeId || s.name) }}>
              {initials(s.name)}
            </div>
            <div className="sponsor-info">
              <div className="sponsor-info-top">
                <div className="sponsor-name-row">
                  {s.name}
                  {(s.isStrongSponsor || s.isTopGuide) && (
                    <span className="best-match-tag">
                      <span className="best-match-star">★</span> Best match
                    </span>
                  )}
                </div>
                <div className="sponsor-score">{(s.relevanceScore / 100).toFixed(2)}</div>
              </div>
              <div className="sponsor-meta">
                {s.role}
                {hop && <> &middot; {hop}</>}
              </div>
              <div className="sponsor-tags">
                {usage && <span className={`badge ${usage.cls}`}>{usage.label}</span>}
                {s.reasons.map((r, idx) => (
                  <span className="badge badge-neutral" key={idx}>
                    {r}
                  </span>
                ))}
                <button className="ask-for-help-btn" onClick={() => onAskForHelp?.(s)}>
                  <SendIcon /> Ask for help
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {!showAll && remaining > 0 && (
        <button className="view-all-sponsors-link" onClick={() => setShowAll(true)}>
          View all {sponsors.length} people with access →
        </button>
      )}
      {showAll && sponsors.length > 3 && (
        <button className="view-all-sponsors-link" onClick={() => setShowAll(false)}>
          Show fewer ↑
        </button>
      )}
    </div>
  );
}
