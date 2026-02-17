import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDimension } from '../lib/units';
import { generateDoorSchedule } from '../lib/calculations/doorSchedule';
import { generateCutList } from '../lib/calculations/cutList';
import { generateMaterialTakeoff } from '../lib/calculations/materialTakeoff';
import { generateHardwareSchedule } from '../lib/calculations/hardwareSchedule';
import { exportCSV, exportPDF } from '../lib/exports';
import toast from 'react-hot-toast';

const DEFAULT_STANDARDS = [
  { name: 'Carcass', category: 'carcass', material: 'HDHMR', thickness_mm: 18, brand: 'Action Tesa', finish: 'Pre-Lam', rate_per_sqft: 55 },
  { name: 'Shutter', category: 'shutter', material: 'HDHMR + Laminate', thickness_mm: 18, brand: 'Merino', finish: 'Matte', rate_per_sqft: 85 },
  { name: 'Back Panel', category: 'back_panel', material: 'MR Ply', thickness_mm: 6, brand: '', finish: '', rate_per_sqft: 25 },
  { name: 'Countertop', category: 'countertop', material: 'Granite', thickness_mm: 20, brand: '', finish: 'Polished', rate_per_sqft: 120 },
  { name: 'Edge Band', category: 'edgeband', material: 'PVC Edge Band', thickness_mm: 1, edge_band_mm: 22, rate_per_unit: 3 },
  { name: 'Hardware', category: 'hardware', material: 'SS / Zinc', rate_per_unit: 45 },
];

const TABS = ['Standards', 'Modules', 'Outputs'];

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [standards, setStandards] = useState([]);
  const [modules, setModules] = useState([]);
  const [outputs, setOutputs] = useState({});
  const [activeTab, setActiveTab] = useState('Standards');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [pRes, sRes, mRes, oRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('standards').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('modules').select('*').eq('project_id', projectId).order('position_index'),
      supabase.from('outputs').select('*').eq('project_id', projectId),
    ]);
    if (pRes.error) { toast.error('Project not found'); navigate('/'); return; }
    setProject(pRes.data);
    setStandards(sRes.data || []);
    setModules(mRes.data || []);
    const oMap = {};
    (oRes.data || []).forEach(o => { oMap[o.output_type] = o.data; });
    setOutputs(oMap);
    setLoading(false);
  }, [projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Initialize defaults
  async function initDefaults() {
    const inserts = DEFAULT_STANDARDS.map(s => ({ ...s, project_id: projectId }));
    const { error } = await supabase.from('standards').insert(inserts);
    if (error) return toast.error(error.message);
    toast.success('Default standards loaded');
    load();
  }

  // Generate all outputs
  async function generateOutputs() {
    if (modules.length === 0) return toast.error('Add at least one module first');

    const doorSchedule = generateDoorSchedule(modules, standards);
    const cutList = generateCutList(modules, standards);
    const materialTakeoff = generateMaterialTakeoff(cutList, standards);
    const hardwareSchedule = generateHardwareSchedule(modules, standards);

    const entries = [
      { type: 'door_schedule', data: doorSchedule },
      { type: 'cut_list', data: cutList },
      { type: 'material_takeoff', data: materialTakeoff },
      { type: 'hardware_schedule', data: hardwareSchedule },
    ];

    for (const entry of entries) {
      // Upsert: delete old + insert new
      await supabase.from('outputs').delete().eq('project_id', projectId).eq('output_type', entry.type);
      await supabase.from('outputs').insert({
        project_id: projectId,
        output_type: entry.type,
        data: entry.data,
      });
    }

    setOutputs({
      door_schedule: doorSchedule,
      cut_list: cutList,
      material_takeoff: materialTakeoff,
      hardware_schedule: hardwareSchedule,
    });

    setActiveTab('Outputs');
    toast.success('All schedules generated!');
  }

  if (loading) return <div className="text-center py-12 text-surface-500">Loading project…</div>;
  if (!project) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <button onClick={() => navigate('/')} className="btn-ghost btn-sm mb-2">
            ← Back to Projects
          </button>
          <h1 className="page-title flex items-center gap-3">
            {project.type === 'kitchen' ? '🍳' : project.type === 'wardrobe' ? '👔' : '📦'}
            {project.name}
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {[project.client_name, project.location, project.unit_system.toUpperCase()].filter(Boolean).join(' • ')}
          </p>
        </div>
        <button onClick={generateOutputs} className="btn-primary">
          ⚡ Generate All Outputs
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-700">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
          >
            {tab}
            {tab === 'Modules' && <span className="ml-1.5 text-xs opacity-60">({modules.length})</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Standards' && (
        <StandardsTab
          standards={standards}
          projectId={projectId}
          onReload={load}
          onInitDefaults={initDefaults}
        />
      )}
      {activeTab === 'Modules' && (
        <ModulesTab
          modules={modules}
          projectId={projectId}
          unit={project.unit_system}
          onReload={load}
        />
      )}
      {activeTab === 'Outputs' && (
        <OutputsTab outputs={outputs} project={project} modules={modules} />
      )}
    </div>
  );
}

