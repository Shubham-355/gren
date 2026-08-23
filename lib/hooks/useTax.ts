"use client";

import { useMemo } from "react";

import { useAppStore, toTaxpayerInput } from "@/lib/store/useAppStore";
import {
  breakEvenDeductions,
  compareRegimes,
  computeHouseProperty,
  computeHraExemption,
  computeTax,
} from "@/lib/tax/compute";

/**
 * One computation, shared by every screen. Recomputed from the store on each
 * change, so a number the copilot alters on one page is already correct by the
 * time you navigate to another.
 */
export function useTax() {
  const state = useAppStore();

  return useMemo(() => {
    const input = toTaxpayerInput(state);
    const current = computeTax(input);
    const comparison = compareRegimes(input);
    const hra = computeHraExemption({
      basic: state.salary.basic,
      hraReceived: state.salary.hra,
      rentPaidAnnual: state.hra.rentPaidAnnual,
      metroCity: state.hra.metroCity,
    });
    const houseProperty = computeHouseProperty(
      input.houseProperty,
      state.regime,
    );

    return {
      input,
      current,
      comparison,
      hra,
      houseProperty,
      breakEven: breakEvenDeductions(input),
    };
    // The whole state object is the dependency: any field can move a number.
  }, [state]);
}
