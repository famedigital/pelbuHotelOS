"use client";

import {
  cloudinaryHlsUrl,
  cloudinaryVideoMp4Url,
  cloudinaryVideoPosterUrl,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import { useEffect, useRef } from "react";

type Props = {
  publicId: string;
  alt?: string;
  posterPublicId?: string | null;
  className?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  /** When true, fills the parent (absolute inset-0). */
  fill?: boolean;
  /** Pause / resume when used in a carousel (defaults to true). */
  active?: boolean;
};

/**
 * Cloudinary video with automatic bandwidth adaptation.
 * Prefers HLS (`sp_auto`); falls back to progressive MP4 when HLS is not
 * supported. Uses hls.js on browsers that cannot play m3u8 natively.
 */
export function CloudinaryVideo({
  publicId,
  alt = "",
  posterPublicId,
  className,
  videoClassName,
  autoPlay = false,
  muted = true,
  loop = true,
  controls = false,
  playsInline = true,
  fill = false,
  active = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsUrl = cloudinaryHlsUrl(publicId);
  const mp4Url = cloudinaryVideoMp4Url(publicId, { width: 1920 });
  const poster =
    cloudinaryVideoPosterUrl(posterPublicId || publicId, {
      width: 1600,
      height: 1000,
      crop: "fill",
    }) ?? undefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    let hls: Hls | null = null;
    const canNative = video.canPlayType("application/vnd.apple.mpegurl");

    if (canNative) {
      video.src = hlsUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (mp4Url) {
      video.src = mp4Url;
    }

    return () => {
      hls?.destroy();
    };
  }, [hlsUrl, mp4Url, publicId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    if (autoPlay) {
      void video.play().catch(() => {
        // Autoplay can be blocked until a gesture; muted + playsInline covers
        // most mobile browsers, so a rejection here is non-fatal.
      });
    }
  }, [active, autoPlay]);

  const video = (
    <video
      ref={videoRef}
      className={cn(
        fill ? "absolute inset-0 h-full w-full object-cover" : "h-full w-full object-cover",
        videoClassName,
      )}
      poster={poster}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      autoPlay={autoPlay}
      aria-label={alt || undefined}
      preload="metadata"
    >
      {mp4Url ? <source src={mp4Url} type="video/mp4" /> : null}
    </video>
  );

  if (fill) {
    return <div className={cn("absolute inset-0 overflow-hidden", className)}>{video}</div>;
  }
  return <div className={cn("relative overflow-hidden", className)}>{video}</div>;
}
