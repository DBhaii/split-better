"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { addMemberToGroup } from "../app/actions/group";

export function AddGroupMember({ groupId }: { groupId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("email", email);

    try {
      await addMemberToGroup(formData);
      setEmail(""); // Clear the input on success
    } catch (error) {
      console.error(error);
      alert("Failed to add member.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-gray-100 flex gap-2">
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required 
        placeholder="friend@example.com"
        className="flex-1 rounded-lg border border-gray-200 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
      />
      <Button type="submit" variant="secondary" disabled={isPending} className="text-sm px-3 py-2">
        {isPending ? "Adding..." : "Invite"}
      </Button>
    </form>
  );
}