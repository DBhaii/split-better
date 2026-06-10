import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { Button } from "../../components/ui/Button";
import { AddExpenseModal } from "../../components/AddExpenseModal";
import { CreateGroupModal } from "../../components/CreateGroupModal";
import { EditExpenseModal } from "../../components/EditExpenseModal";
import Link from "next/link";

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/");

  const primaryEmail = user.emailAddresses[0].emailAddress;

  const dbUser = await prisma.user.upsert({
    where: { email: primaryEmail },
    update: { name: user.firstName || "User" },
    create: {
      id: user.id,
      name: user.firstName || "User",
      email: primaryEmail,
    },
  });

  const userGroups = await prisma.group.findMany({
    where: { members: { some: { id: dbUser.id } } },
    orderBy: { createdAt: "desc" },
  });

  const recentExpenses = await prisma.expense.findMany({
    where: {
      OR: [
        { payments: { some: { userId: dbUser.id } } },
        { splits: { some: { userId: dbUser.id } } }
      ]
    },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let globalBalance = 0;

  recentExpenses.forEach((expense) => {
    if (expense.description === "Payment") return;
    const myTotalPaid = expense.payments.filter((p) => p.userId === dbUser.id).reduce((sum, p) => sum + p.amountPaid, 0);
    const myShare = expense.splits.filter((s) => s.userId === dbUser.id).reduce((sum, s) => sum + s.amountOwed, 0);
    globalBalance += (myTotalPaid - myShare);
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Split <span className="text-emerald-500">Better</span>
          </h2>

          <nav className="space-y-2 mb-8">
            <Link href="/activity" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Activity</Link>
            <Link href="/analytics" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Analytics</Link>
            <Link href="/friends" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Friends</Link>
          </nav>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-4">Your Groups</h3>
            <div className="space-y-1">
              {userGroups.length === 0 ? (
                <p className="px-4 text-sm text-gray-500 italic">No groups yet.</p>
              ) : (
                userGroups.map((group) => (
                  <Link key={group.id} href={`/groups/${group.id}`} className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium">
                    # {group.name}
                  </Link>
                ))
              )}
              <CreateGroupModal />
            </div>
          </div>
        </div>

        <Link href="/settings" className="block w-full">
          <Button variant="secondary" className="w-full">Settings</Button>
        </Link>
      </aside>

      <main className="flex-1 p-8 max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-semibold text-gray-900">Welcome back, {user.firstName}</h1>
          <div className="flex items-center gap-4">
            <AddExpenseModal /> 
            <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center overflow-hidden hover:border-emerald-500 transition-colors">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Balance</p>
            <p className={`text-3xl font-bold ${globalBalance >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {globalBalance > 0.01 ? `You are owed ₹${globalBalance.toFixed(2)}` : 
               globalBalance < -0.01 ? `You owe ₹${Math.abs(globalBalance).toFixed(2)}` : 
               'All settled up!'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between items-start">
            <div>
              <p className="text-sm text-gray-300 font-medium mb-1">Pro Feature</p>
              <h3 className="text-xl font-bold text-white mb-2">Master Calculator</h3>
            </div>
            <Link href="/calculator">
              <Button variant="secondary" className="text-sm py-2 px-4 border-none text-gray-900 bg-white">Open Sandbox</Button>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {recentExpenses.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No expenses yet. Add one above!</div>
            ) : (
              recentExpenses.map((expense) => {
                const primaryPayer = expense.payments[0]?.user;
                const iPaidTotal = expense.payments.filter(p => p.userId === dbUser.id).reduce((sum, p) => sum + p.amountPaid, 0);
                const mySplit = expense.splits.find(s => s.userId === dbUser.id)?.amountOwed || 0;
                
                const formattedDate = new Date(expense.createdAt).toLocaleDateString('en-GB', { 
                  day: 'numeric', month: 'short', year: 'numeric' 
                });

                return (
                  <div key={expense.id} className="flex items-center justify-between p-5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold shrink-0">🧾</div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg leading-tight mb-1">{expense.description}</p>
                        <p className="text-sm font-medium text-gray-500">
                          {primaryPayer?.name || 'Someone'} paid ₹{expense.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end justify-center">
                      {iPaidTotal > mySplit ? (
                        <><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">You lent</p><p className="font-black text-emerald-500 text-lg">₹{(iPaidTotal - mySplit).toFixed(2)}</p></>
                      ) : mySplit > iPaidTotal ? (
                        <><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">You borrowed</p><p className="font-black text-orange-500 text-lg">₹{(mySplit - iPaidTotal).toFixed(2)}</p></>
                      ) : (
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">Not involved</p>
                      )}
                      
                      {(iPaidTotal > 0 || mySplit > 0) && (
                        <div className="flex items-center gap-3 mt-1">
                          <EditExpenseModal expense={expense} />
                          <form action={async (formData) => {
                            "use server";
                            const { deleteExpense } = await import("../../app/actions/expense");
                            await deleteExpense(formData);
                          }}>
                            <input type="hidden" name="expenseId" value={expense.id} />
                            <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors mt-2">
                              Delete
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}