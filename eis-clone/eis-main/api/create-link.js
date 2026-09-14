import { supabaseInsert } from './_lib.js';

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SECRET_KEY) return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY not configured' });

  const { amount, member_id, description } = req.body || {};
  if (!amount || amount < 10) return res.status(400).json({ error: 'Amount must be at least ₱10' });
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });

  const amountInCentavos = Math.round(parseFloat(amount) * 100);
  try {
    const response = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}` },
      body: JSON.stringify({ data: { attributes: { amount: amountInCentavos, description: description || `Wallet top-up ₱${amount}`, remarks: `member_id:${member_id}` } } }),
    });
    const data = await response.json();
    if (!response.ok || data.errors) return res.status(400).json({ error: data.errors?.[0]?.detail || 'Failed to create payment link' });

    const link = data.data.attributes;
    const linkId = data.data.id;

    try {
      await supabaseInsert('conversion_requests', {
        member_id, amount: parseFloat(amount), status: 'pending',
        admin_note: JSON.stringify({ payment_method: 'paymongo', link_id: linkId, reference_number: link.reference_number, checkout_url: link.checkout_url }),
      });
    } catch (e) { console.error('DB save error:', e.message); }

    return res.status(200).json({ checkout_url: link.checkout_url, reference_number: link.reference_number, link_id: linkId });
  } catch (err) {
    console.error('Create-link error:', err);
    return res.status(500).json({ error: 'Failed to create payment link', details: err.message });
  }
}
