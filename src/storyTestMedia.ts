import type { BranchingProject } from './domain.js';
import { canonPresentationImageForRef } from './explorerSchema.js';
import { resolveCanonVariantFrontmatter } from './worldnotionVariants.js';

/** Resolve presentation from the run's document; URLs stay a desktop concern. */
export function storyTestSpeaker(
  project: BranchingProject,
  propertiesConfig: Record<string, unknown> | undefined,
  ref: string,
  variantId?: string,
): { name: string; portraitPath?: string } | undefined {
  const canon = project.canonRefs.find(entity => entity.id === ref);
  if (canon) {
    const portrait = canonPresentationImageForRef(propertiesConfig, {
      ...canon, frontmatter: resolveCanonVariantFrontmatter(canon, variantId),
    }, 'portrait');
    return { name: canon.label ?? canon.id, portraitPath: portrait?.value };
  }
  const local = project.localExplorerEntities?.find(entity => entity.id === ref);
  if (!local) return undefined;
  const portrait = canonPresentationImageForRef(propertiesConfig, {
    kind: local.type, frontmatter: local.properties,
  }, 'portrait');
  // A local portrait property can hold an imported image's stable asset ID.
  const asset = project.assets?.find(asset => asset.kind === 'image' && asset.id === portrait?.value);
  return { name: local.name, portraitPath: asset?.path ?? portrait?.value };
}
