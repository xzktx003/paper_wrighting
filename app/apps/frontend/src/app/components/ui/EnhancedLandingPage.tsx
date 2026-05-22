import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Spinner, tokens } from './DesignSystem';
import { ProjectEmptyState, LoadingState, ErrorState } from './EnhancedEmptyStates';

interface Project {
  id: string;
  name: string;
  path: string;
  updated_at?: number;
  created_at?: number;
}

export function EnhancedLandingPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const data = await res.json();
      if (data.project) {
        navigate(`/project/${data.project.id}`);
      }
    } catch (e) {
      console.error('Failed to create project:', e);
    } finally {
      setCreating(false);
      setShowNewDialog(false);
      setNewProjectName('');
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '24px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: tokens.radius.lg,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: tokens.shadow.glow('var(--accent)'),
          }}>
            📝
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text)',
            }}>
              Paper Writer
            </h1>
            <p style={{
              margin: '2px 0 0',
              fontSize: '12px',
              color: 'var(--muted)',
            }}>
              智能论文写作助手
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Search */}
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索项目..."
            icon={<span style={{ fontSize: '14px' }}>🔍</span>}
            style={{ width: '240px' }}
          />

          {/* New project button */}
          <Button variant="primary" onClick={() => setShowNewDialog(true)}>
            + 新建项目
          </Button>
        </div>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        padding: '32px',
        overflow: 'auto',
      }}>
        {loading ? (
          <LoadingState message="加载项目中..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchProjects} />
        ) : filteredProjects.length === 0 ? (
          searchQuery ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p style={{ fontSize: '14px' }}>没有找到匹配的项目</p>
            </div>
          ) : (
            <ProjectEmptyState onAction={() => setShowNewDialog(true)} />
          )
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/project/${project.id}`)}
                onDelete={() => deleteProject(project.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </main>

      {/* New project dialog */}
      {showNewDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowNewDialog(false)}
        >
          <div style={{
            background: 'var(--paper)',
            borderRadius: tokens.radius.xl,
            padding: '24px',
            width: '400px',
            boxShadow: tokens.shadow.lg,
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>
              创建新项目
            </h3>
            <Input
              label="项目名称"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="例如：我的论文"
              autoFocus
              onKeyDown={(e: any) => e.key === 'Enter' && createProject()}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px',
            }}>
              <Button variant="ghost" onClick={() => setShowNewDialog(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={createProject}
                disabled={!newProjectName.trim() || creating}
                loading={creating}
              >
                创建
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Project Card Component
function ProjectCard({
  project,
  onOpen,
  onDelete,
  formatDate,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  formatDate: (timestamp?: number) => string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      padding="none"
      hover
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Card header with gradient */}
      <div style={{
        height: '80px',
        background: `linear-gradient(135deg, var(--accent-soft) 0%, var(--accent-light) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          fontSize: '32px',
          opacity: 0.8,
        }}>
          📄
        </div>

        {/* Actions overlay */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px',
          opacity: hovered ? 1 : 0,
          transition: `opacity ${tokens.transition.fast}`,
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: tokens.radius.md,
              background: 'rgba(255,255,255,0.9)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: `all ${tokens.transition.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
              e.currentTarget.style.color = 'inherit';
            }}
            title="删除项目"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Card content */}
      <div style={{ padding: '16px' }}>
        <h3 style={{
          margin: '0 0 8px',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.name}
        </h3>
        <div style={{
          fontSize: '11px',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>📅 {formatDate(project.updated_at || project.created_at)}</span>
        </div>
      </div>
    </Card>
  );
}