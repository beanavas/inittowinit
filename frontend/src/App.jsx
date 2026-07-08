import { AppProvider } from "./context/AppContext";
import MainPage from "./pages/MainPage";

function App() {
  return (
    <AppProvider>
      <MainPage />
    </AppProvider>
  );
}

export default App;
