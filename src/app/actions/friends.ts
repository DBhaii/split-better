"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const friendEmail = (formData.get("email") as string).toLowerCase().trim();
  if (!friendEmail) throw new Error("Email required");

  const dbUser = await prisma.user.findUnique({ 
    where: { email: user.emailAddresses[0].emailAddress } 
  });
  if (!dbUser) throw new Error("User not found");

  if (dbUser.email === friendEmail) throw new Error("You cannot add yourself.");

  // Find if the target user actually exists in the system
  const targetUser = await prisma.user.findUnique({ where: { email: friendEmail } });
  if (!targetUser) throw new Error("User not found. They must sign up first.");

  // Check if a friendship or pending request already exists
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: dbUser.id, friendId: targetUser.id },
        { userId: targetUser.id, friendId: dbUser.id }
      ]
    }
  });

  if (existing) {
    if (existing.status === "ACCEPTED") throw new Error("You are already friends.");
    throw new Error("A friend request is already pending.");
  }

  // Create the pending request
  await prisma.friendship.create({
    data: {
      userId: dbUser.id,
      friendId: targetUser.id,
      status: "PENDING"
    }
  });

  revalidatePath("/friends");
}

export async function acceptFriendRequest(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const friendshipId = formData.get("friendshipId") as string;
  if (!friendshipId) throw new Error("Missing ID");

  const dbUser = await prisma.user.findUnique({ 
    where: { email: user.emailAddresses[0].emailAddress } 
  });
  if (!dbUser) throw new Error("User not found");

  // Verify the request exists and belongs to this user
  const request = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!request || request.friendId !== dbUser.id) throw new Error("Invalid request");

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "ACCEPTED" }
  });

  revalidatePath("/friends");
  revalidatePath("/dashboard");
}

export async function rejectFriendRequest(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const friendshipId = formData.get("friendshipId") as string;
  if (!friendshipId) throw new Error("Missing ID");

  await prisma.friendship.delete({
    where: { id: friendshipId }
  });

  revalidatePath("/friends");
}