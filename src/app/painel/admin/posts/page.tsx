import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { listPostListings } from '@/lib/posts/postListingRepository';
import { createPostListingAction, updatePostListingTextAction, deletePostListingAction } from './actions';

export default async function PostsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    redirect('/painel');
  }

  const listings = await listPostListings();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-6 text-xl font-bold text-nathai-ink">Posts com Imóvel</h1>
      <p className="mb-4 text-sm text-nathai-ink/60">
        Vincule um PDF a um post do Instagram. Quando alguém comentar nesse post e a conversa
        evoluir pra DM, a IA vai ter as informações do PDF como contexto durante toda a conversa.
      </p>
      <form
        action={createPostListingAction}
        encType="multipart/form-data"
        className="mb-8 space-y-3 rounded-2xl border border-nathai-mist bg-white p-4 shadow-card"
      >
        <input
          name="postUrl"
          type="url"
          required
          placeholder="Link do post (ex: https://www.instagram.com/p/ABC123/)"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2 font-display text-sm font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
        >
          Vincular PDF ao post
        </button>
      </form>
      <ul className="space-y-4">
        {listings.map((listing) => (
          <li key={listing.id} className="rounded-2xl border border-nathai-mist bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <a
                href={listing.postUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-nathai-blue hover:underline"
              >
                {listing.postUrl}
              </a>
              <form action={deletePostListingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  Remover
                </button>
              </form>
            </div>
            {!listing.propertyText && (
              <p className="mb-2 text-xs font-medium text-nathai-amber">
                Texto vazio — não conseguimos extrair do PDF. Digite manualmente abaixo.
              </p>
            )}
            <form action={updatePostListingTextAction} className="space-y-2">
              <input type="hidden" name="mediaId" value={listing.mediaId} />
              <input type="hidden" name="postUrl" value={listing.postUrl} />
              <textarea
                name="propertyText"
                defaultValue={listing.propertyText}
                rows={6}
                placeholder="Texto do imóvel (preço, metragem, condições...)"
                className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-nathai-blue to-nathai-cyan px-3 py-1 font-display text-sm font-medium text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
              >
                Salvar texto
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
