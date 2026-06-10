"use client";

import { useState, useMemo } from "react";
import { Button } from "./ui/Button";

type Person = { id: string; name: string; paid: number; weight: number };

export function MasterCalculator() {
  // Initial state with two empty slots
  const [people, setPeople] = useState<Person[]>([
    { id: "1", name: "Alice", paid: 1000, weight: 1 },
    { id: "2", name: "Bob", paid: 0, weight: 1 },
  ]);

  const addPerson = () => setPeople([...people, { id: crypto.randomUUID(), name: "", paid: 0, weight: 1 }]);
  
  const updatePerson = (id: string, field: keyof Person, value: string | number) => {
    setPeople(people.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  
  const removePerson = (id: string) => setPeople(people.filter(p => p.id !== id));

  // The Math Engine: Recalculates instantly whenever inputs change
  const { totalPaid, balances, settlements } = useMemo(() => {
    const totalPaid = people.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
    const totalWeight = people.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

    // 1. Calculate how much each person *should* have paid (Target) and their Net Balance
    const balances = people.map(p => {
      const paid = Number(p.paid) || 0;
      const weight = Number(p.weight) || 0;
      const target = totalWeight > 0 ? (weight / totalWeight) * totalPaid : 0;
      return { ...p, target, balance: paid - target };
    });

    // 2. Greedy Algorithm to determine the minimal settlement transfers
    const debtors = balances.filter(b => b.balance < -0.01).map(b => ({ ...b })); // People who owe
    const creditors = balances.filter(b => b.balance > 0.01).map(b => ({ ...b })); // People owed money
    
    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0; let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      settlements.push({
        from: debtor.name || "Unknown",
        to: creditor.name || "Unknown",
        amount: amount
      });

      debtor.balance += amount;
      creditor.balance -= amount;

      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return { totalPaid, balances, settlements };
  }, [people]);

  return (
    <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sandbox Engine</h2>
      
      {/* Input Section */}
      <div className="space-y-4 mb-8">
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 mb-2 px-2">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Paid (₹)</div>
          <div className="col-span-3">Share Weight</div>
          <div className="col-span-2"></div>
        </div>
        
        {people.map((person) => (
          <div key={person.id} className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4">
              <input 
                type="text" value={person.name} onChange={(e) => updatePerson(person.id, "name", e.target.value)}
                className="w-full rounded-lg border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Name"
              />
            </div>
            <div className="col-span-3">
              <input 
                type="number" value={person.paid} onChange={(e) => updatePerson(person.id, "paid", parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="col-span-3">
              <input 
                type="number" value={person.weight} onChange={(e) => updatePerson(person.id, "weight", parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 p-2 outline-none focus:ring-2 focus:ring-emerald-500" step="0.1"
              />
            </div>
            <div className="col-span-2 text-right">
              <button onClick={() => removePerson(person.id)} className="text-red-400 hover:text-red-600 font-medium text-sm">Remove</button>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addPerson} className="w-full mt-4 text-sm py-2">+ Add Person</Button>
      </div>

      {/* Results Section */}
      <div className="border-t border-gray-100 pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Balances</h3>
          <p className="text-sm text-gray-500 mb-4">Total Pool: ₹{totalPaid.toFixed(2)}</p>
          <div className="space-y-3">
            {balances.map(b => (
              <div key={b.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="font-medium text-gray-700">{b.name || "Unknown"}</span>
                <span className={`font-semibold ${b.balance > 0 ? 'text-emerald-500' : b.balance < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {b.balance > 0 ? '+' : ''}{b.balance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Final Settlement Plan</h3>
          {settlements.length === 0 ? (
            <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">Everyone is settled up! No transfers needed.</p>
          ) : (
            <div className="space-y-3">
              {settlements.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                  <span className="text-sm text-emerald-800">
                    <strong className="font-semibold">{s.from}</strong> pays <strong className="font-semibold">{s.to}</strong>
                  </span>
                  <span className="font-bold text-emerald-600">₹{s.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}