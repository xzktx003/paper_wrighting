import { useState, useCallback } from 'react';
import { openProject, createProject } from '../api/projectApi';

export interface ProjectConfig {
  title: string;
  authors: string[];
  template: string;
  editor_mode: 'markdown' | 'latex';
  chapters: { file: string; skills: string[] }[];
  global_skills: string[];
  code?: { language: string; entry: string };
  files?: { path: string; type: 'file' | 'dir' }[];
}

export interface ProjectState {
  path: string | null;
  config: ProjectConfig | null;
  loading: boolean;
  error: string | null;
}

export function useProject() {
  const [project, setProject] = useState<ProjectState>({
    path: null, config: null, loading: false, error: null,
  });

  const open = useCallback(async (path: string) => {
    setProject(p => ({ ...p, loading: true, error: null }));
    try {
      const result = await openProject(path);
      setProject({ path: result.path, config: result.config, loading: false, error: null });
    } catch (e: any) {
      setProject(p => ({ ...p, loading: false, error: e.message }));
    }
  }, []);

  const create = useCallback(async (path: string, config: ProjectConfig) => {
    setProject(p => ({ ...p, loading: true, error: null }));
    try {
      const result = await createProject(path, config);
      setProject({ path: result.path, config: result.config, loading: false, error: null });
    } catch (e: any) {
      setProject(p => ({ ...p, loading: false, error: e.message }));
    }
  }, []);

  return { project, open, create, setProject };
}
