/**
 * California state ADU baseline (Gov. Code Chapter 13, §§ 66310–66342).
 *
 * Most of this law tells cities what they must ALLOW, not what owners must do.
 * So a "state-floor" rule passes anything inside the state guarantee and says
 * `review` above it unless a local value is supplied, because the local code
 * then decides. "state-cap" rules are outer limits and can `fail`.
 *
 * Every number below is copied from the cited subdivision. Where a result
 * depends on how two provisions combine and no agency text was checked, the
 * result lists that reading under `interpretations`.
 */
import type { AduInput } from '../../adu.ts';
import {
  atLeast,
  atMost,
  cite,
  EPS_MM,
  EPS_MM2,
  fmtFt,
  fmtPct,
  fmtSqft,
  ft,
  sqft,
  type CheckResult,
  type Citation,
  type Rule,
  type RuleStatus,
} from '../../types.ts';
import {
  GOV_66313_D,
  GOV_66314_D2,
  GOV_66314_D4,
  GOV_66314_D5,
  GOV_66314_D7,
  GOV_66321_B2,
  GOV_66321_B3,
  GOV_66321_B4,
  GOV_66323_A1,
  GOV_66323_A2,
  GOV_66333,
  LA_COUNTY_SB543_MEMO,
} from './citations.ts';

const REGION = 'us-ca';

// ── numbers from the statute ─────────────────────────────────────────────────

/** § 66321(b)(4)(A) */
export const CA_DETACHED_HEIGHT = ft(16);
/** § 66321(b)(4)(B), (C) */
export const CA_DETACHED_HEIGHT_TRANSIT_OR_MULTISTORY = ft(18);
/** § 66321(b)(4)(B): two additional feet to match the primary dwelling's roof pitch. */
export const CA_ROOF_PITCH_BONUS = ft(2);
/** § 66321(b)(4)(D) */
export const CA_ATTACHED_HEIGHT = ft(25);
/** § 66321(b)(4)(D): a local agency need not allow more than two stories. */
export const CA_ATTACHED_MAX_STORIES_GUARANTEED = 2;
/** § 66314(d)(5) */
export const CA_DETACHED_MAX_TOTAL_AREA = sqft(1200);
/** § 66314(d)(4) */
export const CA_ATTACHED_MAX_FRACTION_OF_PRIMARY = 0.5;
/** § 66321(b)(2) */
export const CA_SIZE_FLOOR = sqft(850);
/** § 66321(b)(2), more than one bedroom */
export const CA_SIZE_FLOOR_MULTI_BEDROOM = sqft(1000);
/** § 66321(b)(3), § 66323(a)(2) */
export const CA_PROTECTED_ADU_AREA = sqft(800);
/** § 66314(d)(7), § 66321(b)(3), § 66323(a)(2) */
export const CA_MAX_SIDE_REAR_SETBACK = ft(4);
/** § 66323(a)(1) */
export const CA_CONVERSION_MAX_EXPANSION = sqft(150);
/** § 66313(d) */
export const CA_JADU_MAX_AREA = sqft(500);

// ── helpers ──────────────────────────────────────────────────────────────────

const result = (
  ruleId: string,
  status: RuleStatus,
  message: string,
  why: string,
  citations: readonly Citation[],
  extra: Partial<Pick<CheckResult, 'measured' | 'limit' | 'unit' | 'interpretations'>> = {},
): CheckResult => ({ ruleId, status, message, why, citations, interpretations: [], ...extra });

const na = (ruleId: string, message: string, citations: readonly Citation[]): CheckResult =>
  result(ruleId, 'n/a', message, 'This rule only covers other kinds of ADU or lot.', citations);

const isNewConstruction = (i: AduInput): boolean => i.adu.kind === 'detached' || i.adu.kind === 'attached';
const totalArea = (i: AduInput): number => i.adu.totalFloorArea ?? i.adu.interiorLivableArea;
const sizeFloor = (bedrooms: number): number => (bedrooms > 1 ? CA_SIZE_FLOOR_MULTI_BEDROOM : CA_SIZE_FLOOR);

/**
 * The detached height a California city must allow on this lot, per
 * § 66321(b)(4)(A)–(C). `unknownTransit` is true when the answer could rise
 * if the lot turned out to be near transit.
 */