/* ═══════════════════════ STANDARDS TAB ═══════════════════════ */

function StandardsTab({ standards, projectId, onReload, onInitDefaults }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  function startEdit(std) {
    setEditing(std?.id || 'new');
    setForm(std || { name: '', category: 'carcass', material: '', thickness_mm: 18, brand: '', finish: '', rate_per_sqft: 0, rate_per_unit: 0, edge_band_mm: 0, notes: '' });
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form, project_id: projectId };
    delete payload.id;
    delete payload.created_at;

    if (editing === 'new') {
      const { error } = await supabase.from('standards').insert(payload);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('standards').update(payload).eq('id', editing);
      if (error) return toast.error(error.message);
    }
    toast.success('Standard saved');
    setEditing(null);
    onReload();
  }

  async function remove(id) {
    if (!confirm('Delete this standard?')) return;
    await supabase.from('standards').delete().eq('id', id);
    toast.success('Deleted');
    onReload();
  }

  if (standards.length === 0 && !editing) {
    return (
      <div className="card text-center py-12">
        <p className="text-surface-300 font-medium mb-2">No standards defined yet</p>
        <p className="text-surface-500 text-sm mb-4">Load defaults for kitchen/wardrobe or add custom standards</p>
        <div className="flex justify-center gap-3">
          <button onClick={onInitDefaults} className="btn-primary">Load Defaults</button>
          <button onClick={() => startEdit(null)} className="btn-secondary">Add Custom</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">{standards.length} standard{standards.length !== 1 ? 's' : ''} defined</p>
        <div className="flex gap-2">
          {standards.length > 0 && <button onClick={onInitDefaults} className="btn-ghost btn-sm">Reset to Defaults</button>}
          <button onClick={() => startEdit(null)} className="btn-secondary btn-sm">+ Add Standard</button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Material</th><th>Thickness</th><th>Brand</th><th>Finish</th><th>Rate</th><th></th>
            </tr>
          </thead>
          <tbody>
            {standards.map(s => (
              <tr key={s.id}>
                <td className="font-medium text-white">{s.name}</td>
                <td><span className="badge bg-surface-700 text-surface-300">{s.category}</span></td>
                <td>{s.material}</td>
                <td className="font-mono text-xs">{s.thickness_mm}mm</td>
                <td className="text-surface-400">{s.brand || '—'}</td>
                <td className="text-surface-400">{s.finish || '—'}</td>
                <td className="font-mono text-xs">
                  {s.rate_per_sqft ? `₹${s.rate_per_sqft}/sqft` : s.rate_per_unit ? `₹${s.rate_per_unit}/unit` : '—'}
                </td>
                <td className="text-right">
                  <button onClick={() => startEdit(s)} className="btn-ghost btn-sm">Edit</button>
                  <button onClick={() => remove(s.id)} className="btn-ghost btn-sm text-red-400">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-700">
              <h2 className="section-title">{editing === 'new' ? 'Add Standard' : 'Edit Standard'}</h2>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label>Name</label>
                  <input value={form.name||''} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full mt-1" required />
                </div>
                <div>
                  <label>Category</label>
                  <select value={form.category||''} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="w-full mt-1">
                    {['carcass','shutter','countertop','back_panel','hardware','edgeband','general'].map(c =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Material</label><input value={form.material||''} onChange={e => setForm(f => ({...f, material: e.target.value}))} className="w-full mt-1" /></div>
                <div><label>Thickness (mm)</label><input type="number" value={form.thickness_mm||0} onChange={e => setForm(f => ({...f, thickness_mm: +e.target.value}))} className="w-full mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label>Brand</label><input value={form.brand||''} onChange={e => setForm(f => ({...f, brand: e.target.value}))} className="w-full mt-1" /></div>
                <div><label>Finish</label><input value={form.finish||''} onChange={e => setForm(f => ({...f, finish: e.target.value}))} className="w-full mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label>Rate/sqft</label><input type="number" value={form.rate_per_sqft||0} onChange={e => setForm(f => ({...f, rate_per_sqft: +e.target.value}))} className="w-full mt-1" /></div>
                <div><label>Rate/unit</label><input type="number" value={form.rate_per_unit||0} onChange={e => setForm(f => ({...f, rate_per_unit: +e.target.value}))} className="w-full mt-1" /></div>
                <div><label>Edge Band (mm)</label><input type="number" value={form.edge_band_mm||0} onChange={e => setForm(f => ({...f, edge_band_mm: +e.target.value}))} className="w-full mt-1" /></div>
              </div>
              <div><label>Notes</label><input value={form.notes||''} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="w-full mt-1" /></div>
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

/* ═══════════════════════ MODULES TAB ═══════════════════════ */

function ModulesTab({ modules, projectId, unit, onReload }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const defaultModule = {
    name: '', module_type: 'base', zone: '', width_mm: 600, height_mm: 720, depth_mm: 550,
    door_count: 1, door_style: 'slab', door_open_type: 'hinged',
    drawer_count: 0, drawer_heights_mm: '[]',
    shelf_count: 1, shelf_type: 'fixed',
    has_back_panel: true, back_panel_type: 'recessed',
    carcass_material: '', shutter_material: '', hardware_json: '{}',
    position_index: modules.length, notes: '',
  };

  function startEdit(mod) {
    setEditing(mod?.id || 'new');
    setForm(mod || { ...defaultModule });
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form, project_id: projectId };
    delete payload.id;
    delete payload.created_at;

    if (editing === 'new') {
      const { error } = await supabase.from('modules').insert(payload);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('modules').update(payload).eq('id', editing);
      if (error) return toast.error(error.message);
    }
    toast.success('Module saved');
    setEditing(null);
    onReload();
  }

  async function duplicate(mod) {
    const dup = { ...mod, name: mod.name + ' (copy)', position_index: modules.length, project_id: projectId };
    delete dup.id;
    delete dup.created_at;
    const { error } = await supabase.from('modules').insert(dup);
    if (error) return toast.error(error.message);
    toast.success('Module duplicated');
    onReload();
  }

  async function remove(id) {
    if (!confirm('Delete this module?')) return;
    await supabase.from('modules').delete().eq('id', id);
    toast.success('Module deleted');
    onReload();
  }

  const typeColors = {
    base: 'bg-blue-500/15 text-blue-400',
    wall: 'bg-green-500/15 text-green-400',
    tall: 'bg-amber-500/15 text-amber-400',
    drawer: 'bg-purple-500/15 text-purple-400',
    corner: 'bg-pink-500/15 text-pink-400',
    shelf: 'bg-teal-500/15 text-teal-400',
    hanging: 'bg-orange-500/15 text-orange-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-surface-400 text-sm">{modules.length} module{modules.length !== 1 ? 's' : ''}</p>
        <button onClick={() => startEdit(null)} className="btn-primary btn-sm">+ Add Module</button>
      </div>

      {modules.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-surface-300 font-medium mb-2">No modules yet</p>
          <p className="text-surface-500 text-sm mb-4">Add cabinets, drawers, shelves, and other units</p>
          <button onClick={() => startEdit(null)} className="btn-primary">+ Add First Module</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(m => (
            <div key={m.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">{m.name}</h3>
                  <span className={`badge ${typeColors[m.module_type] || 'bg-surface-700 text-surface-300'}`}>{m.module_type}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(m)} className="btn-ghost btn-sm text-xs">Edit</button>
                  <button onClick={() => duplicate(m)} className="btn-ghost btn-sm text-xs">⧉</button>
                  <button onClick={() => remove(m.id)} className="btn-ghost btn-sm text-xs text-red-400">✕</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-surface-900 rounded-lg p-2 text-center">
                  <div className="font-mono font-bold text-surface-200">{formatDimension(m.width_mm, unit)}</div>
                  <div className="text-surface-500">Width</div>
                </div>
                <div className="bg-surface-900 rounded-lg p-2 text-center">
                  <div className="font-mono font-bold text-surface-200">{formatDimension(m.height_mm, unit)}</div>
                  <div className="text-surface-500">Height</div>
                </div>
                <div className="bg-surface-900 rounded-lg p-2 text-center">
                  <div className="font-mono font-bold text-surface-200">{formatDimension(m.depth_mm, unit)}</div>
                  <div className="text-surface-500">Depth</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs text-surface-400">
                {m.door_count > 0 && <span>🚪 {m.door_count} {m.door_open_type}</span>}
                {m.drawer_count > 0 && <span>🗄️ {m.drawer_count} drawers</span>}
                {m.shelf_count > 0 && <span>📚 {m.shelf_count} shelves</span>}
                {m.zone && <span>📍 {m.zone}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Module edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-700">
              <h2 className="section-title">{editing === 'new' ? 'Add Module' : 'Edit Module'}</h2>
            </div>
            <form onSubmit={save} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Basic Info</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><label>Name *</label><input value={form.name||''} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="w-full mt-1" required /></div>
                  <div><label>Type</label>
                    <select value={form.module_type||'base'} onChange={e => setForm(f=>({...f,module_type:e.target.value}))} className="w-full mt-1">
                      {['base','wall','tall','drawer','corner','shelf','hanging'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div><label>Zone</label><input value={form.zone||''} onChange={e => setForm(f=>({...f,zone:e.target.value}))} className="w-full mt-1" placeholder="e.g. cooking, sink, dress_left" /></div>
              </fieldset>

              {/* Dimensions */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Dimensions (mm)</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div><label>Width</label><input type="number" value={form.width_mm||0} onChange={e => setForm(f=>({...f,width_mm:+e.target.value}))} className="w-full mt-1" /></div>
                  <div><label>Height</label><input type="number" value={form.height_mm||0} onChange={e => setForm(f=>({...f,height_mm:+e.target.value}))} className="w-full mt-1" /></div>
                  <div><label>Depth</label><input type="number" value={form.depth_mm||0} onChange={e => setForm(f=>({...f,depth_mm:+e.target.value}))} className="w-full mt-1" /></div>
                </div>
              </fieldset>

              {/* Doors */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Doors</legend>
                <div className="grid grid-cols-3 gap-3">
                  <div><label>Door Count</label><input type="number" min="0" value={form.door_count??1} onChange={e => setForm(f=>({...f,door_count:+e.target.value}))} className="w-full mt-1" /></div>
                  <div><label>Style</label>
                    <select value={form.door_style||'slab'} onChange={e => setForm(f=>({...f,door_style:e.target.value}))} className="w-full mt-1">
                      {['slab','shaker','profile','glass'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label>Open Type</label>
                    <select value={form.door_open_type||'hinged'} onChange={e => setForm(f=>({...f,door_open_type:e.target.value}))} className="w-full mt-1">
                      {['hinged','sliding','lift_up','flap','none'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Drawers & Shelves */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Drawers & Shelves</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div><label>Drawer Count</label><input type="number" min="0" value={form.drawer_count??0} onChange={e => setForm(f=>({...f,drawer_count:+e.target.value}))} className="w-full mt-1" /></div>
                  <div><label>Drawer Heights (JSON mm)</label><input value={form.drawer_heights_mm||'[]'} onChange={e => setForm(f=>({...f,drawer_heights_mm:e.target.value}))} className="w-full mt-1" placeholder="[150, 200, 250]" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label>Shelf Count</label><input type="number" min="0" value={form.shelf_count??1} onChange={e => setForm(f=>({...f,shelf_count:+e.target.value}))} className="w-full mt-1" /></div>
                  <div><label>Shelf Type</label>
                    <select value={form.shelf_type||'fixed'} onChange={e => setForm(f=>({...f,shelf_type:e.target.value}))} className="w-full mt-1">
                      {['fixed','adjustable','pullout','none'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Back Panel */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Back Panel</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 mt-5">
                    <input type="checkbox" checked={form.has_back_panel??true} onChange={e => setForm(f=>({...f,has_back_panel:e.target.checked}))} className="w-4 h-4 rounded" />
                    <span className="text-sm text-surface-300">Has Back Panel</span>
                  </div>
                  <div><label>Type</label>
                    <select value={form.back_panel_type||'recessed'} onChange={e => setForm(f=>({...f,back_panel_type:e.target.value}))} className="w-full mt-1">
                      {['recessed','nailed','none'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Material overrides */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Material Override (blank = use standards)</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div><label>Carcass Material</label><input value={form.carcass_material||''} onChange={e => setForm(f=>({...f,carcass_material:e.target.value}))} className="w-full mt-1" placeholder="Leave blank for default" /></div>
                  <div><label>Shutter Material</label><input value={form.shutter_material||''} onChange={e => setForm(f=>({...f,shutter_material:e.target.value}))} className="w-full mt-1" placeholder="Leave blank for default" /></div>
                </div>
              </fieldset>

              {/* Notes */}
              <div><label>Notes</label><input value={form.notes||''} onChange={e => setForm(f=>({...f,notes:e.target.value}))} className="w-full mt-1" /></div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Module</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ OUTPUTS TAB ═══════════════════════ */

function OutputsTab({ outputs, project, modules }) {
  const [activeOutput, setActiveOutput] = useState('door_schedule');

  const OUTPUT_TYPES = [
    { key: 'door_schedule', label: 'Door Schedule', icon: '🚪' },
    { key: 'cut_list', label: 'Cut List', icon: '🪚' },
    { key: 'material_takeoff', label: 'Material Takeoff', icon: '📦' },
    { key: 'hardware_schedule', label: 'Hardware Schedule', icon: '🔩' },
  ];

  const data = activeOutput === 'material_takeoff'
    ? outputs[activeOutput]?.items || []
    : outputs[activeOutput] || [];

  const grandTotal = activeOutput === 'material_takeoff' ? outputs[activeOutput]?.grand_total : null;

  function handleExportCSV() {
    if (!data.length) return toast.error('No data to export');
    const label = OUTPUT_TYPES.find(o => o.key === activeOutput)?.label || 'Export';
    exportCSV(data, `${project.name} - ${label}.csv`);
    toast.success('CSV downloaded');
  }

  function handleExportPDF() {
    if (!data.length) return toast.error('No data to export');
    const label = OUTPUT_TYPES.find(o => o.key === activeOutput)?.label || 'Export';
    exportPDF(data, label, `${project.name} - ${label}.pdf`, {
      name: project.name,
      client_name: project.client_name,
      date: new Date().toLocaleDateString(),
    });
    toast.success('PDF downloaded');
  }

  const hasAnyOutput = Object.values(outputs).some(v => v && (Array.isArray(v) ? v.length > 0 : v.items?.length > 0));

  if (!hasAnyOutput) {
    return (
      <div className="card text-center py-16">
        <div className="text-4xl mb-3">⚡</div>
        <p className="text-surface-300 font-medium">No outputs generated yet</p>
        <p className="text-surface-500 text-sm mt-1">Click "Generate All Outputs" to compute schedules from your modules</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Output type selector */}
      <div className="flex gap-2 flex-wrap">
        {OUTPUT_TYPES.map(ot => (
          <button
            key={ot.key}
            onClick={() => setActiveOutput(ot.key)}
            className={`btn-sm ${activeOutput === ot.key ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
          >
            {ot.icon} {ot.label}
          </button>
        ))}
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <button onClick={handleExportCSV} className="btn-secondary btn-sm">📋 Export CSV</button>
        <button onClick={handleExportPDF} className="btn-secondary btn-sm">📄 Export PDF</button>
      </div>

      {/* Grand total for material takeoff */}
      {grandTotal != null && (
        <div className="card bg-brand-600/10 border-brand-600/30">
          <span className="text-sm text-surface-300">Estimated Total Cost: </span>
          <span className="text-lg font-bold text-white font-mono">₹{grandTotal.toLocaleString()}</span>
        </div>
      )}

      {/* Data table */}
      {data.length === 0 ? (
        <p className="text-surface-500 text-sm text-center py-8">No data for this output</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {Object.keys(data[0]).filter(k => !k.startsWith('is_')).map(k => (
                  <th key={k}>{k.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).filter(([k]) => !k.startsWith('is_')).map(([k, v], j) => (
                    <td key={j} className={typeof v === 'number' ? 'font-mono text-xs text-right' : ''}>
                      {typeof v === 'boolean' ? (v ? '✓' : '—') : typeof v === 'number' ? v.toLocaleString() : (v || '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
