import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Radio, Send, Search, QrCode, Activity, Smartphone, Package,
  Loader2, ChevronDown, ChevronRight, Download, AlertTriangle, RefreshCw
} from "lucide-react";
import { Button, Input, Label, Card, Badge } from "./ui";
import {
  submitJoytelOrder, queryJoytelOrder, queryServiceOrderList,
  submitCardRecharge, queryCardRecharge,
  queryCoupon, queryEsimStatus, queryEsimProfile,
} from "../lib/joytel";
import toast from "react-hot-toast";

const TABS = [
  { id: "orders", label: "Orders", icon: Send },
  { id: "qrcode", label: "QR Codes", icon: QrCode },
  { id: "usage", label: "Data Usage", icon: Activity },
  { id: "recharge", label: "Recharge", icon: Smartphone },
  { id: "inventory", label: "Inventory", icon: Package },
];

function JsonCard({ title, result, loading }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="mt-3 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-medium text-gray-900 text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
          {result && !loading && (
            <Badge className={result.code != null && result.code !== 200 && result.code !== "000" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
              {result.code != null ? `code: ${result.code}` : "ok"}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="p-3">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Calling JoyTel API…
            </div>
          ) : result ? (
            <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-400 text-sm py-3">No response yet.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2.5 bg-blue-50 rounded-xl">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-sm text-gray-500">{desc}</p>}
      </div>
    </div>
  );
}

export default function JoytelDashboard() {
  const [tab, setTab] = useState("orders");
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);

  // Order form state
  const [orderTid, setOrderTid] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [receiveName, setReceiveName] = useState("");
  const [phone, setPhone] = useState("");
  const [productCode, setProductCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [warehouse, setWarehouse] = useState("");
  const [orderType, setOrderType] = useState("3");

  // QR code state
  const [coupons, setCoupons] = useState("");
  const [qrResults, setQrResults] = useState(null);

  // Data usage state
  const [cid, setCid] = useState("");

  // Recharge state
  const [rechargeCode, setRechargeCode] = useState("");
  const [rechargeProductCode, setRechargeProductCode] = useState("");

  async function callApi(name, fn) {
    setLoading(name);
    setResult(null);
    try {
      const res = await fn();
      setResult(res);
      return res;
    } catch (err) {
      toast.error(`API error: ${err.message}`);
      setResult({ error: err.message });
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmitOrder() {
    const ts = Date.now();
    const tid = orderTid || `ORD-${ts}`;
    const itemList = [{ productCode: productCode || "TEST001", quantity: Number(quantity) || 1 }];
    await callApi("submitOrder", () => submitJoytelOrder({
      type: Number(orderType), receiveName, phone, orderTid: tid,
      warehouse, itemList,
    }));
  }

  async function handleQueryOrder() {
    await callApi("queryOrder", () => queryJoytelOrder({ orderCode, orderTid }));
  }

  async function handleServiceList() {
    await callApi("serviceList", () => queryServiceOrderList({}));
  }

  async function handleQueryCoupon() {
    const res = await callApi("coupon", () => queryCoupon(coupons));
    setQrResults(res);
  }

  async function handleBulkDownload() {
    if (!qrResults?.data) {
      toast.error("No QR data to download");
      return;
    }
    const items = Array.isArray(qrResults.data) ? qrResults.data : [qrResults.data];
    for (const item of items) {
      if (item.qrCode || item.activationCode) {
        const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `esim_qr_${item.coupon || item.iccid || Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    toast.success(`Downloaded ${items.length} QR code(s)`);
  }

  async function handleEsimStatus() {
    await callApi("esimStatus", () => queryEsimStatus(cid));
  }

  async function handleEsimProfile() {
    await callApi("esimProfile", () => queryEsimProfile(cid));
  }

  async function handleCardRecharge() {
    const ts = Date.now();
    const tid = orderTid || `RCH-${ts}`;
    const itemList = [{ productCode: rechargeProductCode || "TEST001", quantity: Number(quantity) || 1 }];
    await callApi("recharge", () => submitCardRecharge({ orderTid: tid, itemList }));
  }

  async function handleQueryRecharge() {
    await callApi("rechargeQuery", () => queryCardRecharge({ rechargeCode, orderTid }));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">JoyTel Dashboard</h1>
            <p className="text-gray-500">Orders, eSIM QR codes, data usage, recharge & inventory — all in one place</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setResult(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  active ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Send} title="Submit New Order" desc="Place an eSIM or OTA SIM order to JoyTel" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Order TID (optional)</Label>
                <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Auto-generated if empty" />
              </div>
              <div>
                <Label>Type</Label>
                <select value={orderType} onChange={e => setOrderType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="3">eSIM</option>
                  <option value="1">Physical SIM</option>
                </select>
              </div>
              <div>
                <Label>Recipient Name</Label>
                <Input value={receiveName} onChange={e => setReceiveName(e.target.value)} placeholder="Juan Dela Cruz" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09123456789" />
              </div>
              <div>
                <Label>Product Code</Label>
                <Input value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="e.g. ESIM-GLOBAL-5GB" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSubmitOrder} disabled={loading === "submitOrder"} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "submitOrder" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Order
            </Button>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Search} title="Query Order Status" desc="Check order status by code or TID" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Order Code</Label>
                <Input value={orderCode} onChange={e => setOrderCode(e.target.value)} placeholder="Order code from JoyTel" />
              </div>
              <div>
                <Label>Order TID</Label>
                <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Your transaction ID" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleQueryOrder} disabled={loading === "queryOrder"} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "queryOrder" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Query Order
              </Button>
              <Button onClick={handleServiceList} disabled={loading === "serviceList"} variant="outline" className="border-gray-200">
                {loading === "serviceList" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Service Order List
              </Button>
            </div>
          </Card>
          <JsonCard title="Order Results" result={result} loading={loading !== null && loading.startsWith("submit") || loading === "queryOrder" || loading === "serviceList"} />
        </div>
      )}

      {/* QR CODES TAB */}
      {tab === "qrcode" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={QrCode} title="eSIM QR Code Lookup" desc="Get QR codes & activation codes by coupon (max 20 per batch)" />
            <div>
              <Label>Coupon Code(s) — comma-separated for batch</Label>
              <Input value={coupons} onChange={e => setCoupons(e.target.value)} placeholder="e.g. SN123456,SN789012" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleQueryCoupon} disabled={loading === "coupon"} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "coupon" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Query QR Code
              </Button>
              {qrResults?.data && (
                <Button onClick={handleBulkDownload} variant="outline" className="border-gray-200">
                  <Download className="w-4 h-4" /> Bulk Download
                </Button>
              )}
            </div>
          </Card>

          {/* QR Code Display */}
          {qrResults?.data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Array.isArray(qrResults.data) ? qrResults.data : [qrResults.data]).map((item, i) => (
                <Card key={i} className="p-4 text-center">
                  {item.qrCode ? (
                    <img src={item.qrCode} alt="QR Code" className="w-40 h-40 mx-auto mb-3" />
                  ) : (
                    <div className="w-40 h-40 mx-auto mb-3 bg-gray-100 rounded-lg flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900">{item.coupon || item.iccid || `Item ${i + 1}`}</p>
                  {item.activationCode && <p className="text-xs text-gray-500 mt-1">Activation: {item.activationCode}</p>}
                  {item.couponStatus != null && (
                    <Badge className="mt-2 bg-blue-50 text-blue-700">Status: {item.couponStatus}</Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
          <JsonCard title="QR API Response" result={result} loading={loading === "coupon"} />
        </div>
      )}

      {/* DATA USAGE TAB */}
      {tab === "usage" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Activity} title="eSIM Data Usage & Status" desc="Check real-time data consumption for active eSIMs" />
            <div>
              <Label>eSIM CID (898620003xxxxxxx)</Label>
              <Input value={cid} onChange={e => setCid(e.target.value)} placeholder="e.g. 898620003012345678" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleEsimStatus} disabled={loading === "esimStatus"} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "esimStatus" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Check Status & Usage
              </Button>
              <Button onClick={handleEsimProfile} disabled={loading === "esimProfile"} variant="outline" className="border-gray-200">
                {loading === "esimProfile" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Profile Details
              </Button>
            </div>
          </Card>

          {/* Usage bar visualization */}
          {result?.data?.dataUsed != null && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Data Usage</span>
                <span className="text-sm text-gray-500">
                  {result.data.dataUsed} / {result.data.dataTotal || "∞"} MB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                  style={{ width: `${result.data.dataTotal ? Math.min(100, (result.data.dataUsed / result.data.dataTotal) * 100) : 0}%` }}
                />
              </div>
              {result.data.bundleStatus != null && (
                <Badge className="mt-3 bg-green-50 text-green-700">Bundle Status: {result.data.bundleStatus}</Badge>
              )}
            </Card>
          )}
          <JsonCard title="eSIM API Response" result={result} loading={loading === "esimStatus" || loading === "esimProfile"} />
        </div>
      )}

      {/* RECHARGE TAB */}
      {tab === "recharge" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Smartphone} title="OTA Card Recharge" desc="Submit a recharge order for an OTA SIM card" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Order TID (optional)</Label>
                <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Auto-generated if empty" />
              </div>
              <div>
                <Label>Product Code</Label>
                <Input value={rechargeProductCode} onChange={e => setRechargeProductCode(e.target.value)} placeholder="e.g. RECHARGE-5GB" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleCardRecharge} disabled={loading === "recharge"} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "recharge" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Submit Recharge
            </Button>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Search} title="Query Recharge Status" desc="Check the status of a recharge order" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Recharge Code</Label>
                <Input value={rechargeCode} onChange={e => setRechargeCode(e.target.value)} placeholder="Recharge code" />
              </div>
              <div>
                <Label>Order TID</Label>
                <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Transaction ID" />
              </div>
            </div>
            <Button onClick={handleQueryRecharge} disabled={loading === "rechargeQuery"} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "rechargeQuery" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Query Recharge
            </Button>
          </Card>
          <JsonCard title="Recharge Results" result={result} loading={loading === "recharge" || loading === "rechargeQuery"} />
        </div>
      )}

      {/* INVENTORY TAB */}
      {tab === "inventory" && (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Package} title="Inventory & Service Orders" desc="View all service orders to track inventory levels" />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">Inventory Tracking</p>
                <p>Fetch your service order list to view all active orders. Use this to track which products are in stock and which need reordering.</p>
              </div>
            </div>
            <Button onClick={handleServiceList} disabled={loading === "serviceList"} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "serviceList" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Fetch Service Orders
            </Button>
          </Card>

          {/* Inventory table from service orders */}
          {result?.data && Array.isArray(result.data) && result.data.length > 0 && (
            <Card className="p-5">
              <h4 className="font-medium text-gray-900 mb-3">Service Orders ({result.data.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Order Code</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.slice(0, 20).map((order, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-900">{order.orderCode || order.orderTid || "—"}</td>
                        <td className="py-2 px-3">
                          <Badge className="bg-blue-50 text-blue-700">{order.status ?? order.orderStatus ?? "—"}</Badge>
                        </td>
                        <td className="py-2 px-3 text-gray-500">{order.itemList?.length || 0} item(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.data.length > 20 && (
                <p className="text-xs text-gray-400 mt-2">Showing first 20 of {result.data.length} orders</p>
              )}
            </Card>
          )}
          <JsonCard title="Inventory API Response" result={result} loading={loading === "serviceList"} />
        </div>
      )}
    </div>
  );
}
