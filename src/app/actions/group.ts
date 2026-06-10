"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createGroup(formData: FormData) {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name) {
    throw new Error("Group name is required");
  }

  const email = clerkUser.emailAddresses[0].emailAddress;

  const dbUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!dbUser) {
    throw new Error("User not found");
  }

  await prisma.group.create({
    data: {
      name,
      description,
      members: {
        connect: {
          id: dbUser.id,
        },
      },
    },
  });

  revalidatePath("/dashboard");
}

export async function addMemberToGroup(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const groupId = formData.get("groupId") as string;
  const email = formData.get("email") as string;

  if (!groupId || !email) throw new Error("Group ID and Email are required");

  // 1. Find the friend, or create a shadow profile for them if they don't exist
  const friend = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      id: crypto.randomUUID(),
      name: email.split('@')[0], // Use the first part of their email as a temporary name
      email: email.toLowerCase()
    }
  });

  // 2. Connect this friend to the specific group
  await prisma.group.update({
    where: { id: groupId },
    data: {
      members: {
        connect: { id: friend.id }
      }
    }
  });

  // 3. Log the activity!
  await prisma.activityLog.create({
    data: {
      actionType: "CREATE",
      description: `added ${friend.name} to the group`,
      userId: user.id,
      groupId: groupId
    }
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/activity");
}