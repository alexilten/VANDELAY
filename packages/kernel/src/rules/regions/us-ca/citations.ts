/**
 * California statutes the ADU rules rely on.
 *
 * How these were checked (2026-11-01): the official site
 * leginfo.legislature.ca.gov was not reachable from the build environment, so
 * the section text was read on public mirrors of the official code
 * (california.public.law, gocodebook.com, law.justia.com) and cross-checked
 * against Los Angeles County Planning's SB 543 memo. That makes every entry
 * `secondary`. Before launch, re-read each section on leginfo and flip it to
 * `primary` (see docs/RULES.md).
 *
 * Background: the state ADU law was moved from Gov. Code § 65852.2 / 65852.22
 * into Chapter 13 (§§ 66310–66342) by SB 477 (2024), operative 2025-01-01,
 * and amended by SB 543 (Stats. 2025, ch. 520), operative 2026-01-01.
 */
import type { Citation } from '../../types.ts';

const leginfo = (section: string): string =>
  `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=${section}.`;

const base = {
  jurisdiction: 'State of California',
  code: 'Cal. Gov. Code',
  verification: 'secondary',
  checkedOn: '2026-11-01',
  version: 'as amended by SB 543 (Stats. 2025, ch. 520), operative 2026-01-01',
} as const;

export const GOV_66313_D: Citation = {
  ...base,
  id: 'us-ca.gov.66313.d',
  section: '§ 66313(d)',
  title: 'Definition of junior accessory dwelling unit (500 sq ft of interior livable space, entirely within a single-family residence)',
  url: leginfo('66313'),
  readAt: 'https://california.public.law/codes/government_code_section_66313',
};

export const GOV_66314_D2: Citation = {
  ...base,
  id: 'us-ca.gov.66314.d2',
  section: '§ 66314(d)(2)',
  title: 'Lot zoned single-family or multifamily residential, with a proposed or existing dwelling',
  url: leginfo('66314'),
  readAt: 'https://california.public.law/codes/government_code_section_66314',
};

export const GOV_66314_D4: Citation = {
  ...base,
  id: 'us-ca.gov.66314.d4',
  section: '§ 66314(d)(4)',
  title: 'Attached ADU: total floor area not more than 50% of the existing primary dwelling',
  url: leginfo('66314'),
  readAt: 'https://california.public.law/codes/government_code_section_66314',
};

export const GOV_66314_D5: Citation = {
  ...base,
  id: 'us-ca.gov.66314.d5',
  section: '§ 66314(d)(5)',
  title: 'Detached ADU: total floor area not more than 1,200 sq ft',
  url: leginfo('66314'),
  readAt: 'https://california.public.law/codes/government_code_section_66314',
};

export const GOV_66314_D7: Citation = {
  ...base,
  id: 'us-ca.gov.66314.d7',
  section: '§ 66314(d)(7)',
  title: 'Setbacks: none for existing space or same-footprint replacement; otherwise side and rear setbacks of no more than 4 ft',
  url: leginfo('66314'),
  readAt: 'https://california.public.law/codes/government_code_section_66314',
};

export const GOV_66321_B2: Citation = {
  ...base,
  id: 'us-ca.gov.66321.b2',
  section: '§ 66321(b)(2)',
  title: 'Local maximum size may not be below 850 sq ft, or 1,000 sq ft for more than one bedroom (interior livable space)',
  url: leginfo('66321'),
  readAt: 'https://california.public.law/codes/government_code_section_66321',
};

export const GOV_66321_B3: Citation = {
  ...base,
  id: 'us-ca.gov.66321.b3',
  section: '§ 66321(b)(3)',
  title: 'Lot coverage, FAR, open space, front setback and size limits may not block an 800 sq ft ADU with 4 ft side and rear setbacks',
  url: leginfo('66321'),
  readAt: 'https://california.public.law/codes/government_code_section_66321',
};

export const GOV_66321_B4: Citation = {
  ...base,
  id: 'us-ca.gov.66321.b4',
  section: '§ 66321(b)(4)',
  title: 'Minimum height limits a local agency must allow: 16 / 18 / 18 (+2) ft detached, 25 ft or zone height attached',
  url: leginfo('66321'),
  readAt: 'https://california.public.law/codes/government_code_section_66321',
};

export const GOV_66323_A1: Citation = {
  ...base,
  id: 'us-ca.gov.66323.a1',
  section: '§ 66323(a)(1)',
  title: 'Ministerial approval: one ADU and one JADU within existing or proposed space of a single-family lot (expansion up to 150 sq ft)',
  url: leginfo('66323'),
  readAt: 'https://gocodebook.com/library/us/ca/ca-gov/sections/66323',
};

export const GOV_66323_A2: Citation = {
  ...base,
  id: 'us-ca.gov.66323.a2',
  section: '§ 66323(a)(2)',
  title: 'Ministerial approval: one detached new-construction ADU, 4 ft side and rear setbacks, up to 800 sq ft, height per § 66321(b)(4)(A)–(C)',
  url: leginfo('66323'),
  readAt: 'https://gocodebook.com/library/us/ca/ca-gov/sections/66323',
};

export const GOV_66333: Citation = {
  ...base,
  id: 'us-ca.gov.66333',
  section: '§ 66333(a), (d)',
  title: 'JADU: one per single-family lot, built within the walls of the single-family residence',
  url: leginfo('66333'),
  readAt: "https://california.public.law/codes/ca_gov't_code_section_66333",
};

export const LA_COUNTY_SB543_MEMO: Citation = {
  id: 'us-ca.la-county.sb543-memo',
  jurisdiction: 'County of Los Angeles',
  code: 'LA County Planning',
  section: 'SB 543 memo, Attachment A',
  title: 'Summary of SB 543 (2025) changes: sizes measured as interior livable space; JADU 500 sq ft',
  url: 'https://planning.lacounty.gov/wp-content/uploads/2025/12/ADU_memo_sb543_attachmentA.pdf',
  verification: 'secondary',
  checkedOn: '2026-11-01',
  note: 'Agency summary, used only to confirm what SB 543 changed. Not law.',
};

export const US_CA_CITATIONS: readonly Citation[] = [
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
];
