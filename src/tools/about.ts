/**
 * about — Server metadata, dataset statistics, and provenance.
 *
 * Returns the fleet-wide contract shape: { server, dataset, provenance, security, _metadata }.
 * Asserted by tests/unit/coverage-completeness.test.ts, tests/unit/eu-data-paths.test.ts,
 * tests/unit/registry-dispatch.test.ts, and __tests__/contract/golden.test.ts via fixtures/golden-tests.json.
 */

import type Database from '@ansvar/mcp-sqlite';
import { detectCapabilities, readDbMetadata } from '../capabilities.js';
import { generateResponseMetadata } from '../utils/metadata.js';

export interface AboutContext {
  version: string;
  fingerprint: string;
  dbBuilt: string;
}

function safeCount(db: InstanceType<typeof Database>, sql: string): number {
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  } catch {
    return 0;
  }
}

function safeCapabilities(db: InstanceType<typeof Database>): string[] {
  try {
    return [...detectCapabilities(db)];
  } catch {
    return [];
  }
}

export function getAbout(db: InstanceType<typeof Database>, context: AboutContext) {
  const meta = readDbMetadata(db);

  return {
    server: {
      name: 'Austrian Law MCP',
      version: context.version,
      repository: 'https://github.com/Ansvar-Systems/Austria-law-mcp',
    },
    dataset: {
      jurisdiction: 'Austria (AT)',
      languages: ['de'],
      counts: {
        legal_documents: safeCount(db, 'SELECT COUNT(*) as count FROM legal_documents'),
        legal_provisions: safeCount(db, 'SELECT COUNT(*) as count FROM legal_provisions'),
        definitions: safeCount(db, 'SELECT COUNT(*) as count FROM definitions'),
        eu_documents: safeCount(db, 'SELECT COUNT(*) as count FROM eu_documents'),
        eu_references: safeCount(db, 'SELECT COUNT(*) as count FROM eu_references'),
      },
      fingerprint: context.fingerprint,
      built_at: context.dbBuilt,
      tier: meta.tier,
      schema_version: meta.schema_version,
      capabilities: safeCapabilities(db),
    },
    provenance: {
      sources: [
        {
          name: 'Rechtsinformationssystem des Bundes (RIS)',
          authority: 'Federal Chancellery (Bundeskanzleramt)',
          url: 'https://www.ris.bka.gv.at',
          license: 'Creative Commons Attribution 4.0',
        },
      ],
    },
    security: {
      access_model: 'read-only',
      pii: 'none',
    },
    _metadata: generateResponseMetadata(db),
  };
}
