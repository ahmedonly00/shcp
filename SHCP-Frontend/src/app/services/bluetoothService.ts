/**
 * Web Bluetooth Health Service
 *
 * Connects to BLE health devices that expose standard Bluetooth GATT health profiles:
 *   • Heart Rate Monitor  (0x180D)
 *   • Blood Pressure      (0x1810)
 *   • Health Thermometer  (0x1809)
 *   • Weight Scale        (0x181D)
 *   • Glucose Meter       (0x1808)
 *   • Pulse Oximeter      (0x1822)
 *   • Battery Service     (0x180F)
 *
 * Compatible with:  Chrome 56+, Edge 79+  on Windows, macOS, Android.
 * Not supported in: Firefox, Safari, iOS.
 */

// ── Public types ───────────────────────────────────────────────────────────────

export interface BleDevice {
  id: string;
  name: string;
  battery?: number;
  /** GATT primary service UUIDs exposed by this device */
  services: string[];
  connectedAt: Date;
}

export type VitalsUpdate = Partial<{
  heartRate: string;
  bloodPressure: string;
  temperature: string;
  oxygenSaturation: string;
  weight: string;
  glucose: string;
}>;

type VitalsListener    = (update: VitalsUpdate, deviceId: string) => void;
type DisconnectListener = (deviceId: string) => void;

// ── Internal Bluetooth API types (Web Bluetooth not in TS lib by default) ─────

/* eslint-disable @typescript-eslint/no-explicit-any */
type BT = {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: { services?: string[] }[];
    optionalServices?: string[];
  }): Promise<any>;
};

// ── Service implementation ────────────────────────────────────────────────────

class BluetoothHealthService {
  private connected = new Map<string, {
    device: any;
    gatt: any;
    chars: Array<{ chr: any; listener: (e: any) => void }>;
    disconnectHandler: () => void;
  }>();
  private vitalsListeners    = new Set<VitalsListener>();
  private disconnectListeners = new Set<DisconnectListener>();