export const caDetachedHeightAllowance = (i: AduInput): { limit: number; basis: string; unknownTransit: boolean } => {
  let limit = CA_DETACHED_HEIGHT;
  let basis = '16 ft for a detached ADU (subparagraph (A))';
  if (i.lot.primary === 'multifamily' && i.lot.primaryMultistory) {
    limit = CA_DETACHED_HEIGHT_TRANSIT_OR_MULTISTORY;
    basis = '18 ft on a lot with a multistory multifamily dwelling (subparagraph (C))';
  }
  if (i.lot.nearTransit === true) {
    const t = CA_DETACHED_HEIGHT_TRANSIT_OR_MULTISTORY + (i.lot.roofPitchMatchesPrimary ? CA_ROOF_PITCH_BONUS : 0);
    if (t > limit) {
      limit = t;
      basis = i.lot.roofPitchMatchesPrimary
        ? '18 ft plus 2 ft to match the main home’s roof pitch, within ½ mile of major transit (subparagraph (B))'
        : '18 ft within ½ mile walking distance of major transit (subparagraph (B))';
    }
  }
  return { limit, basis, unknownTransit: i.lot.nearTransit === undefined };
};

/** § 66321(b)(3): the ADU is no bigger than the size the state protects, with 4 ft side and rear clearance. */
const isProtected800 = (i: AduInput): boolean => {
  const c = i.adu.clearances;
  return (
    isNewConstruction(i) &&
    atMost(i.adu.interiorLivableArea, CA_PROTECTED_ADU_AREA, EPS_MM2) &&
    c?.side !== undefined &&
    c.rear !== undefined &&
    atLeast(c.side, CA_MAX_SIDE_REAR_SETBACK, EPS_MM) &&
    atLeast(c.rear, CA_MAX_SIDE_REAR_SETBACK, EPS_MM)
  );
};

