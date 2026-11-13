import type { FixedCoefficientItem } from '@ahs-id/core';

import binaMargaItems from '../data/bina-marga/items.json' with { type: 'json' };

export const ahspItems = binaMargaItems as unknown as readonly FixedCoefficientItem[];
