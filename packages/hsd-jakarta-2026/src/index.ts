import { brandHsdRegional } from '@ahs-id/core';

import hsdData from '../data/hsd.json' with { type: 'json' };

export const hsd = brandHsdRegional(hsdData);
