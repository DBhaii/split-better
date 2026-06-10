"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function addExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const emailsRaw = formData.get("emails") as string;
  const splitsRaw = formData.get("splits") as string;

  if (!description || isNaN(amount)) throw new Error("Invalid data");

  const dbUser = await prisma.user.findUnique({ 
    where: { email: user.emailAddresses[0].emailAddress } 
  });
  if (!dbUser) throw new Error("User not found");

  // Advanced Split Parsing
  let emails: string[] = [];
  let splits: any[] = [];
  try {
    if (emailsRaw) emails = JSON.parse(emailsRaw);
    if (splitsRaw) splits = JSON.parse(splitsRaw);
  } catch (e) {
    // Fallback for simple legacy submission if needed
  }

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { description, totalAmount: amount }
    });

    // Payer is always the creator for personal expenses
    await tx.expensePayment.create({
      data: { amountPaid: amount, expenseId: expense.id, userId: dbUser.id }
    });

    if (splits.length > 0) {
      // Process advanced splits
      for (const split of splits) {
        let targetUserId = dbUser.id;
        if (split.identifier !== "You") {
          const friendEmail = split.identifier;
          const friend = await tx.user.upsert({
            where: { email: friendEmail },
            update: {},
            create: { id: crypto.randomUUID(), name: friendEmail.split('@')[0], email: friendEmail }
          });
          targetUserId = friend.id;
        }
        await tx.expenseSplit.create({
          data: { amountOwed: split.amountOwed, splitType: "CUSTOM", expenseId: expense.id, userId: targetUserId }
        });
      }
    } else {
      // Fallback 100% personal
      await tx.expenseSplit.create({ data: { amountOwed: amount, splitType: "EQUAL", expenseId: expense.id, userId: dbUser.id } });
    }

    await tx.activityLog.create({
      data: {
        actionType: "CREATE",
        description: `added "${description}"`,
        userId: dbUser.id,
        expenseId: expense.id
      }
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity"); 
}

export async function editExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const expenseId = formData.get("expenseId") as string;
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const splitsRaw = formData.get("splits") as string;

  if (!expenseId || !description || isNaN(amount)) throw new Error("Invalid data");

  const dbUser = await prisma.user.findUnique({ 
    where: { email: user.emailAddresses[0].emailAddress } 
  });
  if (!dbUser) throw new Error("User not found");

  const expense = await prisma.expense.findUnique({ 
    where: { id: expenseId },
    include: { payments: true, splits: true }
  });
  if (!expense) throw new Error("Expense not found");

  let customSplits: any[] = [];
  if (splitsRaw) {
    try { customSplits = JSON.parse(splitsRaw); } catch (e) {}
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expenseId },
      data: { description, totalAmount: amount }
    });

    if (customSplits.length > 0) {
      // OVERRIDE: Complex exact edits
      for (const split of customSplits) {
        const existing = expense.splits.find(s => s.userId === split.userId);
        if (existing) {
          await tx.expenseSplit.update({ where: { id: existing.id }, data: { amountOwed: split.amountOwed } });
        }
      }
      // If amount changed, scale payments (for personal/simple edits)
      const ratio = amount / expense.totalAmount;
      for (const payment of expense.payments) {
        await tx.expensePayment.update({ where: { id: payment.id }, data: { amountPaid: payment.amountPaid * ratio } });
      }
    } else {
      // FALLBACK: Proportional scaling if no custom splits provided
      const ratio = amount / expense.totalAmount;
      for (const payment of expense.payments) {
        await tx.expensePayment.update({ where: { id: payment.id }, data: { amountPaid: payment.amountPaid * ratio } });
      }
      for (const split of expense.splits) {
        await tx.expenseSplit.update({ where: { id: split.id }, data: { amountOwed: split.amountOwed * ratio } });
      }
    }

    await tx.activityLog.create({
      data: {
        actionType: "UPDATE",
        description: `updated "${description}"`,
        userId: dbUser.id,
        groupId: expense.groupId
      }
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (expense.groupId) revalidatePath(`/groups/${expense.groupId}`);
}

export async function deleteExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const expenseId = formData.get("expenseId") as string;
  if (!expenseId) throw new Error("Missing ID");

  const dbUser = await prisma.user.findUnique({ 
    where: { email: user.emailAddresses[0].emailAddress } 
  });
  if (!dbUser) throw new Error("User not found");

  const expense = await prisma.expense.findUnique({ 
    where: { id: expenseId },
    include: { payments: true, splits: true }
  });
  if (!expense) throw new Error("Expense not found");

  const myPayment = expense.payments.find(p => p.userId === dbUser.id)?.amountPaid || 0;
  const mySplit = expense.splits.find(s => s.userId === dbUser.id)?.amountOwed || 0;
  const netBalance = myPayment - mySplit;

  const otherInvolvedIds = new Set([...expense.payments.map(p => p.userId), ...expense.splits.map(s => s.userId)]);
  otherInvolvedIds.delete(dbUser.id);

  const otherUsers = await prisma.user.findMany({ where: { id: { in: Array.from(otherInvolvedIds) } } });

  let withText = "";
  if (otherUsers.length === 1) withText = ` with ${otherUsers[0].name.split(' ')[0]}`;
  else if (otherUsers.length > 1) withText = ` with ${otherUsers.length} others`;

  let impactText = "You were settled up";
  if (netBalance > 0.01) impactText = `You get back ₹${netBalance.toFixed(2)}`;
  else if (netBalance < -0.01) impactText = `You owed ₹${Math.abs(netBalance).toFixed(2)}`;

  // --- THE UNDO ARCHITECTURE SNAPSHOT ---
  const snapshot = JSON.stringify({
    description: expense.description,
    totalAmount: expense.totalAmount,
    groupId: expense.groupId,
    payments: expense.payments.map(p => ({ userId: p.userId, amountPaid: p.amountPaid })),
    splits: expense.splits.map(s => ({ userId: s.userId, amountOwed: s.amountOwed, splitType: s.splitType, splitValue: s.splitValue }))
  });

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        actionType: "DELETE",
        // Format: MainText|SubText|JSONSnapshot
        description: `deleted "${expense.description}"${withText}|${impactText}|${snapshot}`,
        userId: dbUser.id,
        groupId: expense.groupId
      }
    });

    await tx.expense.delete({ where: { id: expenseId } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (expense.groupId) revalidatePath(`/groups/${expense.groupId}`);
}

export async function undoDeleteExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const logId = formData.get("logId") as string;
  if (!logId) throw new Error("Missing Log ID");

  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Log not found");

  const parts = log.description.split('|');
  if (parts.length < 3) throw new Error("Snapshot corrupted or missing");

  const snapshot = JSON.parse(parts[2]);

  await prisma.$transaction(async (tx) => {
    // 1. Rebuild the exact expense
    const newExpense = await tx.expense.create({
      data: {
        description: snapshot.description,
        totalAmount: snapshot.totalAmount,
        groupId: snapshot.groupId,
      }
    });

    // 2. Rebuild exact payments
    for (const p of snapshot.payments) {
      await tx.expensePayment.create({ data: { amountPaid: p.amountPaid, userId: p.userId, expenseId: newExpense.id }});
    }

    // 3. Rebuild exact splits
    for (const s of snapshot.splits) {
      await tx.expenseSplit.create({ data: { amountOwed: s.amountOwed, splitType: s.splitType || "EQUAL", splitValue: s.splitValue, userId: s.userId, expenseId: newExpense.id }});
    }

    // 4. Destroy the deletion log so it vanishes from the feed
    await tx.activityLog.delete({ where: { id: logId } });
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (snapshot.groupId) revalidatePath(`/groups/${snapshot.groupId}`);
}