/** ["a"] → "a"; ["a","b"] → "a and b"; ["a","b","c"] → "a, b, and c". */
const listJoin = (xs: readonly string[]): string =>
  xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}`;

// ── rules ────────────────────────────────────────────────────────────────────

type CaRule = Rule<AduInput>;

export const lotEligibility: CaRule = {
  id: 'us-ca.adu.eligibility.lot',
  region: REGION,
  topic: 'eligibility',
  kind: 'state-cap',
  title: 'Lot can have an ADU',
  summary: 'An ADU needs a lot zoned for residential (or, for ministerial approval, mixed) use with an existing or proposed home on it.',
  citations: [GOV_66314_D2, GOV_66323_A2],
  check: (i) => {
    const cites = lotEligibility.citations;
    if (i.lot.primary === 'none') {
      return result(lotEligibility.id, 'fail', 'An ADU needs a main home on the lot, existing or proposed.', `${cite(GOV_66314_D2)} requires a proposed or existing dwelling on the lot.`, cites);
    }
    if (i.lot.zoning === 'other') {
      return result(
        lotEligibility.id,
        'review',
        'This zone may not allow ADUs. Check the local zoning.',
        `${cite(GOV_66314_D2)} covers lots zoned single-family or multifamily residential, and § 66323(a) adds residential and mixed-use zones. Other zones depend on local code.`,
        cites,
      );
    }
    return result(lotEligibility.id, 'pass', 'The lot’s zoning and main home allow an ADU under state law.', `${cite(GOV_66314_D2)}: the lot is zoned ${i.lot.zoning} with ${i.lot.primaryExists ? 'an existing' : 'a proposed'} ${i.lot.primary} home.`, cites);
  },
};

export const detachedHeight: CaRule = {
  id: 'us-ca.adu.height.detached',
  region: REGION,
  topic: 'height',
  kind: 'state-floor',
  title: 'Detached ADU height',
  summary: 'Cities must allow a detached ADU at least 16 ft tall, 18 ft near major transit or beside a multistory apartment building, plus 2 ft near transit to match the main roof pitch.',
  citations: [GOV_66321_B4],
  check: (i) => {
    if (i.adu.kind !== 'detached') return na(detachedHeight.id, 'Only applies to detached ADUs.', detachedHeight.citations);
    const h = i.adu.height;
    if (h === undefined) return result(detachedHeight.id, 'review', 'Height not known yet.', 'The height has not been calculated, so it cannot be checked.', detachedHeight.citations);
    const { limit, basis, unknownTransit } = caDetachedHeightAllowance(i);
    const local = i.local?.maxHeight;
    const unit = { measured: h, unit: 'mm' as const };
    const stateWhy = `${cite(GOV_66321_B4)} says a city may not set a lower limit than ${basis}.`;
    if (atMost(h, limit, EPS_MM)) {
      return result(detachedHeight.id, 'pass', `${fmtFt(h)} tall, within the ${fmtFt(limit)} every California city must allow.`, stateWhy, detachedHeight.citations, { ...unit, limit });
    }
    if (local !== undefined && local > limit) {
      return atMost(h, local, EPS_MM)
        ? result(detachedHeight.id, 'pass', `${fmtFt(h)} tall, within the local ${fmtFt(local)} limit.`, `${stateWhy} The local limit of ${fmtFt(local)} is more generous, so it governs.`, detachedHeight.citations, { ...unit, limit: local })
        : result(detachedHeight.id, 'fail', `${fmtFt(h)} tall, over the local ${fmtFt(local)} limit.`, `${stateWhy} The local limit is ${fmtFt(local)}, and this design is taller than both.`, detachedHeight.citations, { ...unit, limit: local });
    }
    if (unknownTransit && atMost(h, CA_DETACHED_HEIGHT_TRANSIT_OR_MULTISTORY + CA_ROOF_PITCH_BONUS, EPS_MM)) {
      return result(
        detachedHeight.id,
        'review',
        `${fmtFt(h)} tall. That's allowed only if the lot is within ½ mile of major transit.`,
        `${stateWhy} Within ½ mile walking distance of a major transit stop or high-quality transit corridor the guarantee rises to 18 ft, plus 2 ft to match the roof pitch (subparagraph (B)). We don't know yet whether this lot qualifies.`,
        detachedHeight.citations,
        { ...unit, limit },
      );
    }
    if (local !== undefined) {
      return result(detachedHeight.id, 'fail', `${fmtFt(h)} tall, over the ${fmtFt(limit)} allowed here.`, `${stateWhy} The local limit (${fmtFt(local)}) is not higher, so ${fmtFt(limit)} governs.`, detachedHeight.citations, { ...unit, limit });
    }
    return result(
      detachedHeight.id,
      'review',
      `${fmtFt(h)} tall, above the ${fmtFt(limit)} state guarantee. The local code decides.`,
      `${stateWhy} Anything taller depends on the city's own limit, which we don't have yet.`,
      detachedHeight.citations,
      { ...unit, limit },
    );
  },
};

export const attachedHeight: CaRule = {
  id: 'us-ca.adu.height.attached',
  region: REGION,
  topic: 'height',
  kind: 'state-floor',
  title: 'Attached ADU height',
  summary: 'Cities must allow an attached ADU up to 25 ft or the zone’s height limit for the main home, whichever is lower, but need not allow more than two stories.',
  citations: [GOV_66321_B4],
  check: (i) => {
    if (i.adu.kind !== 'attached') return na(attachedHeight.id, 'Only applies to attached ADUs.', attachedHeight.citations);
    const h = i.adu.height;
    if (h === undefined) return result(attachedHeight.id, 'review', 'Height not known yet.', 'The height has not been calculated, so it cannot be checked.', attachedHeight.citations);
    const zone = i.local?.primaryZoneHeight;
    const why = `${cite(GOV_66321_B4, '(D)')} requires cities to allow an attached ADU up to 25 ft or the zone's height limit for the main home, whichever is lower. Cities don't have to allow more than two stories.`;
    if (i.adu.stories !== undefined && i.adu.stories > CA_ATTACHED_MAX_STORIES_GUARANTEED) {
      return result(attachedHeight.id, 'review', `${i.adu.stories} stories. State law only guarantees two, so the local code decides.`, why, attachedHeight.citations, { measured: i.adu.stories, limit: 2, unit: 'count' });
    }
    if (zone === undefined) {
      const local = i.local?.maxHeight;
      if (local !== undefined && atMost(h, local, EPS_MM)) {
        return result(attachedHeight.id, 'pass', `${fmtFt(h)} tall, within the local ${fmtFt(local)} limit.`, why, attachedHeight.citations, { measured: h, limit: local, unit: 'mm' });
      }
      return result(attachedHeight.id, 'review', `${fmtFt(h)} tall. We need the zone's height limit to confirm.`, `${why} We don't have the zone's height limit yet.`, attachedHeight.citations, { measured: h, unit: 'mm' });
    }
    const limit = Math.min(CA_ATTACHED_HEIGHT, zone);
    if (atMost(h, limit, EPS_MM)) {
      return result(attachedHeight.id, 'pass', `${fmtFt(h)} tall, within the ${fmtFt(limit)} allowed for attached ADUs here.`, why, attachedHeight.citations, { measured: h, limit, unit: 'mm' });
    }
    return result(attachedHeight.id, 'fail', `${fmtFt(h)} tall, over the ${fmtFt(limit)} limit for attached ADUs here.`, why, attachedHeight.citations, { measured: h, limit, unit: 'mm' });
  },
};

