import { Handle, Position } from "reactflow";

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

  return (
    <div className="employee-node">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <div
        className={`employee-avatar${data.isCurrentUser ? " current" : ""}${
          data.isStrongSponsor ? " strong" : ""
        }`}
        style={{ borderColor: ringColor }}
      >
        {initials(data.name)}
      </div>
      <div className="employee-node-name">{data.isCurrentUser ? "You" : data.name}</div>
      <div className="employee-node-role">{data.role}</div>
      <div className="badge employee-node-status" style={{ background: `${ringColor}1f`, color: ringColor }}>
        {data.accessStatus}
      </div>
      {data.isStrongSponsor && !data.isCurrentUser && (
        <div className="badge badge-primary employee-node-status">Strong Sponsor</div>
      )}
    </div>
  );
}
