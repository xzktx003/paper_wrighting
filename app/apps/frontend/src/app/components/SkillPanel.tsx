import React, { useState, useEffect } from 'react';
import { listSkills, getSkill, createSkill, deleteSkill, reloadSkills, SkillInfo } from '../api/skillApi';

interface Props {
  globalSkills: string[];
  chapterSkills: string[];
  onActivateSkill: (skillName: string) => void;
}

const typeColors: Record<string, string> = {
  writing: '#1976d2',
  research: '#7b1fa2',
  review: '#e65100',
  analysis: '#2e7d32',
  utility: '#6a1b9a',
  experiment: '#455a64',
  methodology: '#00695c',
  argumentation: '#bf360c',
};

const typeOrder = ['all', 'writing', 'research', 'experiment', 'review', 'analysis', 'methodology', 'argumentation', 'utility'];

export function SkillPanel({ globalSkills, chapterSkills, onActivateSkill }: Props) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillPrompts, setSkillPrompts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', display_name: '', description: '', type: 'writing', trigger: 'manual', prompt: '' });

  const refreshSkills = () => listSkills().then(setSkills).catch((err) => { console.error('Failed to load skills:', err); });

  useEffect(() => { refreshSkills(); }, []);

  const handleExpand = async (name: string) => {
    if (expandedSkill === name) {
      setExpandedSkill(null);
      return;
    }
    setExpandedSkill(name);
    if (!skillPrompts[name]) {
      const detail = await getSkill(name);
      setSkillPrompts(prev => ({ ...prev, [name]: detail.prompt || 'No prompt content' }));
    }
  };

  const handleCreate = async () => {
    if (!newSkill.name || !newSkill.prompt) return;
    await createSkill(newSkill);
    setNewSkill({ name: '', display_name: '', description: '', type: 'writing', trigger: 'manual', prompt: '' });
    setShowCreate(false);
    refreshSkills();
  };

  const handleDelete = async (name: string) => {
    await deleteSkill(name);
    refreshSkills();
  };

  const handleReload = async () => {
    await reloadSkills();
    refreshSkills();
  };

  const filtered = skills.filter(s => {
    if (filter !== 'all' && s.type !== filter) return false;
    if (search && !s.display_name?.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isActive = (name: string) => globalSkills.includes(name) || chapterSkills.includes(name);

  const typeCounts: Record<string, number> = {};
  for (const s of skills) {
    const t = s.type || 'utility';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  return (
    <div style={{ fontSize: '12px' }}>
      <div style={{ padding: '4px 8px', display: 'flex', gap: '4px' }}>
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '3px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box' }}
        />
        <button
          onClick={handleReload}
          title="Reload skills"
          style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}
        >
          ↻
        </button>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #1976d2', borderRadius: '3px', background: showCreate ? '#1976d2' : '#fff', color: showCreate ? '#fff' : '#1976d2', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + Add
        </button>
      </div>

      {showCreate && (
        <div style={{ padding: '8px', margin: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', background: '#fafafa' }}>
          <div style={{ marginBottom: '6px' }}>
            <input placeholder="Skill name (slug)" value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
              style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box', marginBottom: '4px' }} />
            <input placeholder="Display name" value={newSkill.display_name} onChange={e => setNewSkill(p => ({ ...p, display_name: e.target.value }))}
              style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box', marginBottom: '4px' }} />
            <input placeholder="Description" value={newSkill.description} onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
              style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box', marginBottom: '4px' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            <select value={newSkill.type} onChange={e => setNewSkill(p => ({ ...p, type: e.target.value }))}
              style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px' }}>
              {typeOrder.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={newSkill.trigger} onChange={e => setNewSkill(p => ({ ...p, trigger: e.target.value }))}
              style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px' }}>
              <option value="manual">manual</option>
              <option value="auto">auto</option>
            </select>
          </div>
          <textarea placeholder="Prompt content..." value={newSkill.prompt} onChange={e => setNewSkill(p => ({ ...p, prompt: e.target.value }))}
            style={{ width: '100%', height: '80px', padding: '4px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '3px 8px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCreate} style={{ padding: '3px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', background: '#1976d2', color: '#fff', cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}

      {/* Tags toggle */}
      <div
        onClick={() => setTagsExpanded(!tagsExpanded)}
        style={{ padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', userSelect: 'none', color: '#666', fontSize: '11px' }}
      >
        <span style={{ fontSize: '9px', transition: 'transform 0.15s', transform: tagsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        <span>Tags</span>
        {filter !== 'all' && (
          <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: typeColors[filter] || '#999', color: '#fff', marginLeft: '4px' }}>
            {filter}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#aaa' }}>{filtered.length} skills</span>
      </div>

      {tagsExpanded && (
        <div style={{ padding: '4px 8px', display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {typeOrder.map(t => {
            const count = t === 'all' ? skills.length : (typeCounts[t] || 0);
            if (t !== 'all' && count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  padding: '2px 6px', fontSize: '10px', border: '1px solid #ddd',
                  borderRadius: '3px', cursor: 'pointer',
                  background: filter === t ? (typeColors[t] || '#1976d2') : '#fff',
                  color: filter === t ? '#fff' : '#333',
                  transition: 'all 0.15s',
                }}
              >
                {t}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ padding: '2px 8px', fontSize: '10px', color: '#888' }}>
        {globalSkills.length} active
      </div>

      <div style={{ maxHeight: '350px', overflow: 'auto' }}>
        {filtered.map(skill => (
          <div key={skill.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
            <div
              style={{
                padding: '6px 8px', cursor: 'pointer',
                background: isActive(skill.name) ? '#e8f5e9' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <div
                onClick={() => onActivateSkill(skill.name)}
                style={{
                  width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                  border: isActive(skill.name) ? '2px solid #4caf50' : '2px solid #ccc',
                  background: isActive(skill.name) ? '#4caf50' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '10px', fontWeight: 'bold',
                }}
              >
                {isActive(skill.name) ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => onActivateSkill(skill.name)}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {skill.display_name || skill.name}
                </div>
                <div style={{ color: '#888', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {skill.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: typeColors[skill.type] || '#999', color: '#fff' }}>
                  {skill.type}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExpand(skill.name); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 2px', color: '#666' }}
                  title="View skill details"
                >
                  {expandedSkill === skill.name ? '▲' : '▼'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(skill.name); }}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', padding: '0 2px', color: '#d32f2f' }}
                  title="Delete skill"
                >
                  ×
                </button>
              </div>
            </div>
            {expandedSkill === skill.name && (
              <div style={{ padding: '6px 12px', background: '#f9f9f9', fontSize: '11px', whiteSpace: 'pre-wrap', color: '#444', borderTop: '1px solid #eee', maxHeight: '200px', overflow: 'auto' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Prompt:</div>
                {skillPrompts[skill.name] || 'Loading...'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
