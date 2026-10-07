"use client";

import { useEffect, useState } from "react";
import { membersByRegion } from "@/lib/iofs/members";
import { useTranslation } from "./translation-context";

/**
 * A native `<select>` can't take `<T>` as children the way the rest of the
 * page does — `<option>`/`<optgroup>` labels are plain-string attributes,
 * not renderable children, so each one can't own its own translation hook
 * (hooks can't run inside a `.map()`). Instead this resolves every label the
 * dropdown needs (the field label, 5 region names, 43 country names) in one
 * batch through the shared `translate()` function, and falls back to the
 * English source for anything not yet resolved.
 */
export function MemberSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso3: string) => void;
}) {
  const { lang, translate } = useTranslation();
  const groups = membersByRegion();
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lang === "en") return;
    let cancelled = false;
    const texts = [
      "IOFS member country",
      ...groups.map((g) => g.region),
      ...groups.flatMap((g) => g.members.map((m) => m.name)),
    ];
    Promise.all(texts.map((text) => translate(text).then((t) => [text, t] as const))).then(
      (pairs) => {
        if (!cancelled) setLabels(Object.fromEntries(pairs));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, translate]);

  const tr = (text: string) => (lang === "en" ? text : (labels[text] ?? text));

  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{tr("IOFS member country")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-(--radius-control) border border-border bg-surface-panel px-3 py-2 text-sm font-medium text-ink shadow-(--elevation-flat) focus:outline-2 focus:outline-accent"
      >
        {groups.map(({ region, members }) => (
          <optgroup key={region} label={tr(region)}>
            {members.map((m) => (
              <option key={m.iso3} value={m.iso3}>
                {m.flag} {tr(m.name)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
