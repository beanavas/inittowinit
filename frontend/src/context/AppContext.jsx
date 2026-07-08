import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AppContext = createContext(null);

const STORAGE_KEY = "flowaccess.employeeId";

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [employeeId, setEmployeeIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "E001"
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    api
      .listUsers()
      .then((list) => {
        setUsers(list);
        setBackendOnline(true);
      })
      .catch(() => setBackendOnline(false))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    api
      .getUser(employeeId)
      .then((u) => {
        setCurrentUser(u);
        setBackendOnline(true);
      })
      .catch(() => setBackendOnline(false));
  }, [employeeId]);

  const setEmployeeId = useCallback((id) => {
    localStorage.setItem(STORAGE_KEY, id);
    setEmployeeIdState(id);
  }, []);

  return (
    <AppContext.Provider
      value={{ users, loadingUsers, employeeId, setEmployeeId, currentUser, backendOnline }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
