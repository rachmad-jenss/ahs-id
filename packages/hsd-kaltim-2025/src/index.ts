import type { HsdRegional } from '@ahs-id/core';

import hsdData from '../data/hsd.json' with { type: 'json' };

export const hsd = hsdData as unknown as HsdRegional;
