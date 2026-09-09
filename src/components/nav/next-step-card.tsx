"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { nextStep, type CarryState, type WorkflowStep } from "@/lib/climate/workflow";
import { useCountry } from "@/lib/country-context";

/**
 * The single card at the foot of every step. It carries country, location,
 * scenario and horizon forward as URL state, so the whole demo can be run by
 * clicking only this.
 */
export function NextStepCard({
  from,
  state,
}: {
  from: WorkflowStep["id"];
  state: CarryState;
}) {
  const router = useRouter();
  const { country } = useCountry();
  const next = nextStep(from, { country: country.toLowerCase(), ...state });
  if (!next) return null;

  return (
    <Link
      href={next.href}
      onMouseEnter={() => router.prefetch(next.href)}
      className="tier-raised group mt-8 flex items-center justify-between gap-4 p-5 transition-transform duration-[var(--dur-state)] ease-[var(--ease)] hover:-translate-y-0.5"
      data-tour="next-step"
    >
      <div>
        <p className="label mb-1">Next · step {next.step.n} of 4</p>
        <p className="text-base font-medium text-ink">{next.step.label}</p>
        <p className="mt-0.5 text-sm text-ink-faint">{next.step.question}</p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-pill) bg-accent text-accent-ink transition-transform group-hover:translate-x-0.5">
        <ArrowRight className="h-5 w-5" />
      </span>
    </Link>
  );
}