export const detachedSizeCap: CaRule = {
  id: 'us-ca.adu.size.detached-cap',
  region: REGION,
  topic: 'size',
  kind: 'state-cap',
  title: 'Detached ADU size cap',
  summary: 'A detached ADU’s total floor area may not exceed 1,200 sq ft.',
  citations: [GOV_66314_D5],
  check: (i) => {
    if (i.adu.kind !== 'detached') return na(detachedSizeCap.id, 'Only applies to detached ADUs.', detachedSizeCap.citations);
    const a = totalArea(i);
    const ok = atMost(a, CA_DETACHED_MAX_TOTAL_AREA, EPS_MM2);
    return result(
      detachedSizeCap.id,
      ok ? 'pass' : 'fail',
      ok ? `${fmtSqft(a)}, within the 1,200 sq ft cap.` : `${fmtSqft(a)}, over the 1,200 sq ft cap for detached ADUs.`,
      `${cite(GOV_66314_D5)} caps the total floor area of a detached ADU at 1,200 sq ft.`,
      detachedSizeCap.citations,
      { measured: a, limit: CA_DETACHED_MAX_TOTAL_AREA, unit: 'mm2' },
    );
  },
};

export const attachedSizeCap: CaRule = {
  id: 'us-ca.adu.size.attached-cap',
  region: REGION,
  topic: 'size',
  kind: 'state-cap',
  title: 'Attached ADU size cap',
  summary: 'With an existing main home, an attached ADU may not exceed 50% of its floor area, but cities must still allow at least 850 sq ft, or 1,000 sq ft with more than one bedroom.',
  citations: [GOV_66314_D4, GOV_66321_B2],
  check: (i) => {
    if (i.adu.kind !== 'attached') return na(attachedSizeCap.id, 'Only applies to attached ADUs.', attachedSizeCap.citations);
    if (!i.lot.primaryExists) {
      return result(attachedSizeCap.id, 'n/a', 'The 50% cap only applies when the main home already exists.', `${cite(GOV_66314_D4)} only applies when there is an existing primary dwelling.`, attachedSizeCap.citations);
    }
    const floor = sizeFloor(i.adu.bedrooms);
    const interp = [
      'We read § 66321(b)(2) to mean the 50% cap can never bring the allowed size below 850 sq ft (or 1,000 sq ft with more than one bedroom). An agency or court has not confirmed this reading. Unverified.',
    ];
    const a = totalArea(i);
    const p = i.lot.primaryFloorArea;
    if (p === undefined) {
      if (atMost(i.adu.interiorLivableArea, floor, EPS_MM2)) {
        return result(attachedSizeCap.id, 'pass', `${fmtSqft(i.adu.interiorLivableArea)}, within the ${fmtSqft(floor)} every city must allow.`, `${cite(GOV_66321_B2)} bars a local maximum below ${fmtSqft(floor)} of interior livable space.`, attachedSizeCap.citations, { measured: i.adu.interiorLivableArea, limit: floor, unit: 'mm2', interpretations: interp });
      }
      return result(attachedSizeCap.id, 'review', 'We need the main home’s floor area to check the 50% cap.', `${cite(GOV_66314_D4)} limits an attached ADU to 50% of the existing home's floor area.`, attachedSizeCap.citations, { measured: a, unit: 'mm2' });
    }
    const half = p * CA_ATTACHED_MAX_FRACTION_OF_PRIMARY;
    const okHalf = atMost(a, half, EPS_MM2);
    const okFloor = atMost(i.adu.interiorLivableArea, floor, EPS_MM2);
    const why = `${cite(GOV_66314_D4)} caps an attached ADU at 50% of the existing home (${fmtSqft(p)} → ${fmtSqft(half)}). ${cite(GOV_66321_B2)} bars any local maximum below ${fmtSqft(floor)} of interior livable space.`;
    if (okHalf) return result(attachedSizeCap.id, 'pass', `${fmtSqft(a)}, within 50% of the main home (${fmtSqft(half)}).`, why, attachedSizeCap.citations, { measured: a, limit: half, unit: 'mm2' });
    if (okFloor) return result(attachedSizeCap.id, 'pass', `${fmtSqft(i.adu.interiorLivableArea)}. That's over 50% of the main home, but within the ${fmtSqft(floor)} every city must allow.`, why, attachedSizeCap.citations, { measured: i.adu.interiorLivableArea, limit: floor, unit: 'mm2', interpretations: interp });
    return result(attachedSizeCap.id, 'fail', `${fmtSqft(a)}, over 50% of the main home (${fmtSqft(half)}) and over ${fmtSqft(floor)}.`, why, attachedSizeCap.citations, { measured: a, limit: Math.max(half, floor), unit: 'mm2', interpretations: interp });
  },
};

