"use client";

import { useState, useRef } from "react";
import { Button } from "./ui/Button";
import { addAdvancedGroupExpense } from "../app/actions/groupExpense";
import { parseReceiptAction } from "../app/actions/parseReceipt";

interface Member { id: string; name: string; }
interface Props { groupId: string; groupName: string; members: Member[]; currentUserId: string; }

type SplitType = "EQUAL" | "EXACT" | "PERCENT" | "SHARE";

export function AddGroupExpenseModal({ groupId, groupName, members, currentUserId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"MAIN" | "SPLIT_OPTIONS" | "PAYER_OPTIONS">("MAIN");
  const [isPending, setIsPending] = useState(false);

  // Core Details
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const totalAmount = parseFloat(amountStr) || 0;

  // --- FUNDING STATE (Who Paid?) ---
  const [payerMode, setPayerMode] = useState<"SINGLE" | "MULTIPLE">("SINGLE");
  const [singlePayerId, setSinglePayerId] = useState<string>(currentUserId);
  const [payerInputs, setPayerInputs] = useState<Record<string, string>>({});

  // --- DISTRIBUTION STATE (Who Owes?) ---
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});
  const [involvedIds, setInvolvedIds] = useState<string[]>(members.map(m => m.id));

  // --- AI SCANNING STATE ---
  const [isScanning, setIsScanning] = useState(false);
  const [aiItems, setAiItems] = useState<{ name: string; price: number }[]>([]);
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LIVE MATH ENGINES ---
  const calculateFinalPayers = () => {
    if (payerMode === "SINGLE") {
      return [{ userId: singlePayerId, amountPaid: totalAmount }];
    } else {
      return members.map(m => ({
        userId: m.id,
        amountPaid: parseFloat(payerInputs[m.id]) || 0
      })).filter(p => p.amountPaid > 0);
    }
  };

  const currentPayers = calculateFinalPayers();
  const payerMathTotal = currentPayers.reduce((sum, p) => sum + p.amountPaid, 0);
  const payerMathDiff = totalAmount - payerMathTotal;

  const calculateFinalSplits = () => {
    let finalSplits: { userId: string; amountOwed: number; splitType: string; splitValue: number | null }[] = [];
    if (splitType === "EQUAL") {
      const perPerson = involvedIds.length > 0 ? totalAmount / involvedIds.length : 0;
      members.forEach(m => {
        if (involvedIds.includes(m.id)) finalSplits.push({ userId: m.id, amountOwed: perPerson, splitType: "EQUAL", splitValue: null });
      });
    } else if (splitType === "EXACT") {
      members.forEach(m => {
        const val = parseFloat(splitInputs[m.id]) || 0;
        finalSplits.push({ userId: m.id, amountOwed: val, splitType: "EXACT", splitValue: val });
      });
    } else if (splitType === "PERCENT") {
      members.forEach(m => {
        const percent = parseFloat(splitInputs[m.id]) || 0;
        finalSplits.push({ userId: m.id, amountOwed: (percent / 100) * totalAmount, splitType: "PERCENT", splitValue: percent });
      });
    } else if (splitType === "SHARE") {
      const totalShares = members.reduce((sum, m) => sum + (parseFloat(splitInputs[m.id]) || 0), 0);
      members.forEach(m => {
        const shares = parseFloat(splitInputs[m.id]) || 0;
        finalSplits.push({ userId: m.id, amountOwed: totalShares > 0 ? (shares / totalShares) * totalAmount : 0, splitType: "SHARE", splitValue: shares });
      });
    }
    return finalSplits;
  };

  const currentSplits = calculateFinalSplits();
  const splitMathTotal = currentSplits.reduce((sum, s) => sum + s.amountOwed, 0);
  const splitMathDiff = totalAmount - splitMathTotal;

  // --- AI RECEIPT LOGIC ---
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append("receipt", file);

    try {
      const data = await parseReceiptAction(formData);
      if (data.merchant) setDescription(data.merchant);
      if (data.totalAmount) setAmountStr(data.totalAmount.toString());
      setAiItems(data.items || []);
      setItemAssignments({});
    } catch (err) {
      alert("AI was unable to scan this receipt. Please type details manually.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleItemUser(itemIndex: number, userId: string) {
    setItemAssignments(prev => {
      const current = prev[itemIndex] || [];
      const updated = current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId];
      return { ...prev, [itemIndex]: updated };
    });
  }

  function applyAiSplitsToForm() {
    const computedOwed: Record<string, number> = {};
    members.forEach((m: any) => { computedOwed[m.id] = 0; });

    aiItems.forEach((item, idx) => {
      const assignedUsers = itemAssignments[idx] || [];
      if (assignedUsers.length === 0) return;
      const splitCost = item.price / assignedUsers.length;
      assignedUsers.forEach(uid => { computedOwed[uid] += splitCost; });
    });

    const newSplitInputs: Record<string, string> = {};
    Object.keys(computedOwed).forEach(uid => {
      newSplitInputs[uid] = computedOwed[uid].toFixed(2);
    });

    setSplitType("EXACT");
    setSplitInputs(newSplitInputs);
    setAiItems([]); // Clear AI UI
    setView("SPLIT_OPTIONS"); // Switch to splits to show user the math
  }

  // --- SUBMISSION ---
  async function handleSubmit() {
    if (Math.abs(splitMathDiff) > 0.05) return alert("The split amounts do not add up to the total.");
    if (payerMode === "MULTIPLE" && Math.abs(payerMathDiff) > 0.05) return alert("The payer amounts do not add up to the total.");
    if (totalAmount <= 0) return alert("Enter a valid amount");
    if (!description) return alert("Enter a description");

    setIsPending(true);
    try {
      const formData = new FormData();
      formData.append("groupId", groupId);
      formData.append("description", description);
      formData.append("amount", totalAmount.toString());
      formData.append("payers", JSON.stringify(currentPayers));
      formData.append("splits", JSON.stringify(currentSplits));

      await addAdvancedGroupExpense(formData);
      setIsOpen(false); setView("MAIN"); setDescription(""); setAmountStr(""); 
      setSplitInputs({}); setPayerInputs({}); setAiItems([]);
    } catch (error) {
      alert("Failed to save expense.");
    } finally {
      setIsPending(false);
    }
  }

  const getPayerSummaryText = () => payerMode === "MULTIPLE" ? "Multiple people" : (singlePayerId === currentUserId ? "you" : members.find(m => m.id === singlePayerId)?.name);
  const getSplitSummaryText = () => splitType === "EQUAL" && involvedIds.length === members.length ? "equally" : "custom";

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>+ Add Group Expense</Button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[420px] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* VIEW 1: MAIN */}
            {view === "MAIN" && (
              <div className="flex flex-col overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                  <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl px-2 leading-none">&times;</button>
                  <h2 className="text-lg font-bold text-gray-900">Add an expense</h2>
                  <button onClick={handleSubmit} disabled={isPending || !description || totalAmount <= 0} className="text-emerald-600 font-bold px-2 disabled:opacity-50">Save</button>
                </div>

                <div className="px-6 py-6 space-y-6">
                  {/* AI SCANNER */}
                  <div className="border-2 border-dashed border-emerald-100 bg-emerald-50/30 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors cursor-pointer relative overflow-hidden">
                    {isScanning && <div className="absolute inset-0 bg-white/80 backdrop-blur flex items-center justify-center font-bold text-emerald-600 z-10">🔮 Analyzing receipt...</div>}
                    <label className="cursor-pointer block">
                      <span className="text-sm font-bold text-emerald-700 block mb-1">✨ Scan Receipt with AI</span>
                      <span className="text-xs text-gray-500 block">Auto-extract items & exact amounts</span>
                      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} disabled={isScanning} />
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">📝</div>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full text-xl font-medium outline-none border-b border-gray-200 focus:border-emerald-500 pb-1 placeholder:text-gray-400" placeholder="Enter a description" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-800 font-bold text-xl shrink-0">₹</div>
                    <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="w-full text-4xl font-light outline-none border-b border-gray-200 focus:border-emerald-500 pb-1 placeholder:text-gray-300 [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                  </div>
                </div>

                {/* AI ITEM ASSIGNMENT UI */}
                {aiItems.length > 0 && (
                  <div className="px-6 pb-6">
                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tap to assign items</p>
                        <button onClick={() => setAiItems([])} className="text-xs text-red-400 font-bold">Clear</button>
                      </div>
                      
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                        {aiItems.map((item, idx) => (
                          <div key={idx} className="border-b border-gray-50 pb-3 last:border-0">
                            <div className="flex justify-between font-bold text-sm text-gray-800 mb-2">
                              <span className="truncate pr-2">{item.name}</span>
                              <span className="shrink-0">₹{item.price.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {members.map((member: any) => {
                                const isSelected = (itemAssignments[idx] || []).includes(member.id);
                                return (
                                  <button type="button" key={member.id} onClick={() => toggleItemUser(idx, member.id)} className={`text-xs px-2.5 py-1.5 rounded-md font-bold transition-colors ${isSelected ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                    {member.name.split(" ")[0]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={applyAiSplitsToForm} className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                        Calculate & Apply Splits
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-6 pb-8 flex justify-center">
                  <div className="bg-gray-100 py-2.5 px-5 rounded-xl text-sm text-gray-700 flex flex-wrap justify-center items-center gap-1.5">
                    <span>Paid by</span>
                    <button onClick={() => setView("PAYER_OPTIONS")} className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors">{getPayerSummaryText()}</button>
                    <span>and split</span>
                    <button onClick={() => setView("SPLIT_OPTIONS")} className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors">{getSplitSummaryText()}</button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: PAYERS */}
            {view === "PAYER_OPTIONS" && (
              <div className="flex flex-col h-full bg-gray-50 max-h-[90vh]">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shadow-sm shrink-0">
                  <button onClick={() => setView("MAIN")} className="text-gray-500 font-medium px-2">Cancel</button>
                  <h2 className="text-lg font-bold text-gray-900">Choose payer</h2>
                  <button onClick={() => setView("MAIN")} disabled={payerMode === "MULTIPLE" && Math.abs(payerMathDiff) > 0.05} className="text-emerald-600 font-bold px-2 disabled:opacity-50">Done</button>
                </div>
                <div className="overflow-y-auto bg-white flex-1">
                  {payerMode === "SINGLE" && (
                    <>
                      {members.map(m => (
                        <button key={m.id} onClick={() => { setSinglePayerId(m.id); setView("MAIN"); }} className="w-full flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 text-left transition-colors">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">{m.name.charAt(0).toUpperCase()}</div>
                          <span className="font-medium text-gray-900 flex-1">{m.id === currentUserId ? "You" : m.name}</span>
                          {singlePayerId === m.id && <span className="text-emerald-500 font-bold">✓</span>}
                        </button>
                      ))}
                      <button onClick={() => setPayerMode("MULTIPLE")} className="w-full p-4 text-left font-medium text-gray-600 hover:bg-gray-50 flex justify-between items-center transition-colors">
                        Multiple people <span className="text-gray-400 text-lg leading-none">›</span>
                      </button>
                    </>
                  )}
                  {payerMode === "MULTIPLE" && (
                    <div className="p-4 space-y-2">
                      <p className="text-sm text-gray-500 text-center mb-4">Enter exactly how much each person paid.</p>
                      {members.map(m => (
                        <div key={m.id} className="flex justify-between items-center border-b border-gray-50 pb-2">
                          <span className="font-medium text-gray-800">{m.id === currentUserId ? "You" : m.name}</span>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-400 font-bold">₹</span>
                            <input type="number" step="0.01" placeholder="0.00" value={payerInputs[m.id] || ""} onChange={(e) => setPayerInputs(prev => ({ ...prev, [m.id]: e.target.value }))} className="w-28 border border-gray-200 rounded-lg p-2 pl-7 text-right font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all [&::-webkit-inner-spin-button]:appearance-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {payerMode === "MULTIPLE" && (
                  <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                    <div className={`p-4 rounded-xl text-sm font-bold flex justify-between items-center ${Math.abs(payerMathDiff) < 0.05 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      <span>{Math.abs(payerMathDiff) < 0.05 ? "✓ Math checks out" : "⚠ Math doesn't add up"}</span>
                      <span>{payerMathTotal.toFixed(2)} / {totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: SPLITS */}
            {view === "SPLIT_OPTIONS" && (
              <div className="flex flex-col h-full bg-gray-50 max-h-[90vh]">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 shadow-sm shrink-0">
                  <button onClick={() => setView("MAIN")} className="text-gray-500 font-medium px-2">Cancel</button>
                  <h2 className="text-lg font-bold text-gray-900">Split options</h2>
                  <button onClick={() => setView("MAIN")} disabled={Math.abs(splitMathDiff) > 0.05} className="text-emerald-600 font-bold px-2 disabled:opacity-50">Done</button>
                </div>
                <div className="p-4 bg-white border-b border-gray-100 shrink-0">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => setSplitType("EQUAL")} className={`flex-1 h-10 text-lg font-bold rounded flex items-center justify-center transition-colors ${splitType === "EQUAL" ? "bg-emerald-500 text-white shadow-md" : "text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>=</button>
                    <button onClick={() => setSplitType("EXACT")} className={`flex-1 h-10 text-sm font-bold rounded flex items-center justify-center transition-colors ${splitType === "EXACT" ? "bg-emerald-500 text-white shadow-md" : "text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>1.23</button>
                    <button onClick={() => setSplitType("PERCENT")} className={`flex-1 h-10 text-lg font-bold rounded flex items-center justify-center transition-colors ${splitType === "PERCENT" ? "bg-emerald-500 text-white shadow-md" : "text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>%</button>
                    <button onClick={() => setSplitType("SHARE")} className={`flex-1 h-10 text-sm font-bold rounded flex items-center justify-center transition-colors ${splitType === "SHARE" ? "bg-emerald-500 text-white shadow-md" : "text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>iii</button>
                  </div>
                </div>
                <div className="overflow-y-auto bg-white flex-1 p-2">
                  {members.map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">{m.name.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-gray-900">{m.id === currentUserId ? "You" : m.name}</span>
                      </div>
                      {splitType === "EQUAL" ? (
                        <input type="checkbox" checked={involvedIds.includes(m.id)} onChange={() => setInvolvedIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])} className="w-6 h-6 text-emerald-500 rounded-full border-gray-300 focus:ring-emerald-500 accent-emerald-500" />
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">₹{(currentSplits.find(s => s.userId === m.id)?.amountOwed || 0).toFixed(2)}</span>
                          <div className="relative">
                            <input type="number" step="0.01" placeholder="0" value={splitInputs[m.id] || ""} onChange={(e) => setSplitInputs(prev => ({ ...prev, [m.id]: e.target.value }))} className="w-20 border border-gray-200 rounded-lg p-2 text-right font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all [&::-webkit-inner-spin-button]:appearance-none" />
                            {splitType !== "EXACT" && <span className="absolute right-2 top-2.5 text-xs text-gray-400 font-bold">{splitType === "PERCENT" ? "%" : "sh"}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                   <div className={`p-4 rounded-xl text-sm font-bold flex justify-between items-center ${Math.abs(splitMathDiff) < 0.05 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    <span>{Math.abs(splitMathDiff) < 0.05 ? "✓ Math checks out" : "⚠ Math doesn't add up"}</span>
                    <span>{splitMathTotal.toFixed(2)} / {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}