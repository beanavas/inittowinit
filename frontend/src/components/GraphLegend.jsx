const EDGE_ITEMS = [
  { label: "Reports To", detail: "Org hierarchy", swatchClass: "legend-line reports" },
  { label: "Collaborates With", detail: "Works together", swatchClass: "legend-line collaborates" },
  { label: "Access Path", detail: "Suggested route", swatchClass: "legend-line access-path" },
];

export default function GraphLegend() {
  return (
    <div className="graph-legend">
      {EDGE_ITEMS.map((item) => (
        <div className="legend-item" key={item.label}>
          <span className={item.swatchClass} />
          <span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </span>
        </div>
      ))}
      <div className="legend-divider" />
      <div className="legend-item">
        <span className="legend-dot strong">★</span>
        <span>
          <strong>Top Access Guide</strong>
          <small>High relevance</small>
        </span>
      </div>
      <div className="legend-divider" />
      <div className="legend-hop-guide">
        <strong>Hop Distance</strong>
        <small>1 hop: direct teammate/manager connection</small>
        <small>2 hops: connected through one intermediary</small>
      </div>
    </div>
  );
}
