export default function RingGuide({ data }) {
  const size = data.radius * 2;
  return (
    <div
      className={`ring-guide ring-guide-${data.hop}`}
      style={{ width: size, height: size }}
    >
      <span className="ring-guide-label">{data.label}</span>
    </div>
  );
}
