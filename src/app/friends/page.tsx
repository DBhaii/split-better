import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { AddFriendForm } from "./AddFriendForm";
import { acceptFriendRequest, rejectFriendRequest } from "../../app/actions/friends";

export default async function FriendsPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/");

  const dbUser = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress }
  });
  if (!dbUser) redirect("/");

  // 1. Fetch Incoming Requests (People who want to be your friend)
  const incomingRequests = await prisma.friendship.findMany({
    where: { friendId: dbUser.id, status: "PENDING" },
    include: { sender: true }
  });

  // 2. Fetch Outgoing Requests (People you invited who haven't accepted yet)
  const outgoingRequests = await prisma.friendship.findMany({
    where: { userId: dbUser.id, status: "PENDING" },
    include: { receiver: true }
  });

  // 3. Fetch Established Friends (Both where you sent it OR they sent it)
  const acceptedFriendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userId: dbUser.id }, { friendId: dbUser.id }]
    },
    include: { sender: true, receiver: true }
  });

  // Clean up the accepted friends list so it just looks like a list of users
  const friendsList = acceptedFriendships.map(f => {
    return f.userId === dbUser.id ? f.receiver : f.sender;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col shrink-0 hidden md:flex">
        <Link href="/dashboard" className="text-2xl font-bold text-gray-900 block mb-8">
          Split <span className="text-emerald-500">Better</span>
        </Link>
        <nav className="space-y-2 mb-8">
          <Link href="/dashboard" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Dashboard</Link>
          <Link href="/activity" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Activity</Link>
          <Link href="/analytics" className="block px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">Analytics</Link>
          <Link href="/friends" className="block px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold">Friends</Link>
        </nav>
      </aside>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Your Friends</h1>
            <p className="text-gray-500 mt-1 font-medium">Manage your network and incoming requests.</p>
          </div>
          <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center overflow-hidden">
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* CLIENT FORM FOR ADDING FRIENDS */}
        <AddFriendForm />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: REQUESTS */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Incoming Requests ({incomingRequests.length})</h3>
              {incomingRequests.length === 0 ? (
                <div className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm text-center text-gray-400 text-sm font-medium">No pending requests.</div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map(req => (
                    <div key={req.id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{req.sender.name}</p>
                        <p className="text-xs text-gray-500">{req.sender.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <form action={acceptFriendRequest}>
                          <input type="hidden" name="friendshipId" value={req.id} />
                          <button type="submit" className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold py-1.5 px-3 rounded-lg transition-colors text-xs">Accept</button>
                        </form>
                        <form action={rejectFriendRequest}>
                          <input type="hidden" name="friendshipId" value={req.id} />
                          <button type="submit" className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-1.5 px-3 rounded-lg transition-colors text-xs">Decline</button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Sent Requests ({outgoingRequests.length})</h3>
              {outgoingRequests.length === 0 ? (
                <div className="p-6 border border-gray-100 border-dashed rounded-xl text-center text-gray-400 text-sm font-medium">No outgoing requests.</div>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map(req => (
                    <div key={req.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{req.receiver.name}</p>
                        <p className="text-xs text-gray-500">{req.receiver.email}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ESTABLISHED FRIENDS */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">My Friends ({friendsList.length})</h3>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {friendsList.length === 0 ? (
                <div className="p-12 text-center text-gray-500 font-medium">You haven't added any friends yet. Send an invite to get started!</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {friendsList.map(friend => (
                    <div key={friend.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold shrink-0">
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{friend.name}</p>
                        <p className="text-xs text-gray-500">{friend.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}