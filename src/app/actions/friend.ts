"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(formData: FormData) {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthorized");

  const email = formData.get("email") as string;
  if (!email) throw new Error("Email is required");

  // Find the current logged-in user in our DB
  const requester = await prisma.user.findUnique({
    where: { email: clerkUser.emailAddresses[0].emailAddress }
  });
  if (!requester) throw new Error("User not found");

  // Find the person they are trying to add
  const addressee = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  if (!addressee) throw new Error("Friend not found in the system");
  if (requester.id === addressee.id) throw new Error("You cannot add yourself");

  // Check if a relationship already exists (Pending or Accepted)
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: requester.id, friendId: addressee.id },
        { userId: addressee.id, friendId: requester.id }
      ]
    }
  });

  if (existingFriendship) throw new Error("Friendship already exists or is pending");

  // Create the pending request
  await prisma.friendship.create({
    data: {
      userId: requester.id,
      friendId: addressee.id,
      status: "PENDING"
    }
  });

  revalidatePath("/friends");
}

export async function acceptFriendRequest(formData: FormData) {
  const friendshipId = formData.get("friendshipId") as string;
  if (!friendshipId) throw new Error("ID missing");

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "ACCEPTED" }
  });

  revalidatePath("/friends");
}