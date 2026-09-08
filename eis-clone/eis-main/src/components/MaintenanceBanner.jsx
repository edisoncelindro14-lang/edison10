import React, { useState, useEffect } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useTable } from "../lib/useData";
import { getSessionMemberId } from "../lib/auth";
import { maintenanceStatus, formatTime, formatGraceTime } from "../lib/helpers";

export function MaintenanceBanner() {
  const [, setTick] = useState(0);
  const memberId = getSessionMemberId();
  const { data: members = [] } = useTable("members", { enabled: !!memberId });
  const { data: codes = [] } = useTable("maintenance_codes", { enabled: !!memberId });

  useEffect(() => {
    if (!memberId) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [memberId]);

  const member = memberId ? members.find(m => m.id === memberId) : null;
  if (!member) return null;

  const status = maintenanceStatus(member, codes);
  const { isGreen, secondsLeft, neverRedeemed } = status;

  return (
    <div className={`w-full py-2.5 px-4 flex items-center justify-center gap-3 font-semibold text-white ${isGreen ? "bg-green-500" : "bg-red-500"}`}>
      <span className="inline-block w-3 h-3 rounded-full bg-white animate-pulse flex-shrink-0" />
      {isGreen ? (
        <>
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">Maintenance Active — Expires in:</span>
          <span className="font-mono bg-green-700 px-3 py-1 rounded-lg text-white tracking-widest text-lg font-bold">{formatTime(secondsLeft)}</span>
          <span className="text-green-100 font-normal text-xs">720 Hours</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <span className="text-sm font-bold">⚠ Maintenance Inactive — Redeem a code to activate & start earning!</span>
          {secondsLeft > 0 ? (
            <>
              <span className="text-red-100 text-sm">Expires in:</span>
              <span className="font-mono bg-red-700 px-3 py-1 rounded-lg text-white tracking-widest text-lg font-bold">{formatTime(secondsLeft)}</span>
              <span className="text-red-100 font-normal text-xs">120 Hours</span>
            </>
          ) : (
            <span className="font-mono bg-red-700 px-3 py-1 rounded-lg text-white tracking-widest text-lg font-bold">EXPIRED</span>
          )}
        </>
      )}
    </div>
  );
}
