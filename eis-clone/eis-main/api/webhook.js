import { supabaseInsert, supabaseSelect, supabaseUpdate, verifyWebhookSignature } from './_lib.js';

const WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', service: 'paymongo-webhook' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WEBHOOK_SECRET) return res.status(500).json({ error: 'PAYMONGO_WEBHOOK_SECRET not configured' });

  const rawBody = req.body ? JSON.stringify(req.body) : '';
  const sigHeader = req.headers['paymongo-signature'] || '';
  if (!verifyWebhookSignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventType = event?.data?.attributes?.type;
  const eventData = event?.data?.attributes?.data;
  console.log(`PayMongo webhook: ${eventType}`);

  if (eventType === 'link.payment.paid' || eventType === 'payment.paid') {
    const amountPaid = eventData?.amount ? eventData.amount / 100 : 0;
    const referenceNumber = eventData?.reference_number || eventData?.attributes?.reference_number;
    const remarks = eventData?.remarks || eventData?.attributes?.remarks || '';
    const memberIdMatch = remarks.match(/member_id:([a-zA-Z0-9-]+)/);
    const memberId = memberIdMatch ? memberIdMatch[1] : null;

    if (memberId && amountPaid > 0 && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const linkId = eventData?.link_id || eventData?.attributes?.link_id;
        if (linkId) {
          const result = await supabaseSelect('conversion_requests', `admin_note=ilike.%${linkId}%&status=eq.pending&limit=1`);
          if (result && result[0]) {
            const existing = result[0].admin_note ? JSON.parse(result[0].admin_note) : {};
            await supabaseUpdate('conversion_requests', result[0].id, {
              status: 'approved',
              admin_note: JSON.stringify({ ...existing, reference_number: referenceNumber, paid_at: new Date().toISOString(), auto_approved: true }),
            });
          }
        }
        await supabaseInsert('transactions', {
          member_id: memberId, amount: amountPaid, type: 'topup', status: 'completed',
          description: `PayMongo top-up | Ref: ${referenceNumber || 'N/A'} | Auto-credited`,
        });
        console.log(`Wallet credited: ₱${amountPaid} for member ${memberId}`);
      } catch (e) { console.error('Wallet credit error:', e.message); }
    }
  }
  return res.status(200).json({ received: true, type: eventType });
}
