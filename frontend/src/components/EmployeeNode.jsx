function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function EmployeeNode({ data }) {
  const ringColor = data.isCurrentUser ? "#007bc3" : data.visual?.ringColor || "#94a3b3";
  const heatColor = data.visual?.heatColor || "#94a3b3";
  const score = Number(data.relevanceScore || 0);
  const scoreOpacity = data.isCurrentUser ? 1 : Math.max(0.18, Math.min(score / 100, 0.95));

  return (
    <div className={`employee-node${data.isCurrentUser ? " current" : ""}${data.isStrongSponsor ? " strong" : ""}`}>
      <div
        className={`employee-avatar${data.isCurrentUser ? " current" : ""}${data.isStrongSponsor ? " strong" : ""}`}
        style={{
          borderColor: ringColor,
          background: data.isCurrentUser
            ? "#ffffff"
            : `color-mix(in srgb, ${heatColor} ${Math.round(scoreOpacity * 28)}%, #ffffff)`,
          boxShadow: data.isStrongSponsor
            ? `0 0 0 4px rgba(217, 151, 0, 0.18), 0 8px 22px rgba(0, 31, 69, 0.16)`
            : undefined,
        }}
      >
        {data.isStrongSponsor && !data.isCurrentUser && <span className="strong-sponsor-star">★</span>}
        {initials(data.name)}
      </div>
      <div className="employee-node-name">{data.isCurrentUser ? "You" : data.name}</div>
      <div className="employee-node-role">{data.role}</div>
      <div className="employee-node-score" style={{ color: heatColor }}>
        {data.isCurrentUser ? "Requester" : `${data.relevanceScore} match`}
      </div>
      <div className="employee-node-chip" style={{ borderColor: `${ringColor}66`, color: ringColor }}>
        {data.accessStatus}
      </div>
    </div>
  );
}
