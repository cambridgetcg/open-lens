import {
  createLens,
  ENGINE_ID,
  ENGINE_VERSION,
  SCHEMA_VERSION,
} from "../../../packages/core/src/index.js";
import english from "../../../packages/lexicon-en/src/index.js";
import { artifactId } from "./http.js";

/**
 * The only Pages-layer boundary for @open-lens/core and its data packs.
 * Handlers consume these transport-oriented functions, never package internals.
 * In a published workspace the two relative imports above become:
 *
 *   import { createLens } from "@open-lens/core";
 *   import english from "@open-lens/lexicon-en";
 */

const lens = createLens({ packs: [english] });

export async function analyzeDocument(document) {
  // Core is intentionally synchronous and zero-network. Keep this adapter
  // async so Pages handlers can later support a worker boundary unchanged.
  const analysis = lens.analyze(document);
  return { id: artifactId("ana"), ...analysis };
}

export function listTechniques() {
  return english.techniques.map((technique) => ({
    id: technique.id,
    key: technique.key,
    name: technique.name,
    family: technique.family,
    status: technique.status,
    mechanism: technique.mechanism || technique.what,
    benign_reading: technique.benign_reading,
    output_phrasing: technique.output_phrasing,
    realizations: technique.realizations,
  }));
}

export function getTechnique(id) {
  const folded = String(id).toLocaleLowerCase("en");
  return listTechniques().find((technique) =>
    technique.id?.toLocaleLowerCase("en") === folded
    || technique.key?.toLocaleLowerCase("en") === folded);
}

export function listPacks() {
  return [{
    id: english.id,
    object: "pack",
    schema_version: SCHEMA_VERSION,
    version: english.version,
    languages: [...english.languages],
    technique_count: english.techniques.length,
    license: english.license,
    source: "https://github.com/cambridgetcg/open-lens",
    execution: "trusted-declarative-data",
    regex_engine: "javascript-regexp",
    trust: "installed-and-reviewed-by-deployer",
    permissions: { network: false },
  }];
}

export const coreVersions = Object.freeze({
  schema: SCHEMA_VERSION,
  engine: { id: ENGINE_ID, version: ENGINE_VERSION },
});
