import { ChatPage } from "./messaging/Messaging";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import { ForumProvider } from "./context";
import { Landing } from "./Landing";
import { Shell } from "./Shell";
import {
  ForumHome,
  Messages,
  NewTopic,
  NotFound,
  Profile,
  SearchPage,
  TopicPage,
} from "./pages";
import "./styles.css";
import { RouteEffects } from "./navigation";
import "./refinements.css";
import "./market/market.css";
import "./scroll-layout.css";
import "./detail-actions.css";
import "./messaging/messages.css";
function App() {
  return (
    <BrowserRouter>
      <ForumProvider>
        <RouteEffects />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Shell />}>
            <Route path="/forum" element={<ForumHome />} />
            <Route
              path="/board/help"
              element={<Navigate to="/board/life" replace />}
            />
            <Route path="/board/:boardId" element={<ForumHome />} />
            <Route path="/topic/:id" element={<TopicPage />} />
            <Route path="/new" element={<NewTopic />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/chat/:id" element={<ChatPage />} />
            <Route path="/messages/people/:peerId" element={<ChatPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ForumProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
