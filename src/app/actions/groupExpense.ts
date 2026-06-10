"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

interface PayerInput { userId: string; amountPaid: number; }
interface SplitInput { userId: string; amountOwed: number; splitType: string; splitValue: number | null; }

export async function addAdvancedGroupExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const groupId = formData.get("groupId") as string;
  
  // Parse the advanced JSON arrays sent from the frontend
  const payers = JSON.parse(formData.get("payers") as string) as PayerInput[];
  const splits = JSON.parse(formData.get("splits") as string) as SplitInput[];

  if (!description || isNaN(amount) || !groupId || payers.length === 0 || splits.length === 0) {
    throw new Error("Invalid data provided");
  }

  // 1. Math Verification Security Check
  const totalPaid = payers.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalSplit = splits.reduce((sum, s) => sum + s.amountOwed, 0);
  
  // Allow a tiny margin of error for floating point javascript math (e.g., 33.33 + 33.33 + 33.34 = 100)
  if (Math.abs(totalPaid - amount) > 0.05 || Math.abs(totalSplit - amount) > 0.05) {
    throw new Error("Math mismatch: Total paid and total split must equal the total amount.");
  }

  // 2. The Masterpiece Transaction
  await prisma.$transaction(async (tx) => {
    // A. Create the base expense
    const expense = await tx.expense.create({
      data: { description, totalAmount: amount, groupId: groupId }
    });

    // B. Record exactly WHO paid WHAT (Multiple Payers Support)
    for (const payer of payers) {
      if (payer.amountPaid > 0) {
        await tx.expensePayment.create({
          data: { amountPaid: payer.amountPaid, expenseId: expense.id, userId: payer.userId }
        });
      }
    }

    // C. Record exactly WHO owes WHAT and HOW it was calculated
    for (const split of splits) {
      if (split.amountOwed > 0 || split.splitValue !== null) {
        await tx.expenseSplit.create({
          data: { 
            amountOwed: split.amountOwed, 
            splitType: split.splitType,
            splitValue: split.splitValue,
            expenseId: expense.id, 
            userId: split.userId 
          }
        });
      }
    }

    // D. Write to the global audit log
    await tx.activityLog.create({
      data: {
        actionType: "CREATE",
        description: `added '${description}' (₹${amount.toFixed(2)}) using advanced split`,
        userId: user.id,
        expenseId: expense.id,
        groupId: groupId
      }
    });
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
  revalidatePath("/activity");
}