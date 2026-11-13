import Image from "next/image";

import { mediaUrl } from "../../lib/api/media";

export function ManagedImage({
  mediaId,
  variant = "primary",
  alt,
  width,
  height,
  className,
}: {
  mediaId: string;
  variant?: "primary" | "thumbnail";
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <Image
      unoptimized
      src={mediaUrl(mediaId, variant)}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
