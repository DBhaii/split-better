import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default async function LandingPage() {
  // 1. Intelligent Routing: If they are already logged in, skip the pitch and go to the app.
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* NAVIGATION BAR */}
      <nav className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter text-gray-900">
          Split <span className="text-emerald-500">Better</span>
        </div>
        <div className="flex gap-4 items-center">
          <SignInButton mode="modal">
            <button className="text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">Log in</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="text-sm font-bold bg-gray-900 text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition-all shadow-sm">
              Get Started
            </button>
          </SignUpButton>
        </div>
      </nav>

      {/* HERO SECTION */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Splitwise Pro Features, Completely Free.
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tight text-gray-900 mb-8 leading-[1.1]">
          Split expenses. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600">
            Keep your friends.
          </span>
        </h1>
        
        <p className="text-xl text-gray-500 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
          The world's most advanced bill-splitting engine. featuring AI receipt scanning, exact itemization, and greedy-algorithm debt settling. 
        </p>

        <SignUpButton mode="modal">
          <button className="text-lg font-bold bg-emerald-500 text-white px-8 py-4 rounded-full hover:bg-emerald-600 hover:scale-105 transition-all shadow-xl shadow-emerald-500/20">
            Create your free account
          </button>
        </SignUpButton>
      </main>

      {/* BENTO BOX FEATURE GRID */}
      <section className="bg-gray-50 py-32 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-16">Engineered for absolute fairness.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl mb-6">🧠</div>
              <h3 className="text-2xl font-bold mb-2">Masterpiece Math Engine</h3>
              <p className="text-gray-500 font-medium leading-relaxed">Go way beyond simple division. Split by exact amounts, percentages, or shares. Did someone pay 30% of the upfront bill while eating 10% of the food? We calculate the exact debt instantly.</p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl shadow-sm text-white">
              <div className="w-12 h-12 bg-gray-800 border border-gray-700 text-emerald-400 rounded-xl flex items-center justify-center text-2xl mb-6">✨</div>
              <h3 className="text-2xl font-bold mb-2">AI Vision</h3>
              <p className="text-gray-400 font-medium leading-relaxed">Powered by Google Gemini. Upload a receipt and let our AI extract the merchant and the exact total amounts.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-6">💸</div>
              <h3 className="text-xl font-bold mb-2">Smart Settle Up</h3>
              <p className="text-gray-500 font-medium">Our greedy algorithm minimizes the total number of transactions needed to settle all debts in a group.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-6">📊</div>
              <h3 className="text-xl font-bold mb-2">Flawless Analytics</h3>
              <p className="text-gray-500 font-medium">Track your true cost versus your cash flow. Understand exactly where your money is going with beautiful, interactive data visualizations.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}