export const localSizeLimit: CaRule = {
  id: 'us-ca.adu.size.local-max',
  region: REGION,
  topic: 'size',
  kind: 'state-floor',
  title: 'Local ADU size limit',
  summary: 'A city may set a maximum ADU size, but not below 850 sq ft, or 1,000 sq ft with more than one bedroom (interior livable space).',
  citations: [GOV_66321_B2, LA_COUNTY_SB543_MEMO],
  check: (i) => {
    if (!isNewConstruction(i)) return na(localSizeLimit.id, 'Only applies to new detached or attached ADUs.', localSizeLimit.citations);
    const local = i.local?.maxAduArea;
    if (local === undefined) return result(localSizeLimit.id, 'n/a', 'No local size limit entered.', 'Without a local maximum, only the state caps apply.', localSizeLimit.citations);
    const floor = sizeFloor(i.adu.bedrooms);
    const limit = Math.max(local, floor);
    const a = i.adu.interiorLivableArea;
    const raised = limit > local ? ` The local limit (${fmtSqft(local)}) is below that, so ${fmtSqft(floor)} applies instead.` : '';
    const why = `${cite(GOV_66321_B2)} bars a local maximum below ${fmtSqft(floor)} of interior livable space${i.adu.bedrooms > 1 ? ' for an ADU with more than one bedroom' : ''}.${raised}`;
    const ok = atMost(a, limit, EPS_MM2);
    return result(localSizeLimit.id, ok ? 'pass' : 'fail', ok ? `${fmtSqft(a)}, within the ${fmtSqft(limit)} allowed here.` : `${fmtSqft(a)}, over the ${fmtSqft(limit)} allowed here.`, why, localSizeLimit.citations, { measured: a, limit, unit: 'mm2' });
  },
};

