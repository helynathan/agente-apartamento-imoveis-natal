import { recordPendingCommentContext } from '@/lib/posts/pendingCommentContextRepository';

export async function POST(request: Request, { params }: { params: { secret: string } }) {
  if (params.secret !== process.env.WEBHOOK_SECRET) {
    return Response.json({ ok: true, ignored: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.warn('Instagram comment webhook: malformed JSON body, discarding', error);
    return Response.json({ ok: true, ignored: true });
  }

  const body = payload as Record<string, unknown>;
  const commenterId = body.commenterId;
  const mediaId = body.mediaId;

  if (typeof commenterId !== 'string' || commenterId.length === 0) {
    return Response.json({ ok: true, ignored: true });
  }
  if (typeof mediaId !== 'string' || mediaId.length === 0) {
    return Response.json({ ok: true, ignored: true });
  }

  await recordPendingCommentContext({ commenterId, mediaId });

  return Response.json({ ok: true });
}
