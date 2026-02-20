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