const sideRearSetback = (side: 'side' | 'rear'): CaRule => {
  const r: CaRule = {
  id: `us-ca.adu.setback.${side}`,
  region: REGION,
  topic: 'setback',
  kind: 'state-floor',
  title: side === 'side' ? 'Side setback' : 'Rear setback',
  summary: `A city may not require more than 4 ft between a new ADU and the ${side} lot line, and none for a conversion of existing space.`,
  citations: [GOV_66314_D7],
  check: (i) => {
    if (i.adu.kind === 'jadu') return na(r.id, 'A JADU is inside the house, so there is no separate setback.', r.citations);
    if (i.adu.kind === 'conversion') {
      return result(r.id, 'pass', 'No setback needed when converting existing space.', `${cite(GOV_66314_D7)}: no setback is required for an existing living area or accessory structure, or for one rebuilt in the same location and to the same dimensions.`, r.citations);
    }
    const d = i.adu.clearances?.[side];
    if (d === undefined) return result(r.id, 'review', `Distance to the ${side} lot line not known yet.`, 'The placement has not been calculated, so it cannot be checked.', r.citations);
    const local = i.local?.setbacks?.[side];
    const limit = local === undefined ? CA_MAX_SIDE_REAR_SETBACK : Math.min(local, CA_MAX_SIDE_REAR_SETBACK);
    const capped = local !== undefined && local > CA_MAX_SIDE_REAR_SETBACK ? ` The local ${fmtFt(local)} setback can't be applied to an ADU.` : '';
    const why = `${cite(GOV_66314_D7)}: a city may require no more than 4 ft from the ${side} lot line.${capped}`;
    if (atLeast(d, limit, EPS_MM)) {
      return result(r.id, 'pass', `${fmtFt(d)} from the ${side} lot line. The most a city can require is ${fmtFt(limit)}.`, why, r.citations, { measured: d, limit, unit: 'mm' });
    }
    if (local === undefined) {
      return result(r.id, 'review', `${fmtFt(d)} from the ${side} lot line. That works only if the local setback is ${fmtFt(d)} or less.`, `${why} We don't have the local setback, which can be anywhere from 0 to 4 ft.`, r.citations, { measured: d, limit, unit: 'mm' });
    }
    return result(r.id, 'fail', `${fmtFt(d)} from the ${side} lot line, closer than the ${fmtFt(limit)} required.`, why, r.citations, { measured: d, limit, unit: 'mm' });
  },
  };
  return r;
};

export const sideSetback = sideRearSetback('side');
export const rearSetback = sideRearSetback('rear');

export const frontSetback: CaRule = {
  id: 'us-ca.adu.setback.front',
  region: REGION,
  topic: 'setback',
  kind: 'local',
  title: 'Front setback',
  summary: 'Front setbacks are local, but a city may not use one to block an 800 sq ft ADU with 4 ft side and rear setbacks.',
  citations: [GOV_66321_B3],
  check: (i) => {
    if (!isNewConstruction(i)) return na(frontSetback.id, 'Only applies to new detached or attached ADUs.', frontSetback.citations);
    const local = i.local?.setbacks?.front;
    const d = i.adu.clearances?.front;
    if (local === undefined) return result(frontSetback.id, 'n/a', 'No local front setback entered.', 'Front setbacks come from local code. State law sets no number.', frontSetback.citations);
    if (d === undefined) return result(frontSetback.id, 'review', 'Distance to the front lot line not known yet.', 'The placement has not been calculated, so it cannot be checked.', frontSetback.citations);
    if (atLeast(d, local, EPS_MM)) {
      return result(frontSetback.id, 'pass', `${fmtFt(d)} from the front lot line, meeting the ${fmtFt(local)} local setback.`, `The local front setback is ${fmtFt(local)}${i.local?.source ? ` (${i.local.source})` : ''}.`, frontSetback.citations, { measured: d, limit: local, unit: 'mm' });
    }
    if (isProtected800(i)) {
      return result(
        frontSetback.id,
        'review',
        `${fmtFt(d)} from the front, inside the ${fmtFt(local)} setback. This is allowed only if the setback would otherwise rule out an 800 sq ft ADU here.`,
        `${cite(GOV_66321_B3)} bars front setbacks that would prevent an ADU of up to 800 sq ft with 4 ft side and rear setbacks. If an ADU fits elsewhere on the lot, the setback still applies.`,
        frontSetback.citations,
        { measured: d, limit: local, unit: 'mm', interpretations: ['Whether the front setback must give way depends on whether an 800 sq ft ADU fits anywhere else on the lot. We have not checked that yet.'] },
      );
    }
    return result(frontSetback.id, 'fail', `${fmtFt(d)} from the front lot line, inside the ${fmtFt(local)} local setback.`, `The local front setback is ${fmtFt(local)}. The § 66321(b)(3) exception only protects ADUs of up to 800 sq ft with 4 ft side and rear setbacks.`, frontSetback.citations, { measured: d, limit: local, unit: 'mm' });
  },
};

