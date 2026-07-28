import React, { useEffect } from 'react';
import Modal from '@/components/atoms/Modal';
import PokemonConfigForm from '@/components/organisms/PokemonConfigForm';
import { usePokemonEditor, PokemonConfig, BuildEditor } from '@/features/pokemon/hooks/usePokemonEditor';
import { PokemonBaseStats } from '@/components/molecules/PokemonSearchSelect';
import { MoveData } from '@/components/molecules/MoveSearchSelect';
import { PokemonPreset } from '@/features/pokemon/utils/pokemon-presets';

interface TeamMemberEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: PokemonConfig) => void;
  initialConfig?: PokemonConfig | null;
  pokemonList: PokemonBaseStats[];
  moveList: MoveData[];
}

const TeamMemberEditorModal: React.FC<TeamMemberEditorModalProps> = ({
  isOpen, onClose, onSave, initialConfig, pokemonList, moveList
}) => {
  const { state, editor, handleSelectPreset, handleImportShowdown, loadConfig } = usePokemonEditor();

  // The two dex-dependent edits: the hook has no pokemonList/moveList, this component does.
  const actions: BuildEditor = {
    ...editor,
    selectPreset: (preset) => handleSelectPreset(preset, pokemonList, moveList),
    importShowdown: (set) => handleImportShowdown(set, pokemonList, moveList),
  };

  useEffect(() => {
    if (isOpen && initialConfig) {
      loadConfig(initialConfig);
    }
  }, [isOpen, initialConfig, loadConfig]);

  const handleSave = () => {
    onSave(state);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialConfig?.selectedId ? "Edit Pokemon" : "Add Pokemon"}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        <PokemonConfigForm
          config={state}
          pokemonList={pokemonList}
          moveList={moveList}
          actions={actions}
          hideTypeOverride={true}
          enforceSpLimit={true}
        />
        
        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <button
            onClick={onClose}
            className="px-6 py-2 text-ink-3 hover:bg-raise rounded-xl transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!state.selectedId}
            className="px-8 py-2 bg-accent text-accent-ink rounded-xl hover:bg-accent-hover transition-colors font-bold disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {initialConfig?.selectedId ? "Save Changes" : "Add to Team"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TeamMemberEditorModal;
