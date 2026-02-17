/**
 * Cut List Generator
 * Breaks each module into individual panel cuts for carcass, shelves, back panel, drawers.
 */

export function generateCutList(modules, standards) {
  const carcassStd  = standards.find(s => s.category === 'carcass') || {};
  const backStd     = standards.find(s => s.category === 'back_panel') || {};
  const shutterStd  = standards.find(s => s.category === 'shutter') || {};
  const rows = [];
  let seq = 1;

  const t  = carcassStd.thickness_mm || 18;   // carcass thickness
  const bt = backStd.thickness_mm || 6;        // back panel thickness
  const st = shutterStd.thickness_mm || 18;    // shutter thickness

  for (const mod of modules) {
    const W = mod.width_mm;
    const H = mod.height_mm;
    const D = mod.depth_mm;

    const carcassMat = mod.carcass_material || carcassStd.material || 'HDHMR 18mm';
    const backMat    = backStd.material || 'MR Ply 6mm';
    const shutterMat = mod.shutter_material || shutterStd.material || 'Ply + Laminate';

    // ----- Carcass panels -----
    // Left side
    rows.push(panel(seq++, mod, 'Left Side', H, D - (mod.back_panel_type === 'recessed' ? bt + 6 : 0), t, carcassMat, 1));
    // Right side
    rows.push(panel(seq++, mod, 'Right Side', H, D - (mod.back_panel_type === 'recessed' ? bt + 6 : 0), t, carcassMat, 1));
    // Top
    rows.push(panel(seq++, mod, 'Top', W - (2 * t), D - (mod.back_panel_type === 'recessed' ? bt + 6 : 0), t, carcassMat, 1));
    // Bottom
    rows.push(panel(seq++, mod, 'Bottom', W - (2 * t), D - (mod.back_panel_type === 'recessed' ? bt + 6 : 0), t, carcassMat, 1));

    // ----- Shelves -----
    const shelfCount = mod.shelf_count || 0;
    for (let i = 1; i <= shelfCount; i++) {
      rows.push(panel(seq++, mod, `Shelf ${i}`, W - (2 * t) - 2, D - (mod.back_panel_type === 'recessed' ? bt + 6 : 0) - 10, t, carcassMat, 1));
    }

    // ----- Back panel -----
    if (mod.has_back_panel) {
      const bpW = mod.back_panel_type === 'recessed' ? W - (2 * t) + 12 : W;
      const bpH = mod.back_panel_type === 'recessed' ? H + 12 : H;
      rows.push(panel(seq++, mod, 'Back Panel', bpH, bpW, bt, backMat, 1));
    }

    // ----- Drawers -----
    if (mod.drawer_count > 0) {
      let heights = [];
      try { heights = JSON.parse(mod.drawer_heights_mm || '[]'); } catch { heights = []; }
      const defaultH = (H - (mod.shelf_count * t)) / mod.drawer_count;

      for (let d = 1; d <= mod.drawer_count; d++) {
        const dh = heights[d - 1] || defaultH;
        const innerW = W - (2 * t) - 2;
        const innerD = D - 60; // front clearance

        rows.push(panel(seq++, mod, `Drawer ${d} Front`, dh - 4, innerW, st, shutterMat, 1));
        rows.push(panel(seq++, mod, `Drawer ${d} Back`, dh - 30, innerW - (2 * t), t, carcassMat, 1));
        rows.push(panel(seq++, mod, `Drawer ${d} Left`, dh - 30, innerD, t, carcassMat, 1));
        rows.push(panel(seq++, mod, `Drawer ${d} Right`, dh - 30, innerD, t, carcassMat, 1));
        rows.push(panel(seq++, mod, `Drawer ${d} Base`, innerW - (2 * t), innerD, bt, backMat, 1));
      }
    }
  }

  return rows;
}

function panel(seq, mod, part, length, width, thickness, material, qty) {
  return {
    seq,
    module_name: mod.name,
    module_type: mod.module_type,
    zone: mod.zone,
    part,
    length_mm: Math.round(Math.max(length, 0)),
    width_mm: Math.round(Math.max(width, 0)),
    thickness_mm: thickness,
    area_sqmm: Math.round(Math.max(length, 0) * Math.max(width, 0)),
    material,
    qty,
    edge_L1: true,
    edge_L2: true,
    edge_W1: part.includes('Shelf'),
    edge_W2: false,
  };
}
