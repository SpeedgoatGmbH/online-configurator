import type { Category } from './types'

/**
 * Lookup table: `"categoryId:subId:specKey"` → friendly label from CATEGORIES.
 * Falls back to a title-cased version of the raw key if not found.
 */
const _specLabelCache = new Map<string, string>()

export function getSpecLabel(categoryId: string, subId: string, key: string): string {
  const cacheKey = `${categoryId}:${subId}:${key}`
  if (_specLabelCache.has(cacheKey)) return _specLabelCache.get(cacheKey)!

  for (const cat of CATEGORIES) {
    if (cat.id !== categoryId) continue
    for (const sub of cat.subCategories) {
      if (sub.id !== subId) continue
      const field = sub.fields.find((f) => f.key === key)
      if (field) {
        _specLabelCache.set(cacheKey, field.label)
        return field.label
      }
    }
  }

  // Fallback: title-case the raw key  (e.g. "signalType" → "Signal Type")
  const fallback = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
  _specLabelCache.set(cacheKey, fallback)
  return fallback
}

export const CATEGORIES: Category[] = [
  {
    id: 'analog',
    label: 'Analog',
    subCategories: [
      {
        id: 'inputs',
        label: 'Inputs',
        fields: [
          { key: 'inputMode', label: 'Wiring', options: ['Single-ended', 'Differential'] },
          { key: 'signalType', label: 'Type', options: ['Voltage', 'Current'] },
          { 
            key: 'signalRange', 
            label: 'Range', 
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Voltage': ['±10 V', '0-10 V', '±5 V', '±20 V', '±25 V', '±48 V', '±7.5 V'],
                'Current': ['0-20 mA', '4-20 mA', '±25 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['14-bit', '16-bit', '18-bit', '24-bit'] },
          {
            key: 'speed',
            label: 'Acquisition',
            options: ['20 kHz', '100 kHz', '500 kHz', '2 MHz', '5 MHz'],
            tooltip: 'Defines how fast the module can acquire analog input signals. This rate may exceed the closed-loop control rate of the application (e.g., for oversampling).',
          },
        ],
        defaults: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' },
        defaultQuantity: 16,
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'outputMode', label: 'Wiring', options: ['Single-ended', 'Differential'] },
          { key: 'signalType', label: 'Type', options: ['Voltage', 'Current'] },
          { 
            key: 'signalRange', 
            label: 'Range', 
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Voltage': ['±10 V', '0-10 V', '±5 V', '±12 V', '±20 V', '±7.5 V'],
                'Current': ['0-20 mA', '4-20 mA', '0-24 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['14-bit', '16-bit', '18-bit', '20-bit'] },
          {
            key: 'speed',
            label: 'Settling',
            options: ['20 kHz', '100 kHz', '500 kHz', '5 MHz'],
            tooltip: 'For controls applications, this defines how quickly the output signal reaches and stabilizes at a new value after an update. In HIL applications, this determines how quickly the simulator can apply updated analog signals to the controller.',
          },
        ],
        defaults: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' },
        defaultQuantity: 8,
      },
    ],
  },
  {
    id: 'digital',
    label: 'Digital',
    subCategories: [
      {
        id: 'inputs',
        label: 'Inputs',
        fields: [
          { key: 'signalType', label: 'Interface Class', options: ['TTL / Discrete', 'Differential Serial', 'Isolated Power Input', 'LVDS'] },
          {
            key: 'range',
            label: 'Signaling / Voltage',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['5 V TTL', '3.3 V TTL', '24 V'],
                'Differential Serial': ['RS422/RS485', 'LVDS', 'M-LVDS'],
                'Isolated Power Input': ['0-24 V', '0-31 V', '0-48 V'],
                'LVDS': ['LVDS Pairs'],
              },
            },
          },
          {
            key: 'resolution',
            label: 'Isolation',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['None', 'Isolated'],
                'Differential Serial': ['None'],
                'Isolated Power Input': ['Isolated Inputs'],
                'LVDS': ['None'],
              },
            },
          },
        ],
        defaults: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' },
        defaultQuantity: 32,
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'signalType', label: 'Interface Class', options: ['TTL / Discrete', 'Differential Serial', 'Isolated Power Output', 'LVDS'] },
          {
            key: 'range',
            label: 'Signaling / Voltage',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['5 V TTL', '3.3 V TTL', '24 V'],
                'Differential Serial': ['RS422/RS485', 'LVDS', 'M-LVDS'],
                'Isolated Power Output': ['+5-34 V', '+5-48 V', '+6-48 V'],
                'LVDS': ['LVDS Pairs'],
              },
            },
          },
          {
            key: 'resolution',
            label: 'Isolation',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['None', 'Isolated'],
                'Differential Serial': ['None'],
                'Isolated Power Output': ['Isolated Outputs', 'Isolated Inputs + Outputs'],
                'LVDS': ['None'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Topology / Current',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['Push-pull'],
                'Differential Serial': ['Driver enabled', 'Driver with line termination'],
                'Isolated Power Output': [
                  'High-side (0.5 A/ch)',
                  'Low-side (0.5 A/ch)',
                  'Selectable HS/LS (1 A/ch)',
                  '2 A/ch (5 A total)',
                ],
              },
            },
          },
        ],
        defaults: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None', speed: 'Push-pull' },
        defaultQuantity: 32,
      },
      {
        id: 'pwm',
        label: 'PWM Generation',
        fields: [
          { key: 'range', label: 'Signal Level', options: ['TTL 5 V', 'TTL 3.3 V', 'RS422', 'LVDS'] },
          { key: 'speed', label: 'Clock Rate', options: ['1 MHz', '5 MHz', '10 MHz', '25 MHz'] },
        ],
        defaults: { range: 'TTL 5 V', speed: '10 MHz' },
        defaultQuantity: 4,
      },
      {
        id: 'capture',
        label: 'Signal Capture',
        fields: [
          { key: 'range', label: 'Signal Level', options: ['TTL 5 V', 'TTL 3.3 V', 'RS422', 'LVDS'] },
          { key: 'speed', label: 'Clock Rate', options: ['1 MHz', '5 MHz', '10 MHz', '25 MHz'] },
        ],
        defaults: { range: 'TTL 5 V', speed: '10 MHz' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    subCategories: [
      {
        id: 'protocols',
        label: 'Protocols',
        fields: [
          {
            key: 'range',
            label: 'Protocol',
            options: [
              'CAN',
              'CAN FD',
              'LIN',
              'FlexRay',
              'SENT',
              'PSI5',
              'Automotive Ethernet',
              'XCP over CAN',
              'XCP over Ethernet',
              'EtherCAT',
              'PROFINET',
              'EtherNet/IP',
              'POWERLINK',
              'OPC UA',
              'CANopen',
              'PROFIBUS',
              'Modbus RTU',
              'Modbus TCP',
              'DNP3',
              'IEC 61850',
              'AFDX (ARINC 664 P7)',
              'ARINC 429',
              'ARINC 629',
              'ARINC 825',
              'MIL-STD-1553',
              'MVB / WTB',
              'SAE J1939',
              'Dshot',
              'SDLC/HDLC',
              'EV Charging (ISO 15118)',
              'RS-422',
              'RS-485',
              'RS-232',
              'SPI',
              'I2C',
              'PTP (IEEE 1588)',
              'IRIG + GPS',
              'MQTT',
              'DDS',
              'Raw Ethernet',
              'Real-Time UDP',
              'Aurora',
              'Shared Memory',
            ],
          },
          {
            key: 'resolution',
            label: 'Link / Medium',
            options: {
              dependsOn: 'range',
              conditions: {
                'CAN': ['HS CAN'],
                'CAN FD': ['HS CAN FD'],
                'LIN': ['LIN'],
                'FlexRay': ['FlexRay'],
                'SENT': ['SENT'],
                'PSI5': ['PSI5'],
                'Automotive Ethernet': ['100BASE-T1', '1000BASE-T1', '2.5GBASE-T1', '10GBASE-T1'],
                'XCP over CAN': ['CAN'],
                'XCP over Ethernet': ['Ethernet'],
                'EtherCAT': ['100BASE-TX'],
                'PROFINET': ['100BASE-TX', '1000BASE-T'],
                'EtherNet/IP': ['100BASE-TX', '1000BASE-T'],
                'POWERLINK': ['100BASE-TX'],
                'OPC UA': ['Ethernet'],
                'CANopen': ['CAN'],
                'PROFIBUS': ['RS-485'],
                'Modbus RTU': ['RS-485', 'RS-232'],
                'Modbus TCP': ['Ethernet'],
                'DNP3': ['Serial', 'Ethernet'],
                'IEC 61850': ['Ethernet'],
                'AFDX (ARINC 664 P7)': ['Ethernet'],
                'ARINC 429': ['ARINC 429'],
                'ARINC 629': ['ARINC 629'],
                'ARINC 825': ['CAN'],
                'MIL-STD-1553': ['MIL-STD-1553'],
                'MVB / WTB': ['MVB / WTB'],
                'SAE J1939': ['CAN'],
                'Dshot': ['Dshot'],
                'SDLC/HDLC': ['Serial'],
                'EV Charging (ISO 15118)': ['PLC (HomePlug)', 'CCS Combo', 'CHAdeMO'],
                'RS-422': ['RS-422'],
                'RS-485': ['RS-485'],
                'RS-232': ['RS-232'],
                'SPI': ['SPI'],
                'I2C': ['I2C'],
                'PTP (IEEE 1588)': ['Ethernet'],
                'IRIG + GPS': ['IRIG', 'GPS'],
                'MQTT': ['Ethernet'],
                'DDS': ['Ethernet'],
                'Raw Ethernet': ['Ethernet'],
                'Real-Time UDP': ['Ethernet'],
                'Aurora': ['Serial transceiver'],
                'Shared Memory': ['Host memory'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Data Rate',
            options: {
              dependsOn: 'range',
              conditions: {
                'CAN': ['500 kbit/s', '1 Mbit/s'],
                'CAN FD': ['2 Mbit/s', '5 Mbit/s', '8 Mbit/s'],
                'LIN': ['19.2 kbit/s'],
                'FlexRay': ['10 Mbit/s'],
                'SENT': ['3 kbit/s', '30 kbit/s'],
                'PSI5': ['125 kbit/s', '189 kbit/s'],
                'Automotive Ethernet': ['100 Mbit/s', '1 Gbit/s', '2.5 Gbit/s', '10 Gbit/s'],
                'XCP over CAN': ['500 kbit/s', '1 Mbit/s'],
                'XCP over Ethernet': ['100 Mbit/s', '1 Gbit/s'],
                'EtherCAT': ['100 Mbit/s'],
                'PROFINET': ['100 Mbit/s', '1 Gbit/s'],
                'EtherNet/IP': ['100 Mbit/s', '1 Gbit/s'],
                'POWERLINK': ['100 Mbit/s'],
                'OPC UA': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'CANopen': ['500 kbit/s', '1 Mbit/s'],
                'PROFIBUS': ['12 Mbit/s'],
                'Modbus RTU': ['115.2 kbit/s', '1 Mbit/s'],
                'Modbus TCP': ['100 Mbit/s', '1 Gbit/s'],
                'DNP3': ['100 Mbit/s', '1 Gbit/s'],
                'IEC 61850': ['100 Mbit/s', '1 Gbit/s'],
                'AFDX (ARINC 664 P7)': ['100 Mbit/s'],
                'ARINC 429': ['100 kbit/s'],
                'ARINC 629': ['2 Mbit/s'],
                'ARINC 825': ['1 Mbit/s'],
                'MIL-STD-1553': ['1 Mbit/s'],
                'MVB / WTB': ['1.5 Mbit/s'],
                'SAE J1939': ['250 kbit/s', '500 kbit/s'],
                'Dshot': ['150 kbit/s', '300 kbit/s', '600 kbit/s', '1200 kbit/s'],
                'SDLC/HDLC': ['64 kbit/s', '2 Mbit/s', '10 Mbit/s'],
                'EV Charging (ISO 15118)': ['10 Mbit/s'],
                'RS-422': ['10 Mbit/s'],
                'RS-485': ['10 Mbit/s'],
                'RS-232': ['115.2 kbit/s'],
                'SPI': ['10 Mbit/s', '20 Mbit/s'],
                'I2C': ['400 kbit/s', '1 Mbit/s'],
                'PTP (IEEE 1588)': ['Sub-microsecond sync', 'Microsecond sync'],
                'IRIG + GPS': ['Microsecond sync'],
                'MQTT': ['100 Mbit/s', '1 Gbit/s'],
                'DDS': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'Raw Ethernet': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'Real-Time UDP': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'Aurora': ['1 Gbit/s', '5 Gbit/s', '10 Gbit/s'],
                'Shared Memory': ['PCIe-class throughput'],
              },
            },
          },
        ],
        defaults: { range: 'CAN FD', resolution: 'HS CAN FD', speed: '2 Mbit/s' },
        defaultQuantity: 2,
      },
    ],
  },
  {
    id: 'motion',
    label: 'Motion & Position',
    subCategories: [
      {
        id: 'encoder',
        label: 'Encoder',
        fields: [
          { key: 'range', label: 'Type', options: ['Incremental', 'QAD (A/B/Z)', 'QAE (A/B)', 'SSI', 'BiSS', 'EnDat', 'Cam & Crank'] },
          { key: 'speed', label: 'Signal Rate', options: ['10 kHz', '100 kHz', '1 MHz'] },
          { key: 'resolution', label: 'Resolution', options: ['16-bit', '24-bit', '32-bit'] },
        ],
        defaults: { range: 'Incremental', speed: '100 kHz', resolution: '16-bit' },
        defaultQuantity: 4,
      },
      {
        id: 'resolver',
        label: 'Resolver',
        fields: [
          { key: 'range', label: 'Type', options: ['Resolver', 'LVDT', 'RVDT', 'Synchro'] },
          { key: 'speed', label: 'Excitation', options: ['2.5 kHz', '5 kHz', '10 kHz'] },
          { key: 'resolution', label: 'Resolution', options: ['12-bit', '14-bit', '16-bit'] },
        ],
        defaults: { range: 'Resolver', speed: '5 kHz', resolution: '14-bit' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    subCategories: [
      {
        id: 'measurement',
        label: 'Measurement',
        fields: [
          { key: 'range', label: 'Sensor Type', options: ['Thermocouple', 'RTD', 'Thermistor'] },
          { key: 'speed', label: 'Sample Rate', options: ['10 Hz', '100 Hz', '1 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '100 Hz' },
        defaultQuantity: 8,
      },
      {
        id: 'simulation',
        label: 'Simulation',
        fields: [
          { key: 'range', label: 'Sensor Type', options: ['Thermocouple', 'RTD', 'Thermistor'] },
          { key: 'speed', label: 'Update Rate', options: ['10 Hz', '100 Hz', '1 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '100 Hz' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'strain',
    label: 'Strain & Vibration',
    subCategories: [
      {
        id: 'strain',
        label: 'Strain Gauge',
        fields: [
          { key: 'range', label: 'Bridge Type', options: ['Full-Bridge', 'Half-Bridge', 'Quarter-Bridge'] },
          { key: 'speed', label: 'Sample Rate', options: ['1 kHz', '10 kHz', '50 kHz'] },
        ],
        defaults: { range: 'Full-Bridge', speed: '10 kHz' },
        defaultQuantity: 4,
      },
      {
        id: 'vibration',
        label: 'Vibration (IEPE)',
        fields: [
          { key: 'range', label: 'Sensitivity', options: ['100 mV/g', '500 mV/g', '1000 mV/g'] },
          { key: 'speed', label: 'Bandwidth', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: '500 mV/g', speed: '50 kHz' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'fault',
    label: 'Fault Insertion',
    subCategories: [
      {
        id: 'relays',
        label: 'Relays',
        fields: [
          { key: 'range', label: 'Contact Type', options: ['SPST', 'SPDT', 'DPST'] },
          { key: 'speed', label: 'Rating', options: ['120 V AC', '250 V AC', '30 V DC'] },
        ],
        defaults: { range: 'SPDT', speed: '120 V AC' },
        defaultQuantity: 4,
      },
      {
        id: 'switches',
        label: 'Solid-State',
        fields: [
          { key: 'range', label: 'Type', options: ['MOSFET', 'IGBT'] },
          { key: 'speed', label: 'Current', options: ['1 A', '5 A', '20 A'] },
        ],
        defaults: { range: 'MOSFET', speed: '5 A' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'highvoltage',
    label: 'High Voltage',
    subCategories: [
      {
        id: 'measurement',
        label: 'Measurement',
        fields: [
          { key: 'range', label: 'Range', options: ['0–600 V', '0–1000 V', '0–1500 V'] },
          { key: 'speed', label: 'Sample Rate', options: ['1 kHz', '10 kHz', '100 kHz'] },
        ],
        defaults: { range: '0–600 V', speed: '10 kHz' },
        defaultQuantity: 4,
      },
      {
        id: 'switching',
        label: 'Switching Control',
        fields: [
          { key: 'range', label: 'Driver Type', options: ['IGBT', 'Gate Driver', 'PWM'] },
          { key: 'speed', label: 'Bandwidth', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: 'IGBT', speed: '50 kHz' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'resistor',
    label: 'Resistor Simulation',
    subCategories: [
      {
        id: 'simulation',
        label: 'Programmable Resistors',
        fields: [
          { key: 'range', label: 'Resistance Range', options: ['0–1 kΩ', '0–10 kΩ', '0–100 kΩ', '0–1 MΩ'] },
          { key: 'resolution', label: 'Resolution', options: ['10-bit', '12-bit', '16-bit'] },
          { key: 'speed', label: 'Update Rate', options: ['1 kHz', '10 kHz', '100 kHz'] },
        ],
        defaults: { range: '0–10 kΩ', resolution: '12-bit', speed: '10 kHz' },
        defaultQuantity: 4,
      },
    ],
  },
  {
    id: 'bms',
    label: 'Battery Management',
    subCategories: [
      {
        id: 'cell_emulation',
        label: 'Cell Emulation',
        fields: [
          { key: 'range', label: 'Voltage Range', options: ['0–5 V', '0–7 V', '0–10 V', '0–60 V'] },
          { key: 'speed', label: 'Update Rate', options: ['1 kHz', '10 kHz', '100 kHz'] },
          { key: 'resolution', label: 'Resolution', options: ['14-bit', '16-bit'] },
        ],
        defaults: { range: '0–5 V', speed: '10 kHz', resolution: '16-bit' },
        defaultQuantity: 12,
      },
      {
        id: 'fault_insertion',
        label: 'Fault Insertion (BMS)',
        fields: [
          { key: 'range', label: 'Fault Type', options: ['Open Cell', 'Short Cell', 'Low Voltage', 'High Voltage'] },
          { key: 'speed', label: 'Switching Speed', options: ['1 ms', '100 µs', '10 µs'] },
        ],
        defaults: { range: 'Open Cell', speed: '100 µs' },
        defaultQuantity: 4,
      },
      {
        id: 'temp_emulation',
        label: 'Temperature Emulation',
        fields: [
          { key: 'range', label: 'Sensor Type', options: ['NTC', 'PTC', 'Thermocouple', 'RTD'] },
          { key: 'speed', label: 'Update Rate', options: ['10 Hz', '100 Hz', '1 kHz'] },
          { key: 'resolution', label: 'Resistance Range', options: ['0–1 kΩ', '0–10 kΩ', '0–100 kΩ'] },
        ],
        defaults: { range: 'NTC', speed: '100 Hz', resolution: '0–10 kΩ' },
        defaultQuantity: 8,
      },
    ],
  },
  {
    id: 'custom',
    label: 'General Purpose',
    subCategories: [
      {
        id: 'gen_purpose',
        label: 'General Purpose',
        fields: [
          { key: 'range', label: 'I/O Type', options: ['Analog In', 'Analog Out', 'Digital I/O'] },
          { key: 'speed', label: 'Performance', options: ['Standard', 'High-speed', 'Deterministic'] },
        ],
        defaults: { range: 'Analog In', speed: 'Standard' },
        defaultQuantity: 4,
      },
    ],
  },
]
