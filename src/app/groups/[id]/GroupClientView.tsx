"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { AddGroupExpenseModal } from "../../../components/AddGroupExpenseModal";
import { AddGroupMember } from "../../../components/AddGroupMember";
import { settleUp } from "../../../app/actions/settleUp";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EditExpenseModal } from "../../../components/EditExpenseModal";
import { deleteExpense, undoDeleteExpense } from "../../../app/actions/expense"; 

export function GroupClientView({ group, dbUser, deletedLogs = [] }: { group: any, dbUser: any, deletedLogs?: any[] }) {
  const [activeTab, setActiveTab] = useState<"ACTIVITY" | "BALANCES" | "TOTALS" | "CHARTS">("ACTIVITY");
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settlePending, setSettlePending] = useState(false);

  // --- MATH ENGINE: Net Balances ---
  const memberBalances: Record<string, { id: string; name: string; balance: number; totalPaid: number; totalConsumed: number }> = {};
  group.members.forEach((m: any) => { 
    memberBalances[m.id] = { id: m.id, name: m.name, balance: 0, totalPaid: 0, totalConsumed: 0 }; 
  });

  let groupTotalSpent = 0;

  group.expenses.forEach((exp: any) => {
    if (exp.description !== "Payment") groupTotalSpent += exp.totalAmount;
    
    exp.payments.forEach((payment: any) => {
      if (memberBalances[payment.userId]) {
        memberBalances[payment.userId].balance += payment.amountPaid;
        if (exp.description !== "Payment") memberBalances[payment.userId].totalPaid += payment.amountPaid;
      }
    });
    exp.splits.forEach((split: any) => {
      if (memberBalances[split.userId]) {
        memberBalances[split.userId].balance -= split.amountOwed;
        if (exp.description !== "Payment") memberBalances[split.userId].totalConsumed += split.amountOwed;
      }
    });
  });

  // --- GREEDY ALGORITHM: Who owes Whom ---
  const debtors = Object.values(memberBalances).filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const creditors = Object.values(memberBalances).filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  
  const debts: { from: string; to: string; amount: number }[] = [];
  let d = 0; let c = 0;

  const workingDebtors = debtors.map(debtor => ({ ...debtor }));
  const workingCreditors = creditors.map(creditor => ({ ...creditor }));

  while (d < workingDebtors.length && c < workingCreditors.length) {
    const debtor = workingDebtors[d];
    const creditor = workingCreditors[c];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    if (amount > 0.01) debts.push({ from: debtor.name, to: creditor.name, amount });

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) < 0.01) d++;
    if (creditor.balance < 0.01) c++;
  }

  // --- CHART DATA PREPARATION ---
  const chartColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const consumptionData = Object.values(memberBalances).filter(m => m.totalConsumed > 0).map(m => ({ name: m.name, value: m.totalConsumed }));
  const fundingData = Object.values(memberBalances).map(m => ({ name: m.name, "Paid Upfront": m.totalPaid, "Actual Share": m.totalConsumed }));

  // --- UNIFIED ACTIVITY FEED (Expenses + Deleted Logs) ---
  const unifiedFeed = [
    ...group.expenses.map((e: any) => ({ type: 'EXPENSE', data: e, date: e.createdAt })),
    ...deletedLogs.map((l: any) => ({ type: 'LOG', data: l, date: l.createdAt }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- SETTLE UP HANDLER ---
  async function handleSettleUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSettlePending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("groupId", group.id);
      await settleUp(formData);
      setIsSettleModalOpen(false);
    } catch (error) {
      alert("Failed to record settlement");
    } finally {
      setSettlePending(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">{group.name}</h1>
          {group.description && <p className="text-gray-500 mt-1 font-medium">{group.description}</p>}
        </div>
        <AddGroupExpenseModal groupId={group.id} groupName={group.name} members={group.members} currentUserId={dbUser.id} />
      </header>

      {/* TABS */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-4">
        <button onClick={() => setIsSettleModalOpen(true)} className="px-5 py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-sm transition-colors">
          Settle up
        </button>
        <button onClick={() => setActiveTab("ACTIVITY")} className={`px-5 py-2 rounded-xl font-bold transition-all ${activeTab === "ACTIVITY" ? "bg-gray-900 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          Activity
        </button>
        <button onClick={() => setActiveTab("CHARTS")} className={`px-5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === "CHARTS" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          <span className="text-indigo-400">💎</span> Charts
        </button>
        <button onClick={() => setActiveTab("BALANCES")} className={`px-5 py-2 rounded-xl font-bold transition-all ${activeTab === "BALANCES" ? "bg-gray-900 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          Balances
        </button>
        <button onClick={() => setActiveTab("TOTALS")} className={`px-5 py-2 rounded-xl font-bold transition-all ${activeTab === "TOTALS" ? "bg-gray-900 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
          Totals
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* MAIN DYNAMIC CONTENT AREA */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: ACTIVITY LEDGER */}
          {activeTab === "ACTIVITY" && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {unifiedFeed.length === 0 ? (
                <div className="p-12 text-center text-gray-500 font-medium">No activity yet. Time to add an expense!</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unifiedFeed.map((item: any, index: number) => {
                    const formattedDate = new Date(item.date).toLocaleDateString('en-GB', { 
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' 
                    });

                    // --- RENDER DELETED LOG (WITH UNDO) ---
                    if (item.type === 'LOG') {
                      const log = item.data;
                      const parts = log.description.split('|');
                      const mainText = parts[0] || "Action recorded";
                      const subText = parts[1] || "";
                      const snapshotStr = parts.length > 2 ? parts.slice(2).join('|') : null;
                      
                      const actionText = `${log.user.id === dbUser.id ? "You" : log.user.name} ${mainText}`;
                      const canUndo = snapshotStr && snapshotStr.includes('{');

                      return (
                        <div key={`log-${log.id}-${index}`} className="flex justify-between p-5 bg-red-50/30 hover:bg-red-50/50 transition-colors">
                          <div className="flex gap-4">
                            <div className="relative shrink-0">
                              <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold">🧾</div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-800 border-2 border-white"></div>
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-lg leading-tight mb-1">{actionText}</p>
                              <p className="text-sm font-bold text-gray-500">{subText}</p>
                              <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
                            </div>
                          </div>
                          {canUndo && (
                            <div className="text-right flex flex-col justify-center">
                              <form action={undoDeleteExpense}>
                                <input type="hidden" name="logId" value={log.id} />
                                <button type="submit" className="text-xs bg-white hover:bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors border border-gray-200 shadow-sm">
                                  Undo
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // --- RENDER ACTIVE EXPENSE (WITH EDIT & DELETE) ---
                    const expense = item.data;
                    const isPayment = expense.description === "Payment";
                    const primaryPayer = expense.payments[0]?.user;
                    
                    if (isPayment) {
                      const receiver = expense.splits[0]?.user;
                      return (
                        <div key={`exp-${expense.id}-${index}`} className="flex justify-between items-center p-5 bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold shrink-0 text-xl">💸</div>
                            <div>
                              <p className="font-bold text-gray-900">{primaryPayer?.name} paid {receiver?.name}</p>
                              <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <p className="text-sm font-black text-emerald-600">₹{expense.totalAmount.toFixed(2)}</p>
                            <form action={deleteExpense} className="mt-2">
                              <input type="hidden" name="expenseId" value={expense.id} />
                              <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors">Delete</button>
                            </form>
                          </div>
                        </div>
                      );
                    }

                    const iPaidThis = expense.payments.find((p:any) => p.userId === dbUser.id)?.amountPaid || 0;
                    const mySplit = expense.splits.find((s:any) => s.userId === dbUser.id)?.amountOwed || 0;
                    
                    return (
                      <div key={`exp-${expense.id}-${index}`} className="flex justify-between p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold shrink-0">🧾</div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg leading-tight mb-1">{expense.description}</p>
                            <p className="text-sm font-medium text-gray-500">{primaryPayer?.name || 'Someone'} paid ₹{expense.totalAmount.toFixed(2)}</p>
                            <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-center items-end">
                          {iPaidThis > mySplit ? (
                            <><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">You lent</p><p className="font-black text-emerald-500 text-lg">₹{(iPaidThis - mySplit).toFixed(2)}</p></>
                          ) : mySplit > iPaidThis ? (
                            <><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">You owe</p><p className="font-black text-orange-500 text-lg">₹{(mySplit - iPaidThis).toFixed(2)}</p></>
                          ) : (
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">Not involved</p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2">
                            <EditExpenseModal expense={expense} />
                            <form action={deleteExpense}>
                              <input type="hidden" name="expenseId" value={expense.id} />
                              <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors mt-[8px]">
                                Delete
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRO CHARTS */}
          {activeTab === "CHARTS" && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-black text-gray-900 mb-6">Group Consumption</h2>
                <p className="text-sm text-gray-500 mb-6">A breakdown of who actually consumed the most value within the group.</p>
                <div className="h-64 w-full">
                  {consumptionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={consumptionData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {consumptionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 font-medium">Not enough data to graph.</div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
                <h2 className="text-xl font-black text-gray-900 mb-6">Funding vs. Share</h2>
                <p className="text-sm text-gray-500 mb-6">Compare what people physically paid upfront versus what they actually owed.</p>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fundingData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                      <Tooltip cursor={{fill: '#f9fafb'}} formatter={(value: number) => `₹${value.toFixed(2)}`} />
                      <Legend iconType="circle" />
                      <Bar dataKey="Paid Upfront" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Actual Share" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BALANCES */}
          {activeTab === "BALANCES" && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
              <h2 className="text-2xl font-black text-gray-900 mb-6">Who owes whom?</h2>
              {debts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl font-medium border border-gray-100 border-dashed">Everyone is settled up! Zero debts found.</div>
              ) : (
                <div className="space-y-4">
                  {debts.map((debt, i) => (
                    <div key={i} className="flex justify-between items-center p-5 border border-gray-100 bg-white hover:border-orange-200 transition-colors rounded-xl shadow-sm">
                      <p className="text-gray-800 text-lg">
                        <span className="font-bold">{debt.from}</span> owes <span className="font-bold">{debt.to}</span>
                      </p>
                      <p className="font-black text-orange-500 text-xl">₹{debt.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TOTALS */}
          {activeTab === "TOTALS" && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
              <h2 className="text-2xl font-black text-gray-900 mb-8">Group Totals</h2>
              <div className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg mb-8 text-center text-white">
                <p className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-2">Total Group Spending</p>
                <p className="text-5xl font-black">₹{groupTotalSpent.toFixed(2)}</p>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 mb-4">Member Breakdown</h3>
                {Object.values(memberBalances).map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-800">{m.name}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-500 block">Total Paid: ₹{m.totalPaid.toFixed(2)}</span>
                      <span className="text-sm font-medium text-gray-500 block">Total Consumed: ₹{m.totalConsumed.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR: MEMBERS LIST */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit sticky top-6">
          <p className="text-xs text-gray-400 font-bold mb-4 uppercase tracking-widest">Members ({group.members.length})</p>
          <div className="space-y-4 mb-8">
            {group.members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-gray-800">{member.name}</span>
              </div>
            ))}
          </div>
          <AddGroupMember groupId={group.id} />
        </div>
      </div>

      {/* SETTLE UP MODAL */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-black text-gray-900 mb-6 text-center">Record a payment</h2>
            <form onSubmit={handleSettleUp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Who is paying?</label>
                <select name="payerId" className="w-full border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-800 outline-none focus:border-emerald-500 transition-colors" defaultValue={dbUser.id}>
                  {group.members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">To whom?</label>
                <select name="receiverId" className="w-full border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-800 outline-none focus:border-emerald-500 transition-colors">
                  {group.members.filter((m:any) => m.id !== dbUser.id).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount (₹)</label>
                <input type="number" name="amount" step="0.01" required className="w-full border-2 border-gray-100 p-3 rounded-xl text-2xl font-black outline-none focus:border-emerald-500 transition-colors" placeholder="0.00" />
              </div>
              <div className="flex gap-3 mt-8">
                <Button type="button" variant="secondary" className="flex-1 py-4" onClick={() => setIsSettleModalOpen(false)}>Cancel</Button>
                <button type="submit" disabled={settlePending} className="flex-1 bg-orange-500 hover:bg-orange-600 transition-colors text-white font-bold rounded-xl disabled:opacity-50">
                  {settlePending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}