export const lotCoverage: CaRule = {
  id: 'us-ca.adu.coverage',
  region: REGION,
  topic: 'coverage',
  kind: 'local',
  title: 'Lot coverage',
  summary: 'Lot coverage limits are local, but may not prevent an 800 sq ft ADU with 4 ft side and rear setbacks.',
  citations: [GOV_66321_B3],
  check: (i) => {
    if (!isNewConstruction(i)) return na(lotCoverage.id, 'Only applies to new detached or attached ADUs.', lotCoverage.citations);
    const max = i.local?.maxCoverage;
    if (max === undefined) return result(lotCoverage.id, 'n/a', 'No local lot coverage limit entered.', 'Lot coverage limits come from local code. State law sets no number.', lotCoverage.citations);
    const lot = i.lot.lotArea;
    const fp = i.adu.footprintArea;
    if (lot === undefined || fp === undefined) return result(lotCoverage.id, 'review', 'We need the lot area and ADU footprint to check coverage.', 'Coverage is building footprint ÷ lot area.', lotCoverage.citations);
    const ratio = ((i.lot.existingFootprint ?? 0) + fp) / lot;
    const why = `Coverage counts the footprint of every building on the lot. The local limit is ${fmtPct(max)}.`;
    if (ratio <= max + 1e-9) return result(lotCoverage.id, 'pass', `${fmtPct(ratio)} of the lot covered, within the ${fmtPct(max)} limit.`, why, lotCoverage.citations, { measured: ratio, limit: max, unit: 'ratio' });
    if (isProtected800(i)) {
      return result(
        lotCoverage.id,
        'pass',
        `${fmtPct(ratio)} covered, over the ${fmtPct(max)} limit. That's allowed because state law protects ADUs of up to 800 sq ft.`,
        `${why} But ${cite(GOV_66321_B3)} bars lot coverage limits that would prevent an ADU of up to 800 sq ft with 4 ft side and rear setbacks.`,
        lotCoverage.citations,
        { measured: ratio, limit: max, unit: 'ratio', interpretations: ['We read § 66321(b)(3) to exempt an ADU of up to 800 sq ft (interior livable space) with 4 ft side and rear setbacks from the coverage limit. Unverified for a two-story ADU whose footprint is smaller.'] },
      );
    }
    return result(lotCoverage.id, 'fail', `${fmtPct(ratio)} of the lot covered, over the ${fmtPct(max)} limit.`, `${why} The § 66321(b)(3) exception only protects ADUs of up to 800 sq ft with 4 ft side and rear setbacks.`, lotCoverage.citations, { measured: ratio, limit: max, unit: 'ratio' });
  },
};

export const byRightDetached: CaRule = {
  id: 'us-ca.adu.path.ministerial-detached',
  region: REGION,
  topic: 'approval-path',
  kind: 'state-floor',
  title: 'Fast-track approval (detached, up to 800 sq ft)',
  summary: 'A detached new ADU on a single-family lot with 4 ft side and rear setbacks, up to 800 sq ft, within the state height allowance must be approved ministerially, with no other local standards.',
  citations: [GOV_66323_A2, GOV_66321_B4],
  check: (i) => {
    if (i.adu.kind !== 'detached') return na(byRightDetached.id, 'Only applies to detached ADUs.', byRightDetached.citations);
    if (i.lot.primary !== 'single-family') return na(byRightDetached.id, 'This path is for single-family lots. Multifamily lots use § 66323(a)(4).', byRightDetached.citations);
    const misses: string[] = [];
    if (!atMost(i.adu.interiorLivableArea, CA_PROTECTED_ADU_AREA, EPS_MM2)) misses.push(`it is ${fmtSqft(i.adu.interiorLivableArea)} (the limit is 800 sq ft)`);
    const c = i.adu.clearances;
    if (c?.side === undefined || !atLeast(c.side, CA_MAX_SIDE_REAR_SETBACK, EPS_MM)) misses.push('it is less than 4 ft from a side lot line');
    if (c?.rear === undefined || !atLeast(c.rear, CA_MAX_SIDE_REAR_SETBACK, EPS_MM)) misses.push('it is less than 4 ft from the rear lot line');
    const { limit } = caDetachedHeightAllowance(i);
    if (i.adu.height === undefined || !atMost(i.adu.height, limit, EPS_MM)) misses.push(`it is taller than ${fmtFt(limit)}`);
    const why = `${cite(GOV_66323_A2)} requires cities to approve this kind of ADU ministerially (no hearing, no extra local standards) when it is up to 800 sq ft, has 4 ft side and rear setbacks, and fits the height in ${cite(GOV_66321_B4, '(A)–(C)')}.`;
    if (misses.length === 0) return result(byRightDetached.id, 'pass', 'Qualifies for California’s fast-track approval.', why, byRightDetached.citations);
    return result(byRightDetached.id, 'warn', `Doesn't qualify for fast-track approval because ${listJoin(misses)}. It can still go through the regular local process.`, why, byRightDetached.citations);
  },
};

