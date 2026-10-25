import { createClient } from '@supabase/supabase-js';
import { md5 } from './joytel-sign.js';

/**
 * Server-side helpers shared by the JoyTel callback handlers.
 * - rspCall: signed request to the RSP+ system through the fixed-IP proxy
 * - getSetting / saveSetting: small key-value store on the system_settings table
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Prefer the service role key (server only); fall back to the anon key the project already uses.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function getSetting(key) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  if (error || !data) return null;
  try {
    return typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
  } catch {
    return null;
  }
}

export async function saveSetting(key, value, description) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('system_settings')
    .upsert({ setting_key: key, setting_value: JSON.stringify(value), description }, { onConflict: 'setting_key' });
  if (error) throw new Error(`Failed to save ${key}: ${error.message}`);
}

/**
 * Call an RSP+ endpoint. Returns { transId, status, body }.
 * Headers per the document: AppId, TransId (unique, max 50), Timestamp, Ciphertext = MD5(AppId+TransId+Timestamp+AppSecret).
 */
export async function rspCall(endpoint, payload, transId) {
  const proxy = process.env.JOYTEL_PROXY_URL;
  const token = process.env.JOYTEL_PROXY_TOKEN || 'kabaroload-proxy-2024';
  const appId = process.env.JOYTEL_APP_ID;
  const appSecret = process.env.JOYTEL_APP_SECRET;
  if (!proxy || !appId || !appSecret) throw new Error('JoyTel RSP+ is not configured');

  const tid = String(transId || `${appId}-${Date.now()}`).slice(0, 50);
  const timestamp = String(Date.now());
  const res = await fetch(`${proxy}/rsp/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Proxy-Token': token,
      AppId: appId,
      AppSecret: appSecret,
      TransId: tid,
      Timestamp: timestamp,
      Ciphertext: md5(appId + tid + timestamp + appSecret),
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { transId: tid, status: res.status, body };
}
