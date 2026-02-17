/**
 * Door Schedule Generator
 * Computes door dimensions, quantities, material, and finish for every module.
 */

export function generateDoorSchedule(modules, standards) {
  const shutterStd = standards.find(s => s.category === 'shutter') || {};
  const rows = [];

  for (const mod of modules) {
    if (mod.door_count <= 0) continue;

    // Gap deductions (mm) — 2mm per side for hinged, 20mm overlap for sliding
    const isSliding = mod.door_open_type === 'sliding';
    const gapH = isSliding ? 0 : 4;   // total horizontal gap
    const gapV = isSliding ? 0 : 4;   // total vertical gap
    const overlap = isSliding ? 20 : 0;

    const doorW = isSliding
      ? (mod.width_mm / mod.door_count) + overlap
      : (mod.width_mm - gapH) / mod.door_count;
    const doorH = mod.height_mm - gapV;

    const material = mod.shutter_material || shutterStd.material || 'Ply + Laminate';
    const thickness = shutterStd.thickness_mm || 18;
    const finish = shutterStd.finish || 'Laminate';
    const areaSqmm = doorW * doorH;

    for (let i = 1; i <= mod.door_count; i++) {
      rows.push({
        module_name: mod.name,
        module_type: mod.module_type,
        zone: mod.zone,
        door_no: `${mod.name}-D${i}`,
        door_style: mod.door_style,
        open_type: mod.door_open_type,
        width_mm: Math.round(doorW * 100) / 100,
        height_mm: Math.round(doorH * 100) / 100,
        thickness_mm: thickness,
        area_sqmm: Math.round(areaSqmm),
        material,
        finish,
      });
    }
  }
  return rows;
}
