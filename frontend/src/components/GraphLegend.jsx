const EDGE_ITEMS = [
  { label: "Team", swatchClass: "legend-line team" },
  { label: "Common Tool", swatchClass: "legend-line tool" },
  { label: "Works With", swatchClass: "legend-line works" },
];

export default function GraphLegend() {
  return (
    <div className="graph-legend">
      {EDGE_ITEMS.map((item) => (
        <div className="legend-item" key={item.label}>
          <span className={item.swatchClass} />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="legend-divider" />
      <div className="legend-item">
        <span className="legend-dot you" />
        <span>You</span>
      </div>
      <div className="legend-item">
        <span className="legend-dot strong" />
        <span>Strong Sponsor</span>
      </div>
    </div>
  );
}
