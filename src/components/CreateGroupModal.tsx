"use client";

import { useState } from "react";
import { createGroup } from "../app/actions/group";

export function CreateGroupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    
    const formData = new FormData(e.currentTarget);
    try {
      await createGroup(formData);
      setIsOpen(false);
    } catch (error) {
      alert("Failed to create group");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="w-full text-left px-4 py-2 mt-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
        + Create New Group
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[400px] rounded-2xl shadow-2xl overflow-hidden relative">
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2 leading-none">&times;</button>
              <h2 className="text-lg font-bold text-gray-900">Create a Group</h2>
              <div className="w-8"></div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Group Name</label>
                <input type="text" name="name" required className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:border-emerald-500" placeholder="e.g. Goa Trip 2026" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                <input type="text" name="description" className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:border-emerald-500" placeholder="Optional" />
              </div>
              <button type="submit" disabled={isPending} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl mt-4">
                {isPending ? "Creating..." : "Create Group"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}