import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'kitchen', client_name: '', location: '', unit_system: 'mm' });

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, modules(count)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) toast.error(error.message);
    else setProjects(data || []);
    setLoading(false);
  }

  async function createProject(e) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...form, user_id: user.id })
      .select()
      .single();

    if (error) return toast.error(error.message);
    toast.success('Project created!');
    setShowCreate(false);
    setForm({ name: '', type: 'kitchen', client_name: '', location: '', unit_system: 'mm' });
    navigate(`/project/${data.id}`);
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project and all its data?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Project deleted');
    loadProjects();
  }

  const badges = { kitchen: 'badge-kitchen', wardrobe: 'badge-wardrobe', other: 'badge-other' };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="text-surface-400 text-sm mt-1">Your kitchen and wardrobe projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Kitchens" value={projects.filter(p => p.type === 'kitchen').length} />
        <StatCard label="Wardrobes" value={projects.filter(p => p.type === 'wardrobe').length} />
        <StatCard label="Active" value={projects.filter(p => p.status === 'active').length} />
      </div>

      {/* Project list */}
      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">📐</div>
          <p className="text-surface-300 font-medium">No projects yet</p>
          <p className="text-surface-500 text-sm mt-1">Create your first kitchen or wardrobe project to get started</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
            <PlusIcon /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/project/${p.id}`)}
              className="card-hover flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center text-lg">
                {p.type === 'kitchen' ? '🍳' : p.type === 'wardrobe' ? '👔' : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                  <span className={badges[p.type]}>{p.type}</span>
                  <span className="badge bg-surface-700 text-surface-400">{p.unit_system}</span>
                </div>
                <p className="text-surface-500 text-xs mt-0.5 truncate">
                  {[p.client_name, p.location].filter(Boolean).join(' • ') || 'No client info'}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-surface-500">
                  {new Date(p.updated_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-surface-600">
                  {p.modules?.[0]?.count || 0} modules
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                className="p-2 rounded-lg hover:bg-red-600/10 text-surface-600 hover:text-red-400 transition-colors"
                title="Delete project"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-700">
              <h2 className="section-title">New Project</h2>
            </div>
            <form onSubmit={createProject} className="p-5 space-y-4">
              <div>
                <label>Project Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kumar Kitchen Redesign"
                  className="w-full mt-1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full mt-1">
                    <option value="kitchen">Kitchen</option>
                    <option value="wardrobe">Wardrobe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label>Unit System</label>
                  <select value={form.unit_system} onChange={e => setForm(f => ({ ...f, unit_system: e.target.value }))} className="w-full mt-1">
                    <option value="mm">Millimeters (mm)</option>
                    <option value="inches">Inches</option>
                    <option value="ft-in">Feet-Inches</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Client Name</label>
                <input
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder="Client name"
                  className="w-full mt-1"
                />
              </div>
              <div>
                <label>Location</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Site location"
                  className="w-full mt-1"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
