/**
 * FPGA Board Catalog — loads curated FPGA module entries from JSON.
 *
 * These entries were extracted from the original mockCatalog.ts and represent
 * FPGA modules that have `fpgaFamily` set. Each entry is a single
 * (moduleId × categoryCoverage × subCoverage) combination.
 *
 * Future: fitModel.json channels/resources can be used to cross-validate
 * channelCapacity values and flag mismatches.
 */
import type { ModuleCatalogEntry } from '@/lib/proposal/catalog'
import fpgaEntriesJson from '@/lib/proposal/data/fpgaCatalogEntries.json'

/** All FPGA catalog entries (36 entries across 19 families × category combos). */
export const FPGA_BOARD_CATALOG: ModuleCatalogEntry[] = fpgaEntriesJson as unknown as ModuleCatalogEntry[]
