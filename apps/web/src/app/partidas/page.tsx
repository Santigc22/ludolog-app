import { MatchWorkspace } from "../../components/matches/match-workspace";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    gameId?: string;
    editionId?: string;
    copyId?: string;
  }>;
}) {
  const query = await searchParams;
  return (
    <main className="collections-layout">
      <MatchWorkspace
        initialGameId={query.gameId}
        initialEditionId={query.editionId}
        initialCopyId={query.copyId}
      />
    </main>
  );
}
