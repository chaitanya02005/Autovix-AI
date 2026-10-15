import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAuthToken, getAuthToken } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [currentRole, setCurrentRole] = useState('viewer');
  const [selectedTab, setSelectedTab] = useState('Dashboard');
  const [stats, setStats] = useState({
    documents_count: 0,
    entities_count: 0,
    questions_count: 0,
    active_document: null,
  });
  const [documents, setDocuments] = useState([]);
  const [documentReady, setDocumentReady] = useState(false);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch project stats and documents
  const refreshProjectData = useCallback(async (projId) => {
    if (!projId) return;
    try {
      const [statsData, docsData] = await Promise.all([
        api.getProjectStats(projId).catch(() => null),
        api.getDocuments(projId).catch(() => []),
      ]);

      if (statsData) {
        setStats(statsData);
        if (statsData.active_document) {
          setDocumentReady(true);
          setDocumentInfo(statsData.active_document);
        } else {
          setDocumentReady(false);
          setDocumentInfo(null);
        }
      }

      if (docsData) {
        setDocuments(docsData);
        if (!statsData?.active_document && docsData.length > 0) {
          setDocumentReady(true);
          setDocumentInfo({
            document_id: docsData[0].document_id,
            filename: docsData[0].filename,
            version: docsData[0].version,
            pages: docsData[0].pages,
            chunks: docsData[0].chunks,
            traceability_records: docsData[0].traceability_count,
            status: 'Processed',
          });
        }
      }
    } catch (err) {
      console.error('Error refreshing project data:', err);
    }
  }, []);

  // Initialize session & load projects on mount
  useEffect(() => {
    async function initSession() {
      setLoading(true);
      try {
        let session;
        if (!token) {
          session = await api.getSession();
        } else {
          try {
            session = await api.getMe().then((me) => ({ user: me, access_token: token }));
          } catch {
            session = await api.getSession();
          }
        }

        if (session && session.user) {
          setUser(session.user);
          setTokenState(session.access_token);
          setAuthToken(session.access_token);

          // Fetch projects
          const projs = await api.getProjects();
          setProjects(projs);

          if (projs.length > 0) {
            const initialProj = projs[0];
            setCurrentProjectId(initialProj.id);
            setCurrentProject(initialProj);
            setCurrentRole(initialProj.role);
            await refreshProjectData(initialProj.id);
          }
        }
      } catch (err) {
        console.error('Failed to initialize session:', err);
        addToast(`Initialization error: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [token, refreshProjectData, addToast]);

  // Switch workspace
  const switchProject = useCallback(async (projId) => {
    const proj = projects.find((p) => p.id === Number(projId));
    if (!proj) return;
    setCurrentProjectId(proj.id);
    setCurrentProject(proj);
    setCurrentRole(proj.role);
    setLastAnswer(null);
    setComparisonResult(null);
    await refreshProjectData(proj.id);
  }, [projects, refreshProjectData]);

  // Refresh project list
  const refreshProjects = useCallback(async () => {
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      return projs;
    } catch (err) {
      console.error('Failed to refresh projects:', err);
      return [];
    }
  }, []);

  const value = {
    user,
    token,
    projects,
    currentProjectId,
    currentProject,
    currentRole,
    selectedTab,
    setSelectedTab,
    stats,
    documents,
    documentReady,
    documentInfo,
    lastAnswer,
    setLastAnswer,
    comparisonResult,
    setComparisonResult,
    loading,
    toasts,
    addToast,
    removeToast,
    switchProject,
    refreshProjects,
    refreshProjectData: () => refreshProjectData(currentProjectId),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
