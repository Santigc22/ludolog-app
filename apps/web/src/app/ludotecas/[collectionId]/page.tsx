import { CollectionDetailWorkspace } from "../../../components/collections/collection-detail-workspace";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;

  return (
    <main className="collections-layout">
      <CollectionDetailWorkspace collectionId={collectionId} />
    </main>
  );
}
