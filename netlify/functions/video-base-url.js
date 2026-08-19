const normalizeBaseUrl = (value) => value.trim().replace(/\/+$/, '');

export default async () => {
  const videoBaseUrl = normalizeBaseUrl(process.env.VITE_VIDEO_BASE_URL ?? '');

  return new Response(
    JSON.stringify({
      configured: Boolean(videoBaseUrl),
      videoBaseUrl,
    }),
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};
