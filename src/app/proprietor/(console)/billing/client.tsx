"use client";

import { useActionState, useState, useEffect } from "react";
import { purchaseGroupAddonAction, getGroupBillingData, type BillingActionResult } from "./actions";

const init: BillingActionResult = {};

interface BillingData {
  groupId: string;
  groupName: string;
  feeGroupStage: string | null;
  stage: string;
  schoolCount: number;
  addons: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    isGroupBilling: boolean;
    priceBreakdown: { basePrice: number; schoolCount: number; discount: number; subtotal: number; total: number } | null;
    durationDays: number | null;
    subscription: {
      id: string;
      status: string;
      startDate: string;
      endDate: string | null;
    } | null;
  }[];
}

function formatPrice(n: number | null) {
  if (n == null) return "Free";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

function AddonCard({ addon, groupId }: { addon: BillingData["addons"][number]; groupId: string }) {
  const [state, action, pending] = useActionState(purchaseGroupAddonAction, init);
  const [showForm, setShowForm] = useState(false);

  const isActive = addon.subscription?.status === "active";
  const endDate = addon.subscription?.endDate ? new Date(addon.subscription.endDate) : null;
  const isExpiringSoon = endDate && endDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const isExpired = endDate && endDate < new Date();
  const needsAction = !isActive || isExpired || isExpiringSoon;

  return (
    <div className={`bg-white/[0.03] border rounded-xl p-5 space-y-3 ${isActive && !isExpired ? "border-emerald-700/30" : needsAction ? "border-amber-700/30" : "border-white/5"}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">{addon.name}</h3>
          {addon.description && <p className="text-white/40 text-xs mt-0.5">{addon.description}</p>}
        </div>
        {isActive && !isExpired ? (
          <span className="text-[10px] text-emerald-400 bg-emerald-900/30 rounded-full px-2 py-0.5">Active</span>
        ) : isExpired ? (
          <span className="text-[10px] text-red-400 bg-red-900/30 rounded-full px-2 py-0.5">Expired</span>
        ) : (
          <span className="text-[10px] text-gray-400 bg-gray-800/30 rounded-full px-2 py-0.5">Not subscribed</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-white">{formatPrice(addon.price)}</p>
        <p className="text-[10px] text-white/40">
          {addon.durationDays ? `/ ${addon.durationDays} days` : "One-time"}
        </p>
      </div>

      {addon.isGroupBilling && addon.priceBreakdown && (
        <div className="text-[10px] text-white/40 bg-white/5 rounded-lg p-2 space-y-0.5">
          <div className="flex justify-between"><span>Base price</span><span>{formatPrice(addon.priceBreakdown.basePrice)}</span></div>
          <div className="flex justify-between"><span>Schools</span><span>× {addon.priceBreakdown.schoolCount}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(addon.priceBreakdown.subtotal)}</span></div>
          <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-{Math.round(addon.priceBreakdown.discount * 100)}%</span></div>
          <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-1 mt-1"><span>You pay</span><span>{formatPrice(addon.priceBreakdown.total)}</span></div>
        </div>
      )}

      {isActive && endDate && (
        <div className={`text-xs px-3 py-2 rounded-lg ${isExpiringSoon ? "bg-amber-900/20 text-amber-300" : "bg-emerald-900/20 text-emerald-300"}`}>
          {isExpiringSoon && "⚠ "}
          {isExpiringSoon ? "Expires soon" : "Valid until"}: {endDate.toLocaleDateString()}
        </div>
      )}

      {showForm && (
        <form action={action} className="space-y-2 pt-2 border-t border-white/5">
          <input type="hidden" name="addonId" value={addon.id} />
          <input type="hidden" name="durationDays" value={String(addon.durationDays ?? 365)} />
          <div>
            <label className="text-[10px] text-white/50 block mb-0.5">Payment reference</label>
            <input
              name="paymentReference"
              placeholder="Bank transfer ref or receipt no."
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/50 block mb-0.5">Notes</label>
            <input
              name="notes"
              placeholder="Optional"
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white placeholder:text-white/20"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-4 py-1.5 rounded-lg disabled:opacity-60"
            >
              {pending ? "Processing..." : isActive ? "Renew" : "Subscribe"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-white/40 hover:text-white/70 text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
          {state.error && <p className="text-red-400 text-[10px]">{state.error}</p>}
          {state.success && <p className="text-emerald-400 text-[10px]">{state.success}</p>}
        </form>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className={`text-xs px-4 py-1.5 rounded-lg transition-colors ${
            needsAction
              ? "text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/30"
              : "text-amber-300 bg-amber-900/20 hover:bg-amber-900/30"
          }`}
        >
          {isActive && !isExpired ? (isExpiringSoon ? "Renew Now" : "Extend") : "Subscribe"}
        </button>
      )}
    </div>
  );
}

export function BillingClient({ groupId }: { groupId: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGroupBillingData()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-white/40 text-sm text-center py-8">Failed to load.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing & Addons</h1>
        <p className="text-sm text-white/40 mt-1">
          {data.schoolCount} school{data.schoolCount !== 1 ? "s" : ""} in your group · subscriptions cover all branches
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.addons.map((a) => (
          <AddonCard key={a.id} addon={a} groupId={groupId} />
        ))}
      </div>
    </div>
  );
}
