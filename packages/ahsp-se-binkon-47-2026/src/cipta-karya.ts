import type { FixedCoefficientItem } from '@ahs-id/core';

import ciptaKaryaItems from '../data/cipta-karya/items.json' with { type: 'json' };

export const ahspItems = ciptaKaryaItems as unknown as readonly FixedCoefficientItem[];
