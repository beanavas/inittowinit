import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

function storageKey(employeeId) {
  return `flowaccess.chat.${employeeId}`;
}

export function useCopilotChat(employeeId) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [focusPlatform, setFocusPlatform] = useState(null);

  useEffect(() => {
    if (!employeeId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(employeeId)) || "[]");
      setMessages(saved);
    } catch {
      setMessages([]);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) return;
    localStorage.setItem(storageKey(employeeId), JSON.stringify(messages.slice(-50)));
  }, [messages, employeeId]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || !employeeId) return;
      const userMsg = { id: crypto.randomUUID(), role: "user", content: text };
      // Only thread the last few exchanges into the model — older turns are kept
      // in the UI/localStorage but dropped from context so a topic from many
      // messages ago can't keep pulling every new answer back toward it.
      const history = messages
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      try {
        const res = await api.askAssistant({ employeeId, prompt: text, history });
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: res.answer, data: res.data, source: res.source },
        ]);
        if (res.focusPlatform) setFocusPlatform(res.focusPlatform);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: err.message, error: true },
        ]);
      } finally {
        setSending(false);
      }
    },
    [employeeId, messages]
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, sending, sendMessage, clear, focusPlatform };
}
