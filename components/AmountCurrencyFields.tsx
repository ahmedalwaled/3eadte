"use client";

import { useState } from "react";
import { currencyLabel, money, type ClinicCurrency } from "@/lib/format";

export default function AmountCurrencyFields({
  idPrefix,
  base,
  currencies = [],
  defaultValue,
  label = "المبلغ",
}: {
  idPrefix: string;
  base: string;
  currencies?: ClinicCurrency[];
  defaultValue?: number;
  label?: string;
}) {
  const options: ClinicCurrency[] = [{ code: base, rate: 1 }, ...currencies.filter((item) => item.code !== base)];
  const [code, setCode] = useState(base);
  const [amount, setAmount] = useState(defaultValue && defaultValue > 0 ? String(defaultValue) : "");
  const rate = options.find((item) => item.code === code)?.rate ?? 1;
  const converted = Number(amount) * rate;

  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-amount`}>
          {label}
        </label>
        <input
          id={`${idPrefix}-amount`}
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          inputMode="decimal"
          className="input"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      {options.length > 1 ? (
        <div>
          <label className="label" htmlFor={`${idPrefix}-currency`}>
            العملة
          </label>
          <select id={`${idPrefix}-currency`} name="currency" className="input" value={code} onChange={(event) => setCode(event.target.value)}>
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {currencyLabel(option.code)}
                {option.code === base ? " — الأساسية" : ` — 1 = ${option.rate} ${base}`}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="currency" value={base} />
      )}
      {code !== base && converted > 0 ? (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-800 sm:col-span-2">
          يعادل {money(converted, base)} بسعر الصرف المسجل (1 {code} = {rate} {base})
        </p>
      ) : null}
    </>
  );
}
