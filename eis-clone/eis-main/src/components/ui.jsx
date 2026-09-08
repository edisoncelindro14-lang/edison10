import React from "react";
import { Link } from "react-router-dom";

export function Button({ children, variant = "default", size = "default", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  const variants = {
    default: "bg-gray-900 text-white hover:bg-gray-800",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
    outline: "bg-white border border-gray-200 text-gray-900 hover:bg-gray-50",
  };
  const sizes = {
    default: "h-11 px-4 py-2 text-sm",
    sm: "h-9 px-3 text-sm",
    lg: "h-14 px-8 text-lg",
    icon: "h-10 w-10",
  };
  return (
    <button className={`${base} ${variants[variant] || ""} ${sizes[size] || ""} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", children, ...props }) {
  return <label className={`text-gray-700 font-medium block mb-1.5 ${className}`} {...props}>{children}</label>;
}

export function Badge({ className = "", children, ...props }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${className}`} {...props}>
      {children}
    </span>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`bg-white rounded-3xl shadow-lg border border-gray-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

export { Link };
