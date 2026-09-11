import React, { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Send, Search, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Input, Label, Card, Badge } from "./ui";
import {
  submitJoytelOrder,
  queryJoytelOrder,
  queryServiceOrderList,
  submitCardRecharge,
  queryCardRecharge,
  queryCoupon,
  queryEsimStatus,
  queryEsimProfile,
} from "../lib/joytel";

const TABS = [
  { id: "warehouse", label: "Warehouse API", icon: Send },
  { id: "rsp", label: "RSP+ eSIM API", icon: Radio },
];

const WAREHOUSE_ACTIONS = [
  { id: "customerOrder", label: "Submit Order", desc: "Place a new eSIM/OTA SIM order" },
  { id: "customerOrderQuery", label: "Query Order", desc: "Check order status by code or TID" },
  { id: "serviceOrderListQuery", label: "Service Order List", desc: "List service orders" },
  { id: "cardRecharge", label: "Card Recharge", desc: "Submit OTA card recharge" },
  { id: "cardRechargeQuery", label: "Query Recharge", desc: "Check recharge status" },
];

const RSP_ACTIONS = [
  { id: "coupon", label: "Query Coupon", desc: "Get eSIM QR code & profile by coupon code" },
  { id: "esimStatus", label: "eSIM Status", desc: "Check eSIM status & data usage" },
  { id: "esimProfile", label: "eSIM Profile", desc: "Get eSIM profile details" },
];

