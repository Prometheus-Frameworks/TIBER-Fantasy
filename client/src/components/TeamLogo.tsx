import React from "react";

type Props = { team: string; size?: number; className?: string };

export const TeamLogo: React.FC<Props> = ({ team, size = 24, className }) => {
  const src = `/logos/${team}.svg`;
  const [err, setErr] = React.useState(false);

  if (err) {
    // Fallback badge (no logo file yet)
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-gray-700 ${className || ""}`}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.45)) }}
        title={team}
      >
        {team}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${team} logo`}
      width={size}
      height={size}
      className={`inline-block ${className || ""}`}
      onError={() => setErr(true)}
      title={team}
    />
  );
};