/**
 * Material Takeoff Generator
 * Aggregates the cut list by material type to produce total sheet/area requirements.
 */
import { sqmmToSqft, runningFeet } from '../units';

const SHEET_AREA_SQMM = 2440 * 1220; // standard 8x4 sheet in sqmm

export function generateMaterialTakeoff(cutList, standards) {
  // Group by material + thickness
  const groups = {};

  for (const item of cutList) {
    const key = `${item.material}|${item.thickness_mm}`;
    if (!groups[key]) {
      groups[key] = {
        material: item.material,
        thickness_mm: item.thickness_mm,
        total_area_sqmm: 0,
        panel_count: 0,
        items: [],
      };
    }
    groups[key].total_area_sqmm += item.area_sqmm * item.qty;
    groups[key].panel_count += item.qty;
    groups[key].items.push(item);
  }

  // Compute sheets required and costs
  const rows = [];
  for (const g of Object.values(groups)) {
    const std = standards.find(s => s.material === g.material && s.thickness_mm === g.thickness_mm);
    const sheetArea = SHEET_AREA_SQMM;
    const sheetsNeeded = Math.ceil((g.total_area_sqmm * 1.08) / sheetArea); // 8% wastage
    const areaInSqft = sqmmToSqft(g.total_area_sqmm);
    const rate = std?.rate_per_sqft || 0;

    rows.push({
      material: g.material,
      thickness_mm: g.thickness_mm,
      panel_count: g.panel_count,
      total_area_sqmm: g.total_area_sqmm,
      total_area_sqft: Math.round(areaInSqft * 100) / 100,
      wastage_pct: 8,
      sheets_8x4: sheetsNeeded,
      rate_per_sqft: rate,
      estimated_cost: Math.round(areaInSqft * 1.08 * rate),
    });
  }

  // Edge banding summary
  const edgebandStd = standards.find(s => s.category === 'edgeband');
  let totalEdge_mm = 0;
  for (const item of cutList) {
    if (item.edge_L1) totalEdge_mm += item.length_mm * item.qty;
    if (item.edge_L2) totalEdge_mm += item.length_mm * item.qty;
    if (item.edge_W1) totalEdge_mm += item.width_mm * item.qty;
    if (item.edge_W2) totalEdge_mm += item.width_mm * item.qty;
  }

  const edgebandRow = {
    material: edgebandStd?.material || 'PVC Edge Band',
    thickness_mm: edgebandStd?.edge_band_mm || 1,
    panel_count: 0,
    total_area_sqmm: 0,
    total_area_sqft: 0,
    total_running_mm: Math.round(totalEdge_mm),
    total_running_ft: Math.round(runningFeet(totalEdge_mm) * 100) / 100,
    wastage_pct: 10,
    sheets_8x4: 0,
    rate_per_sqft: 0,
    rate_per_rft: edgebandStd?.rate_per_unit || 0,
    estimated_cost: Math.round(runningFeet(totalEdge_mm) * 1.1 * (edgebandStd?.rate_per_unit || 0)),
    is_edgeband: true,
  };

  rows.push(edgebandRow);

  return {
    items: rows,
    grand_total: rows.reduce((s, r) => s + (r.estimated_cost || 0), 0),
  };
}
