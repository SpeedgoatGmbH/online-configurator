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
                'Voltage': ['±10 V', '0-10 V', '±5 V'],
                'Current': ['0-20 mA', '4-20 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['16-bit', '18-bit', '24-bit'] },
          { key: 'speed', label: 'Bandwidth', options: ['20 kHz', '100 kHz', '500 kHz'] },
        ],
        defaults: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' },
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
                'Voltage': ['±10 V', '0-10 V', '±5 V'],
                'Current': ['0-20 mA', '4-20 mA']
              }
            }
          },
          { key: 'resolution', label: 'Resolution', options: ['14-bit', '16-bit', '18-bit'] },
          { key: 'speed', label: 'Update Rate', options: ['20 kHz', '100 kHz', '500 kHz'] },
        ],
        defaults: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' },
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
          { key: 'signalType', label: 'Interface Class', options: ['TTL / Discrete', 'Differential Serial', 'Isolated Power Input'] },
          {
            key: 'range',
            label: 'Signaling / Voltage',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['5 V TTL', '3.3 V TTL', '24 V'],
                'Differential Serial': ['RS422/RS485', 'LVDS', 'M-LVDS'],
                'Isolated Power Input': ['0-24 V', '0-31 V', '0-48 V'],
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
              },
            },
          },
        ],
        defaults: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' },
      },
      {
        id: 'outputs',
        label: 'Outputs',
        fields: [
          { key: 'signalType', label: 'Interface Class', options: ['TTL / Discrete', 'Differential Serial', 'Isolated Power Output'] },
          {
            key: 'range',
            label: 'Signaling / Voltage',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'TTL / Discrete': ['5 V TTL', '3.3 V TTL', '24 V'],
                'Differential Serial': ['RS422/RS485', 'LVDS', 'M-LVDS'],
                'Isolated Power Output': ['+5-34 V', '+5-48 V', '+6-48 V'],
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
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    subCategories: [
      {
        id: 'cross_industry',
        label: 'Cross-Industry',
        fields: [
          {
            key: 'signalType',
            label: 'Protocol Family',
            options: ['CAN / LIN', 'Serial / Bus', 'Ethernet / Middleware', 'Timing / Sync'],
          },
          {
            key: 'range',
            label: 'Protocol',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'CAN / LIN': ['CAN', 'CAN FD', 'SAE J1939', 'LIN'],
                'Serial / Bus': ['RS-422', 'RS-485', 'RS-232', 'SPI', 'I2C', 'MVB / WTB'],
                'Ethernet / Middleware': ['Real-Time UDP', 'Raw Ethernet', 'MQTT', 'DDS', 'Aurora', 'Shared Memory'],
                'Timing / Sync': ['PTP (IEEE 1588)', 'IRIG + GPS'],
              },
            },
          },
          {
            key: 'resolution',
            label: 'Mode',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'CAN / LIN': ['HS CAN', 'LS CAN', 'CAN FD'],
                'Serial / Bus': ['Point-to-point', 'Multi-drop'],
                'Ethernet / Middleware': ['Publisher/Subscriber', 'Client/Server'],
                'Timing / Sync': ['Master', 'Slave'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Data Rate',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'CAN / LIN': ['500 kbit/s', '1 Mbit/s', '2 Mbit/s', '8 Mbit/s'],
                'Serial / Bus': ['115.2 kbit/s', '1 Mbit/s', '5 Mbit/s', '10 Mbit/s'],
                'Ethernet / Middleware': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'Timing / Sync': ['Sub-microsecond sync', 'Microsecond sync'],
              },
            },
          },
        ],
        defaults: {
          signalType: 'CAN / LIN',
          range: 'CAN FD',
          resolution: 'CAN FD',
          speed: '1 Mbit/s',
        },
      },
      {
        id: 'automotive',
        label: 'Automotive',
        fields: [
          { key: 'signalType', label: 'Protocol Family', options: ['Vehicle Bus', 'Automotive Ethernet', 'Calibration / Diagnostics'] },
          {
            key: 'range',
            label: 'Protocol',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Vehicle Bus': ['CAN', 'CAN FD', 'LIN', 'FlexRay', 'SENT', 'PSI5'],
                'Automotive Ethernet': ['Automotive Ethernet'],
                'Calibration / Diagnostics': ['XCP over CAN', 'XCP over Ethernet', 'EV Charging'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Data Rate',
            options: {
              dependsOn: 'signalType',
              conditions: {
                'Vehicle Bus': ['500 kbit/s', '1 Mbit/s', '2 Mbit/s', '8 Mbit/s'],
                'Automotive Ethernet': ['100 Mbit/s', '1 Gbit/s', '2.5 Gbit/s', '10 Gbit/s'],
                'Calibration / Diagnostics': ['1 Mbit/s', '100 Mbit/s', '1 Gbit/s'],
              },
            },
          },
        ],
        defaults: { signalType: 'Vehicle Bus', range: 'CAN FD', speed: '1 Mbit/s' },
      },
      {
        id: 'industrial',
        label: 'Industrial Automation',
        fields: [
          { key: 'signalType', label: 'Protocol Family', options: ['Fieldbus', 'Industrial Ethernet', 'Utility / SCADA'] },
          {
            key: 'range',
            label: 'Protocol',
            options: {
              dependsOn: 'signalType',
              conditions: {
                Fieldbus: ['CANopen', 'PROFIBUS', 'Modbus RTU'],
                'Industrial Ethernet': ['EtherCAT', 'PROFINET', 'EtherNet/IP', 'POWERLINK', 'OPC UA', 'Modbus TCP'],
                'Utility / SCADA': ['DNP3', 'IEC 61850'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Data Rate',
            options: {
              dependsOn: 'signalType',
              conditions: {
                Fieldbus: ['500 kbit/s', '1 Mbit/s', '12 Mbit/s'],
                'Industrial Ethernet': ['100 Mbit/s', '1 Gbit/s', '10 Gbit/s'],
                'Utility / SCADA': ['100 Mbit/s', '1 Gbit/s'],
              },
            },
          },
        ],
        defaults: { signalType: 'Industrial Ethernet', range: 'EtherCAT', speed: '100 Mbit/s' },
      },
      {
        id: 'aerospace',
        label: 'Aerospace',
        fields: [
          { key: 'signalType', label: 'Protocol Family', options: ['ARINC', 'Military / Avionics'] },
          {
            key: 'range',
            label: 'Protocol',
            options: {
              dependsOn: 'signalType',
              conditions: {
                ARINC: ['AFDX (ARINC 664 P7)', 'ARINC 429', 'ARINC 629', 'ARINC 825'],
                'Military / Avionics': ['MIL-STD-1553', 'SDLC/HDLC', 'Dshot'],
              },
            },
          },
          {
            key: 'speed',
            label: 'Data Rate',
            options: {
              dependsOn: 'signalType',
              conditions: {
                ARINC: ['100 kbit/s', '1 Mbit/s', '100 Mbit/s'],
                'Military / Avionics': ['1 Mbit/s', '10 Mbit/s', '100 Mbit/s'],
              },
            },
          },
        ],
        defaults: { signalType: 'ARINC', range: 'ARINC 429', speed: '100 kbit/s' },
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
          { key: 'speed', label: 'Signal Rate', options: ['10 kHz', '100 kHz', '1 MHz'] },
          { key: 'resolution', label: 'Resolution', options: ['16-bit', '24-bit', '32-bit'] },
        ],
        defaults: { range: 'Incremental', speed: '100 kHz', resolution: '16-bit' },
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
          { key: 'speed', label: 'Sample Rate', options: ['10 Hz', '100 Hz', '1 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '100 Hz' },
      },
      {
        id: 'simulation',
        label: 'Simulation',
        fields: [
          { key: 'range', label: 'Sensor Type', options: ['Thermocouple', 'RTD', 'Thermistor'] },
          { key: 'speed', label: 'Update Rate', options: ['10 Hz', '100 Hz', '1 kHz'] },
        ],
        defaults: { range: 'Thermocouple', speed: '100 Hz' },
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
          { key: 'speed', label: 'Sample Rate', options: ['1 kHz', '10 kHz', '100 kHz'] },
        ],
        defaults: { range: '0–600 V', speed: '10 kHz' },
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
          { key: 'speed', label: 'Performance', options: ['Standard', 'High-speed', 'Deterministic'] },
        ],
        defaults: { range: 'Analog In', speed: 'Standard' },
      },
    ],
  },
]
