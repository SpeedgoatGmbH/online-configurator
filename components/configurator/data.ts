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
          { key: 'inputMode', label: 'Input Mode', options: ['Single-Ended', 'Differential'] },
          { key: 'signalType', label: 'Signal Type', options: ['Voltage', 'Current'] },
          { 
            key: 'signalRange', 
            label: 'Input Range', 
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Voltage': ['-10 V to +10 V', '-10.24 V to +10.24 V', '-20 V to +20 V', '-25 V to +25 V', '-48 V to +48 V', '0 V to +10 V'],
                'Current': ['0 mA to +20 mA']
              }
            }
          },
          { key: 'resolution', label: 'ADC Resolution', options: ['16-bit', '18-bit', '20-bit', '24-bit'] },
          { key: 'speed', label: 'Sampling Rate', options: ['Model Rate', '37.5 kHz', '200 kHz', '250 kHz', '500 kHz', '800 kHz', '1 MHz', '1.5 MHz', '2 MHz', '4 MHz', '5 MHz'] },
        ],
        defaults: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '-10 V to +10 V', resolution: '16-bit', speed: '200 kHz' },
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'outputMode', label: 'Output Mode', options: ['Single-Ended', 'Differential'] },
          { key: 'signalType', label: 'Signal Type', options: ['Voltage', 'Current'] },
          { 
            key: 'signalRange', 
            label: 'Output Range', 
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Voltage': ['-10 V to +10 V', '-10.8 V to +10.8 V', '-12 V to +12 V', '-20 V to +20 V', '0 V to +10 V'],
                'Current': ['0 mA to +20 mA', '0 mA to +24 mA', '-10 mA to +10 mA']
              }
            }
          },
          { key: 'resolution', label: 'DAC Resolution', options: ['14-bit', '16-bit', '18-bit', '20-bit'] },
          { key: 'speed', label: 'Update Rate', options: ['Model Rate', '200 kHz', '450 kHz', '500 kHz', '1 MHz', '1.5 MHz', '5 MHz'] },
        ],
        defaults: { outputMode: 'Single-Ended', signalType: 'Voltage', signalRange: '-10.8 V to +10.8 V', resolution: '16-bit', speed: 'Model Rate' },
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
          { key: 'range', label: 'Signal Type', options: ['TTL', 'RS422/RS485', 'LVDS', 'M-LVDS', 'Isolated 0 V to +24 V', 'Isolated 0 V to +48 V'] },
          { key: 'resolution', label: 'Channels', options: ['8', '16', '24', '32', '64'] },
          { key: 'speed', label: 'Type', options: ['Standard', 'High-Speed', 'Isolated'] },
        ],
        defaults: { range: 'TTL', resolution: '32', speed: 'Standard' },
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'range', label: 'Signal Type', options: ['TTL', 'RS422/RS485', 'LVDS', 'High-Side 6 V to +48 V', 'Low-Side 6 V to +48 V'] },
          { key: 'resolution', label: 'Channels', options: ['8', '16', '24', '32', '64'] },
          { key: 'speed', label: 'Type', options: ['Standard', 'High-Speed', 'Isolated'] },
        ],
        defaults: { range: 'TTL', resolution: '32', speed: 'Standard' },
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
          { key: 'range', label: 'Type', options: ['CAN', 'CAN FD', 'CAN FD Flexible'] },
          { key: 'resolution', label: 'Channels', options: ['1', '2', '4'] },
          { key: 'speed', label: 'Bit Rate', options: ['500 kbps', '2 Mbps', '5 Mbps'] },
        ],
        defaults: { range: 'CAN FD', resolution: '2', speed: '2 Mbps' },
      },
      {
        id: 'ethernet',
        label: 'Ethernet',
        fields: [
          { key: 'range', label: 'Type', options: ['1 GbE', '10 GbE', '100 GbE'] },
          { key: 'resolution', label: 'Ports', options: ['1', '2', '4'] },
          { key: 'speed', label: 'Protocol', options: ['TCP/IP', 'UDP', 'EtherCAT'] },
        ],
        defaults: { range: '1 GbE', resolution: '2', speed: 'TCP/IP' },
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
          { key: 'range', label: 'Type', options: ['Incremental', 'Absolute', 'SSI'] },
          { key: 'resolution', label: 'Precision', options: ['12-bit', '16-bit', '20-bit'] },
          { key: 'speed', label: 'Frequency', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: 'Incremental', resolution: '16-bit', speed: '50 kHz' },
      },
      {
        id: 'resolver',
        label: 'Resolver',
        fields: [
          { key: 'range', label: 'Type', options: ['Single-speed', 'Multi-speed', 'Brushless'] },
          { key: 'resolution', label: 'Precision', options: ['12-bit', '14-bit', '16-bit'] },
          { key: 'speed', label: 'Frequency', options: ['2.5 kHz', '5 kHz', '10 kHz'] },
        ],
        defaults: { range: 'Single-speed', resolution: '14-bit', speed: '5 kHz' },
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
          { key: 'range', label: 'Type', options: ['Thermocouple', 'Thermistor', 'RTD'] },
          { key: 'resolution', label: 'Channels', options: ['4', '8', '16'] },
          { key: 'speed', label: 'Sample Rate', options: ['100 Hz', '1 kHz', '10 kHz'] },
        ],
        defaults: { range: 'Thermocouple', resolution: '8', speed: '1 kHz' },
      },
      {
        id: 'simulation',
        label: 'Simulation',
        fields: [
          { key: 'range', label: 'Type', options: ['Thermocouple', 'Thermistor', 'RTD'] },
          { key: 'resolution', label: 'Channels', options: ['4', '8', '16'] },
          { key: 'speed', label: 'Update Rate', options: ['100 Hz', '1 kHz', '10 kHz'] },
        ],
        defaults: { range: 'Thermocouple', resolution: '8', speed: '1 kHz' },
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
          { key: 'range', label: 'Type', options: ['Half-Bridge', 'Full-Bridge', 'Quarter-Bridge'] },
          { key: 'resolution', label: 'Channels', options: ['4', '8', '16'] },
          { key: 'speed', label: 'Sample Rate', options: ['1 kHz', '10 kHz', '50 kHz'] },
        ],
        defaults: { range: 'Full-Bridge', resolution: '8', speed: '10 kHz' },
      },
      {
        id: 'vibration',
        label: 'Vibration (IEPE/ICP)',
        fields: [
          { key: 'range', label: 'Sensitivity', options: ['100 mV/g', '500 mV/g', '1000 mV/g'] },
          { key: 'resolution', label: 'Channels', options: ['4', '8', '16'] },
          { key: 'speed', label: 'Max Frequency', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: '500 mV/g', resolution: '8', speed: '50 kHz' },
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
          { key: 'range', label: 'Type', options: ['SPST', 'SPDT', 'DPST'] },
          { key: 'resolution', label: 'Channels', options: ['2', '4', '8'] },
          { key: 'speed', label: 'Contact Rating', options: ['120V AC', '250V AC', '30V DC'] },
        ],
        defaults: { range: 'SPDT', resolution: '4', speed: '120V AC' },
      },
      {
        id: 'switches',
        label: 'Solid-State Switches',
        fields: [
          { key: 'range', label: 'Type', options: ['MOSFET', 'IGBTs', 'BJTs'] },
          { key: 'resolution', label: 'Channels', options: ['4', '8', '16'] },
          { key: 'speed', label: 'Max Current', options: ['1A', '5A', '20A'] },
        ],
        defaults: { range: 'MOSFET', resolution: '8', speed: '5A' },
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
          { key: 'range', label: 'Range', options: ['0-600V', '0-1000V', '0-1500V'] },
          { key: 'resolution', label: 'Channels', options: ['2', '4', '8'] },
          { key: 'speed', label: 'Sample Rate', options: ['10 kHz', '100 kHz', '1 MHz'] },
        ],
        defaults: { range: '0-600V', resolution: '4', speed: '100 kHz' },
      },
      {
        id: 'switching',
        label: 'Switching Control',
        fields: [
          { key: 'range', label: 'Switch Type', options: ['IGBT Driver', 'Gate Driver', 'PWM Control'] },
          { key: 'resolution', label: 'Channels', options: ['2', '4', '8'] },
          { key: 'speed', label: 'Max Frequency', options: ['10 kHz', '50 kHz', '100 kHz'] },
        ],
        defaults: { range: 'IGBT Driver', resolution: '4', speed: '50 kHz' },
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
          { key: 'resolution', label: 'Channels', options: ['1', '2', '4', '8'] },
          { key: 'speed', label: 'Speed', options: ['Standard', 'High-Speed', 'Real-Time'] },
        ],
        defaults: { range: 'Analog In', resolution: '4', speed: 'Standard' },
      },
    ],
  },
]
