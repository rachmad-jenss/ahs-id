import type { FixedCoefficientItem } from '@ahs-id/core';

import sdaItems from '../data/sda/items.json' with { type: 'json' };

export const ahspItems = sdaItems as unknown as readonly FixedCoefficientItem[];
