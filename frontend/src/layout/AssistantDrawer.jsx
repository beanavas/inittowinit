import { useEffect, useRef, useState } from "react";

const QUICK_PROMPTS = [
  { title: "What should I request?", subtitle: "Get personalized platform recommendations" },
  { title: "What's the status of my requests?", subtitle: "Check other in-flight requests" },
  { title: "Explain why I need this access", subtitle: "Help me write a justification" },
];

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
                {m.content}
                {m.role === "assistant" && !m.error && <DataDisclosure data={m.data} />}
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
