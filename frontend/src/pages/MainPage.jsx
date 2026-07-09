import { useEffect, useMemo, useState } from "react";
import { BASE_URL, api } from "../api";
import { useApp } from "../context/AppContext";
import { useCopilotChat } from "../hooks/useCopilotChat";
import AssistantDrawer from "../layout/AssistantDrawer";
import AccessReportPanel from "../components/AccessReportPanel";
import AccessGraph from "../components/AccessGraph";
import GraphLegend from "../components/GraphLegend";
import SponsorList from "../components/SponsorList";

const DEFAULT_TECHNOLOGY = "GitHub";

export default function MainPage() {
  const { employeeId, setEmployeeId, users, currentUser, backendOnline } = useApp();
  const [platforms, setPlatforms] = useState([]);
  const [technology, setTechnology] = useState(DEFAULT_TECHNOLOGY);
  const [access, setAccess] = useState(null);
  const [graph, setGraph] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [error, setError] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedGraphEmployee, setSelectedGraphEmployee] = useState(null);
  const [chatDrivenGraph, setChatDrivenGraph] = useState(false);
  const [showScoreFormula, setShowScoreFormula] = useState(false);
  const chat = useCopilotChat(employeeId);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const aIsIntern = a.employeeId.startsWith("INT-");
        const bIsIntern = b.employeeId.startsWith("INT-");
        if (aIsIntern !== bIsIntern) return aIsIntern ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [users]
  );

  useEffect(() => {
    api.listPlatforms().then(setPlatforms).catch(() => {});
  }, []);

  const resetToDefaultTechnology = (id) => {
    if (!id) return;
    setChatDrivenGraph(false);
    setTechnology(DEFAULT_TECHNOLOGY);
  };

  // Default the graph to GitHub until the console/chat points it at something
  // more specific.
  useEffect(() => {
    resetToDefaultTechnology(employeeId);
  }, [employeeId]);

  // The console drives the graph: whichever platform comes up in a chat answer
  // becomes the focus, overriding the default above. Default to a tighter
  // 1-hop view here since a chat-driven lookup is usually about one specific
  // tool/person, not the whole network.
  useEffect(() => {
    if (chat.focusPlatform) {
      setChatDrivenGraph(true);
      setTechnology(chat.focusPlatform);
    }
  }, [chat.focusPlatform]);

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
    setSelectedGraphEmployee(null);
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

  const askSponsorForHelp = (sponsor) => {
    chat.sendMessage(
      `Can you help me draft a message asking ${sponsor.name} (${sponsor.role}) to sponsor my access request for ${technology}?`
    );
    setAssistantOpen(true);
  };

  return (
    <div className="app-shell-single">
      {!backendOnline && (
        <div className="offline-banner">
          Can't reach the backend at {BASE_URL} — make sure the FastAPI server is running.
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
            placeholder={'Ask Claude anything — e.g. "who can help with my Claude Code request?"'}
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
            {sortedUsers.map((u) => (
              <option key={u.employeeId} value={u.employeeId}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="main-body">
        <AccessReportPanel
          user={currentUser}
          access={access}
          loading={loadingAccess}
          error={!access ? error : null}
          platforms={platforms}
          selectedEmployee={selectedGraphEmployee}
          users={users}
        />

        <div className="graph-panel">
          <div className="card">
            <div className="card-title">
              Access &amp; Support Network{technology ? ` — ${technology}` : ""}
            </div>
            <p className="card-subtitle">
              Who's connected to {currentUser?.name || "the selected person"} and how they relate to{" "}
              {technology || "this tool"}. Ask Claude about a different tool above to update this view.
            </p>

            {error && <div className="error-banner">{error}</div>}
            {loadingGraph && <div className="loading-line">Mapping the org network...</div>}
            {graph && (
              <AccessGraph
                graph={graph}
                onNodeSelect={(node) => setSelectedGraphEmployee(node.data)}
                defaultHopFilter={chatDrivenGraph ? "1" : "all"}
              />
            )}
            {graph && <GraphLegend />}
          </div>
        </div>

        {graph && (
          <div className="sponsor-panel">
            <div className="card">
              <div className="card-title">Top Access Guides</div>
              <p className="card-subtitle">
                Ranked by relevance to your {technology} request.{" "}
                <a
                  className="score-formula-link"
                  href="#access-guide-score-formula"
                  onClick={(event) => {
                    event.preventDefault();
                    setShowScoreFormula((current) => !current);
                  }}
                >
                  {showScoreFormula ? "Hide scoring formula" : "See scoring formula"}
                </a>
              </p>
              {showScoreFormula && (
                <div className="score-formula-panel" id="access-guide-score-formula">
                  <code className="score-formula-code">
                    relevanceScore = 100 * weightedScore * accessPenalty
                  </code>
                  <div className="score-formula-text">
                    weightedScore = 0.22 orgProximity + 0.36 technologyExpertise + 0.18 relationship + 0.14 approvalHistory + 0.10 availability.
                  </div>
                  <div className="score-formula-text">
                    accessPenalty is 1.00 for active access, 0.55 for pending access, and 0.35 for no access.
                  </div>
                  <dl className="score-formula-definitions">
                    <div>
                      <dt>relevanceScore</dt>
                      <dd>The final guide score shown in the list, converted to a 0-100 scale.</dd>
                    </div>
                    <div>
                      <dt>weightedScore</dt>
                      <dd>The blended signal score before access status is applied.</dd>
                    </div>
                    <div>
                      <dt>orgProximity</dt>
                      <dd>How close the person is to Beatriz in the org and collaboration graph.</dd>
                    </div>
                    <div>
                      <dt>technologyExpertise</dt>
                      <dd>How strongly the person uses the selected technology.</dd>
                    </div>
                    <div>
                      <dt>relationship</dt>
                      <dd>How directly the person is connected to Beatriz as a manager, teammate, or collaborator.</dd>
                    </div>
                    <div>
                      <dt>approvalHistory</dt>
                      <dd>Whether the person recently approved similar access requests for Beatriz.</dd>
                    </div>
                    <div>
                      <dt>availability</dt>
                      <dd>How likely the person is to respond quickly right now.</dd>
                    </div>
                    <div>
                      <dt>accessPenalty</dt>
                      <dd>A multiplier that favors people who already have active access to the selected technology.</dd>
                    </div>
                  </dl>
                </div>
              )}
              <SponsorList sponsors={graph.sponsorRanking} onAskForHelp={askSponsorForHelp} />
            </div>
          </div>
        )}
      </div>

      {!assistantOpen && (
        <button className="assistant-fab" onClick={() => setAssistantOpen(true)} aria-label="Open Claude Assistant">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4.3 3.6a.5.5 0 0 1-.7-.4V17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <circle cx="8.5" cy="10.5" r="1" fill="currentColor" />
            <circle cx="12" cy="10.5" r="1" fill="currentColor" />
            <circle cx="15.5" cy="10.5" r="1" fill="currentColor" />
          </svg>
        </button>
      )}

      <AssistantDrawer
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        messages={chat.messages}
        sending={chat.sending}
        onSend={chat.sendMessage}
        onClear={() => {
          chat.clear();
          resetToDefaultTechnology(employeeId);
        }}
      />
    </div>
  );
}
