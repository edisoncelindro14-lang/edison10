// Maintenance status: 720-hour (30-day) green cycle, 120-hour (5-day) red grace period
const MAINTENANCE_SECONDS = 2592000; // 720 hours — green banner after redeem
const GRACE_SECONDS = 432000; // 120 hours — red banner before first redeem

export function maintenanceStatus(member, codes = []) {
  if (!member) return { isGreen: false, secondsLeft: 0, neverRedeemed: true };

  if (member.maintenance_override === "green") {
    return { isGreen: true, secondsLeft: MAINTENANCE_SECONDS, neverRedeemed: false };
  }
  if (member.maintenance_override === "red") {
    return { isGreen: false, secondsLeft: 0, neverRedeemed: false };
  }

  if (member.maintenance_timer_seconds > 0 && member.maintenance_timer_set_at) {
    const elapsed = Math.floor((Date.now() - new Date(member.maintenance_timer_set_at).getTime()) / 1000);
    const left = member.maintenance_timer_seconds - elapsed;
    return { isGreen: left > 0, secondsLeft: Math.max(0, left), neverRedeemed: false };
  }

  // User has redeemed a code — GREEN with 720h countdown from last redeem
  const usedCodes = codes.filter(c => c.is_used && c.used_by_member_id === member.id && c.used_at);
  if (usedCodes.length > 0) {
    const lastUsed = usedCodes
      .map(c => new Date(c.used_at).getTime())
      .sort((a, b) => b - a)[0];
    const left = Math.max(0, MAINTENANCE_SECONDS - Math.floor((Date.now() - lastUsed) / 1000));
    return { isGreen: left > 0, secondsLeft: left, neverRedeemed: false };
  }

  // User has NOT redeemed — RED with 120h countdown from approval date
  const since = new Date(member.approved_date || member.created_date || Date.now()).getTime();
  const left = Math.max(0, GRACE_SECONDS - Math.floor((Date.now() - since) / 1000));
  return { isGreen: false, secondsLeft: left, neverRedeemed: true };
}

export function formatTime(seconds) {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatGraceTime(seconds) {
  if (seconds <= 0) return "120:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Withdrawal charge: ₱10 flat for ₱300-999, ₱15 per ₱1000 for ₱1000+
export function withdrawalCharge(amount, min) {
  if (amount < 1000) return 10;
  return Math.ceil(amount / 1000) * 15;
}

export const money = n => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function formatDate(date, fmt = "MMM d, yyyy h:mm a") {
  const d = new Date(date);
  if (isNaN(d)) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return fmt
    .replace("MMM", months[d.getMonth()])
    .replace("yyyy", d.getFullYear())
    .replace("d,", `${d.getDate()},`)
    .replace("d", d.getDate())
    .replace("h:mm", `${h12}:${String(d.getMinutes()).padStart(2, "0")}`)
    .replace("a", ampm);
}

export const LEVEL_CONFIG = [
  { level: 1, label: "Level 1 — Direct Downlines", bonus_amount: 150, max_members: 10, description: "Earn ₱150 every time a downline who used your referral link redeems a maintenance code.", color: "from-amber-500 to-orange-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700" },
  { level: 2, label: "Level 2 — Downlines of Downlines", bonus_amount: 100, max_members: 100, description: "Earn ₱100 every time a Level 2 downline redeems a maintenance code.", color: "from-emerald-500 to-teal-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", textColor: "text-emerald-700" },
  { level: 3, label: "Level 3 — Third Generation", bonus_amount: 50, max_members: 1000, description: "Earn ₱50 every time a Level 3 downline redeems a maintenance code.", color: "from-blue-500 to-indigo-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", textColor: "text-blue-700" },
  { level: 4, label: "Level 4 — Fourth Generation", bonus_amount: 20, max_members: 10000, description: "Earn ₱20 every time a Level 4 downline redeems a maintenance code.", color: "from-purple-500 to-pink-600", bgColor: "bg-purple-50", borderColor: "border-purple-200", textColor: "text-purple-700" },
  { level: 5, label: "Level 5 — Fifth Generation", bonus_amount: 10, max_members: 100000, description: "Earn ₱10 every time a Level 5 downline redeems a maintenance code.", color: "from-rose-500 to-red-600", bgColor: "bg-rose-50", borderColor: "border-rose-200", textColor: "text-rose-700" },
];

export const TRANSACTION_TYPES = {
  level_bonus: { label: "Level Bonus", color: "bg-emerald-100 text-emerald-700" },
  referral_bonus: { label: "Referral Bonus", color: "bg-blue-100 text-blue-700" },
  adjustment: { label: "Maintenance Code", color: "bg-teal-100 text-teal-700" },
  withdrawal: { label: "Withdrawal", color: "bg-red-100 text-red-700" },
};

export function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
