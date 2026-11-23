import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { AgentDemo } from "./pages/AgentDemo";
import { MovieCatalog } from "./pages/MovieCatalog";
import { MovieDetail } from "./pages/MovieDetail";
import { GraphExplorer } from "./pages/GraphExplorer";
import { SparqlConsole } from "./pages/SparqlConsole";
import { About } from "./pages/About";
import { SettingData } from "./pages/SettingData";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main application pages with standard Navbar & Footer */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="agent" element={<AgentDemo />} />
          <Route path="movies" element={<MovieCatalog />} />
          <Route path="movies/:movieId" element={<MovieDetail />} />
          <Route path="explore" element={<GraphExplorer />} />
          <Route path="sparql" element={<SparqlConsole />} />
          <Route path="about" element={<About />} />
        </Route>

        {/* Standalone admin settings page (no menubar/navbar) */}
        <Route path="/setting-data" element={<SettingData />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

