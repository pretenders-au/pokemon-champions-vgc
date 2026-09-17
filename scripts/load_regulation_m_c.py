"""Regulation M-C (2026-09-09 to 2026-12-02) for vgc_pokemon.db.

One idempotent pass, in dependency order:

1. Form rows. Toxtricity (Low Key) and the Blue/Yellow/White Squawkabilly plumages already
   exist in pokemon_forms, pokemon_moves, pokemon_abilities and the thumbnails under their
   PokeAPI ids, but the dex import never gave them a `pokemon` row (the gap
   add_female_forms.py closed for the gendered species). Stats and types are the sibling
   form's; a plumage changes only the hidden ability (Guts vs Sheer Force), which the existing
   ability rows already carry.
2. Mega abilities. The six Megas M-C makes legal, with the ability each has in Champions.
   Serebii's Champions dex, op.gg, Bulbapedia's raw page source and the NCP calculator all
   agree on every value. Aura Guard is new to the game and gets an `abilities` row.
3. Legality. Regulations so far only add, and Serebii publishes each as a "Newly Useable
   Pokémon" delta, so M-C is seeded from M-B plus the rows below. Serebii lists 33; here
   Squawkabilly is four plumages, so 35. Legality is fully-evolved only (Persian is legal,
   Meowth is not), so Galarian Farfetch'd is left out even though Sirfetch'd is in.

Run:  python3 scripts/load_regulation_m_c.py
Then: npx tsx scripts/seed-calculated-speeds.ts && cp vgc_pokemon.db public/vgc_pokemon.db
"""
import sqlite3

DB = "vgc_pokemon.db"
FORMAT = "Regulation M-C"
SEED_FROM = "Regulation M-B"

# PokeAPI id (== pokemon_forms.pokemon_id), identifier, form label, sibling pokemon id
FORM_ROWS = [
    (10184, "toxtricity-low-key", "Low Key", 849),
    (10260, "squawkabilly-blue-plumage", "Blue Plumage", 931),
    (10261, "squawkabilly-yellow-plumage", "Yellow Plumage", 931),
    (10262, "squawkabilly-white-plumage", "White Plumage", 931),
]

# identifier -> (name_en, name_ja, name_zh, name_zh_hans)
NEW_ABILITIES = {
    "aura-guard": ("Aura Guard", "はどうのぼうご", "波導防護", "波导防护"),
}

# pokemon identifier -> Champions ability
MEGA_ABILITIES = {
    "absol-mega-z": "Sharpness",
    "garchomp-mega-z": "Levitate",
    "lucario-mega-z": "Aura Guard",
    "golisopod-mega": "Tough Claws",
    "baxcalibur-mega": "Thermal Exchange",
    "salamence-mega": "Aerilate",
}

# Serebii, Regulation M-C "Newly Useable Pokémon", as dex identifiers.
NEWLY_USABLE = [
    "wigglytuff",
    "persian", "persian-alola",
    "farfetchd",
    "mr-mime",
    "swalot",
    "salamence", "salamence-mega",
    "absol-mega-z",
    "garchomp-mega-z",
    "lucario-mega-z",
    "gogoat",
    "golisopod", "golisopod-mega",
    "rillaboom",
    "cinderace",
    "inteleon",
    "thievul",
    "toxtricity-amped", "toxtricity-low-key",
    "grapploct",
    "perrserker",
    "sirfetchd",
    "pincurchin",
    "indeedee-male", "indeedee-female",
    "pawmot",
    "arboliva",
    "squawkabilly-green-plumage", "squawkabilly-blue-plumage",
    "squawkabilly-yellow-plumage", "squawkabilly-white-plumage",
    "mabosstiff",
    "baxcalibur", "baxcalibur-mega",
]


def pokemon_id(cur, identifier):
    row = cur.execute("SELECT id FROM pokemon WHERE identifier = ?", (identifier,)).fetchone()
    if not row:
        raise SystemExit(f"no pokemon row for {identifier!r}")
    return row[0]


def relabel(name, label):
    """'Toxtricity (Amped)' -> 'Toxtricity (Low Key)'; also for the ja/zh names."""
    return f"{name.split(' (')[0]} ({label})"


