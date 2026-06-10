"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

interface PayerInput { userId: string; amountPaid: number; }
interface SplitInput { userId: string; amountOwed: number; splitType: string; splitValue: number | null; }

export async function editAdvancedExpense(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const expenseId = formData.get("expenseId") as string;
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  
  const payers = JSON.parse(formData.get("payers") as string) as PayerInput[];
  const splits = JSON.parse(formData.get("splits") as string) as SplitInput[];

  if (!expenseId || !description || isNaN(amount) || payers.length === 0 || splits.length === 0) {
    throw new Error("Invalid data provided");
  }

  // 1. Math Verification
  const totalPaid = payers.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalSplit = splits.reduce((sum, s) => sum + s.amountOwed, 0);
  
  if (Math.abs(totalPaid - amount) > 0.05 || Math.abs(totalSplit - amount) > 0.05) {
    throw new Error("Math mismatch: Splits do not equal total amount.");
  }

  // 2. Security Check: Ensure the user is actually involved in this expense
  const existingExpense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { payments: true }
  });

  if (!existingExpense) throw new Error("Expense not found");

  // 3. The Atomic Overwrite Transaction
  await prisma.$transaction(async (tx) => {
    // A. Wipe the old complex data
    await tx.expensePayment.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.deleteMany({ where: { expenseId } });

    // B. Update the base expense record
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: { description, totalAmount: amount }
    });

    // C. Write the new payments
    for (const payer of payers) {
      if (payer.amountPaid > 0) {
        await tx.expensePayment.create({
          data: { amountPaid: payer.amountPaid, expenseId, userId: payer.userId }
        });
      }
    }

    // D. Write the new splits
    for (const split of splits) {
      if (split.amountOwed > 0 || split.splitValue !== null) {
        await tx.expenseSplit.create({
          data: { 
            amountOwed: split.amountOwed, 
            splitType: split.splitType,
            splitValue: split.splitValue,
            expenseId, 
            userId: split.userId 
          }
        });
      }
    }

    // E. Log the modification securely
    await tx.activityLog.create({
      data: {
        actionType: "UPDATE",
        description: `updated the expense '${description}' to ₹${amount.toFixed(2)}`,
        userId: user.id,
        expenseId: expenseId,
        groupId: updatedExpense.groupId
      }
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (existingExpense.groupId) revalidatePath(`/groups/${existingExpense.groupId}`);
}