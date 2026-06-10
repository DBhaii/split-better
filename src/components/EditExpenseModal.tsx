"use client";

import { useState } from "react";
import { editExpense } from "../app/actions/expense";

export function EditExpenseModal({ expense }: { expense: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  const [description, setDescription] = useState(expense.description);
  const [amountStr, setAmountStr] = useState(expense.totalAmount.toString());
  const totalAmount = parseFloat(amountStr) || 0;

  // Extract participants involved in this specific expense
  const involvedUsers = new Map();
  expense.payments.forEach((p:any) => involvedUsers.set(p.userId, p.user.name));
  expense.splits.forEach((s:any) => involvedUsers.set(s.userId, s.user.name));
  const participants = Array.from(involvedUsers).map(([id, name]) => ({ id, name }));

  // Load existing exact splits
  const initialSplits: Record<string, string> = {};
  expense.splits.forEach((s:any) => { initialSplits[s.userId] = s.amountOwed.toString() });
  
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT">("EXACT");
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>(initialSplits);

  const calculateFinalSplits = () => {
    let finalSplits: { userId: string; amountOwed: number }[] = [];
    if (splitType === "EQUAL") {
      const perPerson = totalAmount / participants.length;
      participants.forEach(p => finalSplits.push({ userId: p.id, amountOwed: perPerson }));
    } else {
      participants.forEach(p => finalSplits.push({ userId: p.id, amountOwed: parseFloat(splitInputs[p.id]) || 0 }));
    }
    return finalSplits;
  };

  const currentSplits = calculateFinalSplits();
  const splitMathTotal = currentSplits.reduce((sum, s) => sum + s.amountOwed, 0);
  const splitMathDiff = totalAmount - splitMathTotal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (Math.abs(splitMathDiff) > 0.05) return alert("Splits must equal total amount.");
    setIsPending(true);
    
    const formData = new FormData();
    formData.append("expenseId", expense.id);
    formData.append("description", description);
    formData.append("amount", totalAmount.toString());
    formData.append("splits", JSON.stringify(currentSplits));

    try {
      await editExpense(formData);
      setIsOpen(false);
    } catch (error) {
      alert("Failed to update expense");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-xs text-blue-500 hover:text-blue-700 font-bold transition-colors mt-2">Edit</button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[400px] rounded-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 font-bold text-xl px-2">&times;</button>
              <h2 className="text-lg font-bold text-gray-900">Edit Expense</h2>
              <div className="w-8"></div>
            </div>

            <div className="overflow-y-auto">
              <form id="edit-expense-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-400 shrink-0">📝</div>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full text-xl font-medium outline-none border-b border-gray-200 focus:border-blue-500 pb-1" />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 border border-gray-200 rounded flex items-center justify-center text-gray-800 font-bold text-xl shrink-0">₹</div>
                  <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} step="0.01" required className="w-full text-4xl font-light outline-none border-b border-gray-200 focus:border-blue-500 pb-1 [&::-webkit-inner-spin-button]:appearance-none" />
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase">Adjust Splits</p>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setSplitType("EQUAL")} className={`px-2 py-1 text-xs font-bold rounded ${splitType === "EQUAL" ? "bg-blue-500 text-white" : "text-gray-500 border border-gray-200"}`}>Equal</button>
                      <button type="button" onClick={() => setSplitType("EXACT")} className={`px-2 py-1 text-xs font-bold rounded ${splitType === "EXACT" ? "bg-blue-500 text-white" : "text-gray-500 border border-gray-200"}`}>Exact</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {participants.map(p => (
                      <div key={p.id} className="flex justify-between items-center">
                        <span className="font-medium text-sm text-gray-800">{p.name}</span>
                        {splitType === "EQUAL" ? (
                          <span className="text-sm font-bold text-gray-500">₹{(totalAmount / participants.length).toFixed(2)}</span>
                        ) : (
                          <input type="number" step="0.01" value={splitInputs[p.id] || ""} onChange={(e) => setSplitInputs(prev => ({ ...prev, [p.id]: e.target.value }))} className="w-20 border border-gray-200 rounded p-1.5 text-right font-medium text-sm outline-none focus:border-blue-500 [&::-webkit-inner-spin-button]:appearance-none" />
                        )}
                      </div>
                    ))}
                  </div>

                  {splitType === "EXACT" && (
                    <div className={`mt-4 p-2 rounded text-xs font-bold flex justify-between items-center ${Math.abs(splitMathDiff) < 0.05 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-600"}`}>
                      <span>{Math.abs(splitMathDiff) < 0.05 ? "✓ Math matches" : "⚠ Math error"}</span>
                      <span>₹{splitMathTotal.toFixed(2)} / ₹{totalAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <button form="edit-expense-form" type="submit" disabled={isPending || Math.abs(splitMathDiff) > 0.05} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                {isPending ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}