def add_form_rows(cur):
    cols = ("type1, type2, base_hp, base_attack, base_defense, base_sp_atk, base_sp_def, "
            "base_speed, height, weight, base_experience, \"order\"")
    for pid, ident, label, sibling in FORM_ROWS:
        en, ja, zh, *rest = cur.execute(
            f"SELECT name_en, name_ja, name_zh, {cols} FROM pokemon WHERE id = ?", (sibling,)
        ).fetchone()
        cur.execute(
            f"""INSERT OR REPLACE INTO pokemon
                (id, identifier, name_en, name_ja, name_zh, {cols}, is_default)
                VALUES (?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?,?, 0)""",
            (pid, ident, relabel(en, label), relabel(ja, label), relabel(zh, label), *rest),
        )
        for table in ("pokemon_abilities", "pokemon_moves", "pokemon_forms"):
            n = cur.execute(f"SELECT COUNT(*) FROM {table} WHERE pokemon_id = ?", (pid,)).fetchone()[0]
            if n == 0:
                raise SystemExit(f"{ident}: expected existing {table} rows for id {pid}, found none")
        print(f"  form row {pid:>6} {ident}")


def ability_id(cur, name):
    row = cur.execute(
        "SELECT id FROM abilities WHERE LOWER(name_en) = ? ORDER BY id LIMIT 1", (name.lower(),)
    ).fetchone()
    if not row:
        raise SystemExit(f"no ability row for {name!r}")
    return row[0]


def add_mega_abilities(cur):
    for ident, (en, ja, zh, zh_hans) in NEW_ABILITIES.items():
        if not cur.execute("SELECT 1 FROM abilities WHERE identifier = ?", (ident,)).fetchone():
            new_id = cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM abilities").fetchone()[0]
            cur.execute(
                "INSERT INTO abilities (id, identifier, name_en, name_ja, name_zh, name_zh_hans)"
                " VALUES (?,?,?,?,?,?)", (new_id, ident, en, ja, zh, zh_hans))
            print(f"  + ability {en} (id {new_id})")
    for ident, ability in MEGA_ABILITIES.items():
        cur.execute(
            "INSERT OR IGNORE INTO pokemon_abilities (pokemon_id, ability_id, is_hidden, slot)"
            " VALUES (?, ?, 0, 1)", (pokemon_id(cur, ident), ability_id(cur, ability)))
        print(f"  {ident} -> {ability}")


def add_legality(cur):
    row = cur.execute("SELECT id FROM formats WHERE name = ?", (FORMAT,)).fetchone()
    if row:
        format_id = row[0]
    else:
        cur.execute("INSERT INTO formats (name, is_active) VALUES (?, 1)", (FORMAT,))
        format_id = cur.lastrowid
    seed_id = cur.execute("SELECT id FROM formats WHERE name = ?", (SEED_FROM,)).fetchone()
    if not seed_id:
        raise SystemExit(f"{SEED_FROM!r} must exist before seeding {FORMAT!r}")

    # Rebuild from scratch so a re-run is deterministic.
    cur.execute("DELETE FROM format_pokemon WHERE format_id = ?", (format_id,))
    cur.execute(
        "INSERT INTO format_pokemon (format_id, pokemon_id)"
        " SELECT ?, pokemon_id FROM format_pokemon WHERE format_id = ?", (format_id, seed_id[0]))
    seeded = cur.rowcount
    ids = [pokemon_id(cur, ident) for ident in NEWLY_USABLE]
    cur.executemany(
        "INSERT OR IGNORE INTO format_pokemon (format_id, pokemon_id) VALUES (?, ?)",
        [(format_id, pid) for pid in ids])
    total = cur.execute("SELECT COUNT(*) FROM format_pokemon WHERE format_id = ?", (format_id,)).fetchone()[0]
    print(f"  {FORMAT}: {seeded} seeded from {SEED_FROM} + {total - seeded} new = {total}")
    if total - seeded != len(NEWLY_USABLE):
        raise SystemExit(f"expected {len(NEWLY_USABLE)} additions over {SEED_FROM}, got {total - seeded}")


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    print("form rows"); add_form_rows(cur)
    print("mega abilities"); add_mega_abilities(cur)
    print("legality"); add_legality(cur)
    conn.commit()

    print("\nformats:")
    for name, n in cur.execute(
        "SELECT f.name, COUNT(fp.pokemon_id) FROM formats f"
        " LEFT JOIN format_pokemon fp ON fp.format_id = f.id GROUP BY f.id ORDER BY f.name"):
        print(f"  {name:<16} {n}")
    bad = cur.execute(
        "SELECT p.identifier FROM pokemon_forms f JOIN pokemon p ON p.id = f.pokemon_id"
        " WHERE f.is_mega = 1 AND EXISTS (SELECT 1 FROM format_pokemon fp WHERE fp.pokemon_id = p.id)"
        " AND NOT EXISTS (SELECT 1 FROM pokemon_abilities pa WHERE pa.pokemon_id = p.id)").fetchall()
    print("legal megas without an ability:", [r[0] for r in bad] or "none")
    conn.close()


if __name__ == "__main__":
    main()
