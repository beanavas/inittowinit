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

  // The console can also point the "Selected" tab at whoever a question named
  // (e.g. "What access does Leah have?"), reusing the same node-select flow as
  // clicking her in the graph. Prefer the richer graph node if she's in view;
  // otherwise fall back to her plain directory profile + memberships.
  useEffect(() => {
    if (!chat.focusEmployeeId) return;
    const graphNode = graph?.nodes?.find((n) => n.data.employeeId === chat.focusEmployeeId)?.data;
    if (graphNode) {
      setSelectedGraphEmployee(graphNode);
      return;
    }
    const user = users.find((u) => u.employeeId === chat.focusEmployeeId);
    if (user) {
      setSelectedGraphEmployee({
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
        title: user.title,
        team: user.team,
        department: user.department,
        manager: user.manager,
        mail: user.mail,
        memberships: user.memberships || [],
        accessStatus: null,
        usageIntensity: null,
        relevanceScore: null,
        hopDistance: null,
        isCurrentUser: user.employeeId === employeeId,
      });
    }
  }, [chat.focusEmployeeId]);

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
              <p className="card-subtitle">Ranked by relevance to your {technology} request.</p>
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