export const byRightConversion: CaRule = {
  id: 'us-ca.adu.path.ministerial-conversion',
  region: REGION,
  topic: 'approval-path',
  kind: 'state-floor',
  title: 'Fast-track approval (conversion or JADU)',
  summary: 'An ADU or JADU within existing or proposed space on a single-family lot, adding no more than 150 sq ft beyond an existing accessory structure, must be approved ministerially.',
  citations: [GOV_66323_A1],
  check: (i) => {
    if (i.adu.kind !== 'conversion' && i.adu.kind !== 'jadu') return na(byRightConversion.id, 'Only applies to conversions and JADUs.', byRightConversion.citations);
    if (i.lot.primary !== 'single-family') return na(byRightConversion.id, 'This path is for single-family lots. Multifamily lots use § 66323(a)(3).', byRightConversion.citations);
    const why = `${cite(GOV_66323_A1)} requires ministerial approval of one ADU and one JADU within existing or proposed space on a single-family lot, with exterior access and side and rear setbacks sufficient for fire and safety. An accessory-structure conversion may add up to 150 sq ft, for ingress and egress only.`;
    const x = i.adu.expansionArea ?? 0;
    if (!atMost(x, CA_CONVERSION_MAX_EXPANSION, EPS_MM2)) {
      return result(byRightConversion.id, 'warn', `Adds ${fmtSqft(x)}, over the 150 sq ft allowed for fast-track approval.`, why, byRightConversion.citations, { measured: x, limit: CA_CONVERSION_MAX_EXPANSION, unit: 'mm2' });
    }
    return result(byRightConversion.id, 'pass', 'Qualifies for California’s fast-track approval, if it has its own exterior entrance.', why, byRightConversion.citations, { measured: x, limit: CA_CONVERSION_MAX_EXPANSION, unit: 'mm2' });
  },
};

export const jaduSize: CaRule = {
  id: 'us-ca.jadu.size',
  region: REGION,
  topic: 'size',
  kind: 'state-cap',
  title: 'Junior ADU size and location',
  summary: 'A JADU is at most 500 sq ft of interior livable space, entirely within a single-family residence, one per lot.',
  citations: [GOV_66313_D, GOV_66333, LA_COUNTY_SB543_MEMO],
  check: (i) => {
    if (i.adu.kind !== 'jadu') return na(jaduSize.id, 'Only applies to junior ADUs.', jaduSize.citations);
    if (i.lot.primary !== 'single-family') {
      return result(jaduSize.id, 'fail', 'A junior ADU must be inside a single-family home.', `${cite(GOV_66313_D)} and ${cite(GOV_66333)} limit JADUs to single-family residences.`, jaduSize.citations);
    }
    const a = i.adu.interiorLivableArea;
    const ok = atMost(a, CA_JADU_MAX_AREA, EPS_MM2);
    return result(
      jaduSize.id,
      ok ? 'pass' : 'fail',
      ok ? `${fmtSqft(a)}, within the 500 sq ft junior ADU limit.` : `${fmtSqft(a)}, over the 500 sq ft junior ADU limit. Consider a regular ADU instead.`,
      `${cite(GOV_66313_D)} defines a junior ADU as no more than 500 sq ft of interior livable space, entirely within a single-family residence.`,
      jaduSize.citations,
      { measured: a, limit: CA_JADU_MAX_AREA, unit: 'mm2' },
    );
  },
};

/** Run order is display order. */
export const US_CA_ADU_RULES: readonly CaRule[] = [
  lotEligibility,
  detachedHeight,
  attachedHeight,
  detachedSizeCap,
  attachedSizeCap,
  localSizeLimit,
  jaduSize,
  sideSetback,
  rearSetback,
  frontSetback,
  lotCoverage,
  byRightDetached,
  byRightConversion,
];
