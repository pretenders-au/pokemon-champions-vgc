"""Add the Female rows for the seven gendered species to vgc_pokemon.db.

The dex was imported with only the `(Male)` row of each gendered species, so
Showdown sets naming a Female form (`Meowstic-F`, ...) had nothing to resolve
against. See docs/adr/0001-species-matching-has-no-loose-fallback.md.

Every value below is transcribed from the PokeAPI CSVs this dex was built from
(pokemon.csv / pokemon_stats.csv / pokemon_abilities.csv / pokemon_types.csv),
so ids match `pokemon_forms.pokemon_id`, which already references them.

Four species have their own PokeAPI `pokemon` row because the female differs
mechanically:

  Meowstic     hidden ability Prankster -> Competitive (stats identical)
  Indeedee     60/65/55/105/95/95 -> 70/55/65/95/105/85, Inner Focus -> Own Tempo
  Basculegion  112 Atk / 80 SpA -> 92 Atk / 100 SpA (abilities identical)
  Oinkologne   110/100/75/59/80/65 -> 115/90/70/59/90/65, Lingering Aroma -> Aroma Veil

Frillish, Jellicent and Pyroar females are cosmetic-only — identical stats,
types and abilities — so PokeAPI gives them a `pokemon_forms` row but no
`pokemon` row. They get one here (Showdown users do write `Pyroar-F`), keyed by
their `pokemon_forms.id` so the id is traceable and cannot collide.

Run:  python3 scripts/add_female_forms.py
Then: npx tsx scripts/seed-calculated-speeds.ts && cp vgc_pokemon.db public/vgc_pokemon.db
"""

import shutil
import sqlite3
from pathlib import Path

DB = "vgc_pokemon.db"
THUMBS = Path("public/images/pokemon/thumbnails")

# id, identifier, name_en, name_ja, name_zh, type1, type2,
# hp, atk, def, spa, spd, spe, height, weight, base_experience, order, male_id
FEMALES = [
    (10025, "meowstic-female", "Meowstic", "ニャオニクス", "超能妙喵",
     "psychic", None, 74, 48, 76, 83, 81, 104, 6, 85, 163, 812, 678),
    (10186, "indeedee-female", "Indeedee", "イエッサン", "愛管侍",
     "psychic", "normal", 70, 55, 65, 95, 105, 85, 9, 280, 166, 1062, 876),
    (10248, "basculegion-female", "Basculegion", "イダイトウ", "幽尾玄魚",
     "water", "ghost", 120, 92, 65, 100, 75, 78, 30, 1100, 265, None, 902),
    (10254, "oinkologne-female", "Oinkologne", "パフュートン", "飄香豚",
     "normal", None, 115, 90, 70, 59, 90, 65, 10, 1200, 171, None, 916),
    # cosmetic-only: stats/types/abilities copied from the male row
    (10551, "pyroar-female", "Pyroar", "カエンジシ", "火炎獅",
     "fire", "normal", 86, 68, 72, 109, 66, 106, 15, 815, 177, None, 668),
    (10552, "frillish-female", "Frillish", "プルリル", "輕飄飄",
     "water", "ghost", 55, 40, 50, 65, 85, 40, 12, 330, 67, None, 592),
    (10553, "jellicent-female", "Jellicent", "ブルンゲル", "胖嘟嘟",
     "water", "ghost", 100, 60, 70, 85, 105, 60, 22, 1350, 168, None, 593),
]

# pokemon_id -> (slot1, slot2, hidden) ability ids, where they differ from the male
FEMALE_ABILITIES = {
    10025: (51, 151, 172),   # Keen Eye / Infiltrator / Competitive
    10186: (20, 28, 227),    # Own Tempo / Synchronize / Psychic Surge
    10254: (165, 82, 47),    # Aroma Veil / Gluttony / Thick Fat
}


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    for (pid, ident, en, ja, zh, t1, t2, hp, atk, df, spa, spd, spe,
         height, weight, exp, order, male_id) in FEMALES:
        cur.execute(
            """INSERT OR REPLACE INTO pokemon
               (id, identifier, name_en, name_ja, name_zh, type1, type2,
                base_hp, base_attack, base_defense, base_sp_atk, base_sp_def,
                base_speed, height, weight, base_experience, "order", is_default)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
            (pid, ident, f"{en} (Female)", f"{ja} (Female)", f"{zh} (Female)",
             t1, t2, hp, atk, df, spa, spd, spe, height, weight, exp, order),
        )

        # abilities: same as the male unless the female's differ
        if pid in FEMALE_ABILITIES:
            rows = [(pid, aid, 1 if slot == 3 else 0, slot)
                    for slot, aid in enumerate(FEMALE_ABILITIES[pid], start=1)]
        else:
            rows = [(pid, aid, hidden, slot) for aid, hidden, slot in cur.execute(
                "SELECT ability_id, is_hidden, slot FROM pokemon_abilities WHERE pokemon_id = ?",
                (male_id,)).fetchall()]
        cur.executemany(
            "INSERT OR REPLACE INTO pokemon_abilities (pokemon_id, ability_id, is_hidden, slot)"
            " VALUES (?,?,?,?)", rows)

        # a gender form is legal wherever its species is
        cur.execute(
            "INSERT OR IGNORE INTO format_pokemon (format_id, pokemon_id)"
            " SELECT format_id, ? FROM format_pokemon WHERE pokemon_id = ?", (pid, male_id))

        # ponytail: the cosmetic three have no female official artwork on PokeAPI,
        # so they reuse the male thumbnail — right species, wrong colour. Swap in
        # real art if it ever matters.
        thumb = THUMBS / f"{pid}.png"
        if not thumb.exists():
            shutil.copy2(THUMBS / f"{male_id}.png", thumb)

    conn.commit()
    for row in cur.execute(
        "SELECT p.id, p.name_en, group_concat(f.name) FROM pokemon p"
        " LEFT JOIN format_pokemon fp ON fp.pokemon_id = p.id"
        " LEFT JOIN formats f ON f.id = fp.format_id"
        " WHERE p.identifier LIKE '%-female' GROUP BY p.id ORDER BY p.id"):
        print(f"  {row[0]:>6}  {row[1]:<22} {row[2] or '(no format)'}")
    conn.close()


if __name__ == "__main__":
    main()
