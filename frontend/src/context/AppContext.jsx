import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AppContext = createContext(null);

const STORAGE_KEY = "flowaccess.employeeId";
const DEFAULT_EMPLOYEE_ID = "INT-001";
const LEGACY_DEFAULT_EMPLOYEE_ID = "E001";
const DEFAULT_MIGRATION_KEY = "flowaccess.employeeId.defaultMigrated";

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [employeeId, setEmployeeIdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_EMPLOYEE_ID
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
    if (!users.length) return;
    const defaultUser = users.find((user) => user.employeeId === DEFAULT_EMPLOYEE_ID);
    const hasCurrentUser = users.some((user) => user.employeeId === employeeId);
    const needsLegacyDefaultMigration =
      employeeId === LEGACY_DEFAULT_EMPLOYEE_ID &&
      defaultUser &&
      !localStorage.getItem(DEFAULT_MIGRATION_KEY);

    if (hasCurrentUser && !needsLegacyDefaultMigration) return;

    const fallbackEmployeeId = defaultUser?.employeeId || users[0].employeeId;
    localStorage.setItem(STORAGE_KEY, fallbackEmployeeId);
    localStorage.setItem(DEFAULT_MIGRATION_KEY, "true");
    setEmployeeIdState(fallbackEmployeeId);
  }, [employeeId, users]);

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
