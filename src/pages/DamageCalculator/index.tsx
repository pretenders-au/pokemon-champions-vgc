import React, { useReducer, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DamageCalculatorTemplate from '@/components/templates/DamageCalculatorTemplate';
import PokemonPanel from '@/components/organisms/PokemonPanel';
import ResultsPanel, { DamageResult } from '@/components/organisms/ResultsPanel';
import { calculateHP, calculateStat, calculateSmogonDamage, mapToSmogonPokemon, mapToSmogonField, mapToSmogonMove, getMovePowerModifier } from '@/features/damage-calculator/utils/damage-calc';
import { getDb } from '@/db';
import { pokemon, formatPokemon, formats, moves } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { fetchTypeEfficacy, calculateEffectiveness, TypeEfficacyMap } from '@/features/pokemon/utils/type-effectiveness';
import { TYPE_IDS, REVERSE_TYPE_IDS } from '@/features/pokemon/utils/pokemon-types';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { POKEMON_PRESETS, PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';
import { getNatureFromStats } from '@/features/pokemon/utils/pokemon-natures';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import { AEGISLASH_ID } from '@/features/pokemon/hooks/usePokemonEditor';

import { useFormat } from '@/features/formats/FormatContext';
import { useCalculatorState, SideState } from '@/features/damage-calculator/hooks/useCalculatorState';
import { useCalculatorActions } from '@/features/damage-calculator/hooks/useCalculatorActions';
import { useDamageCalc } from '@/features/damage-calculator/hooks/useDamageCalc';
import { AttackerPanel } from '@/features/damage-calculator/components/AttackerPanel';
import { DefenderPanel } from '@/features/damage-calculator/components/DefenderPanel';
import { ResultSummary } from '@/features/damage-calculator/components/ResultSummary';
import ScanTeamModal from '@/features/scan/ScanTeamModal';
import OneTapCaptureToggle from '@/features/scan/OneTapCaptureToggle';
import { useBattleRoster } from '@/features/scan/useBattleRoster';
import OpponentRosterChips from '@/features/scan/OpponentRosterChips';
import MyTeamChips from '@/features/scan/MyTeamChips';
import { useMyTeam } from '@/features/scan/useMyTeam';
import { loadSavedBuild, saveBuild, clearBuild, type SavedBuild } from '@/features/damage-calculator/utils/build-store';
import type { Spread } from '@/features/damage-calculator/utils/common-spreads';
import { useTeams } from '@/features/teams/hooks/useTeams';
import { resolveSets, KIND_LABEL } from '@/features/pokemon/utils/showdown-import';
import { appDex } from '@/features/pokemon/utils/appDex';
import { useToast } from '@/hooks/useToast';
import { ToastNotification } from '@/components/atoms/ToastNotification';
import { useViewportMode } from '@/hooks/useViewportMode';
import { ArenaCalculator } from '@/features/damage-calculator/components/mobile/ArenaCalculator';
import { ArenaCalculatorLandscape } from '@/features/damage-calculator/components/mobile/ArenaCalculatorLandscape';

const speciesNameOf = (side: SideState, list: { id: number; nameEn: string }[]) =>
  list.find((p) => p.id === side.selectedId)?.nameEn ?? null;
const buildOf = (side: SideState): SavedBuild => ({
  nature: side.nature, ability: side.activeAbility, item: side.item,
  sp: { hp: side.spHp, atk: side.spAtk, def: side.spDef, spa: side.spSpa, spd: side.spSpd, spe: side.spSpe },
});
const isDefaultBuild = (side: SideState) =>
  side.spHp === 0 && side.spAtk === 0 && side.spDef === 0 && side.spSpa === 0 && side.spSpd === 0 && side.spSpe === 0
  && side.nature === 'Hardy' && side.item == null;

export interface OverlayDefender { id: number; hpPercent: number | null; seq: number }
interface DamageCalculatorPageProps {
  /** Overlay mode: defender to load (re-applied whenever seq changes). */
  overlayDefender?: OverlayDefender | null;
  /** Hosted in the floating overlay: hides the in-app scan-page entry points. */
  overlayHosted?: boolean;
}

const DamageCalculatorPage: React.FC<DamageCalculatorPageProps> = ({ overlayDefender, overlayHosted }) => {
  const navigate = useNavigate();
  const { state, dispatch } = useCalculatorState();
  const { format } = useFormat();
  const [pokemonList, setPokemonList] = useState<PokemonBaseStats[]>([]);
  const [moveList, setMoveList] = useState<MoveData[]>([]);
  const [efficacyMap, setEfficacyMap] = useState<TypeEfficacyMap>({});
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const { teams, createTeam } = useTeams();
  const actions = useCalculatorActions(dispatch, pokemonList, moveList);
  const { toast } = useToast();
  const mode = useViewportMode();
  const isMobile = mode !== 'desktop';
  const { roster: battleRoster, confirmRoster, clearRoster } = useBattleRoster();
  const pokemonById = useMemo(() => new Map(pokemonList.map((p) => [p.id, p])), [pokemonList]);
  const { team: myTeam, selectTeam, clearTeam } = useMyTeam(teams);
  const myTeamIds = useMemo(
    () => (myTeam ? myTeam.members.map((m) => m.configuration.selectedId).filter((n): n is number => n != null) : null),
    [myTeam],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const db = await getDb();
        const [pokeResult, moveResult, efficacyResult] = await Promise.all([
          db.select({
            id: pokemon.id,
            identifier: pokemon.identifier,
            nameEn: pokemon.nameEn,
            nameZh: pokemon.nameZh,
            type1: pokemon.type1,
            type2: pokemon.type2,
            baseHp: pokemon.baseHp,
            baseAttack: pokemon.baseAttack,
            baseDefense: pokemon.baseDefense,
            baseSpAtk: pokemon.baseSpAtk,
            baseSpDef: pokemon.baseSpDef,
            baseSpeed: pokemon.baseSpeed,
          })
          .from(pokemon)
          .innerJoin(formatPokemon, eq(pokemon.id, formatPokemon.pokemonId))
          .innerJoin(formats, eq(formatPokemon.formatId, formats.id))
          .where(eq(formats.name, format)),
          db.select().from(moves),
          fetchTypeEfficacy()
        ]);

        setPokemonList(pokeResult as PokemonBaseStats[]);
        setMoveList(moveResult as MoveData[]);
        setEfficacyMap(efficacyResult);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };
    fetchData();
  }, [format]);

  const { p1MaxHp, p2MaxHp, p1Results, p2Results } = useDamageCalc(state, pokemonList, efficacyMap);

  const handleLoadDefender = async (pokemonId: number, opts?: { hpPercent?: number | null }) => {
    const p = pokemonList.find((p) => p.id === pokemonId);
    if (!p) return;
    await actions.handleSelectPokemon('p2', p);
    if (opts?.hpPercent != null) dispatch({ type: 'SET_HP_PERCENT', payload: { side: 'p2', val: opts.hpPercent } });
    const build = loadSavedBuild(p.nameEn);
    if (build) dispatch({ type: 'APPLY_SAVED_BUILD', payload: { side: 'p2', build } });
    dispatch({ type: 'SET_SCAN_LOADED', payload: { side: 'p2', val: true } });
  };

  const handleLoadAttacker = async (pokemonId: number, opts?: { hpPercent?: number | null }) => {
    const p = pokemonList.find((p) => p.id === pokemonId);
    if (!p) return;
    await actions.handleSelectPokemon('p1', p);
    if (opts?.hpPercent != null) dispatch({ type: 'SET_HP_PERCENT', payload: { side: 'p1', val: opts.hpPercent } });
    const build = loadSavedBuild(p.nameEn);
    if (build) dispatch({ type: 'APPLY_SAVED_BUILD', payload: { side: 'p1', build } });
    dispatch({ type: 'SET_SCAN_LOADED', payload: { side: 'p1', val: true } });
  };

  // Overlay scan result: (re)apply the detected defender + HP once data is up.
  useEffect(() => {
    if (!overlayDefender || pokemonList.length === 0) return;
    void handleLoadDefender(overlayDefender.id, { hpPercent: overlayDefender.hpPercent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayDefender?.seq, pokemonList.length]);

  const persistIfScanLoaded = (side: SideState) => {
    if (!side.loadedFromScan || isDefaultBuild(side)) return;
    const species = speciesNameOf(side, pokemonList);
    if (species) saveBuild(species, buildOf(side));
  };
  useEffect(() => { persistIfScanLoaded(state.p1); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.p1.loadedFromScan, state.p1.nature, state.p1.item, state.p1.activeAbility,
     state.p1.spHp, state.p1.spAtk, state.p1.spDef, state.p1.spSpa, state.p1.spSpd, state.p1.spSpe]);
  useEffect(() => { persistIfScanLoaded(state.p2); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.p2.loadedFromScan, state.p2.nature, state.p2.item, state.p2.activeAbility,
     state.p2.spHp, state.p2.spAtk, state.p2.spDef, state.p2.spSpa, state.p2.spSpd, state.p2.spSpe]);

  const rosterChips = battleRoster && battleRoster.length > 0 ? (
    <OpponentRosterChips
      roster={battleRoster}
      byId={pokemonById}
      activeId={state.p2.selectedId}
      onPick={(id) => void handleLoadDefender(id)}
      onClear={clearRoster}
    />
  ) : null;

  const myTeamChips = (
    <MyTeamChips
      teams={teams}
      team={myTeam}
      byId={pokemonById}
      activeId={state.p1.selectedId}
      onSelectTeam={selectTeam}
      onPick={(member) => void actions.handleLoadConfig('p1', member.configuration)}
      onClear={clearTeam}
    />
  );

  const handleApplySpread = (side: 'p1' | 'p2', spread: Spread) =>
    dispatch({ type: 'APPLY_SPREAD', payload: { side, sp: spread.sp, nature: spread.nature } });
  const handleResetBuild = (side: 'p1' | 'p2') => {
    const species = speciesNameOf(state[side], pokemonList);
    if (species) clearBuild(species);
    dispatch({ type: 'RESET_BUILD', payload: { side } });
  };

  const handleSaveOppTeam = async (sets: ParsedShowdownSet[]) => {
    const { members: newMembers, corrections, errors } = await resolveSets(sets.slice(0, 6), appDex(pokemonList, moveList));

    if (errors.length > 0) {
      alert(`The following terms could not be recognized:\n${errors.map((e) => `${KIND_LABEL[e.kind]}: ${e.value}`).join('\n')}`);
    }

    if (newMembers.length === 0) {
      alert('Could not find any Pokémon from the scanned team in our database.');
      return;
    }

    const teamName = sets[0].species + "'s Team";
    await createTeam(teamName, newMembers);

    if (corrections.length > 0) {
      window.dispatchEvent(new CustomEvent('showdown-imported', { detail: { side: 'opponent-scan', corrections } }));
    }
  };

  const MobileCalc = mode === 'arena-landscape' ? ArenaCalculatorLandscape : ArenaCalculator;

  if (isMobile) {
    return (
      <>
        <MobileCalc
          state={state}
          dispatch={dispatch}
          pokemonList={pokemonList}
          moveList={moveList}
          p1Results={p1Results}
          p2Results={p2Results}
          p1MaxHp={p1MaxHp}
          p2MaxHp={p2MaxHp}
          actions={actions}
          onApplySpread={handleApplySpread}
          onResetBuild={handleResetBuild}
          onOpenScan={overlayHosted ? undefined : () => navigate('/scan')}
          defenderExtra={rosterChips}
          attackerExtra={myTeamChips}
        />
        <ScanTeamModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          pokemonList={pokemonList}
          onLoadPokemon={handleLoadDefender}
          onLoadAttacker={handleLoadAttacker}
          onSaveTeam={handleSaveOppTeam}
          battleRoster={battleRoster}
          onConfirmRoster={confirmRoster}
          myTeamIds={myTeamIds}
        />
        <ToastNotification message={toast} />
      </>
    );
  }

  return (
    <>
    <DamageCalculatorTemplate
      activeWeather={state.weather}
      onWeatherChange={(w) => dispatch({ type: 'SET_WEATHER', payload: w })}
      activeTerrain={state.terrain}
      onTerrainChange={(t) => dispatch({ type: 'SET_TERRAIN', payload: t })}
      isGravity={state.isGravity}
      onToggleGravity={() => dispatch({ type: 'TOGGLE_GRAVITY' })}
      isSpreadTarget={state.isSpreadTarget}
      onSpreadTargetChange={(isSpread) => dispatch({ type: 'SET_SPREAD_TARGET', payload: isSpread })}
      isFairyAura={state.isFairyAura}
      isDarkAura={state.isDarkAura}
      isAuraBreak={state.isAuraBreak}
      onToggleFieldAura={(aura) => dispatch({ type: 'TOGGLE_FIELD_AURA', payload: aura })}
      resultsPanel={
        <ResultSummary 
          state={state} 
          dispatch={dispatch} 
          p1Results={p1Results} 
          p2Results={p2Results} 
          p1MaxHp={p1MaxHp} 
          p2MaxHp={p2MaxHp} 
        />
      }
      attackerPanel={
        <AttackerPanel
          state={state}
          dispatch={dispatch}
          pokemonList={pokemonList}
          moveList={moveList}
          onApplySpread={handleApplySpread}
          onResetBuild={handleResetBuild}
          attackerExtra={myTeamChips}
        />
      }
      defenderPanel={
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <OneTapCaptureToggle />
            <button
              onClick={() => setIsScanModalOpen(true)}
              className="px-4 py-2 rounded bg-inset text-ink-1 border border-line-2 text-sm font-semibold hover:bg-raise transition-colors"
            >
              Scan opponent
            </button>
          </div>
          <DefenderPanel
            state={state}
            dispatch={dispatch}
            pokemonList={pokemonList}
            moveList={moveList}
            onApplySpread={handleApplySpread}
            onResetBuild={handleResetBuild}
            defenderExtra={rosterChips}
          />
        </div>
      }
    />
    <ScanTeamModal
      isOpen={isScanModalOpen}
      onClose={() => setIsScanModalOpen(false)}
      pokemonList={pokemonList}
      onLoadPokemon={handleLoadDefender}
      onLoadAttacker={handleLoadAttacker}
      onSaveTeam={handleSaveOppTeam}
      battleRoster={battleRoster}
      onConfirmRoster={confirmRoster}
      myTeamIds={myTeamIds}
    />
    <ToastNotification message={toast} />
    </>
  );
};

export default DamageCalculatorPage;
