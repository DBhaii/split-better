import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export default async function ActivityLogPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/");

  const dbUser = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress },
    include: { groups: true }
  });
  if (!dbUser) redirect("/");

  const activeExpenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payments: { some: { userId: dbUser.id } } },
        { splits: { some: { userId: dbUser.id } } }
      ]
    },
    include: {
      payments: { include: { user: true } },
      splits: true,
      group: true
    }
  });

  const groupIds = dbUser.groups.map(g => g.id);
  const deletedLogs = await prisma.activityLog.findMany({
    where: {
      actionType: "DELETE",
      OR: [
        { userId: dbUser.id },
        { groupId: { in: groupIds } }
      ]
    },
    include: { user: true }
  });

  const unifiedFeed = [
    ...activeExpenses.map(e => ({ type: 'EXPENSE', data: e, date: e.createdAt })),
    ...deletedLogs.map(l => ({ type: 'LOG', data: l, date: l.createdAt }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-6 flex flex-col shrink-0 hidden md:flex">
        <Link href="/dashboard" className="text-2xl font-bold text-gray-900 block mb-8">
          Split <span className="text-emerald-500">Better</span>
        </Link>
        <nav className="space-y-2 mb-8">
          <Link href="/dashboard" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium">Dashboard</Link>
          <Link href="/activity" className="block px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold">Activity</Link>
          <Link href="/analytics" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium">Analytics</Link>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-3xl w-full">
        <header className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Recent activity</h1>
          <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center overflow-hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="divide-y divide-gray-100">
          {unifiedFeed.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No recent activity.</div>
          ) : (
            unifiedFeed.map((item, index) => {
              const formattedDate = new Date(item.date).toLocaleDateString('en-GB', {
                weekday: 'long', hour: '2-digit', minute:'2-digit'
              });

              // --- RENDER DELETED LOG (WITH UNDO) ---
              if (item.type === 'LOG') {
                const log = item.data as any;
                
                // Bulletproof extraction (safely handles strings with multiple | symbols)
                const parts = log.description.split('|');
                const mainText = parts[0] || "Action recorded";
                const subText = parts[1] || "";
                const snapshotStr = parts.length > 2 ? parts.slice(2).join('|') : null;
                
                const actionText = `${log.user.id === dbUser.id ? "You" : log.user.name} ${mainText}`;
                const finalSubText = subText || "Action recorded";
                
                let subTextColor = "text-gray-500";
                if (finalSubText.includes("get back")) subTextColor = "text-emerald-600";
                if (finalSubText.includes("owed") && !finalSubText.includes("settled")) subTextColor = "text-orange-600";

                // Only show button if a valid JSON structure is detected
                const canUndo = snapshotStr && snapshotStr.includes('{');

                return (
                  <div key={`log-${log.id}-${index}`} className="py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                    <div className="relative shrink-0">
                      <div className="w-12 h-14 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-xl shadow-sm">🧾</div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-800 border-2 border-white"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-gray-900 font-semibold text-[15px] leading-snug">{actionText}.</p>
                          <p className={`font-bold text-[14px] mt-0.5 ${subTextColor}`}>{finalSubText}</p>
                        </div>
                        {canUndo && (
                          <form action={async (formData) => {
                            "use server";
                            const { undoDeleteExpense } = await import("../../app/actions/expense");
                            await undoDeleteExpense(formData);
                          }}>
                            <input type="hidden" name="logId" value={log.id} />
                            <button type="submit" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3 rounded-lg transition-colors whitespace-nowrap shrink-0 border border-gray-200 shadow-sm">
                              Undo
                            </button>
                          </form>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{formattedDate}</p>
                    </div>
                  </div>
                );
              }

              // --- RENDER ACTIVE EXPENSE ---
              const expense = item.data as any;
              const primaryPayer = expense.payments[0]?.user;
              const isPayment = expense.description === "Payment";
              
              const myPayment = expense.payments.find((p:any) => p.userId === dbUser.id)?.amountPaid || 0;
              const mySplit = expense.splits.find((s:any) => s.userId === dbUser.id)?.amountOwed || 0;
              const netBalance = myPayment - mySplit;

              let icon = "🧾";
              let badgeColor = "bg-gray-500";
              let actionText = "";
              let subText = "";
              let subTextColor = "text-gray-500";

              if (isPayment) {
                icon = "💸";
                badgeColor = "bg-green-700";
                if (myPayment > 0) {
                  actionText = `You recorded a payment to ${expense.splits[0]?.user?.name || "someone"}`;
                  subText = `You paid ₹${expense.totalAmount.toFixed(2)}`;
                  subTextColor = "text-emerald-600";
                } else {
                  actionText = `${primaryPayer?.name || "Someone"} recorded a payment to you`;
                  subText = `You received ₹${expense.totalAmount.toFixed(2)}`;
                  subTextColor = "text-gray-600";
                }
              } else {
                actionText = `${primaryPayer?.id === dbUser.id ? "You" : primaryPayer?.name || "Someone"} added "${expense.description}"`;
                if (expense.group) actionText += ` in "${expense.group.name}"`;
                
                if (netBalance > 0.01) {
                  badgeColor = "bg-orange-500"; 
                  subText = `You get back ₹${netBalance.toFixed(2)}`;
                  subTextColor = "text-emerald-600";
                } else if (netBalance < -0.01) {
                  badgeColor = "bg-blue-900"; 
                  subText = `You owe ₹${Math.abs(netBalance).toFixed(2)}`;
                  subTextColor = "text-orange-600";
                } else {
                  badgeColor = "bg-gray-400";
                  subText = "You are settled up";
                  subTextColor = "text-gray-500";
                }
              }

              return (
                <div key={`exp-${expense.id}-${index}`} className="py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className="relative shrink-0">
                    <div className="w-12 h-14 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-xl shadow-sm">
                      {icon}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${badgeColor} border-2 border-white`}></div>
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-gray-900 font-semibold text-[15px] leading-snug">{actionText}.</p>
                    <p className={`font-bold text-[14px] mt-0.5 ${subTextColor}`}>{subText}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{formattedDate}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}