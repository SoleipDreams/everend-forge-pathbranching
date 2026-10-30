import { useState } from 'react';
import type { BranchingProject, NarrativeEffect } from '../domain.js';
import { interactionNodeId } from '../interactions.js';
import { customizeInteractionUse } from '../interactionLibrary.js';
import { useInterfaceLocale } from '../i18n.js';
import { NarrativeEffectEditor } from './NarrativeEffectEditor.js';
import { AccessibleTabs } from './AccessibleTabs.js';

export function InteractionConsequencesEditor({ project, eventId, nodeId, onMutation }: {
  project: BranchingProject;
  eventId: string;
  nodeId: string;
  onMutation: (mutate: (project: BranchingProject) => BranchingProject) => void | Promise<void>;
}) {
  const locale = useInterfaceLocale(), es = locale === 'es';
  const event = project.events.find(item => item.id === eventId);
  const use = event?.interactionUses?.find(item => interactionNodeId(eventId, item.id) === nodeId);
  const definition = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const [error, setError] = useState<string>();
  const result = definition?.results.find(item => item.id === selectedResultId) ?? definition?.results[0];
  if (!event || !use || !definition) return <p role="status">{es ? 'No se encontró esta interacción.' : 'This interaction could not be found.'}</p>;
  const save = async (effects: NarrativeEffect[]) => {
    try {
      setError(undefined);
      await onMutation(current => {
        const latestEvent = current.events.find(item => item.id === eventId);
        const latestUse = latestEvent?.interactionUses?.find(item => item.id === use.id);
        const latestDefinition = latestEvent?.interactionDefinitions?.find(item => item.id === latestUse?.definitionId);
        if (!latestDefinition) return current;
        return customizeInteractionUse(current, eventId, use.id, {
          results: latestDefinition.results.map(item => item.id === result?.id ? { ...item, effects } : item),
        });
    });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <section className="interaction-consequences-editor" aria-label={es ? 'Consecuencias de la interacción' : 'Interaction consequences'}>
    {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
    {definition.results.length ? <>
      <AccessibleTabs
        className="interaction-result-tabs"
        value={result?.id ?? ''}
        tabs={definition.results.map(item => ({ id: item.id, label: item.name, title: item.name }))}
        onChange={setSelectedResultId}
        ariaLabel={es ? 'Resultado de interacción' : 'Interaction result'}
      />
      {result ? <>
        <header className="interaction-consequences-heading">
          <h2>{result.name}</h2>
          <p>{es ? `Estos cambios se aplican al obtener «${result.name}».` : `These changes apply when “${result.name}” is obtained.`}</p>
        </header>
        <NarrativeEffectEditor
          project={project}
          draftId={`${use.id}:${result.id}`}
          context={{ eventId, dialogueId: use.dialogueId, nodeId }}
          value={result.effects ?? []}
          onChange={effects => { void save(effects); }}
        />
      </> : null}
    </> : <p className="narrative-muted">{es ? 'Añade resultados en la pestaña Interacción para configurar sus consecuencias.' : 'Add results on the Interaction tab to configure their consequences.'}</p>}
  </section>;
}
