import { useState, useEffect, useCallback } from 'react';
import { useTeams, TeamWithMembers } from '@/features/teams/hooks/useTeams';
import { pokemonRepository } from '@/db/repositories/pokemon.repo';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { PokemonConfig } from '@/features/pokemon/hooks/usePokemonEditor';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import { useModalRegistry } from '@/hooks/useModalRegistry';
import { formatShowdownSet } from '@/features/pokemon/utils/showdown-formatter';
import { useFormat } from '@/features/formats/FormatContext';
import { resolveSet, resolveSets, toConfig, KIND_LABEL } from '@/features/pokemon/utils/showdown-import';
import { appDex } from '@/features/pokemon/utils/appDex';

export function useTeamDetail(id: string | undefined) {
  const { getTeam, updateTeam, loading: teamsLoading } = useTeams();
  const { format } = useFormat();
  
  const [team, setTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pokemonList, setPokemonList] = useState<PokemonBaseStats[]>([]);
  const [moveList, setMoveList] = useState<MoveData[]>([]);

  const dex = () => appDex(pokemonList, moveList);
  
  const modals = useModalRegistry({
    editor: false,
    export: false,
    exportSingle: false,
    importTeam: false,
    importSingle: false
  });
  
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | null>(null);
  const [currentConfig, setCurrentConfig] = useState<PokemonConfig | null>(null);
  const [exportText, setExportText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pokeResult, moveResult] = await Promise.all([
          pokemonRepository.getPokemonListByFormat(format),
          pokemonRepository.getAllMoves()
        ]);
        setPokemonList(pokeResult);
        setMoveList(moveResult);
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };
    fetchData();
  }, [format]);

  useEffect(() => {
    const loadTeam = async () => {
      if (!id || teamsLoading) return;
      try {
        setLoading(true);
        const fetchedTeam = await getTeam(id);
        if (fetchedTeam) {
          setTeam(fetchedTeam);
        } else {
          setError('Team not found');
        }
      } catch (err) {
        setError('Failed to load team');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadTeam();
  }, [id, getTeam, teamsLoading]);

  const handleAddPokemonClick = async (p: PokemonBaseStats) => {
    let abilityNames: string[] = [];
    try {
      abilityNames = await pokemonRepository.getPokemonAbilities(p.id);
    } catch (e) {
      console.error('Failed to fetch abilities:', e);
    }

    const initialConfig: PokemonConfig = {
      selectedId: p.id,
      type1: p.type1,
      type2: p.type2,
      baseHp: p.baseHp,
      baseAtk: p.baseAttack,
      baseDef: p.baseDefense,
      baseSpa: p.baseSpAtk,
      baseSpd: p.baseSpDef,
      baseSpe: p.baseSpeed,
      spHp: 0, spAtk: 0, spDef: 0, spSpa: 0, spSpd: 0, spSpe: 0,
      nature: 'Hardy',
      moves: [null, null, null, null],
      activeMoveIndex: 0,
      abilities: abilityNames,
      activeAbility: abilityNames[0] || null,
      item: null,
      hpPercent: 100,
      isTypeOverridden: false,
    };
    
    setEditingMemberIndex(null);
    setCurrentConfig(initialConfig);
    modals.openModal('editor');
  };

  const handleEditPokemonClick = useCallback((index: number) => {
    if (!team) return;
    setEditingMemberIndex(index);
    setCurrentConfig(team.members[index].configuration);
    modals.openModal('editor');
  }, [team, modals]);

  const handleSaveMember = async (config: PokemonConfig) => {
    if (!team) return;

    let newMembers = [...team.members.map(m => m.configuration)];
    if (editingMemberIndex !== null) {
      newMembers[editingMemberIndex] = config;
    } else {
      newMembers.push(config);
    }

    try {
      await updateTeam(team.id, team.name, newMembers);
      const updatedTeam = await getTeam(team.id);
      setTeam(updatedTeam);
    } catch (err) {
      console.error('Failed to save team member:', err);
    }
  };

  const handleRenameTeam = async (newName: string) => {
    if (!team) return;
    try {
      await updateTeam(team.id, newName, team.members.map(m => m.configuration));
      const updatedTeam = await getTeam(team.id);
      setTeam(updatedTeam);
    } catch (err) {
      console.error('Failed to rename team:', err);
    }
  };

  const handleExportIndividual = useCallback((index: number) => {
    if (!team) return;
    const member = team.members[index];
    const speciesName = pokemonList.find(p => p.id === member.configuration.selectedId)?.nameEn || 'Unknown';
    const text = formatShowdownSet(member.configuration, speciesName);
    setExportText(text);
    modals.openModal('exportSingle');
  }, [team, pokemonList, modals]);

  const handleRemovePokemon = useCallback(async (orderToRemove: number) => {
    if (!team) return;

    if (window.confirm('Remove this Pokémon from the team?')) {
      try {
        const newMembers = team.members
          .filter(m => m.order !== orderToRemove)
          .map(m => m.configuration);
          
        await updateTeam(team.id, team.name, newMembers);
        const updatedTeam = await getTeam(team.id);
        setTeam(updatedTeam);
      } catch (err) {
        console.error('Failed to remove Pokémon:', err);
      }
    }
  }, [team, updateTeam, getTeam]);

  const handleImportTeamShowdown = async (sets: ParsedShowdownSet[]) => {
    if (!team) return;

    const { members: newMembers, errors } = await resolveSets(sets.slice(0, 6), dex());

    if (errors.length > 0) {
      alert(`The following terms could not be recognized:\n${errors.map((e) => `${KIND_LABEL[e.kind]}: ${e.value}`).join('\n')}`);
    }

    if (newMembers.length === 0) {
      alert('Could not find any Pokémon from the import text in our database.');
      return;
    }

    if (window.confirm(`Found ${newMembers.length} Pokémon. This will OVERWRITE your current team. Proceed?`)) {
      try {
        await updateTeam(team.id, team.name, newMembers);
        const updatedTeam = await getTeam(team.id);
        setTeam(updatedTeam);
      } catch (err) {
        console.error('Failed to import team:', err);
      }
    }
  };

  const handleImportSingleShowdown = async (set: ParsedShowdownSet) => {
    if (!team) return;

    const result = await resolveSet(set, dex());

    // Single-set import aborts on the first failure, in the order set resolution
    // reports them: species, ability, item, then moves.
    if (!result.ok || result.errors.length > 0) {
      const { kind, value } = result.errors[0];
      alert(`Could not find ${KIND_LABEL[kind]} matching "${value}"`);
      return;
    }
    const { resolved, corrections } = result;

    const newConfig = toConfig(set, resolved);
    const newMembers = [...team.members.map(m => m.configuration), newConfig];
    try {
      await updateTeam(team.id, team.name, newMembers);
      const updatedTeam = await getTeam(team.id);
      setTeam(updatedTeam);
    } catch (err) {
      console.error('Failed to add Pokémon via Showdown:', err);
    }

    if (corrections.length > 0) {
      window.dispatchEvent(new CustomEvent('showdown-imported', { detail: { side: 'single', corrections } }));
    }

    return corrections;
  };

  return {
    team,
    loading,
    error,
    pokemonList,
    moveList,
    modals,
    currentConfig,
    exportText,
    handleAddPokemonClick,
    handleEditPokemonClick,
    handleSaveMember,
    handleRenameTeam,
    handleExportIndividual,
    handleRemovePokemon,
    handleImportTeamShowdown,
    handleImportSingleShowdown
  };
}
