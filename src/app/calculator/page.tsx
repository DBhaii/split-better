import { MasterCalculator } from "../../components/MasterCalculator";
import Link from "next/link";
import { Button } from "../../components/ui/Button";

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Master Calculator</h1>
            <p className="text-gray-500 mt-1">Test complex scenarios, adjust weights, and find the optimal settlement.</p>
          </div>
          <Link href="/dashboard">
            <Button variant="secondary">← Back to Dashboard</Button>
          </Link>
        </header>

        <MasterCalculator />
      </div>
    </div>
  );
}