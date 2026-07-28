import React, { useState } from 'react';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import StatGrid from '@/components/molecules/StatGrid';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { POKEMON_PRESETS, PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';
import { PokemonConfig, BuildEditor, AEGISLASH_ID } from '@/features/pokemon/hooks/usePokemonEditor';
import ShowdownImportModal from '@/components/organisms/ShowdownImportModal';
import ShowdownExportModal from '@/components/organisms/ShowdownExportModal';
import { ParsedShowdownSet } from '@/features/pokemon/utils/showdown-parser';
import { TeamImportSelector } from '@/features/calculator/components/TeamImportSelector';

import { MoveSection } from '@/components/organisms/PokemonConfigForm/MoveSection';
import { MetadataSection } from '@/components/organisms/PokemonConfigForm/MetadataSection';
import { formatShowdownSet } from '@/features/pokemon/utils/showdown-formatter';
import { TopSection } from '@/components/organisms/PokemonConfigForm/TopSection';

interface PokemonConfigFormProps {
  config: PokemonConfig;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
  /** How this build is edited. See BuildEditor — the form is driven by two reducers. */
  actions: BuildEditor;
  /** Stat stages. Battle state, so it isn't part of the build; absent means all zero. */
  stages?: Record<string, number>;
  // Context-specific props
  title?: string;
  sideColor?: string;
  hideTypeOverride?: boolean;
  enforceSpLimit?: boolean;
  renderMoveActions?: (move: MoveData | null, index: number) => React.ReactNode;
}

const PokemonConfigForm: React.FC<PokemonConfigFormProps> = ({
  config, pokemonList, moveList, actions, stages,
  title, sideColor, hideTypeOverride = false, enforceSpLimit = false,
  renderMoveActions
}) => {
  const {
    selectPokemon: onSelectPokemon, selectPreset: onSelectPreset, importShowdown: onImportShowdown,
    loadConfig: onLoadConfig, setSp: onSpChange, setNature: onNatureChange, toggleNature: onToggleNature,
    setStage: onStageChange, setMove: onSelectMove, clearMove: onClearMove, setAbility: onAbilityChange,
    setItem: onItemChange, setType: onTypeChange, toggleTypeOverride: onToggleTypeOverride,
    toggleAegislashForm: onToggleAegislashForm, resetStats: onResetStats,
  } = actions;
  const [lastAppliedPreset, setLastAppliedPreset] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [isTeamSelectorOpen, setIsTeamSelectorOpen] = useState(false);
  const selectedPokemon = pokemonList.find(p => p.id === config.selectedId);
  const pokemonTypes = [config.type1, config.type2].filter((t): t is string => !!t).map(t => t.toLowerCase());
  
  const availablePresets = selectedPokemon 
    ? POKEMON_PRESETS.filter(p => p.pokemonName === selectedPokemon.nameEn)
    : [];

  const handleExportShowdown = () => {
    if (!selectedPokemon) return;
    const speciesName = config.form && selectedPokemon.id === AEGISLASH_ID
      ? `${selectedPokemon.nameEn}-${config.form}`
      : selectedPokemon.nameEn;
    
    const showdownText = formatShowdownSet(config, speciesName);
    setExportText(showdownText);
    setIsExportModalOpen(true);
  };

  return (
    <div className="bg-card rounded-xl border border-line p-6 space-y-6">
      <ShowdownImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={(set) => {
          if (onImportShowdown) {
            onImportShowdown(set);
          }
        }} 
      />
      <ShowdownExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportText={exportText}
      />
      {/* 1. Title Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-1.5 h-6 ${sideColor || 'bg-accent'} rounded-full`} />
          <h2 className="text-lg font-bold text-ink-1 whitespace-nowrap">{title || "Pokémon 1"}</h2>
        </div>
        
        {/* Actions Selection moved to top right */}
        <div className="flex gap-1.5 items-center justify-end shrink">
          {onLoadConfig && (
            <div className="relative shrink-0">
              <button
                onClick={() => setIsTeamSelectorOpen(!isTeamSelectorOpen)}
                className="text-[9px] font-black text-accent hover:text-accent uppercase tracking-widest bg-accent-soft hover:bg-accent-soft-hover px-2 py-1.5 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                Teams
              </button>
              {isTeamSelectorOpen && (
                <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[500px] bg-card border border-line rounded-xl shadow-[var(--shadow-pop)] z-30 overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-3 border-b border-line bg-inset">
                    <span className="text-xs font-bold text-ink-2">Import from team</span>
                    <button
                      onClick={() => setIsTeamSelectorOpen(false)}
                      className="text-ink-3 hover:text-ink-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <TeamImportSelector 
                      pokemonList={pokemonList}
                      onSelect={(loadedConfig) => {
                        onLoadConfig(loadedConfig);
                        setIsTeamSelectorOpen(false);
                      }} 
                      onClose={() => setIsTeamSelectorOpen(false)}
                    />
                  </div>
                </div>
              )}
              {isTeamSelectorOpen && (
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsTeamSelectorOpen(false)}
                />
              )}
            </div>
          )}

          {onImportShowdown && (
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="text-[9px] font-black text-accent hover:text-accent uppercase tracking-widest bg-accent-soft hover:bg-accent-soft-hover px-2 py-1.5 rounded-full transition-colors whitespace-nowrap"
              >
                Import
              </button>
              {selectedPokemon && (
                <button
                  onClick={handleExportShowdown}
                  className="text-[9px] font-black text-accent hover:text-accent uppercase tracking-widest bg-accent-soft hover:bg-accent-soft-hover px-2 py-1.5 rounded-full transition-colors whitespace-nowrap"
                >
                  Export
                </button>
              )}
            </div>
          )}

          {selectedPokemon && availablePresets.length > 0 ? (
            <div className="relative group shrink-0">
              <button className="text-[9px] font-black text-accent hover:text-accent uppercase tracking-widest bg-accent-soft hover:bg-accent-soft-hover px-2 py-1.5 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap">
                Presets <span className="bg-accent-soft text-accent px-1.5 rounded-full text-[9px] leading-tight">{availablePresets.length}</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-line rounded-xl shadow-[var(--shadow-pop)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  {availablePresets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (onSelectPreset) {
                          onSelectPreset(preset);
                          setLastAppliedPreset(preset.name);
                          setTimeout(() => setLastAppliedPreset(null), 3000);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors border-b last:border-0 border-line flex flex-col gap-0.5 ${
                        lastAppliedPreset === preset.name
                          ? 'bg-safe-soft text-safe'
                          : 'text-ink-2 hover:bg-accent-soft hover:text-accent'
                      }`}
                    >
                      <span className="font-bold flex justify-between items-center">
                        {preset.name}
                        {lastAppliedPreset === preset.name && <span className="text-[10px] text-safe bg-safe-soft px-1.5 rounded-full">Applied</span>}
                      </span>
                      <span className="text-[9px] text-ink-3 uppercase tracking-wider">{preset.nature} • {preset.item}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <TopSection 
        title={title}
        selectedId={config.selectedId}
        selectedPokemon={selectedPokemon}
        form={config.form}
        pokemonList={pokemonList}
        item={config.item}
        onSelectPokemon={onSelectPokemon}
        onItemChange={onItemChange}
      />

      {/* 3. Stats Grid Section */}
      <div className="pt-2">
        <StatGrid 
          stats={{
            hp: { base: config.baseHp, sp: config.spHp },
            atk: { base: config.baseAtk, sp: config.spAtk },
            def: { base: config.baseDef, sp: config.spDef },
            spa: { base: config.baseSpa, sp: config.spSpa },
            spd: { base: config.baseSpd, sp: config.spSpd },
            spe: { base: config.baseSpe, sp: config.spSpe },
          }}
          nature={config.nature}
          onToggleNature={onToggleNature}
          onSpChange={onSpChange}
          onStageChange={onStageChange}
          stages={stages ?? { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }}
          ability={config.activeAbility}
          pokemonTypes={pokemonTypes}
          enforceSpLimit={enforceSpLimit}
          onResetStats={onResetStats}
        />
      </div>

      <MoveSection 
        moves={config.moves}
        moveList={moveList}
        onSelectMove={onSelectMove}
        onClearMove={onClearMove}
        renderMoveActions={renderMoveActions}
      />

      <MetadataSection 
        selectedId={config.selectedId}
        form={config.form}
        activeAbility={config.activeAbility}
        abilities={config.abilities}
        nature={config.nature}
        isTypeOverridden={config.isTypeOverridden}
        type1={config.type1}
        type2={config.type2}
        hideTypeOverride={hideTypeOverride}
        onAbilityChange={onAbilityChange}
        onNatureChange={onNatureChange}
        onTypeChange={onTypeChange}
        onToggleTypeOverride={onToggleTypeOverride}
        onToggleAegislashForm={onToggleAegislashForm}
      />
    </div>
  );
};

export default PokemonConfigForm;
