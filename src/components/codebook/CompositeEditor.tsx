"use client";

import { useState } from "react";
import type { SurveyRespondent } from "@/types/survey";
import type { CompositeConfig, FeatureBundle } from "@/lib/featurize";
import { DEFAULT_COMPOSITES } from "@/lib/featurize";

export type CompositeEditorKey =
  | "totalLoss"
  | "anyDamage"
  | "accessBarrier"
  | "aiEmoSupport"
  | "healthImpact"
  | "financialStrain"
  | "exposureTier";

interface CompositeEditorProps {
  which: CompositeEditorKey;
  bundle: FeatureBundle;
  composites: CompositeConfig;
  setComposites: (c: CompositeConfig) => void;
  allRespondents: SurveyRespondent[];
}

function countPresence(rows: SurveyRespondent[], extractor: (r: SurveyRespondent) => string[], needle: string): number {
  let c = 0;
  for (const r of rows) {
    if (extractor(r).includes(needle)) c++;
  }
  return c;
}

function pct(n: number, d: number): string {
  if (d <= 0) return "0.0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function Badge({ kind }: { kind: "default" | "unmatched" }) {
  const cls = kind === "default" ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-800";
  const label = kind === "default" ? "default" : "unmatched";
  return <span className={`ml-2 text-[9px] uppercase px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

/** Tier checklist for exposureTier composites. */
function TierBuckets(props: {
  title: string;
  options: string[];
  membership: readonly string[];
  onToggle: (opt: string) => void;
  allRespondents: SurveyRespondent[];
  defaults: readonly string[];
}) {
  const { title, options, membership, onToggle, allRespondents, defaults } = props;
  const selected = new Set(membership);
  const nTot = Math.max(allRespondents.length, 1);
  return (
    <div className="space-y-2">
      <p className="font-semibold text-[11px]">{title}</p>
      <ul className="max-h-44 overflow-auto space-y-1 pr-2 border border-border rounded p-2">
        {options.map((opt) => {
          const freq = countPresence(allRespondents, (r) => r.fireImpacts ?? [], opt);
          const defHit = defaults.includes(opt);
          return (
            <li key={`${title}-${opt}`} className="flex gap-2 border-b border-border pb-1">
              <input type="checkbox" className="mt-0.5" checked={selected.has(opt)} onChange={() => onToggle(opt)} />
              <label className="flex-1 flex items-start flex-wrap gap-1">
                <span>{opt}</span>
                {defHit ? <Badge kind="default" /> : <Badge kind="unmatched" />}
              </label>
              <span className="text-text-muted font-mono text-[10px]">
                n={freq} ({pct(freq, nTot)})
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function CompositeEditor({
  which,
  bundle,
  composites,
  setComposites,
  allRespondents,
}: CompositeEditorProps) {
  const vocab = bundle.observedMultiSelectOptions ?? {};
  const fireOptions = vocab.fireImpacts ?? [];
  const barrierOptions = vocab.supportBarriers ?? [];
  const interestOptions = vocab.aiToolInterests ?? [];
  const challengingOptions = vocab.challengingAreas ?? [];

  const [tierError, setTierError] = useState<string | null>(null);

  if (which === "exposureTier") {
    const applyTier = (nextTl: string[], nextPs: string[]) => {
      const clash = nextTl.filter((x) => nextPs.includes(x));
      if (clash.length) {
        setTierError(
          `Duplicate assignment: ${clash.slice(0, 4).join("; ")}${clash.length > 4 ? "…" : ""}`
        );
        return;
      }
      setTierError(null);
      setComposites({
        ...composites,
        exposureTier: { totalLossMembers: nextTl, partialOrSmokeMembers: nextPs },
      });
    };

    const toggleTotal = (opt: string) => {
      const tl = [...composites.exposureTier.totalLossMembers];
      const ps = [...composites.exposureTier.partialOrSmokeMembers];
      const has = tl.includes(opt);
      const nextTl = has ? tl.filter((x) => x !== opt) : [...tl, opt];
      applyTier(nextTl, ps.filter((x) => x !== opt));
    };

    const togglePartial = (opt: string) => {
      const tl = [...composites.exposureTier.totalLossMembers];
      const ps = [...composites.exposureTier.partialOrSmokeMembers];
      const has = ps.includes(opt);
      const nextPs = has ? ps.filter((x) => x !== opt) : [...ps, opt];
      applyTier(tl.filter((x) => x !== opt), nextPs);
    };

    const membersSelected =
      composites.exposureTier.totalLossMembers.length +
      composites.exposureTier.partialOrSmokeMembers.length;

    return (
      <div className="border border-border rounded-md p-3 mt-2 bg-card-alt space-y-3 text-[11px]">
        <header className="flex justify-between gap-2 items-start">
          <div>
            <p className="font-semibold">exposureTier composite</p>
            <p className="text-text-muted">
              Tracking {membersSelected} of {fireOptions.length} observed fire-impact options.
            </p>
          </div>
          <button
            type="button"
            className="text-[10px] border border-border rounded px-2 py-1"
            onClick={() =>
              setComposites({ ...composites, exposureTier: { ...DEFAULT_COMPOSITES.exposureTier } })
            }
          >
            Reset to default
          </button>
        </header>
        {tierError && (
          <p className="text-red-700 border border-red-200 bg-red-50 rounded px-2 py-1">{tierError}</p>
        )}
        <TierBuckets
          title="Total loss tier members"
          options={fireOptions}
          membership={composites.exposureTier.totalLossMembers}
          defaults={DEFAULT_COMPOSITES.exposureTier.totalLossMembers}
          allRespondents={allRespondents}
          onToggle={toggleTotal}
        />
        <TierBuckets
          title="Partial / smoke tier members"
          options={fireOptions}
          membership={composites.exposureTier.partialOrSmokeMembers}
          defaults={DEFAULT_COMPOSITES.exposureTier.partialOrSmokeMembers}
          allRespondents={allRespondents}
          onToggle={togglePartial}
        />
      </div>
    );
  }

  type SimpleSpec = {
    title: string;
    options: string[];
    memberList: string[];
    defaults: readonly string[];
    extractor: (r: SurveyRespondent) => string[];
    onPatch: (m: string[]) => void;
    onReset: () => void;
  };

  const simpleSpec: SimpleSpec =
    which === "totalLoss"
      ? {
          title: "totalLoss composite",
          options: fireOptions,
          memberList: composites.totalLoss.members,
          defaults: DEFAULT_COMPOSITES.totalLoss.members,
          extractor: (r) => r.fireImpacts ?? [],
          onPatch: (m: string[]) => setComposites({ ...composites, totalLoss: { members: m } }),
          onReset: () =>
            setComposites({ ...composites, totalLoss: { ...DEFAULT_COMPOSITES.totalLoss } }),
        }
      : which === "anyDamage"
        ? {
            title: "anyDamage composite",
            options: fireOptions,
            memberList: composites.anyDamage.members,
            defaults: DEFAULT_COMPOSITES.anyDamage.members,
            extractor: (r) => r.fireImpacts ?? [],
            onPatch: (m: string[]) => setComposites({ ...composites, anyDamage: { members: m } }),
            onReset: () =>
              setComposites({ ...composites, anyDamage: { ...DEFAULT_COMPOSITES.anyDamage } }),
          }
        : which === "accessBarrier"
          ? {
              title: "accessBarrier composite",
              options: barrierOptions,
              memberList: composites.accessBarrier.members,
              defaults: DEFAULT_COMPOSITES.accessBarrier.members,
              extractor: (r) => r.supportBarriers ?? [],
              onPatch: (m: string[]) => setComposites({ ...composites, accessBarrier: { members: m } }),
              onReset: () =>
                setComposites({ ...composites, accessBarrier: { ...DEFAULT_COMPOSITES.accessBarrier } }),
            }
          : which === "aiEmoSupport"
            ? {
                title: "aiEmoSupport composite",
                options: interestOptions,
                memberList: composites.aiEmoSupport.members,
                defaults: DEFAULT_COMPOSITES.aiEmoSupport.members,
                extractor: (r) => r.aiToolInterests ?? [],
                onPatch: (m: string[]) => setComposites({ ...composites, aiEmoSupport: { members: m } }),
                onReset: () =>
                  setComposites({ ...composites, aiEmoSupport: { ...DEFAULT_COMPOSITES.aiEmoSupport } }),
              }
            : which === "healthImpact"
              ? {
                  title: "healthImpact composite",
                  options: fireOptions,
                  memberList: composites.healthImpact.members,
                  defaults: DEFAULT_COMPOSITES.healthImpact.members,
                  extractor: (r) => r.fireImpacts ?? [],
                  onPatch: (m: string[]) => setComposites({ ...composites, healthImpact: { members: m } }),
                  onReset: () =>
                    setComposites({ ...composites, healthImpact: { ...DEFAULT_COMPOSITES.healthImpact } }),
                }
              : {
                  title: "financialStrain composite",
                  options: challengingOptions,
                  memberList: composites.financialStrain.members,
                  defaults: DEFAULT_COMPOSITES.financialStrain.members,
                  extractor: (r) => r.challengingAreas ?? [],
                  onPatch: (m: string[]) =>
                    setComposites({ ...composites, financialStrain: { members: m } }),
                  onReset: () =>
                    setComposites({
                      ...composites,
                      financialStrain: { ...DEFAULT_COMPOSITES.financialStrain },
                    }),
                };

  const toggleMember = (opt: string) => {
    const draft = [...simpleSpec.memberList];
    const ix = draft.indexOf(opt);
    if (ix >= 0) draft.splice(ix, 1);
    else draft.push(opt);
    simpleSpec.onPatch(draft);
  };

  return (
    <div className="border border-border rounded-md p-3 mt-2 bg-card-alt space-y-2 text-[11px]">
      <header className="flex justify-between gap-2 items-start">
        <div>
          <p className="font-semibold">{simpleSpec.title}</p>
          <p className="text-text-muted">
            Selected {simpleSpec.memberList.length} of {simpleSpec.options.length} observed options (
            {pct(simpleSpec.memberList.length, simpleSpec.options.length)} of vocabulary).
          </p>
        </div>
        <button type="button" className="text-[10px] border border-border rounded px-2 py-1" onClick={simpleSpec.onReset}>
          Reset to default
        </button>
      </header>

      <ul className="max-h-48 overflow-auto space-y-1 pr-2">
        {simpleSpec.options.map((opt) => {
          const selected = simpleSpec.memberList.includes(opt);
          const defHit = simpleSpec.defaults.includes(opt);
          const freq = countPresence(allRespondents, simpleSpec.extractor, opt);
          return (
            <li key={`${which}-${opt}`} className="flex items-start gap-2 border-b border-border pb-1">
              <input type="checkbox" className="mt-0.5" checked={selected} onChange={() => toggleMember(opt)} />
              <label className="flex-1 flex flex-wrap gap-1">
                <span>{opt}</span>
                {defHit ? <Badge kind="default" /> : <Badge kind="unmatched" />}
              </label>
              <span className="text-text-muted font-mono text-[10px] whitespace-nowrap">
                n={freq} ({pct(freq, Math.max(allRespondents.length, 1))})
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
