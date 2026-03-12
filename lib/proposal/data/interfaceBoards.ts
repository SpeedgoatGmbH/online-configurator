/**
 * IO Interface Boards (IO33X-N) and IO Interface Extensions (-21, -22, etc.).
 *
 * Relocated from mockCatalog.ts — these are curated hardware reference data
 * not available in the MAT exports.
 */

// ── IO33X-N Front Interface Boards ─────────────────────────────────────────────

/**
 * IO Interface Boards (IO33X-N) for FPGA I/O modules.
 * These are front I/O boards that plug into IO33x series modules.
 */
export const IO_INTERFACE_BOARDS = [
  {
    "interfaceId": "IO33X-1-LV",
    "description": "64 x digital LVTTL (3.3V) front I/O lines",
    "channelCount": 64,
    "channelType": "digital LVTTL (3.3V)",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-2",
    "description": "30 x RS485 (RS422 compliant) front I/O lines",
    "channelCount": 30,
    "channelType": "RS485 (RS422 compliant)",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-3",
    "description": "16 x CMOS (5V) and 22 RS485 (RS422 compliant) front I/O lines",
    "channelCount": 16,
    "channelType": "CMOS (5V) and 22 RS485 (RS422 compliant)",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-4",
    "description": "30 x LVDS I/O lines",
    "channelCount": 30,
    "channelType": "LVDS",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-5",
    "description": "2 x 16-bit 105 MHz differential simultaneous analog inputs",
    "channelCount": null,
    "channelType": null,
    "hasAnalog": true,
    "hasDigital": false
  },
  {
    "interfaceId": "IO33X-6",
    "description": "16 x 16-bit 500kHz ADs, 8 x 16-bit DAs with 10µs settling time, 16 x digital TTL I/O lines",
    "channelCount": 16,
    "channelType": "16-bit 500kHz ADs, 8 x 16-bit DAs with 10µs settling time, 16 x digital TTL",
    "hasAnalog": true,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-7",
    "description": "16 x 16-bit analog outputs with 2µs settling time, +/- 10V",
    "channelCount": null,
    "channelType": null,
    "hasAnalog": true,
    "hasDigital": true
  },
  {
    "interfaceId": "IO33X-8",
    "description": "8 x 16-bit analog outputs with 2µs settling time, +/- 10V",
    "channelCount": null,
    "channelType": null,
    "hasAnalog": true,
    "hasDigital": true
  }
] as const;

// ── IO Interface Extensions ────────────────────────────────────────────────────

/**
 * IO Interface Extensions (-21, -22, -24, -40, -120).
 * Signal conditioning boards extending rear LVCMOS lines.
 */
export const IO_INTERFACE_EXTENSIONS = [
  {
    "extensionId": "-21",
    "description": "Converts the rear I/O lines from LVCMOS to 3.3 V/5 V TTL, and makes them accessible from the front of the enclosure",
    "type": "TTL Signal Conditioning",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "extensionId": "-22",
    "description": "Converts the rear I/O lines from LVCMOS to RS422, RS485, and 3.3 V/5 V TTL and makes them accessible from the front of the enclosure",
    "type": "RS422/RS485/TTL Signal Conditioning",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "extensionId": "-24",
    "description": "Makes use of the LVCMOS rear I/O lines to interface with two Resolver-to-Digital Converters. Converts some of the rear I/O lines from LVCMOS to RS422, RS485, and 3.3 V/5 V TTL and makes them accessible from the front of the enclosure",
    "type": "Resolver-to-Digital Converter + Signal Conditioning",
    "hasAnalog": false,
    "hasDigital": true
  },
  {
    "extensionId": "-40",
    "description": "Provides two A2B nodes of type AD2433, and makes them accessible from the front of the enclosure",
    "type": "A2B (Automotive Audio Bus)",
    "hasAnalog": false,
    "hasDigital": false
  },
  {
    "extensionId": "-120",
    "description": "Provides the following analog functionality: 16 x 16-bit analog inputs up to 1.5 MSPS sampling rate 16 x 16-bit analog outputs up to 10 MSPS update rate",
    "type": "Analog I/O Extension",
    "hasAnalog": true,
    "hasDigital": false
  }
] as const;
