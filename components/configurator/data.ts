import type { Category } from './types'

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
                'Voltage': ['±10 V', '±10.24 V', '±20 V', '±25 V', '±48 V', '0–10 V'],
                'Current': ['0–20 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['16-bit', '18-bit', '20-bit', '24-bit'] },
          { key: 'speed', label: 'Bandwidth', options: ['Model Rate', '37.5 kHz', '200 kHz', '250 kHz', '500 kHz', '800 kHz', '1 MHz', '1.5 MHz', '2 MHz', '4 MHz', '5 MHz'] },
        ],
        defaults: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '200 kHz' },
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
                'Voltage': ['±10 V', '±10.8 V', '±12 V', '±20 V', '0–10 V'],
                'Current': ['0–20 mA', '0–24 mA', '±10 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['14-bit', '16-bit', '18-bit', '20-bit'] },
          { key: 'speed', label: 'Update Rate', options: ['Model Rate', '200 kHz', '450 kHz', '500 kHz', '1 MHz', '1.5 MHz', '5 MHz'] },
        ],
        defaults: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10.8 V', resolution: '16-bit', speed: 'Model Rate' },
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
          { key: 'range', label: 'Logic Level', options: ['5 V TTL', '3.3 V', '24 V', 'RS-422', 'LVDS'] },
          { key: 'resolution', label: 'Isolation', options: ['None', 'Isolated'] },
          { key: 'speed', label: 'Speed', options: ['Standard', 'High-speed'] },
        ],
        defaults: { range: '5 V TTL', resolution: 'None', speed: 'Standard' },
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'range', label: 'Logic Level', options: ['5 V TTL', '3.3 V', '24 V', 'RS-422', 'High-side'] },
          { key: 'resolution', label: 'Isolation', options: ['None', 'Isolated'] },
          { key: 'speed', label: 'Speed', options: ['Standard', 'High-speed'] },
        ],
        defaults: { range: '5 V TTL', resolution: 'None', speed: 'Standard' },
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    subCategories: [
      {
        id: 'can',
        label: 'CAN / CAN FD',
        fields: [
          { key: 'range', label: 'Protocol', options: ['CAN', 'CAN FD'] },
          { key: 'speed', label: 'Data Rate', options: ['500 kbit/s', '1 Mbit/s', '2 Mbit/s', '5 Mbit/s'] },
        ],
        defaults: { range: 'CAN FD', speed: '2 Mbit/s' },
      },
      {
        id: 'ethernet',
        label: 'Ethernet',
        fields: [
          { key: 'range', label: 'Speed', options: ['1 GbE', '10 GbE'] },
          { key: 'speed', label: 'Usage', options: ['TCP/IP', 'UDP', 'EtherCAT'] },
        ],
        defaults: { range: '1 GbE', speed: 'TCP/IP' },
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
          { key: 'range', label: 'Type', options: ['Incremental', 'SSI', 'BiSS', 'EnDat'] },
          { key: 'speed', label: 'Max Rate', options: ['10 kHz', '50 kHz', '100 kHz', '5 MHz'] },
          { key: 'resolution', label: 'Counter', options: ['16-bit', '24-bit', '32-bit'] },
        ],
        defaults: { range: 'Incremental', speed: '50 kHz', resolution: '16-bit' },
      },
      {
        id: 'resolver',
        label: 'Resolver',
        fields: [
          { key: 'range', label: 'Type', options: ['Single-speed', 'Multi-speed'] },
          { key: 'speed', label: 'Excitation', options: ['2.5 kHz', '5 kHz', '10 kHz'] },
          { key: 'resolution', label: 'Resolution', options: ['12-bit', '14-bit', '16-bit'] },
        ],
        defaults: { range: 'Single-speed', speed: '5 kHz', resolution: '14-bit' },
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
          { key: 'speed', label: 'Sample Rate', options: ['100 Hz', '1 kHz', '10 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '1 kHz' },
      },
      {
        id: 'simulation',
        label: 'Simulation',
        fields: [
          { key: 'range', label: 'Sensor Type', options: ['Thermocouple', 'RTD', 'Thermistor'] },
          { key: 'speed', label: 'Update Rate', options: ['100 Hz', '1 kHz', '10 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '1 kHz' },
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
      },
      {
        id: 'vibration',
        label: 'Vibration (IEPE)',
        fields: [
          { key: 'range', label: 'Sensitivity', options: ['100 mV/g', '500 mV/g', '1000 mV/g'] },
          { key: 'speed', label: 'Bandwidth', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: '500 mV/g', speed: '50 kHz' },
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
      },
      {
        id: 'switches',
        label: 'Solid-State',
        fields: [
          { key: 'range', label: 'Type', options: ['MOSFET', 'IGBT'] },
          { key: 'speed', label: 'Current', options: ['1 A', '5 A', '20 A'] },
        ],
        defaults: { range: 'MOSFET', speed: '5 A' },
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
          { key: 'speed', label: 'Sample Rate', options: ['10 kHz', '100 kHz', '1 MHz'] },
        ],
        defaults: { range: '0–600 V', speed: '100 kHz' },
      },
      {
        id: 'switching',
        label: 'Switching Control',
        fields: [
          { key: 'range', label: 'Driver Type', options: ['IGBT', 'Gate Driver', 'PWM'] },
          { key: 'speed', label: 'Bandwidth', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: 'IGBT', speed: '50 kHz' },
      },
    ],
  },
  {
    id: 'custom',
    label: 'Custom Signal',
    subCategories: [
      {
        id: 'gen_purpose',
        label: 'General Purpose',
        fields: [
          { key: 'range', label: 'I/O Type', options: ['Analog In', 'Analog Out', 'Digital I/O'] },
          { key: 'speed', label: 'Performance', options: ['Standard', 'High-speed', 'Real-time'] },
        ],
        defaults: { range: 'Analog In', speed: 'Standard' },
      },
    ],
  },
]
