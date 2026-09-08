import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GitBranch, Search, ArrowRight, Users, ZoomIn, ZoomOut, CircleDashed } from "lucide-react";
import { useTable, useCurrentMember } from "../lib/useData";
import { Button } from "./ui";

export default function Genealogy() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(100);
  const { data: members = [], isLoading } = useTable("members");
  const { currentMember } = useCurrentMember(members);

  useEffect(() => {
    if (currentMember && !selected) setSelected(currentMember);
  }, [currentMember]);

  const approvedMembers = members.filter(m => m.status === "approved");
  const searchResults = search
    ? approvedMembers.filter(m =>
        m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.referral_code?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  function getDownlines(memberId, level = 1) {
    if (level > 5) return [];
    const direct = approvedMembers.filter(m => m.referrer_id === memberId);
    return direct.map(d => ({ ...d, _level: level, _children: getDownlines(d.id, level + 1) }));
  }

  function TreeNode({ member, level = 0 }) {
    const downlines = approvedMembers.filter(m => m.referrer_id === member.id);
    const isRoot = level === 0;
    return (
      <div className={`flex flex-col items-center ${level > 0 ? "mt-6" : ""}`}>
        <div
          onClick={() => setSelected(member)}
          className={`cursor-pointer inline-flex flex-col items-center ${isRoot ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-white border-2 border-gray-200 hover:border-amber-400"} rounded-2xl px-6 py-3 transition-all hover:shadow-lg`}
        >
          <span className={`font-bold text-sm ${isRoot ? "text-white" : "text-gray-900"}`}>{member.full_name || member.username}</span>
          <span className={`text-xs ${isRoot ? "text-amber-100" : "text-gray-500"}`}>Level {member.tree_level || level}</span>
          {member.referral_code && <span className={`text-xs ${isRoot ? "text-amber-200" : "text-gray-400"}`}>{member.referral_code}</span>}
        </div>
        {downlines.length > 0 && (
          <div className="relative flex flex-wrap justify-center gap-4 mt-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-6 bg-gray-300" />
            {downlines.slice(0, 10).map(d => (
              <TreeNode key={d.id} member={d} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading genealogy...</div>
      </div>
    );
  }

  if (!currentMember) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <GitBranch className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Mamlakah Tree</h1>
          <p className="text-gray-600 mb-6">Please login to view your genealogy.</p>
          <Link to="/MemberLogin">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white text-lg px-8 py-6">Login <ArrowRight className="ml-2 w-5 h-5" /></Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mamlakah Tree</h1>
            <p className="text-gray-500">Your 5-level mamlakah network — up to 10 downlines per member</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members..."
            className="pl-10 w-full sm:w-64 rounded-xl border border-gray-200 h-11 px-4 outline-none focus:border-amber-500"
          />
          {search && searchResults.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 max-h-60 overflow-y-auto z-20">
              {searchResults.map(m => (
                <button key={m.id} onClick={() => { setSelected(m); setSearch(""); }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{m.full_name || m.username}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email || m.referral_code || "—"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Status Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-green-700">Redeemed Code</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-sm font-medium text-red-700">Not Redeemed</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
          <CircleDashed className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-sm font-medium text-orange-700">Open Slot</span>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Zoom controls */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-100">
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-600 w-12 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
        <div className="p-8 overflow-x-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
          {selected ? <TreeNode member={selected} /> : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm">No genealogy data available</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Downline stats */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(level => {
            const count = getDownlines(selected.id, level).length;
            return (
              <div key={level} className="bg-white rounded-2xl shadow border border-gray-100 p-4 text-center">
                <p className="text-3xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-500 mt-1">Level {level}</p>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
