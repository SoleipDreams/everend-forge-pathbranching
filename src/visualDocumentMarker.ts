import YAML from "yaml";
/** A reserved WorldNotion document envelope is not a canon character or entity. */
export function isWorldNotionVisualDocument(source: string): boolean {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!/^---[ \t]*\n/.test(normalized)) return false;
  const header = normalized.split(/^---[ \t]*$/m)[1] || "";
  if (/^(?:forgeView|"forgeView"|'forgeView')\s*:/m.test(header)) return true;
  try {
    const data = YAML.parse(header);
    return Boolean(data && typeof data === "object" && Object.hasOwn(data, "forgeView"));
  } catch { return false; }
}
