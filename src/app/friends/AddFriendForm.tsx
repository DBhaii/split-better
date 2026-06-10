"use client";

import { useState } from "react";
import { sendFriendRequest } from "../../app/actions/friends";

export function AddFriendForm() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setMessage({ type: "", text: "" });

    const formData = new FormData();
    formData.append("email", email);

    try {
      await sendFriendRequest(formData);
      setMessage({ type: "success", text: "Friend request sent successfully!" });
      setEmail("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to send request." });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Add a new friend</h2>
      <div className="flex gap-3">
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          placeholder="friend@example.com" 
          className="flex-1 border border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors font-medium text-gray-800"
        />
        <button 
          type="submit" 
          disabled={isPending || !email} 
          className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send Invite"}
        </button>
      </div>
      {message.text && (
        <p className={`mt-3 text-sm font-bold ${message.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}