/**
 * Google Fit REST API service
 *
 * Setup (one-time):
 *  1. Go to https://console.cloud.google.com
 *  2. Create a project → APIs & Services → Enable "Fitness API"
 *  3. Credentials → Create OAuth 2.0 Client ID → Web application
 *  4. Add your app URL to "Authorised JavaScript origins" (e.g. http://localhost:5173)
 *  5. Copy the Client ID and add to your .env:
 *       VITE_GOOGLE_FIT_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
 *
 * The service uses Google Identity Services (GIS) implicit flow — no backend needed.
 * Access tokens are kept in memory only (not persisted).
 */

// ── Public types ───────────────────────────────────────────────────────────────

export interface FitDaySummary {
  /** YYYY-MM-DD */
  date: string;
  steps: number;
  calories: number;
  activeMinutes: number;
  sleepHours: number;
  weightKg?: number;
  heartRateBpm?: number;
}

// ── Internal GIS types ────────────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): GisTokenClient;
        };
      };
    };
  }
}

const CLIENT_ID = (import.meta as Record<string, any>).env?.VITE_GOOGLE_FIT_CLIENT_ID as string | undefined;

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
].join(' ');

const FIT_API = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';
const DAY_MS  = 86_400_000;

// ── Service ───────────────────────────────────────────────────────────────────

class GoogleFitService {
  private accessToken: string | null = null;
  private scriptLoaded = false;

  /** True if VITE_GOOGLE_FIT_CLIENT_ID is set */
  isConfigured(): boolean {
    return !!CLIENT_ID;
  }

  /**
   * Fetch the last `days` days of activity from Google Fit.
   * Will trigger Google's OAuth consent screen on first call (or when token expires).
   */
  async fetchLastNDays(days = 7): Promise<FitDaySummary[]> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Fit is not configured. Add VITE_GOOGLE_FIT_CLIENT_ID to your .env file.',
      );
    }

    if (!this.accessToken) {
      this.accessToken = await this.authorize();
    }

    const endMs   = Date.now();
    const startMs = endMs - days * DAY_MS;

    const payload = {
      aggregateBy: [
        { dataTypeName: 'com.google.step_count.delta'   },
        { dataTypeName: 'com.google.calories.expended'  },
        { dataTypeName: 'com.google.active_minutes'     },
        { dataTypeName: 'com.google.weight'             },
        { dataTypeName: 'com.google.heart_rate.bpm'     },
        { dataTypeName: 'com.google.sleep.segment'      },
      ],
      bucketByTime:   { durationMillis: DAY_MS },
      startTimeMillis: startMs,
      endTimeMillis:   endMs,
    };

    const res = await fetch(FIT_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      // Token expired — clear and retry once
      this.accessToken = null;
      this.accessToken = await this.authorize();
      return this.fetchLastNDays(days);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errBody?.error?.message || `Google Fit API error ${res.status}`);
    }

    const data = await res.json() as { bucket?: BucketDto[] };
    return this.parseBuckets(data.bucket ?? []);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private authorize(): Promise<string> {
    return this.loadGisScript().then(
      () =>
        new Promise((resolve, reject) => {
          const client = window.google!.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID!,
            scope: SCOPES,
            callback: (r) => {
              if (r.error || !r.access_token) {
                reject(new Error(r.error_description || r.error || 'Google OAuth failed'));
              } else {
                resolve(r.access_token);
              }
            },
            error_callback: (e) => {
              if (e.type !== 'popup_closed') reject(new Error(`OAuth error: ${e.type}`));
              else reject(new Error('popup_closed'));
            },
          });
          client.requestAccessToken({ prompt: '' });
        }),
    );
  }

  private loadGisScript(): Promise<void> {
    if (this.scriptLoaded || window.google?.accounts) {
      this.scriptLoaded = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s    = document.createElement('script');
      s.src      = 'https://accounts.google.com/gsi/client';
      s.async    = true;
      s.defer    = true;
      s.onload   = () => { this.scriptLoaded = true; resolve(); };
      s.onerror  = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(s);
    });
  }

  private parseBuckets(buckets: BucketDto[]): FitDaySummary[] {
    return buckets.map((b) => {
      const date = new Date(Number(b.startTimeMillis)).toISOString().slice(0, 10);
      let steps = 0, calories = 0, activeMinutes = 0, sleepMs = 0;
      let weightKg: number | undefined;
      let heartRateSum = 0, heartRateCount = 0;

      for (const ds of b.dataset ?? []) {
        const srcId = ds.dataSourceId;
        for (const pt of ds.point ?? []) {
          for (const val of pt.value ?? []) {
            if (srcId.includes('step_count'))    steps         += val.intVal  ?? 0;
            else if (srcId.includes('calories')) calories      += Math.round(val.fpVal ?? 0);
            else if (srcId.includes('active_minutes')) activeMinutes += val.intVal ?? 0;
            else if (srcId.includes('weight'))   weightKg       = val.fpVal;
            else if (srcId.includes('heart_rate.bpm')) {
              heartRateSum   += val.fpVal ?? 0;
              heartRateCount += 1;
            } else if (srcId.includes('sleep')) {
              const start = Number(pt.startTimeNanos ?? 0) / 1e6;
              const end   = Number(pt.endTimeNanos   ?? 0) / 1e6;
              sleepMs += (end - start);
            }
          }
        }
      }

      return {
        date,
        steps,
        calories,
        activeMinutes,
        sleepHours: Math.round((sleepMs / 3_600_000) * 10) / 10,
        weightKg,
        heartRateBpm: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : undefined,
      };
    });
  }
}

// ── Internal DTO ──────────────────────────────────────────────────────────────

interface BucketDto {
  startTimeMillis: string;
  endTimeMillis:   string;
  dataset?: {
    dataSourceId: string;
    point?: {
      startTimeNanos?: string;
      endTimeNanos?:   string;
      value?: { intVal?: number; fpVal?: number }[];
    }[];
  }[];
}

export const googleFit = new GoogleFitService();
