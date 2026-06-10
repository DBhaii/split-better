"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function AnalyticsClientView({ totalLent, totalBorrowed, trendData, balanceData }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-black text-gray-900 mb-6">Debt Distribution</h2>
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-sm font-bold text-emerald-600">You Lent</p>
            <p className="text-2xl font-black text-gray-900">₹{totalLent.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-orange-500">You Borrowed</p>
            <p className="text-2xl font-black text-gray-900">₹{totalBorrowed.toFixed(2)}</p>
          </div>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${totalLent + totalBorrowed === 0 ? 50 : (totalLent / (totalLent + totalBorrowed)) * 100}%` }}></div>
          <div className="bg-orange-400 h-full transition-all duration-1000" style={{ width: `${totalLent + totalBorrowed === 0 ? 50 : (totalBorrowed / (totalLent + totalBorrowed)) * 100}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4">Spending Trend</h2>
          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                  <Area type="monotone" dataKey="Your Cost" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm flex items-center justify-center h-full">No data available</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4">Global Balances</h2>
          <div className="h-64 w-full">
             {balanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balanceData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#374151', fontWeight: 600}} />
                  <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} cursor={{fill: '#f9fafb'}}/>
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                  <Bar dataKey="Owes You" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                  <Bar dataKey="You Owe" stackId="a" fill="#f97316" radius={[4, 0, 0, 4]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
             ) : <p className="text-gray-400 text-sm flex items-center justify-center h-full">Everyone is settled up!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}