  /** True if the current browser supports Web Bluetooth */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Opens the browser's native Bluetooth device picker and connects.
   * MUST be called from a user gesture (button click).
   * @returns info about the connected device
   */
  async scan(): Promise<BleDevice> {
    if (!this.isSupported()) {
      throw new Error(
        'Web Bluetooth is not supported in this browser. Please use Chrome or Edge on Windows or Android.',
      );
    }

    const bt = (navigator as any).bluetooth as BT;
    const device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        'heart_rate',
        'battery_service',
        'blood_pressure',
        'health_thermometer',
        'weight_scale',
        'glucose',
        '00001822-0000-1000-8000-00805f9b34fb', // Pulse Oximeter
        'running_speed_and_cadence',
        'cycling_speed_and_cadence',
        'cycling_power',
      ],
    });

    return this.connectDevice(device);
  }

  /** Disconnect a previously connected device by its ID */
  async disconnect(deviceId: string): Promise<void> {
    const entry = this.connected.get(deviceId);
    if (entry) {
      for (const { chr, listener } of entry.chars) {
        chr.removeEventListener('characteristicvaluechanged', listener);
        chr.stopNotifications().catch(() => {});
      }
      if (entry.gatt?.connected) entry.gatt.disconnect();
      entry.device.removeEventListener('gattserverdisconnected', entry.disconnectHandler);
      this.connected.delete(deviceId);
    }
  }

  isConnected(deviceId: string): boolean {
    return this.connected.has(deviceId);
  }

  /** Subscribe to real-time vitals pushed by any connected device */
  onVitalsUpdate(cb: VitalsListener): () => void {
    this.vitalsListeners.add(cb);
    return () => this.vitalsListeners.delete(cb);
  }

  /** Subscribe to device disconnect events */
  onDisconnect(cb: DisconnectListener): () => void {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async connectDevice(device: any): Promise<BleDevice> {
    const gatt = await device.gatt.connect();
    const disconnectHandler = () => {
      this.connected.delete(device.id);
      this.disconnectListeners.forEach(cb => cb(device.id));
    };
    this.connected.set(device.id, { device, gatt, chars: [], disconnectHandler });
    device.addEventListener('gattserverdisconnected', disconnectHandler);

    // Subscribe to all health characteristics in parallel
    await this.subscribeAll(device.id, gatt);

    const battery  = await this.readBattery(gatt).catch(() => undefined);
    const rawSvcs  = await gatt.getPrimaryServices().catch(() => []);
    const services = (rawSvcs as any[]).map((s: any) => String(s.uuid));

    return {
      id:          device.id,
      name:        device.name || 'Unknown Health Device',
      battery,
      services,
      connectedAt: new Date(),
    };
  }

  private async subscribeAll(deviceId: string, gatt: any) {
    const sub = async (
      svcUuid: string,
      chrUuid: string,
      parse: (v: DataView) => VitalsUpdate,
    ) => {
      try {
        const svc = await gatt.getPrimaryService(svcUuid);
        const chr = await svc.getCharacteristic(chrUuid);

        // Subscribe to notifications if supported
        try {
          await chr.startNotifications();
          const listener = (e: any) => {
            try { this.emit(parse(e.target.value), deviceId); } catch { /* bad frame */ }
          };
          chr.addEventListener('characteristicvaluechanged', listener);
          this.connected.get(deviceId)?.chars.push({ chr, listener });
        } catch { /* char is read-only */ }

        // Initial read
        try {
          const val = await chr.readValue();
          this.emit(parse(val), deviceId);
        } catch { /* notification-only */ }
      } catch { /* service not present on this device */ }
    };

    await Promise.all([
      sub('heart_rate',         'heart_rate_measurement',   v => ({ heartRate:        `${this.parseHeartRate(v)} bpm` })),
      sub('blood_pressure',     'blood_pressure_measurement', v => ({ bloodPressure:  this.parseBloodPressure(v) })),
      sub('health_thermometer', 'temperature_measurement',  v => ({ temperature:      `${this.parseTemperature(v)} °C` })),
      sub('weight_scale',       'weight_measurement',       v => ({ weight:           `${this.parseWeight(v)} kg` })),
      sub('glucose',            'glucose_measurement',      v => ({ glucose:          `${this.parseGlucose(v)} mmol/L` })),
      // Pulse oximeter SpO2
      sub(
        '00001822-0000-1000-8000-00805f9b34fb',
        '00002a5f-0000-1000-8000-00805f9b34fb',
        // PLX Spot-Check (0x2A5F): flags byte 0, SpO2 SFLOAT at bytes 1-2
        v => ({ oxygenSaturation: `${Math.round(this.sfloat(v, 1))}%` }),
      ),
    ]);
  }

  // ── GATT characteristic parsers ─────────────────────────────────────────────

  /** Heart Rate Measurement (0x2A37) */
  private parseHeartRate(v: DataView): number {
    const flags = v.getUint8(0);
    return flags & 0x01 ? v.getUint16(1, true) : v.getUint8(1);
  }

  /** Blood Pressure Measurement (0x2A35) — returns "systolic/diastolic" */
  private parseBloodPressure(v: DataView): string {
    const sys = this.sfloat(v, 1);
    const dia = this.sfloat(v, 3);
    return `${Math.round(sys)}/${Math.round(dia)}`;
  }

  /**
   * Temperature Measurement (0x2A1C).
   * Bytes 1-4: IEEE 11073-20601 FLOAT (3-byte mantissa LE + 1-byte signed exponent)
   */
  private parseTemperature(v: DataView): string {
    const exp = v.getInt8(4);
    const man = v.getUint8(1) | (v.getUint8(2) << 8) | (v.getUint8(3) << 16);
    const celsius = man * Math.pow(10, exp);
    return celsius.toFixed(1);
  }

  /**
   * Weight Measurement (0x2A9D).
   * Unit flag bit 0: 0 = SI (kg, resolution 0.005), 1 = Imperial (lb, resolution 0.01)
   */
  private parseWeight(v: DataView): string {
    const flags = v.getUint8(0);
    const raw   = v.getUint16(1, true);
    const kg    = flags & 0x01 ? raw * 0.01 * 0.453592 : raw * 0.005;
    return kg.toFixed(1);
  }

  /** Glucose Measurement (0x2A18) — returns mmol/L */
  private parseGlucose(v: DataView): string {
    const flags  = v.getUint8(0);
    const raw    = this.sfloat(v, 10); // concentration at offset 10
    // flag bit 2: 0 = kg/L, 1 = mol/L → convert to mmol/L
    // kg/L ÷ glucose molecular weight (0.18016 kg/mol) = mol/L × 1000 = mmol/L
    const mmol   = flags & 0x04 ? raw * 1000 : raw / 0.00018016;
    return Math.max(0, mmol).toFixed(1);
  }

  /** Decode a Bluetooth SFLOAT (16-bit: 4-bit exponent + 12-bit signed mantissa) */
  private sfloat(v: DataView, offset: number): number {
    const raw      = v.getUint16(offset, true);
    const exp      = raw >> 12;
    const man      = raw & 0x0fff;
    const signedExp = exp  >= 8     ? exp - 16     : exp;
    const signedMan = man  >= 0x800 ? man - 0x1000 : man;
    return signedMan * Math.pow(10, signedExp);
  }

  private async readBattery(gatt: any): Promise<number> {
    const svc = await gatt.getPrimaryService('battery_service');
    const chr = await svc.getCharacteristic('battery_level');
    const v   = await chr.readValue();
    return v.getUint8(0);
  }

  private emit(update: VitalsUpdate, deviceId: string) {
    // Filter out NaN / empty values
    const clean: VitalsUpdate = {};
    for (const [k, val] of Object.entries(update)) {
      if (val && !String(val).includes('NaN')) {
        (clean as Record<string, string>)[k] = val;
      }
    }
    if (Object.keys(clean).length > 0) {
      this.vitalsListeners.forEach(cb => cb(clean, deviceId));
    }
  }
}

export const bluetoothHealth = new BluetoothHealthService();
