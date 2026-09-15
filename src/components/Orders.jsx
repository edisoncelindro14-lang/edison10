import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight, Filter, QrCode, Download, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { money, formatDate, TRANSACTION_TYPES } from "../lib/helpers";
import { Button, Badge } from "./ui";

export default function Orders() {
  const [filter, setFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const { data: members = [] } = useTable("members");
  const { data: transactions = [] } = useTable("transactions");
  const { data: settings = [] } = useTable("system_settings");
  const { currentMember } = useCurrentMember(members);

  // Find JoyTel callback data for an order (by orderTid match in description)
  function getJoytelData(order) {
    if (!order.description) return null;
    const callbacks = settings.filter(s => s.setting_key?.startsWith("joytel_callback_"));
    for (const cb of callbacks) {
      try {
        const data = typeof cb.setting_value === "string" ? JSON.parse(cb.setting_value) : cb.setting_value;
        if (order.description.includes(data.orderTid) || (data.raw?.orderTid && order.description.includes(data.raw.orderTid))) {
          return data;
        }
      } catch { /* skip unparseable */ }
    }
    return null;
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">My Orders</h1>
          <p className="text-gray-600 mb-6">Please login to view your orders.</p>
          <Link to="/MemberLogin"><Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button></Link>
        </motion.div>
      </div>
    );
  }

  const myOrders = transactions
    .filter(t => t.member_id === currentMember.id && (t.type === "withdrawal" || t.type === "purchase"))
    .sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_date || a.created_date));

  const filteredOrders = filter === "all" ? myOrders : myOrders.filter(o => o.status === filter);

  function StatusIcon({ status }) {
    if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === "cancelled") return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-500">Track your load and SIM purchases</p>
          </div>
        </div>
      </motion.div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        {["all", "pending", "completed", "cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${filter === f ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No orders yet.</p>
            <Link to="/Products"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Start Shopping</Button></Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredOrders.map(o => {
              const joytelData = getJoytelData(o);
              const hasQR = joytelData?.qrCode || joytelData?.qrResponse?.data?.[0]?.qrCode || joytelData?.qrResponse?.data?.qrCode;
              const isExpanded = expandedOrder === o.id;

              return (
                <div key={o.id}>
                  <button
                    onClick={() => hasQR ? setExpandedOrder(isExpanded ? null : o.id) : null}
                    className={`w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 ${hasQR ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={o.status} />
                        <p className="font-medium text-gray-900 truncate">{o.description || "Purchase"}</p>
                        {hasQR && <QrCode className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-gray-500">{formatDate(o.created_at || o.created_date)}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-gray-900">{money(Math.abs(o.amount))}</p>
                      <Badge className={o.status === "completed" ? "bg-green-100 text-green-700" : o.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>{o.status}</Badge>
                    </div>
                  </button>

                  {/* QR Code expandable section */}
                  {isExpanded && hasQR && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-6 pb-4 bg-blue-50 border-t border-blue-100">
                      <div className="py-4 flex flex-col sm:flex-row items-center gap-4">
                        {(() => {
                          const qrUrl = joytelData?.qrCode || joytelData?.qrResponse?.data?.[0]?.qrCode || joytelData?.qrResponse?.data?.qrCode;
                          return qrUrl ? (
                            <img src={qrUrl} alt="eSIM QR Code" className="w-32 h-32 rounded-xl border-2 border-blue-200" />
                          ) : (
                            <div className="w-32 h-32 rounded-xl bg-gray-100 flex items-center justify-center">
                              <QrCode className="w-12 h-12 text-gray-300" />
                            </div>
                          );
                        })()}
                        <div>
                          <p className="font-medium text-gray-900">Your eSIM QR Code</p>
                          <p className="text-sm text-gray-500 mb-2">Scan this QR code to install your eSIM profile.</p>
                          {joytelData?.coupon && (
                            <p className="text-xs text-gray-400">Coupon: {joytelData.coupon}</p>
                          )}
                          {joytelData?.activationCode && (
                            <p className="text-xs text-gray-400">Activation: {joytelData.activationCode}</p>
                          )}
                          {joytelData?.qrCode && (
                            <a href={joytelData.qrCode} download={`esim_qr_${joytelData.coupon || o.id}.png`}>
                              <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm">
                                <Download className="w-4 h-4 mr-1" /> Download QR
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
