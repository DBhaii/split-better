"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { sendFriendRequest } from "../app/actions/friend";

export function AddFriendForm() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setMessage("");
    try {
      await sendFriendRequest(formData);
      setMessage("Friend request sent!");
    } catch (error: any) {
      setMessage(error.message || "Failed to send request.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex gap-3">
      <input 
        type="email" 
        name="email" 
        required 
        placeholder="friend@example.com"
        className="flex-1 rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
      />
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Sending..." : "Add Friend"}
      </Button>
      {message && <span className="text-sm font-medium text-emerald-600 self-center">{message}</span>}
    </form>
  );
}