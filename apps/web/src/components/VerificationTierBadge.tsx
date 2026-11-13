import type { VerificationTier } from '@ahs-id/core';
import { Badge } from '@/components/ui/badge';
import { VERIFICATION_TIER_LABELS } from '@/lib/library-packages';
import { cn } from '@/lib/utils';

const TIER_VARIANT: Record<
  VerificationTier,
  'tierAuto' | 'tierSpot' | 'tierVerified' | 'tierExecuted'
> = {
  'auto-extracted': 'tierAuto',
  'spot-checked': 'tierSpot',
  verified: 'tierVerified',
  executed: 'tierExecuted',
};

interface VerificationTierBadgeProps {
  readonly tier: VerificationTier;
  readonly className?: string;
  /** Lebih kecil untuk teks paragraf (inline). */
  readonly density?: 'default' | 'inline';
}

/** Status verifikasi data — warna per tier, konsisten di tabel & prose. */
export function VerificationTierBadge({
  tier,
  className,
  density = 'default',
}: VerificationTierBadgeProps): React.JSX.Element {
  return (
    <Badge
      className={cn(
        'shrink-0 whitespace-nowrap font-semibold',
        density === 'inline'
          ? 'mx-0.5 inline-flex max-w-none align-middle px-2 py-0.5 text-[10px] leading-tight'
          : 'max-w-[11rem] px-2.5 py-1 text-[11px]',
        className,
      )}
      variant={TIER_VARIANT[tier]}
    >
      {VERIFICATION_TIER_LABELS[tier]}
    </Badge>
  );
}
