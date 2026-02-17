import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('std_templates');
  const TABS = [
    { key: 'std_templates', label: 'Standard Templates' },
    { key: 'mod_templates', label: 'Module Templates' },
    { key: 'users', label: 'Users' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Admin Panel</h1>
        <p className="text-surface-400 text-sm mt-1">Manage global templates and users</p>
      </div>

      <div className="flex gap-1 border-b border-surface-700">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold ${activeTab === t.key ? 'tab-active' : 'tab-inactive'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'std_templates' && <StandardTemplatesSection />}
      {activeTab === 'mod_templates' && <ModuleTemplatesSection />}
      {activeTab === 'users' && <UsersSection />}
    </div>
  );
}

/* ── Standard Templates ── */
function StandardTemplatesSection() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'kitchen', standards_json: '[]', is_global: true });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('standard_templates').select('*').order('created_at', { ascending: false });
    setTemplates(data || []);
  }

  async function save(e) {
    e.preventDefault();
    try {
      JSON.parse(form.standards_json);
    } catch {
      return toast.error('Invalid JSON in standards data');
    }

    const payload = {
      ...form,
      standards_json: JSON.parse(form.standards_json),
      user_id: user.id,
    };
    delete payload.id;
    delete payload.created_at;

    if (editing === 'new') {
      const { error } = await supabase.from('standard_templates').insert(payload);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('standard_templates').update(payload).eq('id', editing);
      if (error) return toast.error(error.message);
    }
    toast.success('Template saved');
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this template?')) return;
    await supabase.from('standard_templates').delete().eq('id', id);
    toast.success('Deleted');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditing('new'); setForm({ name: '', description: '', type: 'kitchen', standards_json: '[]', is_global: true }); }} className="btn-primary btn-sm">
          + New Template
        </button>
      </div>

      <div className="grid gap-3">
        {templates.map(t => (
          <div key={t.id} className="card flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">{t.name}</h3>
              <p className="text-surface-500 text-xs">{t.description || 'No description'} • {t.type} • {t.is_global ? '🌐 Global' : '🔒 Private'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(t.id); setForm({ ...t, standards_json: JSON.stringify(t.standards_json, null, 2) }); }} className="btn-ghost btn-sm">Edit</button>
              <button onClick={() => remove(t.id)} className="btn-ghost btn-sm text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-700">
              <h2 className="section-title">{editing === 'new' ? 'New' : 'Edit'} Standard Template</h2>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label>Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full mt-1" required /></div>
              <div><label>Description</label><input value={form.description||''} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="w-full mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Type</label>
                  <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="w-full mt-1">
                    <option value="kitchen">Kitchen</option>
                    <option value="wardrobe">Wardrobe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={form.is_global} onChange={e => setForm(f=>({...f,is_global:e.target.checked}))} className="w-4 h-4" />
                  <span className="text-sm text-surface-300">Global (visible to all)</span>
                </div>
              </div>
              <div>
                <label>Standards JSON</label>
                <textarea
                  value={form.standards_json}
                  onChange={e => setForm(f=>({...f,standards_json:e.target.value}))}
                  className="w-full mt-1 font-mono text-xs h-40"
                  placeholder='[{"name":"Carcass","category":"carcass","material":"HDHMR","thickness_mm":18}]'
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Module Templates ── */
function ModuleTemplatesSection() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'kitchen', module_json: '{}', is_global: true });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('module_templates').select('*').order('created_at', { ascending: false });
    setTemplates(data || []);
  }

  async function save(e) {
    e.preventDefault();
    try { JSON.parse(form.module_json); } catch { return toast.error('Invalid JSON'); }

    const payload = { ...form, module_json: JSON.parse(form.module_json), user_id: user.id };
    delete payload.id;
    delete payload.created_at;

    if (editing === 'new') {
      const { error } = await supabase.from('module_templates').insert(payload);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('module_templates').update(payload).eq('id', editing);
      if (error) return toast.error(error.message);
    }
    toast.success('Template saved');
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete?')) return;
    await supabase.from('module_templates').delete().eq('id', id);
    toast.success('Deleted');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">{templates.length} module template{templates.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditing('new'); setForm({ name: '', description: '', type: 'kitchen', module_json: '{}', is_global: true }); }} className="btn-primary btn-sm">+ New Template</button>
      </div>

      <div className="grid gap-3">
        {templates.map(t => (
          <div key={t.id} className="card flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white text-sm">{t.name}</h3>
              <p className="text-surface-500 text-xs">{t.description || 'No description'} • {t.type} • {t.is_global ? '🌐 Global' : '🔒 Private'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(t.id); setForm({ ...t, module_json: JSON.stringify(t.module_json, null, 2) }); }} className="btn-ghost btn-sm">Edit</button>
              <button onClick={() => remove(t.id)} className="btn-ghost btn-sm text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-700">
              <h2 className="section-title">{editing === 'new' ? 'New' : 'Edit'} Module Template</h2>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div><label>Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full mt-1" required /></div>
              <div><label>Description</label><input value={form.description||''} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="w-full mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Type</label>
                  <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="w-full mt-1">
                    <option value="kitchen">Kitchen</option>
                    <option value="wardrobe">Wardrobe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={form.is_global} onChange={e => setForm(f=>({...f,is_global:e.target.checked}))} className="w-4 h-4" />
                  <span className="text-sm text-surface-300">Global</span>
                </div>
              </div>
              <div>
                <label>Module JSON</label>
                <textarea
                  value={form.module_json}
                  onChange={e => setForm(f=>({...f,module_json:e.target.value}))}
                  className="w-full mt-1 font-mono text-xs h-40"
                  placeholder='{"name":"Base 600","module_type":"base","width_mm":600,"height_mm":720,"depth_mm":550}'
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Users ── */
function UsersSection() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setUsers(data || []);
    });
  }, []);

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Set ${u.email} to "${newRole}"?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
    if (error) return toast.error(error.message);
    toast.success(`Role updated to ${newRole}`);
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: newRole } : p));
  }

  return (
    <div className="space-y-4">
      <p className="text-surface-400 text-sm">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
      <div className="table-container">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium text-white">{u.full_name || '—'}</td>
                <td className="text-surface-300">{u.email}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'bg-amber-500/15 text-amber-400' : 'bg-surface-700 text-surface-400'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="text-surface-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => toggleRole(u)} className="btn-ghost btn-sm text-xs">
                    {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
