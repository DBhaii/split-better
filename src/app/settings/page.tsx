import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";
import { prisma } from "../../lib/db";

export default async function SettingsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/");

  const dbUser = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress }
  });

  if (!dbUser) redirect("/");

  // Fetch some fun stats for the user's profile
  const totalGroups = await prisma.group.count({
    where: { members: { some: { id: dbUser.id } } }
  });

  const totalExpensesInvolved = await prisma.expenseSplit.count({
    where: { userId: dbUser.id }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* Reused Sidebar Logic for seamless navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col shrink-0">
        <div className="mb-8">
          <Link href="/dashboard" className="text-2xl font-bold text-gray-900 block mb-8">
            Split <span className="text-emerald-500">Better</span>
          </Link>

          <nav className="space-y-2 mb-8">
            <Link href="/dashboard" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Dashboard</Link>
            <Link href="/activity" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Activity</Link>
            <Link href="/analytics" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Analytics</Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-500 mt-1">Manage your identity, security, and preferences.</p>
        </header>

        {/* Custom Application Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl font-bold">#</div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active Groups</p>
              <p className="text-2xl font-black text-gray-900">{totalGroups}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold">🧾</div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Expenses Logged</p>
              <p className="text-2xl font-black text-gray-900">{totalExpensesInvolved}</p>
            </div>
          </div>
        </div>

        {/* Clerk's Enterprise Security Component */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden [&_.cl-rootBox]:w-full [&_.cl-card]:w-full [&_.cl-card]:shadow-none [&_.cl-card]:border-0">
          <UserProfile 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none border-0 rounded-none",
                navbar: "hidden md:flex", // Hide Clerk's internal sidebar on mobile for cleaner UI
                profileSectionPrimaryButton: "text-emerald-600 hover:bg-emerald-50",
                formButtonPrimary: "bg-emerald-500 hover:bg-emerald-600 text-white",
              }
            }}
          />
        </div>

      </main>
    </div>
  );
}