function ResultCard({ title, result, loading }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="mt-4 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-medium text-gray-900 text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
          {result && !loading && (
            <Badge className={result.code != null && result.code !== 200 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
              {result.code != null ? `code: ${result.code}` : "ok"}
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Calling JoyTel API…
            </div>
          ) : result ? (
            <pre className="text-xs bg-gray-900 text-green-400 rounded-xl p-4 overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-400 text-sm py-4">No response yet. Run a test above.</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function JoytelTest() {
  const [tab, setTab] = useState("warehouse");
  const [whAction, setWhAction] = useState("customerOrder");
  const [rspAction, setRspAction] = useState("coupon");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Warehouse form fields
  const [orderTid, setOrderTid] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [receiveName, setReceiveName] = useState("");
  const [phone, setPhone] = useState("");
  const [productCode, setProductCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rechargeCode, setRechargeCode] = useState("");

  // RSP form fields
  const [coupons, setCoupons] = useState("");
  const [cid, setCid] = useState("");

  async function runWarehouseTest() {
    setLoading(true);
    setResult(null);
    try {
      let res;
      const ts = Date.now();
      const tid = orderTid || `TEST-${ts}`;
      const itemList = [{ productCode: productCode || "TEST001", quantity: Number(quantity) || 1 }];

      switch (whAction) {
        case "customerOrder":
          res = await submitJoytelOrder({
            type: 3, receiveName: receiveName || "Test", phone: phone || "09000000000",
            orderTid: tid, warehouse: "", itemList,
          });
          break;
        case "customerOrderQuery":
          res = await queryJoytelOrder({ orderCode, orderTid: tid });
          break;
        case "serviceOrderListQuery":
          res = await queryServiceOrderList({ orderCode, orderTid: tid });
          break;
        case "cardRecharge":
          res = await submitCardRecharge({ orderTid: tid, itemList });
          break;
        case "cardRechargeQuery":
          res = await queryCardRecharge({ orderTid: tid, rechargeCode });
          break;
        default:
          res = { error: "Unknown action" };
      }
      setResult(res);
      toast.success("API call completed");
    } catch (err) {
      setResult({ error: err.message });
      toast.error("API call failed: " + err.message);
    }
    setLoading(false);
  }

  async function runRspTest() {
    setLoading(true);
    setResult(null);
    try {
      let res;
      switch (rspAction) {
        case "coupon":
          res = await queryCoupon(coupons || "TEST001");
          break;
        case "esimStatus":
          res = await queryEsimStatus(cid || "8986200030000000000");
          break;
        case "esimProfile":
          res = await queryEsimProfile(cid || "8986200030000000000");
          break;
        default:
          res = { error: "Unknown action" };
      }
      setResult(res);
      toast.success("API call completed");
    } catch (err) {
      setResult({ error: err.message });
      toast.error("API call failed: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">JoyTel API Test</h1>
            <p className="text-gray-500">Test Warehouse & RSP+ eSIM API endpoints</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm transition-all ${tab === t.id ? "bg-indigo-500 text-white shadow-lg" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "warehouse" ? (
        <Card className="p-6">
          {/* Action selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {WAREHOUSE_ACTIONS.map(a => (
              <button key={a.id} onClick={() => { setWhAction(a.id); setResult(null); }}
                className={`text-left p-4 rounded-xl border transition-all ${whAction === a.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="font-medium text-gray-900 text-sm">{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>

          {/* Dynamic form */}
          <div className="space-y-4">
            {(whAction === "customerOrder" || whAction === "cardRecharge") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {whAction === "customerOrder" && (
                  <>
                    <div>
                      <Label>Receive Name</Label>
                      <Input value={receiveName} onChange={e => setReceiveName(e.target.value)} placeholder="Test" />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09000000000" />
                    </div>
                  </>
                )}
                <div>
                  <Label>Order TID (optional)</Label>
                  <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Auto-generated if empty" />
                </div>
                <div>
                  <Label>Product Code</Label>
                  <Input value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="TEST001" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" />
                </div>
              </div>
            )}

            {(whAction === "customerOrderQuery" || whAction === "serviceOrderListQuery") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Order Code</Label>
                  <Input value={orderCode} onChange={e => setOrderCode(e.target.value)} placeholder="Order code" />
                </div>
                <div>
                  <Label>Order TID (optional)</Label>
                  <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Transaction ID" />
                </div>
              </div>
            )}

            {whAction === "cardRechargeQuery" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Order TID (optional)</Label>
                  <Input value={orderTid} onChange={e => setOrderTid(e.target.value)} placeholder="Transaction ID" />
                </div>
                <div>
                  <Label>Recharge Code</Label>
                  <Input value={rechargeCode} onChange={e => setRechargeCode(e.target.value)} placeholder="Recharge code" />
                </div>
              </div>
            )}

            <Button onClick={runWarehouseTest} disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white w-full sm:w-auto">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Run Test
            </Button>
          </div>

          <ResultCard title={`${WAREHOUSE_ACTIONS.find(a => a.id === whAction)?.label} Response`} result={result} loading={loading} />
        </Card>
      ) : (
        <Card className="p-6">
          {/* Action selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {RSP_ACTIONS.map(a => (
              <button key={a.id} onClick={() => { setRspAction(a.id); setResult(null); }}
                className={`text-left p-4 rounded-xl border transition-all ${rspAction === a.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="font-medium text-gray-900 text-sm">{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              </button>
            ))}
          </div>

          {/* Dynamic form */}
          <div className="space-y-4">
            {rspAction === "coupon" && (
              <div>
                <Label>Coupon Code(s)</Label>
                <Input value={coupons} onChange={e => setCoupons(e.target.value)} placeholder="Enter coupon / snPin code(s), comma-separated" />
              </div>
            )}
            {(rspAction === "esimStatus" || rspAction === "esimProfile") && (
              <div>
                <Label>eSIM CID</Label>
                <Input value={cid} onChange={e => setCid(e.target.value)} placeholder="8986200030xxxxxxx" />
              </div>
            )}

            <Button onClick={runRspTest} disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 text-white w-full sm:w-auto">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Run Test
            </Button>
          </div>

          <ResultCard title={`${RSP_ACTIONS.find(a => a.id === rspAction)?.label} Response`} result={result} loading={loading} />
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">
        Calls go through Vercel serverless functions (/api/joytel/*). JoyTel requires IP whitelisting — if you see "IP not authorised", route through the joytel-proxy.
      </p>
    </div>
  );
}
