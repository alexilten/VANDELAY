import type { AduInput } from '../../adu.ts';
import type { Region } from '../../types.ts';
import { US_CA_ADU_RULES } from './adu-rules.ts';

export * from './adu-rules.ts';
export * from './citations.ts';

/**
 * California, state baseline only. City and county ordinances plug in as
 * child regions (`parent: 'us-ca'`) that add `local` rules or supply
 * `LocalStandards`; they are not loaded yet.
 */
export const US_CA: Region<AduInput> = {
  id: 'us-ca',
  name: 'California (state ADU law)',
  coverage:
    'State ADU baseline (Gov. Code §§ 66313–66333). Local ordinances not loaded: enter local setbacks, height, coverage and size limits as LocalStandards.',
  rules: US_CA_ADU_RULES,
};
