"use client";

import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// Define the shape of our data
interface AnalyticsProps {
  timeData: { date: string; amount: number }[];
  distributionData: { name: string; value: number }[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export function AnalyticsCharts({ timeData, distributionData }: AnalyticsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* 1. Time-Series Bar Chart */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Spending Over Time</h3>
        <div className="h-72 w-full">
          {timeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">No data available yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData}>
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Group vs Personal Pie Chart */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Expense Distribution</h3>
        <div className="h-72 w-full">
          {distributionData.length === 0 || distributionData.every(d => d.value === 0) ? (
            <div className="h-full flex items-center justify-center text-gray-400">No data available yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}