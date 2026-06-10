import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import Link from "next/link";
import { AnalyticsClientView } from "./AnalyticsClientView";

export default async function AnalyticsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/");

  const dbUser = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress }
  });
  if (!dbUser) redirect("/");

  // Fetch all expenses to calculate global metrics
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payments: { some: { userId: dbUser.id } } },
        { splits: { some: { userId: dbUser.id } } }
      ]
    },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
      group: true
    },
    orderBy: { createdAt: "asc" } // Oldest to newest for the trend chart
  });

  // Calculate Global Stats and Chart Data
  let totalTrueCost = 0;
  let totalPhysicallyPaid = 0;
  let totalLent = 0;
  let totalBorrowed = 0;

  const friendBalances: Record<string, { name: string; balance: number }> = {};
  const monthlySpending: Record<string, number> = {};

  expenses.forEach(exp => {
    if (exp.description === "Payment") return;

    const myPayment = exp.payments.find(p => p.userId === dbUser.id)?.amountPaid || 0;
    const mySplit = exp.splits.find(s => s.userId === dbUser.id)?.amountOwed || 0;

    totalPhysicallyPaid += myPayment;
    totalTrueCost += mySplit;

    if (myPayment > mySplit) totalLent += (myPayment - mySplit);
    else if (mySplit > myPayment) totalBorrowed += (mySplit - myPayment);

    // Trend Data
    const month = new Date(exp.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    monthlySpending[month] = (monthlySpending[month] || 0) + mySplit;

    // Friend Balances Data
    exp.splits.forEach(split => {
      if (split.userId !== dbUser.id && myPayment > 0) {
        if (!friendBalances[split.userId]) friendBalances[split.userId] = { name: split.user.name, balance: 0 };
        friendBalances[split.userId].balance += split.amountOwed; 
      }
    });
    exp.payments.forEach(payment => {
      if (payment.userId !== dbUser.id && mySplit > 0) {
        if (!friendBalances[payment.userId]) friendBalances[payment.userId] = { name: payment.user.name, balance: 0 };
        friendBalances[payment.userId].balance -= mySplit; 
      }
    });
  });

  const trendData = Object.keys(monthlySpending).map(month => ({
    name: month,
    "Your Cost": monthlySpending[month]
  }));

  const balanceData = Object.values(friendBalances)
    .filter(f => Math.abs(f.balance) > 0.05)
    .map(f => ({
      name: f.name.split(' ')[0],
      "Owes You": f.balance > 0 ? f.balance : 0,
      "You Owe": f.balance < 0 ? Math.abs(f.balance) : 0
    }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col shrink-0 hidden md:flex">
        <Link href="/dashboard" className="text-2xl font-bold text-gray-900 block mb-8">
          Split <span className="text-emerald-500">Better</span>
        </Link>
        <nav className="space-y-2 mb-8">
          <Link href="/dashboard" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Dashboard</Link>
          <Link href="/activity" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Activity</Link>
          <Link href="/analytics" className="block px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold">Analytics</Link>
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-gray-900">Your Analytics</h1>
          <p className="text-gray-500 mt-1 font-medium">A comprehensive breakdown of your cash flow.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total True Cost</p>
            <p className="text-4xl font-black text-gray-900 mb-2">₹{totalTrueCost.toFixed(2)}</p>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">This is your actual share of expenses, regardless of who paid the upfront bill.</p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-2xl shadow-xl text-white">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Cash Flow</p>
            <p className="text-4xl font-black mb-2">₹{totalPhysicallyPaid.toFixed(2)}</p>
            <p className="text-sm text-gray-300 font-medium leading-relaxed">Total cash that has physically left your bank account.</p>
          </div>
        </div>

        <AnalyticsClientView 
          totalLent={totalLent} 
          totalBorrowed={totalBorrowed} 
          trendData={trendData} 
          balanceData={balanceData} 
        />
      </main>
    </div>
  );
}