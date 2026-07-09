import { useEffect, useRef, useState } from "react";

const QUICK_PROMPTS = [
  { title: "What should I request?", subtitle: "Get personalized platform recommendations" },
  { title: "I need help getting access to Claude Code", subtitle: "See the access code, steps, and who can sponsor it" },
  { title: "Who can sponsor my request?", subtitle: "Find the best person to ask for help" },
  { title: "What's the status of my requests?", subtitle: "Check other in-flight requests" },
  { title: "Explain why I need this access", subtitle: "Help me write a justification" },
];

const STATUS_BADGE_CLASS = {
  provisioned: "badge-success",
  approved: "badge-success",
  pending: "badge-warning",
  waiting: "badge-warning",
  denied: "badge-danger",
  rejected: "badge-danger",
};

function isTableDivider(line) {
  return /^\s*\|?\s*[-:|\s]+\|?\s*$/.test(line);
}

function splitTableLine(line) {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, arr) => !(i === 0 && c === "" && arr.length > 1))
    .filter((c, i, arr) => !(i === arr.length - 1 && c === "" && arr.length > 1));
}

function parseBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim() || "";
    if (!line) {
      i += 1;
      continue;
    }

    const next = lines[i + 1]?.trim() || "";
    const looksLikeTableHeader = line.includes("|") && isTableDivider(next);
    if (looksLikeTableHeader) {
      const headers = splitTableLine(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && (lines[i].trim().includes("|") || isTableDivider(lines[i].trim()))) {
        if (!isTableDivider(lines[i].trim())) {
          rows.push(splitTableLine(lines[i]));
        }
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] || "").trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "steps", items });
      continue;
    }

    const paragraph = [];
    while (i < lines.length) {
      const current = lines[i]?.trim() || "";
      const upcoming = lines[i + 1]?.trim() || "";
      if (!current) break;
      if (current.includes("|") && isTableDivider(upcoming)) break;
      if (/^\d+\.\s+/.test(current)) break;
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
    }
  }

  return blocks;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={idx}>{part.slice(1, -1)}</code>;
    }
    return <span key={idx}>{part}</span>;
  });
}

function statusBadge(value) {
  const normalized = value.trim().toLowerCase();
  const hit = Object.keys(STATUS_BADGE_CLASS).find((k) => normalized.includes(k));
  if (!hit) return null;
  return <span className={`badge ${STATUS_BADGE_CLASS[hit]}`}>{value}</span>;
}

function AssistantMessageContent({ content }) {
  const blocks = parseBlocks(content);

  if (!blocks.length) return <>{content}</>;

  return (
    <div className="assistant-rich">
      {blocks.map((block, idx) => {
        if (block.type === "paragraph") {
          return (
            <p className="assistant-paragraph" key={idx}>
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === "steps") {
          return (
            <ol className="assistant-steps" key={idx}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div className="assistant-table-wrap" key={idx}>
              <table className="assistant-table">
                <thead>
                  <tr>
                    {block.headers.map((h, j) => (
                      <th key={j}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => {
                        const badge = statusBadge(cell);
                        const isCode = /(DEMO-ACC|ACC|GT-|AAD-|PIM-|RAS-|CTS-|GBTS-)/i.test(cell);
                        return (
                          <td key={c}>
                            {badge || (isCode ? <code>{cell}</code> : renderInline(cell))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function SourceCitation({ source }) {
  if (!source) return null;
  return <div className="chat-citation">Source: {source}</div>;
}

function DataDisclosure({ data }) {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <>
      <button className="chat-data-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide" : "Show"} data used
      </button>
      {open && <pre className="chat-data-panel">{JSON.stringify(data, null, 2)}</pre>}
    </>
  );
}

export default function AssistantDrawer({ open, onClose, messages, sending, onSend, onClear }) {
  const [draft, setDraft] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending, open]);

  if (!open) return null;

  const submit = (text) => {
    const value = (text ?? draft).trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  };

  return (
    <>
      <div className="copilot-drawer-backdrop" onClick={onClose} />
      <div className="copilot-drawer">
        <div className="copilot-drawer-header">
          <h3>Claude Assistant</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {messages.length > 0 && (
              <button className="drawer-text-btn" onClick={onClear}>
                New chat
              </button>
            )}
            <button onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className="copilot-drawer-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div style={{ marginBottom: 16 }}>
              {QUICK_PROMPTS.map((q) => (
                <button key={q.title} className="quick-prompt" onClick={() => submit(q.title)}>
                  <span>
                    <strong>{q.title}</strong>
                    <span>{q.subtitle}</span>
                  </span>
                  <span>›</span>
                </button>
              ))}
            </div>
          )}
          <div className="chat-thread">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.error ? "error" : m.role}`}>
                {m.role === "assistant" && !m.error ? (
                  <AssistantMessageContent content={m.content} />
                ) : (
                  m.content
                )}
                {m.role === "assistant" && !m.error && <DataDisclosure data={m.data} />}
                {m.role === "assistant" && !m.error && <SourceCitation source={m.source} />}
              </div>
            ))}
            {sending && (
              <div className="chat-bubble assistant">
                <span className="chat-typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="copilot-drawer-body" style={{ flex: "0 0 auto", paddingTop: 0 }}>
          {messages.length > 0 && (
            <div className="quick-actions-row">
              {QUICK_PROMPTS.map((q) => (
                <button key={q.title} className="quick-action-chip" onClick={() => submit(q.title)} disabled={sending}>
                  {q.title}
                </button>
              ))}
            </div>
          )}
          <div className="chat-composer">
            <input
              placeholder="Ask Claude anything about your access..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="btn btn-primary" onClick={() => submit()} disabled={sending || !draft.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
