import React from 'react';

export interface TeamBadgeProps {
  team?: {
    badge?: string;
    shortName?: string;
    logoUrl?: string;
    name?: string;
    color?: string;
  } | null;
  className?: string;
  textClassName?: string;
  alt?: string;
}

/**
 * Universal Team Badge & Logo Component
 * - If team has uploaded logoUrl or badge is an image URL/data URI, displays the crisp image logo.
 * - Otherwise falls back to team's themed background color with bold shortName / badge text.
 */
export default function TeamBadge({
  team,
  className = "w-8 h-8 rounded-xl",
  textClassName = "",
  alt
}: TeamBadgeProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  // Check if logo exists as custom upload or image link
  const rawImage = team?.logoUrl || team?.badge;
  const isImage = !imageFailed && Boolean(
    rawImage && (
      rawImage.startsWith('data:image/') ||
      rawImage.startsWith('blob:') ||
      rawImage.startsWith('http://') ||
      rawImage.startsWith('https://') ||
      rawImage.startsWith('/')
    )
  );

  if (!team) {
    return (
      <div className={`bg-[#540816] text-[#ffd700] font-black flex items-center justify-center ${className}`}>
        SPL
      </div>
    );
  }

  if (isImage && rawImage) {
    return (
      <div className={`overflow-hidden flex items-center justify-center flex-shrink-0 bg-white border border-[#cfa027]/40 shadow-sm ${className}`}>
        <img
          src={rawImage}
          alt={alt || team.name || team.shortName || 'Team Logo'}
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`font-display font-black flex items-center justify-center text-white shadow-sm flex-shrink-0 select-none ${className}`}
      style={{ backgroundColor: team.color || '#540816' }}
      title={team.name}
    >
      <span className={textClassName || "leading-none"}>
        {team.badge && !team.badge.startsWith('data:') && !team.badge.startsWith('http') && !team.badge.startsWith('/')
          ? team.badge
          : (team.shortName || 'SPL')}
      </span>
    </div>
  );
}
