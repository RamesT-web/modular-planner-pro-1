/**
 * Hardware Schedule Generator
 * Computes hinges, channels, handles, accessories per module.
 */

// Default hardware rules
const HINGE_RULES = {
  default: 2,          // doors < 1000mm
  tall: 3,             // doors 1000–1500mm
  extra_tall: 4,       // doors > 1500mm
};

export function generateHardwareSchedule(modules, standards) {
  const hwStd = standards.find(s => s.category === 'hardware') || {};
  const rows = [];

  for (const mod of modules) {
    const extras = parseHardwareJson(mod.hardware_json);

    // --- Hinges ---
    if (mod.door_count > 0 && mod.door_open_type === 'hinged') {
      const doorH = mod.height_mm;
      let hingesPerDoor = HINGE_RULES.default;
      if (doorH > 1500) hingesPerDoor = HINGE_RULES.extra_tall;
      else if (doorH > 1000) hingesPerDoor = HINGE_RULES.tall;

      rows.push(hwRow(mod, 'Soft-Close Hinge', 'hinge', hingesPerDoor * mod.door_count, 'pcs', hwStd));
    }

    // --- Lift-up / Flap ---
    if (mod.door_open_type === 'lift_up') {
      rows.push(hwRow(mod, 'Lift-Up Mechanism', 'lift_up', mod.door_count, 'set', hwStd));
    }
    if (mod.door_open_type === 'flap') {
      rows.push(hwRow(mod, 'Flap Stay', 'flap_stay', mod.door_count * 2, 'pcs', hwStd));
    }

    // --- Sliding channels ---
    if (mod.door_open_type === 'sliding') {
      rows.push(hwRow(mod, 'Sliding Channel Set', 'sliding_channel', 1, 'set', hwStd));
    }

    // --- Drawer channels ---
    if (mod.drawer_count > 0) {
      const channelType = mod.depth_mm > 450 ? 'Telescopic Channel (full ext.)' : 'Ball Bearing Channel';
      rows.push(hwRow(mod, channelType, 'drawer_channel', mod.drawer_count, 'pair', hwStd));
    }

    // --- Handles ---
    const handleCount = mod.door_count + mod.drawer_count;
    if (handleCount > 0) {
      rows.push(hwRow(mod, 'Handle / Knob', 'handle', handleCount, 'pcs', hwStd));
    }

    // --- Shelf supports ---
    if (mod.shelf_count > 0 && mod.shelf_type === 'adjustable') {
      rows.push(hwRow(mod, 'Shelf Support Pin', 'shelf_pin', mod.shelf_count * 4, 'pcs', hwStd));
    }

    // --- Leg / plinth ---
    if (mod.module_type === 'base') {
      rows.push(hwRow(mod, 'Adjustable Leg', 'leg', 4, 'pcs', hwStd));
    }

    // --- Any custom hardware from JSON ---
    for (const [name, qty] of Object.entries(extras)) {
      rows.push(hwRow(mod, name, 'custom', qty, 'pcs', hwStd));
    }
  }

  return rows;
}

function hwRow(mod, itemName, category, qty, unit, hwStd) {
  return {
    module_name: mod.name,
    module_type: mod.module_type,
    zone: mod.zone,
    item: itemName,
    category,
    qty,
    unit,
    rate: hwStd.rate_per_unit || 0,
    estimated_cost: Math.round(qty * (hwStd.rate_per_unit || 0)),
  };
}

function parseHardwareJson(json) {
  try {
    const parsed = JSON.parse(json || '{}');
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return {};
}
