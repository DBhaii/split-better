"use client";

import { useState } from "react";
import { addExpense } from "../app/actions/expense";

export function AddExpenseModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const totalAmount = parseFloat(amountStr) || 0;

  // Dynamic Friends List
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");

  // Split Engine
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENT">("EQUAL");
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});

  const allParticipants = ["You", ...emails];

  function addEmail() {
    if (currentEmail && !emails.includes(currentEmail) && currentEmail.includes("@")) {
      setEmails([...emails, currentEmail.toLowerCase()]);
      setCurrentEmail("");
    }
  }

  function removeEmail(target: string) {
    setEmails(emails.filter(e => e !== target));
  }

  const calculateFinalSplits = () => {
    let finalSplits: { identifier: string; amountOwed: number }[] = [];
    if (splitType === "EQUAL") {
      const perPerson = totalAmount / allParticipants.length;
      allParticipants.forEach(p => finalSplits.push({ identifier: p, amountOwed: perPerson }));
    } else if (splitType === "EXACT") {
      allParticipants.forEach(p => finalSplits.push({ identifier: p, amountOwed: parseFloat(splitInputs[p]) || 0 }));
    } else if (splitType === "PERCENT") {
      allParticipants.forEach(p => finalSplits.push({ identifier: p, amountOwed: ((parseFloat(splitInputs[p]) || 0) / 100) * totalAmount }));
    }
    return finalSplits;
  };

  const currentSplits = calculateFinalSplits();
  const splitMathTotal = currentSplits.reduce((sum, s) => sum + s.amountOwed, 0);
  const splitMathDiff = totalAmount - splitMathTotal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (totalAmount <= 0) return alert("Enter a valid amount");
    if (emails.length > 0 && Math.abs(splitMathDiff) > 0.05) return alert("The split amounts do not add up to the total.");

    setIsPending(true);
    
    // We stringify the emails and splits so the server action can process the advanced math
    const formData = new FormData();
    formData.append("description", description);
    formData.append("amount", totalAmount.toString());
    formData.append("emails", JSON.stringify(emails));
    formData.append("splits", JSON.stringify(currentSplits));

    try {
      await addExpense(formData);
      setIsOpen(false);
      setDescription(""); setAmountStr(""); setEmails([]); setSplitInputs({});
    } catch (error) {
      alert("Failed to save expense");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors">
        + Add Expense
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[420px] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white shrink-0">
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl px-2 leading-none">&times;</button>
              <h2 className="text-lg font-bold text-gray-900">Add personal expense</h2>
              <div className="w-8"></div>
            </div>

            <div className="overflow-y-auto">
              <form id="add-expense-form" onSubmit={handleSubmit} className="flex flex-col">
                <div className="px-6 py-6 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">📝</div>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full text-xl font-medium outline-none border-b border-gray-200 focus:border-emerald-500 pb-1" placeholder="Enter a description" />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-800 font-bold text-xl shrink-0">₹</div>
                    <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} step="0.01" required className="w-full text-4xl font-light outline-none border-b border-gray-200 focus:border-emerald-500 pb-1 [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Split with friends</label>
                    <div className="flex gap-2 mb-3">
                      <input type="email" value={currentEmail} onChange={(e) => setCurrentEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())} className="flex-1 rounded-xl border border-gray-200 p-3 outline-none focus:border-emerald-500 text-sm font-medium" placeholder="friend@example.com" />
                      <button type="button" onClick={addEmail} className="bg-gray-900 text-white font-bold px-4 rounded-xl text-sm hover:bg-gray-800">Add</button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {emails.map(email => (
                        <div key={email} className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-200">
                          {email}
                          <button type="button" onClick={() => removeEmail(email)} className="text-emerald-500 hover:text-emerald-800">&times;</button>
                        </div>
                      ))}
                    </div>

                    {emails.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex justify-center gap-1.5 mb-4">
                          <button type="button" onClick={() => setSplitType("EQUAL")} className={`flex-1 h-8 text-xs font-bold rounded transition-colors ${splitType === "EQUAL" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 border border-gray-200 hover:bg-white"}`}>Equal</button>
                          <button type="button" onClick={() => setSplitType("EXACT")} className={`flex-1 h-8 text-xs font-bold rounded transition-colors ${splitType === "EXACT" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 border border-gray-200 hover:bg-white"}`}>Exact</button>
                          <button type="button" onClick={() => setSplitType("PERCENT")} className={`flex-1 h-8 text-xs font-bold rounded transition-colors ${splitType === "PERCENT" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 border border-gray-200 hover:bg-white"}`}>Percent</button>
                        </div>

                        <div className="space-y-2">
                          {allParticipants.map(p => (
                            <div key={p} className="flex justify-between items-center">
                              <span className="font-medium text-sm text-gray-800 truncate pr-2">{p}</span>
                              {splitType === "EQUAL" ? (
                                <span className="text-sm font-bold text-gray-500">₹{(totalAmount / allParticipants.length).toFixed(2)}</span>
                              ) : (
                                <input type="number" step="0.01" placeholder="0" value={splitInputs[p] || ""} onChange={(e) => setSplitInputs(prev => ({ ...prev, [p]: e.target.value }))} className="w-20 border border-gray-200 rounded p-1.5 text-right font-medium text-sm outline-none focus:border-emerald-500 [&::-webkit-inner-spin-button]:appearance-none" />
                              )}
                            </div>
                          ))}
                        </div>

                        {splitType !== "EQUAL" && (
                          <div className={`mt-4 p-2 rounded text-xs font-bold flex justify-between items-center ${Math.abs(splitMathDiff) < 0.05 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            <span>{Math.abs(splitMathDiff) < 0.05 ? "✓ Math checks out" : "⚠ Math doesn't add up"}</span>
                            <span>{splitType === "PERCENT" ? `${splitMathTotal.toFixed(0)}%` : `₹${splitMathTotal.toFixed(2)}`}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <button form="add-expense-form" type="submit" disabled={isPending || (emails.length > 0 && Math.abs(splitMathDiff) > 0.05)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                {isPending ? "Saving..." : "Save Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}