import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { useCopilotChat } from "../hooks/useCopilotChat";
import AssistantDrawer from "../layout/AssistantDrawer";
import AccessReportPanel from "../components/AccessReportPanel";
import AccessGraph from "../components/AccessGraph";
import GraphLegend from "../components/GraphLegend";
import SponsorList from "../components/SponsorList";

const FACTORS = [
  { key: "orgProximity", title: "Org Proximity", impact: "22% impact", desc: "Closer people in the org/collaboration graph can help faster." },
  { key: "technologyExpertise", title: "Tool Usage & Expertise", impact: "36% impact", desc: "They use this tool regularly and can explain practical setup details." },
  { key: "relationship", title: "Relationship", impact: "18% impact", desc: "Manager, teammate, or frequent collaborator." },
  { key: "approvalHistory", title: "Approval History", impact: "14% impact", desc: "Has sponsored similar requests for you before." },
  { key: "availability", title: "Availability", impact: "10% impact", desc: "Likely to respond quickly right now." },
];

export default function MainPage() {
  const { employeeId, setEmployeeId, users, currentUser, backendOnline } = useApp();
  const [platforms, setPlatforms] = useState([]);
  const [technology, setTechnology] = useState("");
  const [access, setAccess] = useState(null);
  const [graph, setGraph] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [error, setError] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chat = useCopilotChat(employeeId);

  useEffect(() => {
    api
      .listPlatforms()
      .then((list) => {
        setPlatforms(list);
        setTechnology((prev) => prev || list[0]?.platform || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    setLoadingAccess(true);
    api
      .getAccess(employeeId)
      .then((a) => setAccess(a))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingAccess(false));
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || !technology) return;
    setLoadingGraph(true);
    api
      .getAccessGraph(employeeId, technology)
      .then((g) => {
        setGraph(g);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingGraph(false));
  }, [employeeId, technology]);

  const submitQuery = () => {
    if (!query.trim()) return;
    chat.sendMessage(query.trim());
    setAssistantOpen(true);
    setQuery("");
  };

  return (
    <div className="app-shell-single">
      {!backendOnline && (
        <div className="offline-banner">
          Can't reach the backend at {import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"} — make
          sure the FastAPI server is running.
        </div>
      )}

      <div className="main-topbar">
        <div className="main-brand">
          <div className="main-brand-icon">FA</div>
          <div>
            <div className="main-brand-title">FlowAccess</div>
            <div className="main-brand-subtitle">Guided access. Faster approvals.</div>
          </div>
        </div>

        <div className="copilot-search">
          <input
            placeholder={'Ask Claude anything — e.g. "who can sponsor my Claude Code request?"'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitQuery()}
          />
          <button onClick={submitQuery} disabled={!query.trim()} aria-label="Ask">
            →
          </button>
        </div>

        <div className="picker-group">
          <select
            className="picker-select"
            value={employeeId || ""}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.employeeId} value={u.employeeId}>
                {u.name}
              </option>
            ))}
          </select>
          <select className="picker-select" value={technology} onChange={(e) => setTechnology(e.target.value)}>
            {platforms.map((p) => (
              <option key={p.platform} value={p.platform}>
                {p.platform}
              </option>
            ))}
          </select>
        </div>

        <button className="topbar-btn" onClick={() => setAssistantOpen(true)}>
          Chat with Claude
        </button>
      </div>

      <div className="main-body">
        <AccessReportPanel
          user={currentUser}
          access={access}
          loading={loadingAccess}
          error={!access ? error : null}
        />

        <div className="graph-panel">
          <div className="card">
            <div className="card-title">
              Access &amp; Sponsor Network{technology ? ` — ${technology}` : ""}
            </div>
            <p className="card-subtitle">
              Who's connected to {currentUser?.name || "the selected person"} and how they relate to{" "}
              {technology || "this tool"}.
            </p>

            {error && <div className="error-banner">{error}</div>}
            {loadingGraph && <div className="loading-line">Mapping the org network...</div>}
            {graph && <AccessGraph graph={graph} />}
            {graph && <GraphLegend />}

            {graph && (
              <>
                <div className="card-title">Top Sponsor Suggestions</div>
                <SponsorList sponsors={graph.sponsorRanking} />
                <div className="factor-grid">
                  {FACTORS.map((f) => (
                    <div className="factor-card" key={f.key}>
                      <div className="factor-card-title">{f.title}</div>
                      <p>{f.desc}</p>
                      <div className="factor-impact">{f.impact}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AssistantDrawer
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        messages={chat.messages}
        sending={chat.sending}
        onSend={chat.sendMessage}
      />
    </div>
  );
}
