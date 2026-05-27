import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';

const EditorPage = lazy(() => import('./EditorPage'));
const LandingPage = lazy(() => import('./LandingPage'));
const ProjectPage = lazy(() => import('./ProjectPage'));
const CollabJoinPage = lazy(() => import('./CollabJoinPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted, #888)', fontSize: '14px' }}>
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes future={{ v7_relativeSplatPath: true }}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/projects" element={<ErrorBoundary><ProjectPage /></ErrorBoundary>} />
          <Route path="/editor/:projectId" element={<ErrorBoundary><EditorPage /></ErrorBoundary>} />
          <Route path="/collab" element={<ErrorBoundary><CollabJoinPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
