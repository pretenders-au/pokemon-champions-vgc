/**
 * Copy Pokémon Champions' move rebalances into vgc_pokemon.db's `moves` table, so the move
 * picker shows the same base power and type the damage engine uses.
 *
 * Source of truth is the vendored @smogon/calc's Champions generation (gen 0) compared against
 * gen 9: every move whose base power or type differs is updated (First Impression 90→100,
 * Snap Trap Grass→Steel, …). `championsMoveOverrides` in damage-calc.ts reads the same table at
 * calc time, and champions-move-rebalance.test.ts asserts the dex agrees with it.
 *
 * Re-run after refreshing the vendored build (scripts/vendor-smogon-calc.sh):
 *   npx tsx scripts/sync-champions-move-data.ts && cp vgc_pokemon.db public/vgc_pokemon.db
 */
import Database from 'better-sqlite3';
import { Generations, toID } from '@smogon/calc';

const db = new Database('vgc_pokemon.db');
const champions = Generations.get(0);
const main = Generations.get(9);
const typeIdByName = db.prepare('SELECT id FROM types WHERE identifier = ?');
const update = db.prepare('UPDATE moves SET power = ?, type_id = ? WHERE id = ?');
const rows = db.prepare('SELECT id, name_en, power, type_id FROM moves').all() as
  { id: number; name_en: string; power: number | null; type_id: number }[];

let updated = 0;
for (const r of rows) {
  const c = champions.moves.get(toID(r.name_en));
  const m = main.moves.get(toID(r.name_en));
  if (!c || !m) continue;
  const power = c.basePower !== undefined && c.basePower !== m.basePower ? c.basePower : r.power;
  let typeId = r.type_id;
  if (c.type && c.type !== m.type) {
    const t = typeIdByName.get(c.type.toLowerCase()) as { id: number } | undefined;
    if (!t) throw new Error(`no types row for ${c.type}`);
    typeId = t.id;
  }
  if (power === r.power && typeId === r.type_id) continue;
  update.run(power, typeId, r.id);
  console.log(`${r.name_en}: power ${r.power} -> ${power}${typeId !== r.type_id ? `, type -> ${c.type}` : ''}`);
  updated++;
}
console.log(`${updated} move(s) updated`);
