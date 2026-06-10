"use server";

import { prisma } from "../../lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function settleUp(formData: FormData) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const groupId = formData.get("groupId") as string;
  const payerId = formData.get("payerId") as string; // The person handing over the cash
  const receiverId = formData.get("receiverId") as string; // The person receiving the cash
  const amountStr = formData.get("amount") as string;
  const amount = parseFloat(amountStr);

  if (!groupId || !payerId || !receiverId || isNaN(amount) || amount <= 0) {
    throw new Error("Invalid settlement data");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create a special "Settlement" expense
    const expense = await tx.expense.create({
      data: { 
        description: "Payment", 
        totalAmount: amount, 
        groupId: groupId 
      }
    });

    // 2. The Payer made the payment
    await tx.expensePayment.create({
      data: { amountPaid: amount, expenseId: expense.id, userId: payerId }
    });

    // 3. The Receiver owes the exact split, which mathematically cancels the debt!
    await tx.expenseSplit.create({
      data: { 
        amountOwed: amount, 
        splitType: "EXACT", 
        splitValue: amount, 
        expenseId: expense.id, 
        userId: receiverId 
      }
    });

    // 4. Log the settlement
    const payerDb = await tx.user.findUnique({ where: { id: payerId } });
    const receiverDb = await tx.user.findUnique({ where: { id: receiverId } });

    await tx.activityLog.create({
      data: {
        actionType: "UPDATE",
        description: `recorded a payment from ${payerDb?.name} to ${receiverDb?.name} for ₹${amount.toFixed(2)}`,
        userId: user.id,
        groupId: groupId
      }
    });
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/dashboard");
}