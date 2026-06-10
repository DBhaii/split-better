import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/db";
import { GroupClientView } from "./GroupClientView";
import Link from "next/link";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  // THE FIX: Await the params object (Required in Next.js 15+)
  const resolvedParams = await params;
  const groupId = resolvedParams.id;

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/");

  const dbUser = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress }
  });
  if (!dbUser) redirect("/");

  const group = await prisma.group.findUnique({
    where: { id: groupId }, // Now using the successfully awaited ID
    include: {
      members: true,
      expenses: {
        include: { 
          payments: { include: { user: true } }, 
          splits: { include: { user: true } } 
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Group not found</h1>
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 font-bold">Return to Dashboard</Link>
      </div>
    );
  }

  // Fetch the permanent deletion logs for this specific group to power the Undo button
  const deletedLogs = await prisma.activityLog.findMany({
    where: { 
      groupId: group.id, 
      actionType: "DELETE" 
    },
    include: { user: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-800 font-bold transition-colors inline-block">
          ← Back to Dashboard
        </Link>
      </div>
      <GroupClientView group={group} dbUser={dbUser} deletedLogs={deletedLogs} />
    </div>
  );
}