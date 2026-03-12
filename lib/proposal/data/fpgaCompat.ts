/**
 * FPGA code-module compatibility matrix and sub-ID mappings.
 *
 * Relocated from mockCatalog.ts — these are curated reference maps
 * not derivable from MAT exports.
 *
 * FPGA_CODE_MODULE_COMPAT: Maps FPGA families → Set<code-module>.
 * Derived from Speedgoat IO Blockset v9.11.1.1 documentation
 * (see doc/speedgoat-fpga-io-architecture-analysis.md §9.3).
 *
 * SUB_ID_TO_CODE_MODULES: Gates FPGA candidates by sub-ID.
 * SUB_ID_EXTENSION_PREFERENCE: Picks the right extension for signal types.
 */

// ── FPGA Code-Module Compatibility ─────────────────────────────────────────────

export const FPGA_CODE_MODULE_COMPAT: Record<string, Set<string>> = {
  IO306: new Set(['PWM', 'SPI', 'I2C', 'Digital', 'Pulse Counter', 'Quadrature', 'Interrupt', 'DMA Controller']),
  IO307: new Set(['PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Interrupt', 'DMA Controller']),
  IO324: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Resolver', 'TPI6020', 'SENT', 'Dshot', 'Cam and Crank', 'CMU Emulation', 'Interrupt', 'DMA Controller']),
  IO334: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Resolver', 'SENT', 'Dshot', 'Cam and Crank', 'Interrupt', 'DMA Controller']),
  IO336: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Resolver', 'TPI6020', 'SENT', 'Dshot', 'Cam and Crank', 'CMU Emulation', 'Interrupt', 'DMA Controller']),
  IO337: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Resolver', 'Interrupt', 'DMA Controller']),
  IO397: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'TPI6020', 'Interrupt', 'DMA Controller']),
  // Configurable-only modules
  IO316: new Set(['PWM', 'SPI', 'I2C', 'Digital', 'Pulse Counter', 'Quadrature', 'Interrupt', 'DMA Controller']),
  IO317: new Set(['PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Interrupt', 'DMA Controller']),
  IO318: new Set(['PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Interrupt', 'DMA Controller']),
  IO322: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'Interrupt', 'DMA Controller']),
  IO391: new Set(['PWM', 'SPI', 'I2C', 'Digital', 'Pulse Counter', 'Quadrature', 'Interrupt', 'DMA Controller']),
  IO392: new Set(['PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Interrupt', 'DMA Controller']),
  IO393: new Set(['PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Interrupt', 'DMA Controller']),
  IO325: new Set(['Analog', 'PWM', 'SPI', 'I2C', 'Serial', 'Digital', 'Pulse Counter', 'Quadrature', 'SSI', 'BiSS', 'EnDat', 'Resolver', 'SENT', 'Interrupt', 'DMA Controller']),
}

// ── Sub-ID → Code Module Mapping ───────────────────────────────────────────────

/**
 * Maps configurator sub-IDs to FPGA code-module names used in the compat matrix.
 * A sub-ID may map to multiple code modules (any match = compatible).
 */
export const SUB_ID_TO_CODE_MODULES: Record<string, string[]> = {
  // Digital sub-categories
  'pwm':       ['PWM'],
  'capture':   ['PWM', 'Pulse Counter'],
  'gpio':      ['Digital'],
  // Motion & Position
  'encoder':   ['Quadrature', 'BiSS', 'EnDat', 'SSI'],
  'resolver':  ['Resolver'],
  // Communication protocols
  'spi':       ['SPI'],
  'i2c':       ['I2C'],
  'serial':    ['Serial'],
  'sent':      ['SENT'],
  'dshot':     ['Dshot'],
  // Analog (for FPGA modules with on-board ADC/DAC)
  'inputs':    ['Analog'],
  'outputs':   ['Analog'],
  // Custom / general purpose FPGA
  'gen_purpose': [],
}

// ── Sub-ID → Extension Preference ──────────────────────────────────────────────

/**
 * Maps configurator sub-IDs to the preferred I/O interface extension type.
 * Used by `addFpgaInterfaceBoards()` to choose the right extension
 * instead of always defaulting to -21 (TTL).
 *
 * Priority (most specific wins): resolver (-24) > analog (-120) > RS422 (-22) > TTL (-21)
 */
export const SUB_ID_EXTENSION_PREFERENCE: Record<string, string> = {
  'resolver': '-24',
  'a2b':      '-40',
}
